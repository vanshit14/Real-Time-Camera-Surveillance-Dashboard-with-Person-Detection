import { describe, expect, test } from "bun:test";
import { streamFields, parseFields } from "../src/stream-codec";

describe("Redis stream field codec", () => {
  test("round trips canonical alert payloads", () => {
    const payload = {
      eventId: "00000000-0000-4000-8000-000000000000",
      type: "person_detected",
      cameraId: "camera-id",
      userId: "user-id",
      occurredAt: "2026-08-06T12:00:00.000Z",
      confidence: 0.87,
      bbox: { x: 120, y: 64, width: 180, height: 420 },
      snapshotUrl: null,
      source: "worker",
      model: "yolov8n-coco",
      dedupeKey: "camera-id:person:bucket"
    };
    expect(parseFields(streamFields(payload))).toEqual(payload);
  });
});
