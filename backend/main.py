import threading
from threading import Event
from fastapi import FastAPI, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel
from typing import List

import yt_dlp
import os
import uuid
import zipfile
import asyncio

app = FastAPI()

# =========================
# CORS
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# Config
# =========================
DOWNLOAD_DIR = "downloads"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# In-memory task store (replace with Redis in production)
tasks = {}


# =========================
# Request Schema
# =========================
class DownloadRequest(BaseModel):
    urls: List[str]


# =========================
# Root
# =========================
@app.get("/")
def root():
    return {"message": "Production YouTube Downloader API"}


# =========================
# Info endpoint
# =========================
@app.get("/info")
def get_info(url: str):
    with yt_dlp.YoutubeDL({"quiet": True}) as ydl:
        info = ydl.extract_info(url, download=False)

    def format_duration(seconds):
        if not seconds:
            return "0:00"
        m, s = divmod(seconds, 60)
        h, m = divmod(m, 60)
        return f"{h}:{m:02}:{s:02}" if h else f"{m}:{s:02}"

    if "entries" in info:
        videos = [
            {
                "title": v["title"],
                "url": v["webpage_url"],
                "thumbnail": v.get("thumbnail"),
                "duration": format_duration(v.get("duration")),
            }
            for v in info["entries"] if v
        ]
    else:
        videos = [
            {
                "title": info["title"],
                "url": info["webpage_url"],
                "thumbnail": info.get("thumbnail"),
                "duration": format_duration(info.get("duration")),
            }
        ]

    return {"videos": videos}


# =========================
# Start download job
# =========================
@app.post("/download")
def start_download(request: DownloadRequest, background_tasks: BackgroundTasks):
    print(">>> POST /download called")
    print("URLs received:", request.urls)

    urls = request.urls
    if not urls:
        raise HTTPException(status_code=400, detail="No URLs provided")

    task_id = str(uuid.uuid4())
    task_folder = os.path.join(DOWNLOAD_DIR, task_id)
    os.makedirs(task_folder, exist_ok=True)

    # Try to detect playlist metadata
    total_videos = len(urls)  # fallback
    playlist_title = None

    try:
        with yt_dlp.YoutubeDL({"quiet": True, "extract_flat": True}) as ydl:
            info = ydl.extract_info(urls[0] if len(urls) == 1 else urls, download=False)
            if "entries" in info:
                total_videos = len(info["entries"])
                playlist_title = info.get("title", "Playlist")
    except Exception as e:
        print(f"Playlist metadata extraction failed: {e}")

    tasks[task_id] = {
        "status": "queued",
        "overall_progress": 0.0,
        "current_video_progress": 0.0,
        "current_video_title": None,
        "downloaded_videos": 0,
        "total_videos": total_videos,
        "failed_videos": [],
        "file": None,
        "error": None,
        "playlist_title": playlist_title,
        "stop_event": Event(),
        "download_thread": None,
    }

    background_tasks.add_task(process_download, task_id, urls, task_folder)

    print(f">>> Task created: {task_id} | {total_videos} videos")

    return {
        "task_id": task_id,
        "total_videos": total_videos,
        "playlist_title": playlist_title,
    }


# =========================
# Background worker
# =========================
def process_download(task_id: str, urls: list[str], folder: str):
    if task_id not in tasks:
        print(f"Task {task_id} disappeared before processing")
        return

    task = tasks[task_id]
    stop_event = task["stop_event"]

    print(f">>> Starting download for task {task_id}")

    try:
        task["status"] = "downloading"
        task["current_video_title"] = "Preparing download..."
        task["current_video_progress"] = 0
        task["downloaded_videos"] = 0
        task["overall_progress"] = 0

        def progress_hook(d):
            if stop_event.is_set():
                raise Exception("Download cancelled by user")

            if d["status"] == "downloading":
                percent_str = d.get("_percent_str", "0%").rstrip("%")
                try:
                    percent = float(percent_str)
                except ValueError:
                    percent = 0.0

                filename = d.get("filename", "Unknown video")
                display_name = os.path.basename(filename).rsplit(".", 1)[0] if "." in filename else filename

                task["current_video_title"] = display_name
                task["current_video_progress"] = percent

            elif d["status"] == "finished":
                task["downloaded_videos"] += 1
                total = task["total_videos"]
                if total > 0:
                    overall = (task["downloaded_videos"] / total) * 100
                    task["overall_progress"] = round(overall, 1)
                task["current_video_progress"] = 100
                task["current_video_title"] = "Video completed"

            elif d["status"] == "error":
                failed_file = d.get("filename", "Unknown")
                task["failed_videos"].append(os.path.basename(failed_file))

        ydl_opts = {
            "outtmpl": f"{folder}/%(title)s.%(ext)s",
            "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best",
            "merge_output_format": "mp4",
            "progress_hooks": [progress_hook],
            "ignoreerrors": True,
            "continuedl": True,
            "noplaylist": False,
        }

        def run_yt_dlp():
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    if stop_event.is_set():
                        return
                    ydl.download(urls)
            except Exception as e:
                if "cancelled" in str(e).lower():
                    task["status"] = "cancelled"
                    task["error"] = "Download cancelled by user"
                else:
                    task["status"] = "error"
                    task["error"] = str(e)

        thread = threading.Thread(target=run_yt_dlp, daemon=True)
        task["download_thread"] = thread
        thread.start()

        thread.join()

        if task["status"] in ["cancelled", "error"]:
            print(f"Task {task_id} stopped ({task['status']})")
            # Optional: cleanup partial downloads
            # import shutil
            # shutil.rmtree(folder, ignore_errors=True)
            return

        # Zipping phase
        task["status"] = "zipping"
        task["current_video_title"] = "Creating ZIP archive..."
        task["current_video_progress"] = 0
        task["overall_progress"] = 95

        zip_path = os.path.join(folder, "playlist_download.zip")

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
            for root, _, files in os.walk(folder):
                for file in files:
                    if file == "playlist_download.zip":
                        continue
                    full_path = os.path.join(root, file)
                    arcname = os.path.relpath(full_path, folder)
                    z.write(full_path, arcname=arcname)

        task["file"] = zip_path
        task["status"] = "done"
        task["overall_progress"] = 100
        task["current_video_progress"] = 100
        task["current_video_title"] = "Download complete"

        print(f">>> Task {task_id} completed successfully")

    except Exception as e:
        task["status"] = "error"
        task["error"] = str(e)
        task["current_video_title"] = "Error occurred"
        print(f"!!! Error in process_download for {task_id}: {e}")


