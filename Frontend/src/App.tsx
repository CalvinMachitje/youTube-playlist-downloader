// src/App.tsx
import { useState } from 'react'
import DownloadForm from './components/DownloadForm'
import DownloadQueue from './components/DownloadQueue'
import { type DownloadTask } from "./types/types";

export default function App() {
  const [tasks, setTasks] = useState<DownloadTask[]>([])

  const addTask = (newTask: DownloadTask) => {
    setTasks(prev => [...prev, newTask])
  }

  const updateTask = (id: string, updates: Partial<DownloadTask>) => {
    setTasks(prev =>
      prev.map(t => t.id === id ? { ...t, ...updates } : t)
    )
  }

  return (
    <div className="min-h-screen bg-warm-bg">
      {/* Header */}
      <header className="py-10 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight">
          YouTube Playlist Downloader
        </h1>
        <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">
          Download entire playlists in one click – fast, clean, and beautiful.
        </p>
      </header>

      <main className="max-w-4xl mx-auto px-4 pb-20">
        {/* Form card */}
        <div className="mb-16">
          {/* @ts-ignore */}
          <DownloadForm onTaskCreate={addTask} />
        </div>

        {/* Queue */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">
            Your Downloads
          </h2>

          {tasks.length === 0 ? (
            <div className="text-center py-16 bg-white/60 backdrop-blur-sm rounded-2xl border border-orange-100 shadow-sm">
              <p className="text-gray-500 text-lg">
                Start by pasting YouTube URLs above
              </p>
            </div>
          ) : (
            <DownloadQueue tasks={tasks} updateTask={updateTask} />
          )}
        </section>
      </main>
    </div>
  )
}