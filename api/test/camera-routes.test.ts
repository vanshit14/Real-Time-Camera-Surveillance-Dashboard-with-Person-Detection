import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Hono } from "hono";
import type { AppEnv } from "../src/types";

const createCamera = mock(async (userId: string, input: Record<string, unknown>) => ({
  id: "camera-created",
  userId,
  ...input
}));
const deleteCamera = mock(async () => false);
const findCameraForUser = mock(async () => null);
const getCameraHealthForUser = mock(async () => null);
const listCamerasForUser = mock(async () => []);
const setCameraDesiredState = mock(async () => null);
const updateCamera = mock(async () => null);
const redisXadd = mock(async () => "1-0");

mock.module("../src/repositories/camera-repository", () => ({
  createCamera,
  deleteCamera,
  findCameraForUser,
  getCameraHealthForUser,
  listCamerasForUser,
  setCameraDesiredState,
  updateCamera
}));

mock.module("../src/redis", () => ({
  redis: { xadd: redisXadd },
  streamFields: (value: Record<string, unknown>) =>
    Object.entries(value).flatMap(([key, item]) => (item === undefined ? [] : [key, String(item)]))
}));

const { authMiddleware, signToken } = await import("../src/auth");
const { cameraRoutes } = await import("../src/routes/camera-routes");

const app = new Hono<AppEnv>();
app.use("/cameras", authMiddleware);
app.use("/cameras/*", authMiddleware);
app.route("/cameras", cameraRoutes);

const user = { id: "user-a", username: "alice" };
const token = await signToken(user);
const authorizedHeaders = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json"
};

beforeEach(() => {
  createCamera.mockClear();
  deleteCamera.mockClear();
  findCameraForUser.mockClear();
  getCameraHealthForUser.mockClear();
  listCamerasForUser.mockClear();
  setCameraDesiredState.mockClear();
  updateCamera.mockClear();
  redisXadd.mockClear();
});

describe("camera HTTP routes", () => {
  test("rejects requests without a bearer token", async () => {
    const response = await app.request("/cameras");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Missing bearer token" });
  });

  test("returns readable validation errors", async () => {
    const response = await app.request("/cameras", {
      method: "POST",
      headers: authorizedHeaders,
      body: JSON.stringify({ name: " ", rtspUrl: "not-a-url" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Please correct the highlighted fields.",
      fields: {
        name: "Camera name is required.",
        rtspUrl: "Enter a valid stream URL."
      }
    });
    expect(createCamera).not.toHaveBeenCalled();
  });

  test("returns health only for an owned camera", async () => {
    getCameraHealthForUser.mockResolvedValueOnce({
      cameraId: "camera-a",
      status: "healthy",
      desiredState: "live",
      runtimeState: "live",
      fps: 24.9,
      detectionsPerMinute: 6,
      statsFresh: true,
      statsUpdatedAt: new Date("2026-09-03T10:00:00.000Z"),
      lastError: null
    });

    const response = await app.request("/cameras/camera-a/health", { headers: authorizedHeaders });

    expect(response.status).toBe(200);
    expect(getCameraHealthForUser).toHaveBeenCalledWith(user.id, "camera-a");
    expect((await response.json()).health.status).toBe("healthy");
  });

  test("hides health for an unowned camera", async () => {
    const response = await app.request("/cameras/someone-elses-camera/health", { headers: authorizedHeaders });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Camera not found" });
  });

  test("creates a normalized camera for the authenticated user", async () => {
    const response = await app.request("/cameras", {
      method: "POST",
      headers: authorizedHeaders,
      body: JSON.stringify({ name: "  Front door  ", rtspUrl: "  rtsp://camera/live  " })
    });

    expect(response.status).toBe(201);
    expect(createCamera).toHaveBeenCalledWith(user.id, {
      name: "Front door",
      rtspUrl: "rtsp://camera/live",
      location: "",
      enabled: true
    });
  });

  test("hides an unowned camera during editing", async () => {
    const response = await app.request("/cameras/someone-elses-camera", {
      method: "PATCH",
      headers: authorizedHeaders,
      body: JSON.stringify({ name: "Renamed" })
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Camera not found" });
    expect(updateCamera).not.toHaveBeenCalled();
  });

  test("hides an unowned camera during deletion", async () => {
    const response = await app.request("/cameras/someone-elses-camera", {
      method: "DELETE",
      headers: authorizedHeaders
    });

    expect(response.status).toBe(404);
    expect(redisXadd).not.toHaveBeenCalled();
  });

  test("hides an unowned camera during start", async () => {
    const response = await app.request("/cameras/someone-elses-camera/start", {
      method: "POST",
      headers: authorizedHeaders
    });

    expect(response.status).toBe(404);
    expect(redisXadd).not.toHaveBeenCalled();
  });

  test("publishes a start command for an owned camera", async () => {
    setCameraDesiredState.mockResolvedValueOnce({
      id: "camera-a",
      userId: user.id,
      enabled: true,
      rtspUrl: "rtsp://camera/live",
      streamKey: "cam-stream-a"
    });

    const response = await app.request("/cameras/camera-a/start", {
      method: "POST",
      headers: authorizedHeaders
    });

    expect(response.status).toBe(200);
    expect(setCameraDesiredState).toHaveBeenCalledWith(user.id, "camera-a", "live");
    expect(redisXadd).toHaveBeenCalledTimes(1);
    expect(redisXadd.mock.calls[0].slice(0, 2)).toEqual(["camera.commands", "*"]);
    expect(redisXadd.mock.calls[0]).toContain("start");
    expect(redisXadd.mock.calls[0]).toContain(user.id);
  });
});
