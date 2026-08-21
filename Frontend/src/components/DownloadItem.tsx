// frontend/src/components/DownloadItem.tsx
import { useEffect, useRef } from "react";
import ProgressBar from "./ProgressBar";
import { type DownloadTask } from "../types/types";
import { getFileUrl, getProgressUrl, getWsUrl } from "../api";

type Props = {
  task: DownloadTask;
  updateTask: (id: string, data: Partial<DownloadTask>) => void;
};

export default function DownloadItem({ task, updateTask }: Props) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryCount = useRef(0);

  // WebSocket connection
  useEffect(() => {
    if (["done", "error", "cancelled"].includes(task.status)) return;

    const connect = () => {
      if (wsRef.current) return;

      const ws = new WebSocket(getWsUrl(task.id));
      wsRef.current = ws;

      ws.onopen = () => {
        retryCount.current = 0;
        console.log("WebSocket connected:", task.id);
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          updateTask(task.id, data);
        } catch (err) {
          console.error("WS parse error:", err);
        }
      };

      ws.onerror = () => {
        console.warn("WebSocket error");
        ws.close();
      };

      ws.onclose = () => {
        wsRef.current = null;

        // Retry a few times if still active
        if (
          !["done", "error", "cancelled"].includes(task.status) &&
          retryCount.current < 5
        ) {
          retryCount.current += 1;
          setTimeout(connect, 1500 * retryCount.current);
        }
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [task.id]);

  // Fallback polling when near completion
  useEffect(() => {
    if (task.overall_progress < 90 || task.status === "done") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(getProgressUrl(task.id));
        if (!res.ok) return;
        const data = await res.json();
        updateTask(task.id, data);

        if (["done", "error", "cancelled"].includes(data.status)) {
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [task.overall_progress, task.status]);

  const isDone = task.status === "done";
  const isError = task.status === "error" || task.status === "cancelled";
  const isActive = ["queued", "downloading", "processing", "zipping"].includes(
    task.status
  );

  const getDownloadTypeLabel = () => {
    switch (task.download_type) {
      case "audio":
        return "Audio (MP3)";
      case "both":
        return "Video + Audio";
      default:
        return "Video (MP4)";
    }
  };

  const formatSpeed = (speed?: number | null) => {
    if (!speed) return "";
    const kb = speed / 1024;
    return kb >= 1024
      ? `${(kb / 1024).toFixed(1)} MB/s`
      : `${kb.toFixed(1)} KB/s`;
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(getFileUrl(task.id));
      if (!res.ok) throw new Error("File not ready");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${task.playlist_title || "playlist"}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Download failed – file may still be preparing");
    }
  };

  return (
    <div
      className={`rounded-2xl border p-6 shadow-sm transition-all ${
        isDone
          ? "bg-green-50 border-green-200"
          : isError
          ? "bg-red-50 border-red-200"
          : "bg-white border-gray-200 hover:shadow-md"
      }`}
    >
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-5">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg text-gray-900 truncate">
            {task.playlist_title || `Task ${task.id.slice(0, 8)}...`}
          </h3>

          <div className="flex flex-wrap gap-2 mt-2">
            <span
              className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                isDone
                  ? "bg-green-100 text-green-800"
                  : isError
                  ? "bg-red-100 text-red-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
            </span>

            <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              {getDownloadTypeLabel()}
            </span>

            {task.video_quality && task.download_type !== "audio" && (
              <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                {task.video_quality}
              </span>
            )}

            {task.total_videos > 0 && (
              <span className="text-sm text-gray-600 self-center">
                {task.downloaded_videos ?? 0} / {task.total_videos}
              </span>
            )}
          </div>

          {task.current_video_title && isActive && (
            <p className="mt-3 text-sm text-gray-700 truncate">
              {task.current_video_title}
            </p>
          )}

          {isError && task.error && (
            <p className="mt-2 text-sm text-red-600">{task.error}</p>
          )}
        </div>

        <div className="flex gap-3">
          {isDone && (
            <button
              onClick={handleDownload}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition shadow-sm"
            >
              Download ZIP
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-6">
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1.5">
            <span>Overall Progress</span>
            <span className="font-medium">
              {Math.round(task.overall_progress ?? 0)}%
            </span>
          </div>
          <ProgressBar progress={`${task.overall_progress ?? 0}%`} />
        </div>

        {isActive && (task.current_video_progress ?? 0) > 0 && (
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1.5">
              <span>Current Item</span>
              <div className="flex items-center gap-3">
                <span>{Math.round(task.current_video_progress ?? 0)}%</span>
                {task.speed && (
                  <span className="text-green-600 text-xs font-medium">
                    {formatSpeed(task.speed)}
                  </span>
                )}
              </div>
            </div>
            <ProgressBar progress={`${task.current_video_progress ?? 0}%`} />
          </div>
        )}
      </div>
    </div>
  );
}