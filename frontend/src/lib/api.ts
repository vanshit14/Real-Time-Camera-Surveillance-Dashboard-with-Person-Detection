import type { Alert, Camera } from "../types";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
export const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:3000/ws";

export type Session = {
  token: string;
  user: { id: string; username: string };
};

async function request<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

export function signup(username: string, password: string) {
  return request<Session>("/auth/signup", null, {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export function login(username: string, password: string) {
  return request<Session>("/auth/login", null, {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export function listCameras(token: string) {
  return request<{ cameras: Camera[] }>("/cameras", token);
}

export function createCamera(token: string, camera: Pick<Camera, "name" | "rtspUrl" | "location" | "enabled">) {
  return request<{ camera: Camera }>("/cameras", token, {
    method: "POST",
    body: JSON.stringify(camera)
  });
}

export function updateCamera(token: string, id: string, camera: Partial<Pick<Camera, "name" | "rtspUrl" | "location" | "enabled">>) {
  return request<{ camera: Camera }>(`/cameras/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(camera)
  });
}

export function deleteCamera(token: string, id: string) {
  return request<{ ok: true }>(`/cameras/${id}`, token, { method: "DELETE" });
}

export function startCamera(token: string, id: string) {
  return request<{ camera: Camera }>(`/cameras/${id}/start`, token, { method: "POST" });
}

export function stopCamera(token: string, id: string) {
  return request<{ camera: Camera }>(`/cameras/${id}/stop`, token, { method: "POST" });
}

export function listAlerts(token: string, limit = 100) {
  return request<{ alerts: Alert[]; nextCursor: string | null }>(`/alerts?limit=${limit}`, token);
}

