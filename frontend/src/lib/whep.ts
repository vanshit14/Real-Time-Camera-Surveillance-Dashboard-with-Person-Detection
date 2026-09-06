export async function playWhep(video: HTMLVideoElement, url: string, signal: AbortSignal) {
  const pc = new RTCPeerConnection();
  const stream = new MediaStream();
  let resourceUrl: string | null = null;

  pc.addTransceiver("video", { direction: "recvonly" });
  pc.addTransceiver("audio", { direction: "recvonly" });

  pc.ontrack = (event) => {
    stream.addTrack(event.track);
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  };

  signal.addEventListener(
    "abort",
    () => {
      pc.close();
      if (resourceUrl) {
        void fetch(resourceUrl, { method: "DELETE" }).catch(() => undefined);
      }
    },
    { once: true }
  );

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGathering(pc);
  if (signal.aborted) return;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: pc.localDescription?.sdp,
    signal
  });
  if (!response.ok) throw new Error(`WebRTC negotiation failed (${response.status})`);

  const location = response.headers.get("Location");
  resourceUrl = location ? new URL(location, url).toString() : null;
  const answer = await response.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answer });
}

function waitForIceGathering(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", done);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", done);
  });
}

