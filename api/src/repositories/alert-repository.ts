import { pool, rowAlert } from "../db";

export type AlertFilters = {
  userId: string;
  cameraId?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit: number;
};

export async function listAlerts(filters: AlertFilters) {
  const values: unknown[] = [filters.userId];
  const where = ["user_id = $1"];

  if (filters.cameraId) {
    values.push(filters.cameraId);
    where.push(`camera_id = $${values.length}`);
  }
  if (filters.from) {
    values.push(filters.from);
    where.push(`occurred_at >= $${values.length}`);
  }
  if (filters.to) {
    values.push(filters.to);
    where.push(`occurred_at <= $${values.length}`);
  }
  if (filters.cursor) {
    const [occurredAt, id] = Buffer.from(filters.cursor, "base64url").toString("utf8").split("|");
    values.push(occurredAt, id);
    where.push(`(occurred_at, id) < ($${values.length - 1}, $${values.length})`);
  }

  values.push(filters.limit + 1);
  const result = await pool.query(
    `SELECT * FROM alerts WHERE ${where.join(" AND ")}
     ORDER BY occurred_at DESC, id DESC
     LIMIT $${values.length}`,
    values
  );
  const rows = result.rows.slice(0, filters.limit);
  const next = result.rows.length > filters.limit ? rows.at(-1) : undefined;
  return {
    alerts: rows.map(rowAlert),
    nextCursor: next ? Buffer.from(`${next.occurred_at.toISOString()}|${next.id}`).toString("base64url") : null
  };
}
