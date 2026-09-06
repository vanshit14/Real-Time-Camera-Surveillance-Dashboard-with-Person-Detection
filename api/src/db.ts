import pg from "pg";
import { config } from "./config";

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export async function migrate() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS cameras (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      rtsp_url TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      enabled BOOLEAN NOT NULL DEFAULT true,
      stream_key TEXT NOT NULL UNIQUE,
      desired_state TEXT NOT NULL DEFAULT 'stopped',
      runtime_state TEXT NOT NULL DEFAULT 'stopped',
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL,
      confidence DOUBLE PRECISION NOT NULL,
      bbox JSONB NOT NULL,
      snapshot_url TEXT,
      dedupe_key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS alerts_camera_time_idx ON alerts(camera_id, occurred_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS alerts_user_time_idx ON alerts(user_id, occurred_at DESC, id DESC);

    CREATE TABLE IF NOT EXISTS camera_stats (
      camera_id UUID PRIMARY KEY REFERENCES cameras(id) ON DELETE CASCADE,
      fps DOUBLE PRECISION NOT NULL DEFAULT 0,
      detections_per_minute INTEGER NOT NULL DEFAULT 0,
      state TEXT NOT NULL DEFAULT 'stopped',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export function rowCamera(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    rtspUrl: row.rtsp_url,
    location: row.location,
    enabled: row.enabled,
    streamKey: row.stream_key,
    desiredState: row.desired_state,
    runtimeState: row.runtime_state,
    lastError: row.last_error,
    webrtcUrl: `${config.publicWebrtcBaseUrl}/${row.stream_key}/whep`,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function rowAlert(row: any) {
  return {
    eventId: row.id,
    type: row.event_type,
    cameraId: row.camera_id,
    userId: row.user_id,
    occurredAt: row.occurred_at,
    confidence: row.confidence,
    bbox: row.bbox,
    snapshotUrl: row.snapshot_url,
    source: "worker",
    model: "yolov8n-coco",
    dedupeKey: row.dedupe_key,
    createdAt: row.created_at
  };
}

