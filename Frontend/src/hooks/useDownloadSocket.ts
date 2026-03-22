// This hook establishes a WebSocket connection to receive real-time updates for a specific download task.
// frontend/src/hooks/useDownloadSocket.ts
import { useEffect } from "react";
import { type DownloadTask } from "../types/types";

export const useTaskSocket = (
  taskId: string,
  updateTask: (id: string, data: Partial<DownloadTask>) => void
) => {
  useEffect(() => {
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${taskId}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      updateTask(taskId, {
        status: data.status,
        progress: `${data.progress ?? 0}%`,
      });
    };

    ws.onclose = () => {
      console.log("WebSocket closed:", taskId);
    };

    return () => ws.close();
  }, [taskId, updateTask]);
};