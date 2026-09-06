import { pool, rowCamera } from "../db";

export type CameraInput = {
  name: string;
  rtspUrl: string;
  location: string;
  enabled: boolean;
};

export async function listCamerasForUser(userId: string) {
  const result = await pool.query(
    `SELECT c.*, s.fps, s.detections_per_minute
     FROM cameras c
     LEFT JOIN camera_stats s ON s.camera_id = c.id
     WHERE c.user_id = $1
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return result.rows.map((row) => ({
    ...rowCamera(row),
    stats: {
      fps: row.fps ?? 0,
      detectionsPerMinute: row.detections_per_minute ?? 0
    }
  }));
}

export async function createCamera(userId: string, input: CameraInput) {
  const streamKey = `cam-${crypto.randomUUID()}`;
  const result = await pool.query(
    `INSERT INTO cameras (user_id, name, rtsp_url, location, enabled, stream_key)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, input.name, input.rtspUrl, input.location, input.enabled, streamKey]
  );
  return rowCamera(result.rows[0]);
}

export async function findCameraForUser(userId: string, cameraId: string) {
  const result = await pool.query("SELECT * FROM cameras WHERE id = $1 AND user_id = $2", [cameraId, userId]);
  return result.rowCount ? rowCamera(result.rows[0]) : null;
}

export async function getCameraHealthForUser(userId: string, cameraId: string) {
  const result = await pool.query(
    `SELECT c.id, c.desired_state, c.runtime_state, c.last_error,
            s.fps, s.detections_per_minute, s.updated_at AS stats_updated_at
     FROM cameras c
     LEFT JOIN camera_stats s ON s.camera_id = c.id
     WHERE c.id = $1 AND c.user_id = $2`,
    [cameraId, userId]
  );
  if (!result.rowCount) return null;

  const row = result.rows[0];
  const statsUpdatedAt = row.stats_updated_at ? new Date(row.stats_updated_at) : null;
  const statsFresh = Boolean(statsUpdatedAt && Date.now() - statsUpdatedAt.getTime() < 15000);
  const status = row.desired_state === "stopped"
    ? "stopped"
    : row.runtime_state === "connecting"
      ? "starting"
      : row.runtime_state === "live" && statsFresh
        ? "healthy"
        : "unhealthy";

  return {
    cameraId: row.id,
    status,
    desiredState: row.desired_state,
    runtimeState: row.runtime_state,
    fps: row.fps ?? 0,
    detectionsPerMinute: row.detections_per_minute ?? 0,
    statsFresh,
    statsUpdatedAt,
    lastError: row.last_error
  };
}

export async function updateCamera(userId: string, cameraId: string, input: CameraInput) {
  const result = await pool.query(
    `UPDATE cameras
     SET name = $1, rtsp_url = $2, location = $3, enabled = $4, updated_at = now()
     WHERE id = $5 AND user_id = $6
     RETURNING *`,
    [input.name, input.rtspUrl, input.location, input.enabled, cameraId, userId]
  );
  return result.rowCount ? rowCamera(result.rows[0]) : null;
}

export async function deleteCamera(userId: string, cameraId: string) {
  const result = await pool.query("DELETE FROM cameras WHERE id = $1 AND user_id = $2 RETURNING id", [cameraId, userId]);
  return Boolean(result.rowCount);
}

export async function setCameraDesiredState(userId: string, cameraId: string, desiredState: "live" | "stopped") {
  const result = await pool.query(
    `UPDATE cameras
     SET desired_state = $1,
         runtime_state = CASE WHEN $1 = 'live' THEN 'connecting' ELSE 'stopped' END,
         last_error = NULL,
         updated_at = now()
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [desiredState, cameraId, userId]
  );
  return result.rowCount ? rowCamera(result.rows[0]) : null;
}
