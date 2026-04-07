// frontend/src/components/DownloadForm.tsx
import { useState } from 'react'

interface Props {
  onTaskCreate: (task: any) => void
}

type DownloadType = 'video' | 'audio' | 'both';

type VideoItem = {
  title: string
  url: string
  duration: string
  thumbnail?: string
}

export default function DownloadForm({ onTaskCreate }: Props) {
  const [urls, setUrls] = useState('')
  const [downloadType, setDownloadType] = useState<DownloadType>('video')
  const [, setLoading] = useState(false)

  const [videos, setVideos] = useState<VideoItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set<string>())
  const [playlistTitle, setPlaylistTitle] = useState('')

  // 🔍 Fetch playlist info
  const fetchInfo = async () => {
    const firstUrl = urls.split('\n')[0]?.trim()
    if (!firstUrl) return

    setLoading(true)
    try {
      const res = await fetch(`http://127.0.0.1:8000/info?url=${encodeURIComponent(firstUrl)}`)
      const data = await res.json()

      setVideos(data.videos)
      setPlaylistTitle(data.playlist_title)

      // ✅ Select all by default
      const all = new Set<string>(data.videos.map((v: VideoItem) => v.url))
      setSelected(all)

    } catch (err) {
      alert("Failed to fetch playlist info")
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (url: string) => {
    const newSet = new Set(selected)
    if (newSet.has(url)) newSet.delete(url)
    else newSet.add(url)
    setSelected(newSet)
  }

  const selectAll = () => {
    setSelected(new Set<string>(videos.map(v => v.url)))
  }

  const clearAll = () => {
    setSelected(new Set<string>())
  }

  const handleSubmit = async () => {
    const selectedUrls = Array.from(selected)
    if (selectedUrls.length === 0) return alert("Select at least one item")

    setLoading(true)

    try {
      const res = await fetch('http://127.0.0.1:8000/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          urls: selectedUrls,
          download_type: downloadType 
        })
      })

      const data = await res.json()

      onTaskCreate({
        id: data.task_id,
        status: 'queued',
        overall_progress: 0,
        total_videos: selectedUrls.length,
        download_type: downloadType,
        playlist_title: playlistTitle
      })

      // Reset
      setVideos([])
      setSelected(new Set<string>())
      setUrls('')

    } catch {
      alert("Failed to start download")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow">

      <h2 className="text-xl font-bold mb-4">YouTube Downloader</h2>

      {/* URL input */}
      <textarea
        value={urls}
        onChange={e => setUrls(e.target.value)}
        placeholder="Paste playlist URL..."
        className="w-full p-3 border rounded mb-4"
      />

      <div className="flex gap-3 mb-4">
        <button onClick={fetchInfo} className="bg-blue-600 text-white px-4 py-2 rounded">
          Load Playlist
        </button>

        <button onClick={handleSubmit} className="bg-orange-600 text-white px-4 py-2 rounded">
          Download Selected
        </button>
      </div>

      {/* Download Type */}
      <div className="mb-4">
        <select
          value={downloadType}
          onChange={(e) => setDownloadType(e.target.value as DownloadType)}
          className="border p-2 rounded"
        >
          <option value="video">Video</option>
          <option value="audio">Audio</option>
          <option value="both">Both</option>
        </select>
      </div>

      {/* Playlist */}
      {videos.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">{playlistTitle}</h3>

          <div className="flex gap-2 mb-3">
            <button onClick={selectAll} className="text-sm bg-green-500 text-white px-2 py-1 rounded">
              Select All
            </button>
            <button onClick={clearAll} className="text-sm bg-gray-400 text-white px-2 py-1 rounded">
              Clear
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto border rounded p-2">
            {videos.map((v, i) => (
              <label key={i} className="flex items-center gap-3 p-2 border-b cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(v.url)}
                  onChange={() => toggleSelect(v.url)}
                />
                {v.thumbnail && (
                  <img src={v.thumbnail} className="w-16 h-10 object-cover rounded" />
                )}
                <div>
                  <p className="text-sm font-medium">{v.title}</p>
                  <p className="text-xs text-gray-500">{v.duration}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}