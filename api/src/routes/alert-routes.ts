import { Hono } from "hono";
import { getUser } from "../auth";
import { listAlerts } from "../repositories/alert-repository";
import type { AppEnv } from "../types";

export const alertRoutes = new Hono<AppEnv>();

alertRoutes.get("/", async (c) => {
  const user = getUser(c);
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  return c.json(
    await listAlerts({
      userId: user.id,
      cameraId: c.req.query("cameraId"),
      from: c.req.query("from"),
      to: c.req.query("to"),
      cursor: c.req.query("cursor"),
      limit
    })
  );
});
