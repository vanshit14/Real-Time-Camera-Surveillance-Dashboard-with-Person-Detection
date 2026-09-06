import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "./auth";
import { config } from "./config";
import { migrate } from "./db";
import { redisConsumer } from "./redis";
import { alertRoutes } from "./routes/alert-routes";
import { authRoutes } from "./routes/auth-routes";
import { cameraRoutes } from "./routes/camera-routes";
import { startStreamConsumer } from "./stream-consumer";
import type { AppEnv } from "./types";
import { websocket, wsHandler } from "./ws";

const app = new Hono<AppEnv>();

app.use("*", cors({ origin: "*", allowHeaders: ["Authorization", "Content-Type"], allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] }));

app.get("/health", (c) => c.json({ ok: true }));
app.get("/ws", wsHandler());

app.route("/auth", authRoutes);
app.use("/cameras", authMiddleware);
app.use("/cameras/*", authMiddleware);
app.use("/alerts", authMiddleware);
app.route("/cameras", cameraRoutes);
app.route("/alerts", alertRoutes);

await migrate();
startStreamConsumer(redisConsumer);

console.log(`API listening on ${config.port}`);

export default {
  port: config.port,
  fetch: app.fetch,
  websocket
};
