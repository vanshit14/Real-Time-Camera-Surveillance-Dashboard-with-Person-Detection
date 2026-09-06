import { describe, expect, test } from "bun:test";
import { cameraSchema, formatValidationErrors } from "../src/validation";

describe("camera validation", () => {
  test("trims valid camera input and supplies defaults", () => {
    const result = cameraSchema.parse({
      name: "  Front door  ",
      rtspUrl: "  rtsp://mediamtx:8554/testcam  "
    });

    expect(result).toEqual({
      name: "Front door",
      rtspUrl: "rtsp://mediamtx:8554/testcam",
      location: "",
      enabled: true
    });
  });

  test("returns readable field errors for invalid input", () => {
    const result = cameraSchema.safeParse({
      name: "   ",
      rtspUrl: "not-a-url",
      location: "x".repeat(161)
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(formatValidationErrors(result.error)).toEqual({
      error: "Please correct the highlighted fields.",
      fields: {
        name: "Camera name is required.",
        rtspUrl: "Enter a valid stream URL.",
        location: "Location must be 160 characters or fewer."
      }
    });
  });
});
