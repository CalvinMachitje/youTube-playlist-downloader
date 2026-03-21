import { useState } from "react";
import DownloadForm from "./components/DownloadForm";
import DownloadQueue from "./components/DownloadQueue";
import { startDownload } from "./api";
import { type DownloadTask } from "./types/types";

export default function App() {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);

  const handleStart = async (urls: string[]) => {
    const res = await startDownload(urls);

    const newTask: DownloadTask = {
      id: res.task_id,
      status: "queued",
      progress: "0%",
    };

    setTasks((prev) => [...prev, newTask]);
  };

  const updateTask = (id: string, data: Partial<DownloadTask>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...data } : t))
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">
          YouTube Playlist Downloader
        </h1>

        <DownloadForm onStart={handleStart} />

        <DownloadQueue tasks={tasks} updateTask={updateTask} />
      </div>
    </div>
  );
}