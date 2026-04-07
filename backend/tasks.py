# This file contains the Celery task for downloading YouTube videos using yt-dlp.
# backend/tasks.py
from celery_worker import celery_app
import yt_dlp
import os

DOWNLOAD_DIR = "downloads"


@celery_app.task(bind=True)
def download_task(self, urls):
    task_id = self.request.id
    folder = os.path.join(DOWNLOAD_DIR, task_id)
    os.makedirs(folder, exist_ok=True)

    def progress_hook(d):
        if d["status"] == "downloading":
            percent = d.get("_percent_str", "0%").strip()
            self.update_state(
                state="PROGRESS",
                meta={"progress": percent}
            )

    ydl_opts = {
        "outtmpl": f"{folder}/%(title)s.%(ext)s",
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best",
        "merge_output_format": "mp4",
        "progress_hooks": [progress_hook],
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download(urls)

    return {"folder": folder}