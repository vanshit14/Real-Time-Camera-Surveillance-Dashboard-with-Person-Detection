import { useState } from "react";
import { Loader2, LogOut, Plus, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { AuthView } from "./components/AuthView";
import { CameraForm } from "./components/CameraForm";
import { CameraTile } from "./components/CameraTile";
import { useDashboard } from "./hooks/useDashboard";
import type { Camera } from "./types";

export function App() {
  const [editing, setEditing] = useState<Camera | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const dashboard = useDashboard();
  const { session, cameras, alertsByCamera, error, realtimeState, saveSession, logout, refresh, saveCamera, start, stop, remove } = dashboard;

  if (!session) return <AuthView onSession={saveSession} />;

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <h1>Camera Surveillance</h1>
          <p>{cameras.length} cameras monitored by {session.user.username}</p>
        </div>
        <div className="top-actions">
          <span className={`realtime-status ${realtimeState}`} aria-live="polite" title="Realtime alert and camera status connection">
            {realtimeState === "connected" ? <Wifi size={16} /> : realtimeState === "disconnected" ? <WifiOff size={16} /> : <Loader2 className="spin" size={16} />}
            {realtimeState === "connected" ? "Live updates" : realtimeState === "reconnecting" ? "Reconnecting" : realtimeState}
          </span>
          <button className="secondary-button" onClick={refresh}><RefreshCw size={16} /> Refresh</button>
          <button className="primary-button" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={16} /> Add camera</button>
          <button className="icon-button" onClick={logout} aria-label="Logout"><LogOut size={18} /></button>
        </div>
      </header>

      {error ? <div className="banner-error">{error}</div> : null}

      {cameras.length === 0 ? (
        <section className="empty-state">
          <h2>No cameras yet</h2>
          <p>Create a camera and use the bundled test stream: rtsp://mediamtx:8554/testcam</p>
          <button className="primary-button" onClick={() => setFormOpen(true)}><Plus size={16} /> Add first camera</button>
        </section>
      ) : (
        <section className="camera-grid">
          {cameras.map((camera) => (
            <CameraTile
              key={camera.id}
              camera={camera}
              alerts={alertsByCamera[camera.id] ?? []}
              onStart={() => start(camera.id)}
              onStop={() => stop(camera.id)}
              onEdit={() => { setEditing(camera); setFormOpen(true); }}
              onDelete={() => remove(camera.id)}
            />
          ))}
        </section>
      )}

      {formOpen ? (
        <CameraForm
          camera={editing}
          onClose={() => setFormOpen(false)}
          onSave={async (draft) => {
            await saveCamera(editing, draft);
          }}
        />
      ) : null}
    </main>
  );
}
