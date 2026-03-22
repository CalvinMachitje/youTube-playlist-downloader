// src/components/DownloadForm.tsx
import { useState } from 'react'

interface Props {
  onTaskCreate: (task: any) => void
}

export default function DownloadForm({ onTaskCreate }: Props) {
  const [urls, setUrls] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const lines = urls.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return

    setLoading(true)
    try {
      const res = await fetch('http://127.0.0.1:8000/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: lines })
      })

      if (!res.ok) throw new Error('Failed')

      const data = await res.json()

      onTaskCreate({
        id: data.task_id,
        status: 'queued',
        overall_progress: 0,
        current_video_progress: 0,
        downloaded_videos: 0,
        total_videos: data.total_videos || lines.length,
        playlist_title: data.playlist_title || 'Playlist',
        failed_count: 0
      })

      setUrls('')
    } catch (err) {
      console.error(err)
      alert('Something went wrong. Check console.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-orange-100">
      <div className="p-8 md:p-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Paste YouTube Links
        </h2>

        <textarea
          value={urls}
          onChange={e => setUrls(e.target.value)}
          placeholder="One link per line&#10;Example:&#10;https://youtube.com/playlist?list=PL...&#10;https://youtu.be/..."
          className="w-full h-48 p-5 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sunset-orange focus:border-transparent resize-none font-mono text-sm"
          disabled={loading}
        />

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={loading || !urls.trim()}
            className={`
              px-10 py-4 rounded-2xl font-semibold text-white text-lg transition-all
              ${loading || !urls.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-sunset-orange hover:bg-deep-orange shadow-lg hover:shadow-xl active:scale-98'
              }
            `}
          >
            {loading ? 'Starting...' : 'Start Download'}
          </button>
        </div>
      </div>
    </div>
  )
}