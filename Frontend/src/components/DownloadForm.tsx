// frontend/src/components/DownloadForm.tsx
import { useState } from "react";
import { getInfoUrl, startDownload } from "../api";
import { type DownloadTask } from "../types/types";

interface Props {
  onTaskCreate: (task: DownloadTask) => void;
}

type DownloadType = "video" | "audio" | "both";

type VideoItem = {
  title: string;
  url: string;
  duration: string;
  thumbnail?: string;
};

export default function DownloadForm({ onTaskCreate }: Props) {
  const [urls, setUrls] = useState("");
  const [downloadType, setDownloadType] = useState<DownloadType>("video");
  const [videoQuality, setVideoQuality] = useState("best");
  const [loading, setLoading] = useState(false);

  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [playlistTitle, setPlaylistTitle] = useState("");

  // 🔍 Fetch playlist info
  const fetchInfo = async () => {
    const firstUrl = urls.split("\n")[0]?.trim();
    if (!firstUrl) {
      alert("Please paste a playlist URL");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(getInfoUrl(firstUrl));
      if (!res.ok) throw new Error("Failed to fetch playlist info");

      const data = await res.json();
      setVideos(data.videos || []);
      setPlaylistTitle(data.playlist_title || "Playlist");

      // Select all by default
      setSelected(new Set(data.videos.map((v: VideoItem) => v.url)));
    } catch (err) {
      console.error(err);
      alert("Failed to fetch playlist info");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (url: string) => {
    const newSet = new Set(selected);
    if (newSet.has(url)) newSet.delete(url);
    else newSet.add(url);
    setSelected(newSet);
  };

  const selectAll = () => {
    setSelected(new Set(videos.map((v) => v.url)));
  };

  const clearAll = () => {
    setSelected(new Set());
  };

  const handleSubmit = async () => {
    const selectedUrls = Array.from(selected);
    if (selectedUrls.length === 0) {
      alert("Select at least one item");
      return;
    }

    setLoading(true);
    try {
      const data = await startDownload({
        urls: selectedUrls,
        download_type: downloadType,
        video_quality: videoQuality,
      });

      onTaskCreate({
        id: data.task_id,
        status: "queued",
        overall_progress: 0,
        current_video_progress: 0,
        current_video_title: null,
        downloaded_videos: 0,
        total_videos: selectedUrls.length,
        failed_count: 0,
        download_type: downloadType,
        video_quality: videoQuality,
        playlist_title: playlistTitle,
      });

      // Reset form
      setVideos([]);
      setSelected(new Set());
      setUrls("");
      setPlaylistTitle("");
    } catch (err) {
      console.error(err);
      alert("Failed to start download");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow">
      <h2 className="text-xl font-bold mb-4">YouTube Downloader</h2>

      <textarea
        value={urls}
        onChange={(e) => setUrls(e.target.value)}
        placeholder="Paste playlist URL..."
        className="w-full p-3 border rounded mb-4"
        rows={3}
        disabled={loading}
      />

      <div className="flex gap-3 mb-4">
        <button
          onClick={fetchInfo}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded transition"
        >
          {loading ? "Loading..." : "Load Playlist"}
        </button>

        <button
          onClick={handleSubmit}
          disabled={loading || selected.size === 0}
          className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white px-4 py-2 rounded transition"
        >
          {loading ? "Starting..." : `Download Selected (${selected.size})`}
        </button>
      </div>

      {/* Download Type + Quality */}
      <div className="mb-4 flex gap-3">
        <select
          value={downloadType}
          onChange={(e) => setDownloadType(e.target.value as DownloadType)}
          className="border p-2 rounded"
          disabled={loading}
        >
          <option value="video">Video</option>
          <option value="audio">Audio</option>
          <option value="both">Both</option>
        </select>

        {downloadType !== "audio" && (
          <select
            value={videoQuality}
            onChange={(e) => setVideoQuality(e.target.value)}
            className="border p-2 rounded"
            disabled={loading}
          >
            <option value="best">Best</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
            <option value="360p">360p</option>
          </select>
        )}
      </div>

      {/* Playlist Preview */}
      {videos.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">{playlistTitle}</h3>

          <div className="flex gap-2 mb-3">
            <button
              onClick={selectAll}
              className="text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
            >
              Select All
            </button>
            <button
              onClick={clearAll}
              className="text-sm bg-gray-400 hover:bg-gray-500 text-white px-3 py-1 rounded"
            >
              Clear
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto border rounded p-2">
            {videos.map((v, i) => (
              <label
                key={i}
                className="flex items-center gap-3 p-2 border-b cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(v.url)}
                  onChange={() => toggleSelect(v.url)}
                />
                {v.thumbnail && (
                  <img
                    src={v.thumbnail}
                    alt=""
                    className="w-16 h-10 object-cover rounded"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{v.title}</p>
                  <p className="text-xs text-gray-500">{v.duration}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}