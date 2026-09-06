export const config = {
  port: Number(process.env.API_PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://surveillance:surveillance@localhost:5432/surveillance",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  jwtSecret: process.env.JWT_SECRET ?? "change-me-in-production",
  publicWebrtcBaseUrl: process.env.PUBLIC_WEBRTC_BASE_URL ?? "http://localhost:8889",
  alertDedupeSeconds: Number(process.env.ALERT_DEDUPE_SECONDS ?? 10)
};

export const streams = {
  commands: "camera.commands",
  events: "detection.events",
  stats: "camera.stats",
  states: "camera.states"
};

