from celery import Celery # type: ignore

celery_app = Celery(
    "yt_downloader",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0"
)

celery_app.conf.task_track_started = True