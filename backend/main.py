# backend/main.py
from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel
from typing import List, Dict, Any

import yt_dlp
import os
import uuid
import zipfile
import json
import asyncio
import time
import re
import shutil
from concurrent.futures import ThreadPoolExecutor

app = FastAPI(title="YouTube Playlist Downloader")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DOWNLOAD_DIR = "downloads"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

tasks: Dict[str, Dict[str, Any]] = {}

executor = ThreadPoolExecutor(max_workers=3)


class DownloadRequest(BaseModel):
    urls: List[str]
    download_type: str = "video"


def sanitize_filename(name: str) -> str:
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    name = re.sub(r'\s+', " ", name).strip()
    return name[:150] or "Untitled_Playlist"


@app.get("/")
def root():
    return {"message": "API running"}


# ---------------- PLAYLIST INFO (NEW) ---------------- #

@app.get("/info")
def get_info(url: str):
    ydl_opts = {
        "quiet": True,
        "extract_flat": False
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    def format_duration(seconds):
        if not seconds:
            return "0:00"
        m, s = divmod(int(seconds), 60)
        h, m = divmod(m, 60)
        return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"

    playlist_title = info.get("title") or info.get("playlist_title") or "Playlist"

    videos = []

    if "entries" in info:
        for v in info["entries"]:
            if not v:
                continue

            video_url = v.get("webpage_url") or (
                f"https://www.youtube.com/watch?v={v.get('id')}" if v.get("id") else None
            )

            if not video_url:
                continue

            videos.append({
                "title": v.get("title", "Untitled"),
                "url": video_url,
                "thumbnail": v.get("thumbnail"),
                "duration": format_duration(v.get("duration")),
            })
    else:
        videos.append({
            "title": info.get("title", "Untitled"),
            "url": info.get("webpage_url"),
            "thumbnail": info.get("thumbnail"),
            "duration": format_duration(info.get("duration")),
        })

    return {
        "playlist_title": playlist_title,
        "total_videos": len(videos),
        "videos": videos
    }


# ---------------- DOWNLOAD START ---------------- #

@app.post("/download")
def start_download(request: DownloadRequest):
    if not request.urls:
        raise HTTPException(status_code=400, detail="No URLs provided")

    task_id = str(uuid.uuid4())
    folder = os.path.join(DOWNLOAD_DIR, task_id)
    os.makedirs(folder, exist_ok=True)

    tasks[task_id] = {
        "status": "queued",
        "overall_progress": 0,
        "current_video_progress": 0,
        "current_video_title": None,
        "downloaded_videos": 0,
        "total_videos": len(request.urls),  # ✅ accurate for selected items
        "playlist_title": "Fetching info...",
        "failed_count": 0,
        "error": None,
        "file": None,
        "download_type": request.download_type,
        "speed": None,
        "eta": None,
        "task_folder": folder,
    }

    executor.submit(process_download, task_id, request.urls, folder, request.download_type)

    return {"task_id": task_id}


# ---------------- DOWNLOAD PROCESS ---------------- #

def process_download(task_id: str, urls: List[str], folder: str, download_type: str):
    task = tasks[task_id]

    try:
        task["status"] = "downloading"

        with yt_dlp.YoutubeDL({"quiet": True, "extract_flat": True}) as ydl:
            info = ydl.extract_info(urls[0], download=False)
            raw_title = info.get("title") or info.get("playlist_title") or "Playlist"
            playlist_title = sanitize_filename(raw_title)

            task["playlist_title"] = raw_title

        downloaded_count = 0

        def progress_hook(d):
            nonlocal downloaded_count

            if d["status"] == "downloading":
                try:
                    percent = float(d.get("_percent_str", "0%").replace("%", "").strip())
                except:
                    percent = 0

                task["current_video_progress"] = percent
                task["current_video_title"] = d.get("info_dict", {}).get("title")
                task["speed"] = d.get("speed")
                task["eta"] = d.get("eta")

                if task["total_videos"] > 0:
                    base = (downloaded_count / task["total_videos"]) * 100
                    task["overall_progress"] = round(base + (percent / task["total_videos"]), 1)

            elif d["status"] == "finished":
                downloaded_count += 1
                task["downloaded_videos"] = downloaded_count
                task["speed"] = None
                task["eta"] = None

                if task["total_videos"] > 0:
                    task["overall_progress"] = round((downloaded_count / task["total_videos"]) * 100, 1)

        base_opts = {
            "outtmpl": f"{folder}/%(title)s.%(ext)s",
            "progress_hooks": [progress_hook],
            "ignoreerrors": True,
            "concurrent_fragment_downloads": 5,
        }

        if download_type == "audio":
            base_opts.update({
                "format": "bestaudio/best",
                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192"
                }]
            })
        elif download_type == "both":
            base_opts.update({
                "format": "bestvideo+bestaudio/best",
                "merge_output_format": "mp4",
                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192"
                }]
            })
        else:
            base_opts.update({
                "format": "bestvideo+bestaudio/best",
                "merge_output_format": "mp4"
            })

        with yt_dlp.YoutubeDL(base_opts) as ydl:
            ydl.download(urls)

        task["status"] = "zipping"
        task["overall_progress"] = 95
        task["current_video_title"] = "Creating ZIP..."

        zip_filename = f"{playlist_title}.zip"
        zip_path = os.path.join(folder, zip_filename)

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
            for root, _, files in os.walk(folder):
                for file in files:
                    if not file.endswith(".zip"):
                        z.write(os.path.join(root, file), arcname=file)

        task["file"] = zip_path

        task["status"] = "done"
        task["overall_progress"] = 100
        task["current_video_progress"] = 100
        task["current_video_title"] = "Download complete"

    except Exception as e:
        task["status"] = "error"
        task["error"] = str(e)


