import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Camera } from "./types";

const actions = {
  saveSession: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  saveCamera: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  remove: vi.fn()
};

let dashboardState: Record<string, unknown>;

vi.mock("./hooks/useDashboard", () => ({
  useDashboard: () => dashboardState
}));

import { App } from "./App";

const stoppedCamera: Camera = {
  id: "camera-a",
  name: "Front door",
  rtspUrl: "rtsp://camera/live",
  location: "Entrance",
  enabled: true,
  streamKey: "stream-a",
  desiredState: "stopped",
  runtimeState: "stopped",
  lastError: null,
  webrtcUrl: "http://localhost:8889/stream-a/whep",
  stats: { fps: 0, detectionsPerMinute: 0 }
};

beforeEach(() => {
  vi.clearAllMocks();
  dashboardState = {
    session: null,
    cameras: [],
    alertsByCamera: {},
    error: null,
    realtimeState: "disconnected",
    ...actions
  };
});

describe("App", () => {
  test("shows authentication without a session", () => {
    render(<App />);

    expect(screen.getByText("Surveillance Dashboard")).toBeInTheDocument();
  });

  test("shows cameras and realtime status for a logged-in user", () => {
    dashboardState = {
      ...dashboardState,
      session: { token: "token", user: { id: "user-a", username: "alice" } },
      cameras: [stoppedCamera],
      realtimeState: "connected"
    };

    render(<App />);

    expect(screen.getByText("Front door")).toBeInTheDocument();
    expect(screen.getByText("Entrance")).toBeInTheDocument();
    expect(screen.getByText("Live updates")).toBeInTheDocument();
    expect(screen.getByText("Stream diagnostics")).toBeInTheDocument();
  });
});
