// src/components/DownloadItem.tsx
import { useEffect, useRef, useState } from "react";
import ProgressBar from "./ProgressBar";
import { type DownloadTask } from "../types/types";
import { getFileUrl, cancelDownload } from "../api";

type Props = {
  task: DownloadTask;
  updateTask: (id: string, data: Partial<DownloadTask>) => void;
};

export default function DownloadItem({ task, updateTask }: Props) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = () => {
    if (wsRef.current) return;
    if (!["queued", "downloading", "zipping"].includes(task.status)) return;

    setIsConnecting(true);
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${task.id}`);
    wsRef.current = ws;

    ws.onopen = () => setIsConnecting(false);
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        updateTask(task.id, {
          status: data.status,
          overall_progress: data.overall_progress ?? 0,
          current_video_progress: data.current_video_progress ?? 0,
          current_video_title: data.current_video_title ?? null,
          downloaded_videos: data.downloaded_videos ?? 0,
          total_videos: data.total_videos ?? 0,
          failed_count: data.failed_count ?? 0,
          playlist_title: data.playlist_title,
          error: data.error ?? null,
        });
      } catch {}
    };

    ws.onclose = () => {
      wsRef.current = null;
      setIsConnecting(false);
    };
  };

  useEffect(() => {
    if (task.status === "queued") {
      const t = setTimeout(connect, 800);
      return () => clearTimeout(t);
    }
    connect();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [task.status, task.id]);

  const handleCancel = async () => {
    if (!confirm("Cancel this download?")) return;
    try {
      await cancelDownload(task.id);
      updateTask(task.id, { status: "cancelling" });
    } catch (err) {
      alert("Cancel failed – may already be finished.");
    }
  };

  const isDone = task.status === "done";
  const isError = task.status === "error" || task.status === "cancelled";
  const isActive = ["queued", "downloading", "zipping"].includes(task.status);

  return (
    <div
      className={`rounded-2xl border p-6 mb-5 shadow-sm transition-all ${
        isDone
          ? "bg-green-50 border-green-200"
          : isError
          ? "bg-red-50 border-red-200"
          : "bg-white border-gray-200 hover:shadow-md"
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-5">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg text-gray-900 truncate">
            {task.playlist_title || `Task ${task.id.slice(0, 8)}...`}
          </h3>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                isDone
                  ? "bg-green-100 text-green-800"
                  : isError
                  ? "bg-red-100 text-red-800"
                  : isConnecting
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {isConnecting
                ? "Connecting..."
                : task.status === "cancelling"
                ? "Cancelling..."
                : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
            </span>

            {task.total_videos > 0 && isActive && (
              <span className="text-sm text-gray-600">
                {task.downloaded_videos} / {task.total_videos}
              </span>
            )}

            {task.failed_count > 0 && (
              <span className="text-red-600 text-sm">({task.failed_count} failed)</span>
            )}
          </div>

          {task.current_video_title && isActive && (
            <p className="mt-2 text-sm text-gray-700 truncate">
              {task.current_video_title}
            </p>
          )}
        </div>

        <div className="flex gap-3 flex-shrink-0">
          {isDone && (
            <a
              href={getFileUrl(task.id)}
              download
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium shadow-sm"
            >
              Download ZIP
            </a>
          )}

          {["queued", "downloading"].includes(task.status) && (
            <button
              onClick={handleCancel}
              className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium shadow-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-5">
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1.5">
            <span>Overall Progress</span>
            <span>{Math.round(task.overall_progress)}%</span>
          </div>
          <ProgressBar progress={`${task.overall_progress}%`} />
        </div>

        {isActive && task.current_video_progress > 0 && (
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1.5">
              <span>Current Video</span>
              <span>{Math.round(task.current_video_progress)}%</span>
            </div>
            <ProgressBar progress={`${task.current_video_progress}%`} />
          </div>
        )}
      </div>
    </div>
  );
}