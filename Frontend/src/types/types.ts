// frontend/src/types/types.ts

export interface DownloadTask {
  id: string;
  status:
    | "queued"
    | "downloading"
    | "zipping"
    | "processing"
    | "done"
    | "error"
    | "cancelling"
    | "cancelled";

  overall_progress: number;
  current_video_progress: number;
  current_video_title: string | null;

  downloaded_videos: number;
  total_videos: number;
  failed_count?: number;

  playlist_title?: string;
  error?: string | null;

  download_type?: "video" | "audio" | "both";
  video_quality?: string;           // ← added (best, 1080p, 720p...)

  speed?: number | null;
  eta?: number | null;
  task_folder?: string;
}