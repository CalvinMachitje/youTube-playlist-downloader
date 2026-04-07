// frontend/src/components/DownloadItem.tsx
import { useEffect, useRef, useState } from "react";
import ProgressBar from "./ProgressBar";
import { type DownloadTask } from "../types/types";
import { getFileUrl } from "../api";

type Props = {
  task: DownloadTask;
  updateTask: (id: string, data: Partial<DownloadTask>) => void;
};

export default function DownloadItem({ task, updateTask }: Props) {
  const wsRef = useRef<WebSocket | null>(null);
  const [, setIsConnecting] = useState(false);

  const connectWebSocket = () => {
    if (wsRef.current) return;
    if (["done", "error", "cancelled"].includes(task.status)) return;

    setIsConnecting(true);

    const connect = () => {
      const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${task.id}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnecting(false);
        console.log("WebSocket connected");
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
        console.warn("WebSocket error, retrying...");
        ws.close();
      };

      ws.onclose = () => {
        wsRef.current = null;

        // 🔁 Retry if still active
        if (!["done", "error", "cancelled"].includes(task.status)) {
          setTimeout(connect, 1000);
        }
      };
    };

    connect();
  };

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [task.id]);

  // ✅ FALLBACK: Poll when stuck near completion
  useEffect(() => {
    if (task.overall_progress >= 95 && task.status !== "done") {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`http://127.0.0.1:8000/progress/${task.id}`);
          const data = await res.json();
          updateTask(task.id, data);

          if (data.status === "done") clearInterval(interval);
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [task.overall_progress]);

  const isDone = task.status === "done";
  const isError = task.status === "error" || task.status === "cancelled";
  const isActive = ["queued", "downloading", "processing", "cancelling"].includes(task.status);

  const getDownloadTypeLabel = () => {
    switch (task.download_type) {
      case "audio": return "Audio (MP3)";
      case "both": return "Video + Audio";
      default: return "Video (MP4)";
    }
  };

  const formatSpeed = (speed: number | null | undefined) => {
    if (!speed) return "";
    const kb = speed / 1024;
    return kb >= 1024 
      ? `${(kb / 1024).toFixed(1)} MB/s` 
      : `${kb.toFixed(1)} KB/s`;
  };

  const handleCancel = () => {
    if (confirm("Cancel this download?")) {
      fetch(`http://127.0.0.1:8000/cancel/${task.id}`, { method: "POST" })
        .then(() => updateTask(task.id, { status: "cancelling" }))
        .catch(() => alert("Failed to cancel task"));
    }
  };

  // ✅ IMPROVED DOWNLOAD (blob → triggers Save dialog)
  const handleDownload = async () => {
    try {
      const res = await fetch(getFileUrl(task.id));
      const blob = await res.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${task.playlist_title || "playlist"}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error(err);
      alert("Download failed");
    }
  };

  return (
    <div
      className={`rounded-2xl border p-6 shadow-sm transition-all ${
        isDone ? "bg-green-50 border-green-200" :
        isError ? "bg-red-50 border-red-200" : 
        "bg-white border-gray-200 hover:shadow-md"
      }`}
    >
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-5">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg text-gray-900 truncate">
            {task.playlist_title || `Task ${task.id.slice(0, 8)}...`}
          </h3>

          <div className="flex flex-wrap gap-2 mt-2">
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
              isDone ? "bg-green-100 text-green-800" :
              isError ? "bg-red-100 text-red-800" :
              "bg-blue-100 text-blue-800"
            }`}>
              {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
            </span>

            <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              {getDownloadTypeLabel()}
            </span>

            {task.total_videos > 0 && (
              <span className="text-sm text-gray-600 self-center">
                {task.downloaded_videos} / {task.total_videos}
              </span>
            )}
          </div>

          {task.current_video_title && isActive && (
            <p className="mt-3 text-sm text-gray-700 truncate">
              {task.current_video_title}
            </p>
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

          {isActive && (
            <button
              onClick={handleCancel}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition shadow-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-6">
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1.5">
            <span>Overall Progress</span>
            <span className="font-medium">{Math.round(task.overall_progress)}%</span>
          </div>
          <ProgressBar progress={`${task.overall_progress}%`} />
        </div>

        {isActive && task.current_video_progress > 0 && (
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1.5">
              <span>Current Item</span>
              <div className="flex items-center gap-3">
                <span>{Math.round(task.current_video_progress)}%</span>
                {task.speed && (
                  <span className="text-green-600 text-xs font-medium">
                    {formatSpeed(task.speed)}
                  </span>
                )}
              </div>
            </div>
            <ProgressBar progress={`${task.current_video_progress}%`} />
          </div>
        )}
      </div>
    </div>
  );
}