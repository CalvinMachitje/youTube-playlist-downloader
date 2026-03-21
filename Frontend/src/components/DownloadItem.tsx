import { useEffect } from "react";
import ProgressBar from "./ProgressBar";
import { type DownloadTask } from "../types/types";
import { getFileUrl } from "../api";

type Props = {
  task: DownloadTask;
  updateTask: (id: string, data: Partial<DownloadTask>) => void;
};

export default function DownloadItem({ task, updateTask }: Props) {
  useEffect(() => {
    if (task.status === "done" || task.status === "error") return;

    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${task.id}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      updateTask(task.id, {
        status: data.status,
        progress: `${data.progress ?? 0}%`,
      });
    };

    ws.onerror = () => {
      updateTask(task.id, { status: "error" });
    };

    return () => ws.close();
  }, [task.id]);

  return (
    <div className="bg-white shadow rounded-xl p-4 mb-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="font-semibold">Task: {task.id}</p>
          <p className="text-sm text-gray-500">{task.status}</p>
        </div>

        {task.status === "done" && (
          <a
            href={getFileUrl(task.id)}
            className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm"
          >
            Download ZIP
          </a>
        )}
      </div>

      <div className="mt-3">
        <ProgressBar progress={task.progress} />
        <p className="text-xs text-gray-500 mt-1">{task.progress}</p>
      </div>
    </div>
  );
}