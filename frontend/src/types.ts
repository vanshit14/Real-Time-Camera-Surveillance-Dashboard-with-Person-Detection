export type RuntimeState = "connecting" | "live" | "stopped" | "error";
export type RealtimeState = "connecting" | "connected" | "reconnecting" | "disconnected";

export type Camera = {
  id: string;
  name: string;
  rtspUrl: string;
  location: string;
  enabled: boolean;
  streamKey: string;
  desiredState: RuntimeState;
  runtimeState: RuntimeState;
  lastError: string | null;
  webrtcUrl: string;
  stats?: {
    fps: number;
    detectionsPerMinute: number;
  };
};

export type Alert = {
  eventId: string;
  type: "person_detected";
  cameraId: string;
  userId: string;
  occurredAt: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
  snapshotUrl: string | null;
  source: "worker";
  model: "yolov8n-coco";
  dedupeKey: string;
};

export type WsMessage =
  | { type: "alert.created"; payload: Alert }
  | { type: "camera.stats"; payload: { cameraId: string; fps: number; detectionsPerMinute: number; state: RuntimeState; updatedAt: string } }
  | { type: "camera.state"; payload: { cameraId: string; state: RuntimeState; error: string | null; updatedAt: string } }
  | { type: "connected"; payload: { userId: string } };
