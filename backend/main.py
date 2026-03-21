from fastapi import FastAPI, BackgroundTasks, HTTPException, WebSocket
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel
from typing import List

import yt_dlp
import os
import uuid
import zipfile
import json
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
    urls = request.urls

    if not urls:
        raise HTTPException(status_code=400, detail="No URLs provided")

    task_id = str(uuid.uuid4())

    task_folder = os.path.join(DOWNLOAD_DIR, task_id)
    os.makedirs(task_folder, exist_ok=True)

    tasks[task_id] = {
        "status": "queued",
        "progress": 0,
        "file": None,
        "error": None,
    }

    background_tasks.add_task(process_download, task_id, urls, task_folder)

    return {"task_id": task_id}


# =========================
# Background worker
# =========================
def process_download(task_id, urls, folder):
    try:
        tasks[task_id]["status"] = "downloading"

        def progress_hook(d):
            if d["status"] == "downloading":
                percent_str = d.get("_percent_str", "0%").strip().replace("%", "")
                try:
                    percent = float(percent_str)
                except:
                    percent = 0

                tasks[task_id]["progress"] = percent

        ydl_opts = {
            "outtmpl": f"{folder}/%(title)s.%(ext)s",
            "format": "bestvideo+bestaudio/best",
            "progress_hooks": [progress_hook],
            "ignoreerrors": True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download(urls)

        tasks[task_id]["status"] = "processing"

        zip_path = os.path.join(folder, "output.zip")

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
            for root, _, files in os.walk(folder):
                for file in files:
                    if file != "output.zip":
                        full_path = os.path.join(root, file)
                        z.write(full_path, arcname=file)

        tasks[task_id]["file"] = zip_path
        tasks[task_id]["status"] = "done"
        tasks[task_id]["progress"] = 100

    except Exception as e:
        tasks[task_id]["status"] = "error"
        tasks[task_id]["error"] = str(e)


# =========================
# Progress endpoint (REST fallback)
# =========================
@app.get("/progress/{task_id}")
def get_progress(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    return tasks[task_id]


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
    await websocket.accept()

    try:
        while True:
            if task_id not in tasks:
                await websocket.send_text(json.dumps({
                    "status": "error",
                    "message": "Task not found"
                }))
                break

            task = tasks[task_id]

            await websocket.send_text(json.dumps({
                "status": task["status"],
                "progress": task["progress"],
                "error": task["error"],
            }))

            if task["status"] in ["done", "error"]:
                break

            # Avoid tight loop (important!)
            await asyncio.sleep(1)

    except Exception:
        pass
    finally:
        await websocket.close()