# ---------------- FILE DOWNLOAD ---------------- #

from fastapi import BackgroundTasks

@app.get("/file/{task_id}")
def get_file(task_id: str, background_tasks: BackgroundTasks):
    if task_id not in tasks:
        raise HTTPException(404, "Task not found")

    task = tasks[task_id]

    if task["status"] != "done" or not task.get("file"):
        raise HTTPException(400, "File not ready")

    file_path = task["file"]
    folder = task.get("task_folder")

    filename = sanitize_filename(task.get("playlist_title", "Playlist"))

    # ✅ Background cleanup function
    def cleanup():
        try:
            time.sleep(60)  # wait 1 minute before deleting
            if folder and os.path.exists(folder):
                shutil.rmtree(folder, ignore_errors=True)

            # remove task from memory
            if task_id in tasks:
                del tasks[task_id]

        except Exception as e:
            print(f"Cleanup error for task {task_id}: {e}")

    # ✅ Schedule cleanup AFTER response is sent
    background_tasks.add_task(cleanup)

    return FileResponse(
        path=file_path,
        filename=f"{filename}.zip",
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}.zip"'
        }
    )

# ---------------- PROGRESS ---------------- #

@app.get("/progress/{task_id}")
def get_progress(task_id: str):
    if task_id not in tasks:
        raise HTTPException(404)
    return tasks[task_id]


# ---------------- WEBSOCKET ---------------- #

@app.websocket("/ws/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    await websocket.accept()

    try:
        while True:
            if task_id not in tasks:
                await websocket.send_text(json.dumps({"status": "error"}))
                break

            task = tasks[task_id]

            payload = {
                "status": task["status"],
                "overall_progress": task["overall_progress"],
                "current_video_progress": task.get("current_video_progress"),
                "current_video_title": task.get("current_video_title"),
                "downloaded_videos": task.get("downloaded_videos"),
                "total_videos": task.get("total_videos"),
                "failed_count": task.get("failed_count"),
                "playlist_title": task.get("playlist_title"),
                "error": task.get("error"),
                "download_type": task.get("download_type"),
                "speed": task.get("speed"),
                "eta": task.get("eta"),
            }

            await websocket.send_text(json.dumps(payload))

            if task["status"] in ["done", "error", "cancelled"]:
                await asyncio.sleep(0.5)
                await websocket.send_text(json.dumps(payload))
                break

            await asyncio.sleep(0.5)

    finally:
        await websocket.close()


# ---------------- CLEANUP ---------------- #

@app.get("/cleanup")
def cleanup():
    removed = 0
    for tid in list(tasks.keys()):
        if tasks[tid]["status"] in ["done", "error"]:
            folder = tasks[tid].get("task_folder")
            if folder and os.path.exists(folder):
                shutil.rmtree(folder, ignore_errors=True)
            del tasks[tid]
            removed += 1

    return {"removed": removed}