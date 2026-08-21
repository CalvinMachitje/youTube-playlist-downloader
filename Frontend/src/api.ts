// frontend/src/api.ts

const API_BASE = "http://127.0.0.1:8000";

// ---------- Helpers ----------

export const getInfoUrl = (url: string) =>
  `${API_BASE}/info?url=${encodeURIComponent(url)}`;

export const getFileUrl = (taskId: string) =>
  `${API_BASE}/file/${taskId}`;

export const getProgressUrl = (taskId: string) =>
  `${API_BASE}/progress/${taskId}`;

export const getWsUrl = (taskId: string) =>
  `ws://127.0.0.1:8000/ws/${taskId}`;

export const downloadEndpoint = `${API_BASE}/download`;

// ---------- Typed API calls (optional – you can keep using fetch) ----------

export async function startDownload(payload: {
  urls: string[];
  download_type: "video" | "audio" | "both";
  video_quality?: string;
}) {
  const res = await fetch(downloadEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Failed to start download");
  }

  return res.json(); // { task_id: string }
}

export async function getProgress(taskId: string) {
  const res = await fetch(getProgressUrl(taskId));
  if (!res.ok) throw new Error("Failed to get progress");
  return res.json();
}

// Cancel is not implemented on the backend yet
export async function cancelDownload(taskId: string) {
  const res = await fetch(`${API_BASE}/cancel/${taskId}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to cancel");
  return res.json();
}