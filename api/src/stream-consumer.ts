import { config, streams } from "./config";
import { pool, rowAlert } from "./db";
import { broadcast } from "./ws";
import { parseFields } from "./redis";
import type Redis from "ioredis";

async function shouldStoreAlert(event: any) {
  const existing = await pool.query(
    `SELECT id FROM alerts
     WHERE camera_id = $1
       AND event_type = $2
       AND occurred_at > now() - ($3::text || ' seconds')::interval
     LIMIT 1`,
    [event.cameraId, event.type, String(config.alertDedupeSeconds)]
  );
  return existing.rowCount === 0;
}

async function handleDetectionEvent(event: any) {
  if (!event.eventId || !event.cameraId || !event.userId) return;
  if (!(await shouldStoreAlert(event))) return;

  const inserted = await pool.query(
    `INSERT INTO alerts (id, user_id, camera_id, event_type, occurred_at, confidence, bbox, snapshot_url, dedupe_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [
      event.eventId,
      event.userId,
      event.cameraId,
      event.type,
      event.occurredAt,
      event.confidence,
      event.bbox,
      event.snapshotUrl ?? null,
      event.dedupeKey
    ]
  );
  if (inserted.rowCount) broadcast(event.userId, "alert.created", rowAlert(inserted.rows[0]));
}

async function handleStats(event: any) {
  if (!event.cameraId || !event.userId) return;
  await pool.query(
    `INSERT INTO camera_stats (camera_id, fps, detections_per_minute, state, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (camera_id)
     DO UPDATE SET fps = excluded.fps,
                   detections_per_minute = excluded.detections_per_minute,
                   state = excluded.state,
                   updated_at = excluded.updated_at`,
    [event.cameraId, event.fps ?? 0, event.detectionsPerMinute ?? 0, event.state ?? "live", event.updatedAt ?? new Date()]
  );
  await pool.query(
    `UPDATE cameras
     SET runtime_state = $1, last_error = NULL, updated_at = now()
     WHERE id = $2 AND user_id = $3 AND desired_state = 'live'`,
    [event.state ?? "live", event.cameraId, event.userId]
  );
  broadcast(event.userId, "camera.stats", event);
}

async function handleState(event: any) {
  if (!event.cameraId || !event.userId) return;
  await pool.query(
    `UPDATE cameras SET runtime_state = $1, last_error = $2, updated_at = now()
     WHERE id = $3 AND user_id = $4`,
    [event.state, event.error ?? null, event.cameraId, event.userId]
  );
  broadcast(event.userId, "camera.state", event);
}

export function startStreamConsumer(redisConsumer: Redis) {
  void (async () => {
    let lastEvent = "$";
    let lastStats = "$";
    let lastStates = "$";
    for (;;) {
      try {
        const batches = await redisConsumer.xread(
          "BLOCK",
          5000,
          "STREAMS",
          streams.events,
          streams.stats,
          streams.states,
          lastEvent,
          lastStats,
          lastStates
        );
        for (const [stream, messages] of batches ?? []) {
          for (const [id, fields] of messages) {
            const data = parseFields(fields);
            if (stream === streams.events) {
              lastEvent = id;
              await handleDetectionEvent(data);
            }
            if (stream === streams.stats) {
              lastStats = id;
              await handleStats(data);
            }
            if (stream === streams.states) {
              lastStates = id;
              await handleState(data);
            }
          }
        }
      } catch (error) {
        console.error("Redis stream consumer error", error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  })();
}
