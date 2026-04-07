// This file defines the TypeScript interface for a download task, which includes an id, status, and progress. This interface is used across the frontend components to ensure type safety when handling download tasks.
// frontend/src/types/types.ts
export interface DownloadTask {
  id: string;
  status: "queued" | "downloading" | "zipping" | "processing" | "done" | "error" | "cancelling" | "cancelled";
  overall_progress: number;
  current_video_progress: number;
  current_video_title: string | null;
  downloaded_videos: number;
  total_videos: number;
  failed_count: number;
  playlist_title?: string;
  error?: string | null;
  download_type?: "video" | "audio" | "both";
  speed?: number | null;
  task_folder?: string;
}