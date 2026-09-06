import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { playWhep } from "../lib/whep";
import type { RuntimeState } from "../types";

const visibleErrorDelayMs = 10000;

export type BrowserVideoStatus = {
  state: "connecting" | "playing" | "retrying";
  error: string | null;
};

export function WebRtcVideo({
  url,
  state,
  onStatusChange
}: {
  url: string;
  state: RuntimeState;
  onStatusChange?: (status: BrowserVideoStatus) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || state === "stopped" || state === "error") return;
    const controller = new AbortController();
    const handlePlaying = () => onStatusChange?.({ state: "playing", error: null });
    video.addEventListener("playing", handlePlaying);
    onStatusChange?.({ state: "connecting", error: null });
    setStartedAt(Date.now());
    setAttempt(0);
    void (async () => {
      while (!controller.signal.aborted) {
        try {
          setError(null);
          setAttempt((current) => current + 1);
          await playWhep(video, url, controller.signal);
          return;
        } catch (err) {
          if (controller.signal.aborted) return;
          const message = err instanceof Error ? err.message : "Waiting for stream";
          setError(message);
          onStatusChange?.({ state: "retrying", error: message });
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    })();
    return () => {
      video.removeEventListener("playing", handlePlaying);
      controller.abort();
    };
  }, [url, state, onStatusChange]);

  const elapsedMs = attempt >= 0 && startedAt ? Date.now() - startedAt : 0;
  const showRawError = Boolean(error && elapsedMs >= visibleErrorDelayMs);
  const showConnecting = !showRawError && (state === "connecting" || Boolean(error));

  return (
    <>
      <video ref={videoRef} muted playsInline autoPlay />
      {showConnecting ? <div className="video-overlay"><Loader2 className="spin" size={22} /> Connecting video</div> : null}
      {showRawError ? <div className="video-overlay error">{error}</div> : null}
    </>
  );
}
