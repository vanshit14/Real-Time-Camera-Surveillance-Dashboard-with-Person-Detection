import { beforeEach, describe, expect, mock, test } from "bun:test";

const query = mock(async () => ({ rows: [], rowCount: 0 }));

mock.module("../src/db", () => ({
  pool: { query },
  rowCamera: (row: unknown) => row
}));

const {
  createCamera,
  deleteCamera,
  findCameraForUser,
  getCameraHealthForUser,
  listCamerasForUser,
  setCameraDesiredState,
  updateCamera
} = await import("../src/repositories/camera-repository");

const userId = "user-a";
const cameraId = "camera-a";
const input = {
  name: "Front door",
  rtspUrl: "rtsp://camera/live",
  location: "Entrance",
  enabled: true
};

beforeEach(() => {
  query.mockClear();
});

describe("camera ownership queries", () => {
  test("assigns new cameras to the authenticated user", async () => {
    query.mockResolvedValueOnce({ rows: [{}], rowCount: 1 });

    await createCamera(userId, input);

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain("INSERT INTO cameras (user_id");
    expect(values[0]).toBe(userId);
  });

  test("filters camera lists by the authenticated user", async () => {
    await listCamerasForUser(userId);

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain("WHERE c.user_id = $1");
    expect(values).toEqual([userId]);
  });

  test("requires ownership when finding, updating, and deleting a camera", async () => {
    await findCameraForUser(userId, cameraId);
    await updateCamera(userId, cameraId, input);
    await deleteCamera(userId, cameraId);

    const [findSql, findValues] = query.mock.calls[0];
    expect(findSql).toContain("id = $1 AND user_id = $2");
    expect(findValues).toEqual([cameraId, userId]);

    const [updateSql, updateValues] = query.mock.calls[1];
    expect(updateSql).toContain("WHERE id = $5 AND user_id = $6");
    expect(updateValues.slice(-2)).toEqual([cameraId, userId]);

    const [deleteSql, deleteValues] = query.mock.calls[2];
    expect(deleteSql).toContain("WHERE id = $1 AND user_id = $2");
    expect(deleteValues).toEqual([cameraId, userId]);
  });

  test("requires ownership when starting or stopping a camera", async () => {
    await setCameraDesiredState(userId, cameraId, "live");

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain("WHERE id = $2 AND user_id = $3");
    expect(values).toEqual(["live", cameraId, userId]);
  });

  test("requires ownership when reading camera health", async () => {
    await getCameraHealthForUser(userId, cameraId);

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain("WHERE c.id = $1 AND c.user_id = $2");
    expect(values).toEqual([cameraId, userId]);
  });
});
