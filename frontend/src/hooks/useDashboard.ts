import { useEffect, useMemo, useState } from "react";
import {
  createCamera,
  deleteCamera,
  listAlerts,
  listCameras,
  startCamera,
  stopCamera,
  updateCamera,
  WS_URL,
  type Session
} from "../lib/api";
import type { Alert, Camera, RealtimeState, WsMessage } from "../types";

const storageKey = "surveillance.session";

export function useDashboard() {
  const [session, setSession] = useState<Session | null>(() => {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  });
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [realtimeState, setRealtimeState] = useState<RealtimeState>(session ? "connecting" : "disconnected");

  function saveSession(next: Session) {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setSession(next);
  }

  function logout() {
    localStorage.removeItem(storageKey);
    setSession(null);
    setCameras([]);
    setAlerts([]);
  }

  async function refresh() {
    if (!session) return;
    setError(null);
    try {
      const [cameraResult, alertResult] = await Promise.all([listCameras(session.token), listAlerts(session.token)]);
      setCameras(cameraResult.cameras);
      setAlerts(alertResult.alerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard");
    }
  }

  async function replaceCamera(next: Promise<{ camera: Camera }>) {
    const result = await next;
    setCameras((current) => current.map((camera) => camera.id === result.camera.id ? { ...camera, ...result.camera } : camera));
  }

  async function saveCamera(camera: Camera | null, draft: Pick<Camera, "name" | "rtspUrl" | "location" | "enabled">) {
    if (!session) return;
    const result = camera
      ? await updateCamera(session.token, camera.id, draft)
      : await createCamera(session.token, draft);
    setCameras((current) => camera
      ? current.map((item) => item.id === result.camera.id ? result.camera : item)
      : [result.camera, ...current]);
  }

  async function start(cameraId: string) {
    if (!session) return;
    await replaceCamera(startCamera(session.token, cameraId)).catch((err) => {
      setError(err instanceof Error ? err.message : "Could not start camera");
    });
  }

  async function stop(cameraId: string) {
    if (!session) return;
    await replaceCamera(stopCamera(session.token, cameraId)).catch((err) => {
      setError(err instanceof Error ? err.message : "Could not stop camera");
    });
  }

  async function remove(cameraId: string) {
    if (!session) return;
    try {
      await deleteCamera(session.token, cameraId);
      setCameras((current) => current.filter((item) => item.id !== cameraId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete camera");
    }
  }

  useEffect(() => {
    void refresh();
  }, [session?.token]);

  useEffect(() => {
    if (!session) {
      setRealtimeState("disconnected");
      return;
    }

    let cancelled = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;

    const connect = () => {
      if (cancelled) return;
      setRealtimeState(retryCount === 0 ? "connecting" : "reconnecting");
      socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(session.token)}`);

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data) as WsMessage;
        if (message.type === "connected") {
          retryCount = 0;
          setRealtimeState("connected");
          void refresh();
        }
        if (message.type === "alert.created") {
          setAlerts((current) => [message.payload, ...current].slice(0, 100));
        }
        if (message.type === "camera.stats") {
          setCameras((current) => current.map((camera) => (
            camera.id === message.payload.cameraId
              ? { ...camera, runtimeState: message.payload.state, stats: { fps: message.payload.fps, detectionsPerMinute: message.payload.detectionsPerMinute } }
              : camera
          )));
        }
        if (message.type === "camera.state") {
          setCameras((current) => current.map((camera) => (
            camera.id === message.payload.cameraId
              ? { ...camera, runtimeState: message.payload.state, lastError: message.payload.error }
              : camera
          )));
        }
      };

      socket.onclose = () => {
        if (cancelled) return;
        retryCount += 1;
        setRealtimeState("reconnecting");
        const delay = Math.min(1000 * (2 ** (retryCount - 1)), 10000);
        retryTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [session?.token]);

  const alertsByCamera = useMemo(() => {
    return alerts.reduce<Record<string, Alert[]>>((grouped, alert) => {
      grouped[alert.cameraId] = grouped[alert.cameraId] ?? [];
      grouped[alert.cameraId].push(alert);
      return grouped;
    }, {});
  }, [alerts]);

  return {
    session,
    cameras,
    alertsByCamera,
    error,
    realtimeState,
    saveSession,
    logout,
    refresh,
    saveCamera,
    start,
    stop,
    remove
  };
}
