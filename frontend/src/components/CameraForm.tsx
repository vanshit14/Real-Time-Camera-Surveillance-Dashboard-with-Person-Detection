import { FormEvent, useEffect, useState } from "react";
import { Check, Radio, X } from "lucide-react";
import type { Camera } from "../types";

type CameraDraft = Pick<Camera, "name" | "rtspUrl" | "location" | "enabled">;
type CameraErrors = Partial<Record<keyof CameraDraft, string>>;

const emptyDraft: CameraDraft = {
  name: "",
  rtspUrl: "rtsp://mediamtx:8554/testcam",
  location: "",
  enabled: true
};

export function CameraForm({
  camera,
  onSave,
  onClose
}: {
  camera: Camera | null;
  onSave: (draft: CameraDraft) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<CameraDraft>(emptyDraft);
  const [fieldErrors, setFieldErrors] = useState<CameraErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(camera ? { name: camera.name, rtspUrl: camera.rtspUrl, location: camera.location, enabled: camera.enabled } : emptyDraft);
    setFieldErrors({});
    setError(null);
  }, [camera]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateDraft(draft);
    setFieldErrors(validation.errors);
    if (!validation.valid) return;

    setError(null);
    setSaving(true);
    try {
      await onSave(validation.draft);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save camera");
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="side-panel" aria-label="Camera form">
      <div className="panel-header">
        <h2>{camera ? "Edit camera" : "Add camera"}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close" disabled={saving}><X size={18} /></button>
      </div>
      <form onSubmit={submit} className="camera-form">
        <label>
          Camera name
          <input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            aria-invalid={Boolean(fieldErrors.name)}
            disabled={saving}
          />
          {fieldErrors.name ? <span className="field-error">{fieldErrors.name}</span> : null}
        </label>
        <label>
          RTSP URL
          <input
            value={draft.rtspUrl}
            onChange={(event) => setDraft({ ...draft, rtspUrl: event.target.value })}
            aria-invalid={Boolean(fieldErrors.rtspUrl)}
            disabled={saving}
          />
          <span className="field-hint">Use the demo stream: rtsp://mediamtx:8554/testcam</span>
          {fieldErrors.rtspUrl ? <span className="field-error">{fieldErrors.rtspUrl}</span> : null}
        </label>
        <label>
          Location
          <input
            value={draft.location}
            onChange={(event) => setDraft({ ...draft, location: event.target.value })}
            aria-invalid={Boolean(fieldErrors.location)}
            disabled={saving}
          />
          {fieldErrors.location ? <span className="field-error">{fieldErrors.location}</span> : null}
        </label>
        <label className="toggle-row">
          Enabled
          <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} disabled={saving} />
        </label>
        <button type="button" className="secondary-button" onClick={() => setDraft({ ...draft, rtspUrl: "rtsp://mediamtx:8554/testcam", name: draft.name || "Test camera" })} disabled={saving}>
          <Radio size={16} /> Use demo stream
        </button>
        {error ? <div className="error-text">{error}</div> : null}
        <button className="primary-button" type="submit" disabled={saving}>
          <Check size={16} /> {saving ? "Saving" : camera ? "Save changes" : "Create camera"}
        </button>
      </form>
    </aside>
  );
}

function validateDraft(draft: CameraDraft) {
  const trimmed: CameraDraft = {
    name: draft.name.trim(),
    rtspUrl: draft.rtspUrl.trim(),
    location: draft.location.trim(),
    enabled: draft.enabled
  };
  const errors: CameraErrors = {};

  if (!trimmed.name) errors.name = "Camera name is required.";
  if (trimmed.name.length > 120) errors.name = "Camera name must be 120 characters or fewer.";

  if (!trimmed.rtspUrl) {
    errors.rtspUrl = "RTSP URL is required.";
  } else {
    try {
      const parsed = new URL(trimmed.rtspUrl);
      if (!["rtsp:", "rtsps:", "http:", "https:"].includes(parsed.protocol)) {
        errors.rtspUrl = "Use an RTSP URL, for example rtsp://mediamtx:8554/testcam.";
      }
    } catch {
      errors.rtspUrl = "Enter a valid URL, for example rtsp://mediamtx:8554/testcam.";
    }
  }

  if (trimmed.location.length > 160) errors.location = "Location must be 160 characters or fewer.";

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    draft: trimmed
  };
}
