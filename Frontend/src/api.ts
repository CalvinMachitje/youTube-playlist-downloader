// This file contains the API calls to the backend server.
// frontend/src/api.ts
import axios from "axios";

export const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  timeout: 10000,
});

export const startDownload = async (urls: string[]) => {
  const res = await api.post("/download", { urls });
  return res.data;
};

export const cancelDownload = async (taskId: string) => {
  const res = await api.post(`/cancel/${taskId}`);
  return res.data;
};

export const getFileUrl = (taskId: string) => {
  return `http://127.0.0.1:8000/file/${taskId}`;
};