import { useState } from "react";
import { Activity, ChevronDown, Edit3, Play, Square, Trash2, VideoOff } from "lucide-react";
import type { Alert, Camera } from "../types";
import { WebRtcVideo, type BrowserVideoStatus } from "./WebRtcVideo";

export function CameraTile({
  camera,
  alerts,
  onStart,
  onStop,
  onEdit,
  onDelete
}: {
  camera: Camera;
  alerts: Alert[];
  onStart: () => Promise<void> | void;
  onStop: () => Promise<void> | void;
  onEdit: () => void;
  onDelete: () => Promise<void> | void;
}) {
  const isActive = camera.runtimeState === "live" || camera.runtimeState === "connecting";
  const [busyAction, setBusyAction] = useState<"start" | "stop" | "delete" | null>(null);
  const [videoStatus, setVideoStatus] = useState<BrowserVideoStatus>({ state: "connecting", error: null });
  const browserState = isActive ? videoStatus.state : camera.runtimeState === "error" ? "error" : "stopped";
  const diagnosticError = camera.lastError ?? (isActive ? videoStatus.error : null);

  async function runAction(action: "start" | "stop" | "delete", handler: () => Promise<void> | void) {
    if (busyAction) return;
    setBusyAction(action);
    try {
      await handler();
    } finally {
      setBusyAction(null);
    }
  }

  async function confirmDelete() {
    const confirmed = window.confirm(`Delete "${camera.name}"? This also stops the camera.`);
    if (!confirmed) return;
    await runAction("delete", onDelete);
  }

  return (
    <article className="camera-card">
      <div className="video-frame">
        {isActive ? <WebRtcVideo url={camera.webrtcUrl} state={camera.runtimeState} onStatusChange={setVideoStatus} /> : <div className="video-placeholder"><VideoOff size={34} /></div>}
        <span className={`state-pill ${camera.runtimeState}`}>{camera.runtimeState}</span>
      </div>
      <div className="camera-body">
        <div>
          <h2>{camera.name}</h2>
          <p>{camera.location || "No location"}</p>
        </div>
        <div className="stats-strip">
          <span>{camera.stats?.fps?.toFixed(1) ?? "0.0"} FPS</span>
          <span>{camera.stats?.detectionsPerMinute ?? 0}/min</span>
        </div>
        {camera.lastError ? <div className="error-text">{camera.lastError}</div> : null}
        <details className="stream-diagnostics">
          <summary><Activity size={16} /> Stream diagnostics <ChevronDown className="details-chevron" size={16} /></summary>
          <dl>
            <div><dt>Requested</dt><dd className={`diagnostic-state ${camera.desiredState}`}>{camera.desiredState}</dd></div>
            <div><dt>Worker</dt><dd className={`diagnostic-state ${camera.runtimeState}`}>{camera.runtimeState}</dd></div>
            <div><dt>Browser</dt><dd className={`diagnostic-state ${browserState}`}>{browserState}</dd></div>
            <div><dt>Input</dt><dd>{camera.enabled ? "Enabled" : "Disabled"}</dd></div>
            {diagnosticError ? <div className="diagnostic-error"><dt>Last error</dt><dd>{diagnosticError}</dd></div> : null}
          </dl>
        </details>
        <div className="tile-actions">
          {isActive ? (
            <button className="secondary-button" onClick={() => void runAction("stop", onStop)} disabled={Boolean(busyAction)}>
              <Square size={16} /> {busyAction === "stop" ? "Stopping" : "Stop"}
            </button>
          ) : (
            <button className="primary-button" onClick={() => void runAction("start", onStart)} disabled={!camera.enabled || Boolean(busyAction)}>
              <Play size={16} /> {busyAction === "start" ? "Starting" : "Start"}
            </button>
          )}
          <button className="icon-button" onClick={onEdit} aria-label="Edit camera" disabled={Boolean(busyAction)}><Edit3 size={17} /></button>
          <button className="icon-button danger" onClick={() => void confirmDelete()} aria-label="Delete camera" disabled={Boolean(busyAction)}>
            <Trash2 size={17} />
          </button>
        </div>
        <div className="alerts-list">
          <h3>Recent alerts</h3>
          {alerts.length === 0 ? <p>No person detections yet.</p> : alerts.slice(0, 4).map((alert) => (
            <div key={alert.eventId} className="alert-row">
              <span>{Math.round(alert.confidence * 100)}%</span>
              <time>{new Date(alert.occurredAt).toLocaleTimeString()}</time>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