# =========================
# Cancel download endpoint
# =========================
@app.post("/cancel/{task_id}")
async def cancel_download(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    task = tasks[task_id]

    if task["status"] not in ["queued", "downloading"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel task in status: {task['status']}")

    task["stop_event"].set()
    task["status"] = "cancelling"

    print(f">>> Cancellation requested for task {task_id}")

    return {"message": "Cancellation requested", "task_id": task_id}


# =========================
# Download completed file
# =========================
@app.get("/file/{task_id}")
def get_file(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    task = tasks[task_id]

    if task["status"] != "done":
        raise HTTPException(status_code=400, detail="File not ready")

    return FileResponse(
        path=task["file"],
        filename="playlist.zip",
        media_type="application/zip"
    )


# =========================
# WebSocket for real-time updates
# =========================
@app.websocket("/ws/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    print(f">>> WS: New connection attempt for task {task_id}")
    
    try:
        await websocket.accept()
        print(f">>> WS: Accepted connection for {task_id}")

        # Send initial state right away (critical for fast-finished tasks)
        if task_id not in tasks:
            print(f">>> WS: Task {task_id} not found at accept time")
            await websocket.send_json({
                "status": "not_found",
                "message": "Task not initialized yet — retrying later"
            })
        else:
            task = tasks[task_id]
            await websocket.send_json({
                "status": task.get("status", "unknown"),
                "overall_progress": round(task.get("overall_progress", 0), 1),
                "current_video_progress": round(task.get("current_video_progress", 0), 1),
                "current_video_title": task.get("current_video_title"),
                "downloaded_videos": task.get("downloaded_videos", 0),
                "total_videos": task.get("total_videos", 0),
                "failed_count": len(task.get("failed_videos", [])),
                "playlist_title": task.get("playlist_title"),
                "error": task.get("error"),
            })

        # Main loop — keep sending updates until client disconnects or task is terminal
        while True:
            if task_id not in tasks:
                print(f">>> WS: Task {task_id} disappeared during loop")
                await websocket.send_json({"status": "not_found", "message": "Task no longer exists"})
                break

            task = tasks[task_id]

            await websocket.send_json({
                "status": task.get("status", "unknown"),
                "overall_progress": round(task.get("overall_progress", 0), 1),
                "current_video_progress": round(task.get("current_video_progress", 0), 1),
                "current_video_title": task.get("current_video_title"),
                "downloaded_videos": task.get("downloaded_videos", 0),
                "total_videos": task.get("total_videos", 0),
                "failed_count": len(task.get("failed_videos", [])),
                "playlist_title": task.get("playlist_title"),
                "error": task.get("error"),
            })

            # If terminal state reached, send one final polished message and prepare to exit
            if task["status"] in ["done", "error", "cancelled", "cancelling"]:
                if task["status"] == "done":
                    await websocket.send_json({
                        "status": "done",
                        "overall_progress": 100.0,
                        "current_video_progress": 100.0,
                        "current_video_title": "Download complete – ZIP ready",
                        "downloaded_videos": task.get("total_videos", 0),
                        "total_videos": task.get("total_videos", 0),
                        "failed_count": task.get("failed_count", 0),
                    })
                # Do NOT break here — let client decide when to close (or timeout naturally)
            
            await asyncio.sleep(0.7)  # balanced refresh rate

    except WebSocketDisconnect:
        print(f">>> WS: Client disconnected normally from {task_id}")
    except RuntimeError as re:
        if "send" in str(re) and "close" in str(re):
            print(f">>> WS: Ignored known close race condition for {task_id}")
        else:
            print(f">>> WS: RuntimeError for {task_id}: {re}")
    except Exception as exc:
        print(f">>> WS: Unexpected error for {task_id}: {exc}")
    finally:
        # Safe close — only if not already closed
        try:
            if websocket.application_state != websocket.ApplicationState.DISCONNECTED:
                await websocket.close(code=1000, reason="Task finished or client disconnected")
        except Exception:
            pass
        print(f">>> WS: Connection fully terminated for {task_id}")