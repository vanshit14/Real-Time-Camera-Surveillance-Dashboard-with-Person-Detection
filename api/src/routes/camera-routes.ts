import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { getUser } from "../auth";
import { streams } from "../config";
import {
  createCamera,
  deleteCamera,
  findCameraForUser,
  getCameraHealthForUser,
  listCamerasForUser,
  setCameraDesiredState,
  updateCamera
} from "../repositories/camera-repository";
import { redis, streamFields } from "../redis";
import type { AppEnv } from "../types";
import { cameraSchema, formatValidationErrors } from "../validation";

export const cameraRoutes = new Hono<AppEnv>();

const validateCamera = zValidator("json", cameraSchema, (result, c) => {
  if (!result.success) {
    return c.json(formatValidationErrors(result.error), 400);
  }
});

const validateCameraUpdate = zValidator("json", cameraSchema.partial(), (result, c) => {
  if (!result.success) {
    return c.json(formatValidationErrors(result.error), 400);
  }
});

cameraRoutes.get("/", async (c) => {
  const user = getUser(c);
  return c.json({ cameras: await listCamerasForUser(user.id) });
});

cameraRoutes.get("/:id/health", async (c) => {
  const user = getUser(c);
  const health = await getCameraHealthForUser(user.id, c.req.param("id"));
  if (!health) return c.json({ error: "Camera not found" }, 404);
  return c.json({ health });
});

cameraRoutes.post("/", validateCamera, async (c) => {
  const user = getUser(c);
  const body = c.req.valid("json");
  return c.json({ camera: await createCamera(user.id, body) }, 201);
});

cameraRoutes.patch("/:id", validateCameraUpdate, async (c) => {
  const user = getUser(c);
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const current = await findCameraForUser(user.id, id);
  if (!current) return c.json({ error: "Camera not found" }, 404);
  const merged = { ...current, ...body };
  const camera = await updateCamera(user.id, id, merged);
  return c.json({ camera });
});

cameraRoutes.delete("/:id", async (c) => {
  const user = getUser(c);
  const id = c.req.param("id");
  const deleted = await deleteCamera(user.id, id);
  if (!deleted) return c.json({ error: "Camera not found" }, 404);
  await publishCameraCommand(user.id, id, "stop");
  return c.json({ ok: true });
});

cameraRoutes.post("/:id/start", async (c) => {
  const user = getUser(c);
  const camera = await setCameraDesiredState(user.id, c.req.param("id"), "live");
  if (!camera) return c.json({ error: "Camera not found" }, 404);
  if (!camera.enabled) return c.json({ error: "Camera is disabled" }, 409);
  await publishCameraCommand(user.id, camera.id, "start", camera);
  return c.json({ camera });
});

cameraRoutes.post("/:id/stop", async (c) => {
  const user = getUser(c);
  const camera = await setCameraDesiredState(user.id, c.req.param("id"), "stopped");
  if (!camera) return c.json({ error: "Camera not found" }, 404);
  await publishCameraCommand(user.id, camera.id, "stop", camera);
  return c.json({ camera });
});

async function publishCameraCommand(userId: string, cameraId: string, action: "start" | "stop", camera?: any) {
  await redis.xadd(
    streams.commands,
    "*",
    ...streamFields({
      commandId: crypto.randomUUID(),
      action,
      userId,
      cameraId,
      rtspUrl: camera?.rtspUrl,
      streamKey: camera?.streamKey,
      issuedAt: new Date().toISOString()
    })
  );
}
