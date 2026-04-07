// frontend/src/App.tsx
import { useState, useEffect } from 'react';
import DownloadForm from './components/DownloadForm';
import DownloadQueue from './components/DownloadQueue';
import { type DownloadTask } from "./types/types";

export default function App() {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);

  // Add new task from form
  const addTask = (newTask: DownloadTask) => {
    setTasks(prev => [...prev, newTask]);
  };

  // Update existing task (used by WebSocket and cancel)
  const updateTask = (id: string, updates: Partial<DownloadTask>) => {
    setTasks(prev =>
      prev.map(t => t.id === id ? { ...t, ...updates } : t)
    );
  };

  // Auto-remove old completed tasks after some time (optional cleanup)
  useEffect(() => {
    const interval = setInterval(() => {
      setTasks(prev => 
        prev.filter(task => {
          // Keep tasks that are still active or were completed less than 10 minutes ago
          if (["queued", "downloading", "processing"].includes(task.status)) {
            return true;
          }
          // Keep done/error tasks for a while so user can download ZIP
          return true; // You can add time-based cleanup if desired
        })
      );
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      {/* Header */}
      <header className="py-12 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 tracking-tighter">
          YouTube Playlist Downloader
        </h1>
        <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
          Download entire playlists as MP4 or MP3 — fast, concurrent, and beautiful.
        </p>
      </header>

      <main className="max-w-4xl mx-auto px-4 pb-24">
        {/* Download Form */}
        <div className="mb-16">
          <DownloadForm onTaskCreate={addTask} />
        </div>

        {/* Download Queue */}
        <section>
          <DownloadQueue 
            tasks={tasks} 
            updateTask={updateTask} 
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-gray-400 text-sm">
        Concurrent downloads enabled • Powered by yt-dlp + FastAPI
      </footer>
    </div>
  );
}