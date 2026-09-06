import asyncio
import time
import uuid
from collections import deque
from typing import Any

import cv2
from redis.asyncio import Redis
from ultralytics import YOLO

from commands import CameraCommand
from config import DETECTION_CONFIDENCE, DETECTION_INTERVAL_MS, EVENT_STREAM, MEDIAMTX_RTSP_URL, MODEL_NAME, STATE_STREAM, STATS_STREAM
from events import encode_fields, utc_now


class CameraRunner:
    def __init__(self, redis: Redis, model: YOLO, command: CameraCommand):
        self.redis = redis
        self.model = model
        self.command = command
        self.stop_event = asyncio.Event()
        self.ffmpeg: asyncio.subprocess.Process | None = None
        self.detection_times: deque[float] = deque()
        self.frame_times: deque[float] = deque(maxlen=120)

    async def run(self) -> None:
        while not self.stop_event.is_set():
            await self.publish_state("connecting")
            try:
                await self.start_restream()
                await self.detect_loop()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                print(f"camera {self.command.camera_id} failed: {exc}; retrying", flush=True)
                await self.publish_state("error", str(exc))
            finally:
                await self.stop_restream()
            if not self.stop_event.is_set():
                await asyncio.sleep(3)
        await self.publish_state("stopped")

    async def start_restream(self) -> None:
        if not self.command.rtsp_url or not self.command.stream_key:
            raise ValueError("start command requires rtspUrl and streamKey")
        output = f"{MEDIAMTX_RTSP_URL.rstrip('/')}/{self.command.stream_key}"
        self.ffmpeg = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-rtsp_transport",
            "tcp",
            "-i",
            self.command.rtsp_url,
            "-an",
            "-c:v",
            "copy",
            "-f",
            "rtsp",
            output,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )

    async def stop_restream(self) -> None:
        if self.ffmpeg and self.ffmpeg.returncode is None:
            self.ffmpeg.terminate()
            try:
                await asyncio.wait_for(self.ffmpeg.wait(), timeout=5)
            except asyncio.TimeoutError:
                self.ffmpeg.kill()
        self.ffmpeg = None

    async def detect_loop(self) -> None:
        if not self.command.rtsp_url:
            raise ValueError("missing rtspUrl")

        capture = cv2.VideoCapture(self.command.rtsp_url, cv2.CAP_FFMPEG)
        if not capture.isOpened():
            raise RuntimeError(f"could not open RTSP stream: {self.command.rtsp_url}")

        print(f"camera {self.command.camera_id} input connected", flush=True)
        await self.publish_state("live")
        last_detection = 0.0
        last_stats = 0.0
        last_frame = time.monotonic()

        try:
            while not self.stop_event.is_set():
                ok, frame = capture.read()
                now = time.time()
                if not ok:
                    if time.monotonic() - last_frame > 10:
                        raise RuntimeError("camera stopped returning frames")
                    await asyncio.sleep(0.2)
                    if self.ffmpeg and self.ffmpeg.returncode is not None:
                        raise RuntimeError("restream process exited")
                    continue

                last_frame = time.monotonic()
                self.frame_times.append(now)
                if (now - last_detection) * 1000 >= DETECTION_INTERVAL_MS:
                    last_detection = now
                    await self.detect_frame(frame, now)

                if now - last_stats >= 1:
                    last_stats = now
                    await self.publish_stats()

                await asyncio.sleep(0)
        finally:
            capture.release()

    async def detect_frame(self, frame: Any, now: float) -> None:
        results = self.model.predict(frame, classes=[0], conf=DETECTION_CONFIDENCE, verbose=False)
        for result in results:
            for box in result.boxes:
                confidence = float(box.conf[0])
                x1, y1, x2, y2 = [int(value) for value in box.xyxy[0].tolist()]
                self.detection_times.append(now)
                while self.detection_times and now - self.detection_times[0] > 60:
                    self.detection_times.popleft()
                await self.publish_detection(confidence, x1, y1, x2 - x1, y2 - y1)

    def current_fps(self) -> float:
        if len(self.frame_times) < 2:
            return 0.0
        duration = self.frame_times[-1] - self.frame_times[0]
        return round((len(self.frame_times) - 1) / duration, 2) if duration > 0 else 0.0

    async def publish_detection(self, confidence: float, x: int, y: int, width: int, height: int) -> None:
        bucket = int(time.time() // 10)
        payload = {
            "eventId": str(uuid.uuid4()),
            "type": "person_detected",
            "cameraId": self.command.camera_id,
            "userId": self.command.user_id,
            "occurredAt": utc_now(),
            "confidence": confidence,
            "bbox": {"x": x, "y": y, "width": width, "height": height},
            "snapshotUrl": None,
            "source": "worker",
            "model": MODEL_NAME,
            "dedupeKey": f"{self.command.camera_id}:person:{bucket}",
        }
        await self.redis.xadd(EVENT_STREAM, encode_fields(payload))

    async def publish_stats(self) -> None:
        now = time.time()
        while self.detection_times and now - self.detection_times[0] > 60:
            self.detection_times.popleft()
        await self.redis.xadd(
            STATS_STREAM,
            encode_fields(
                {
                    "cameraId": self.command.camera_id,
                    "userId": self.command.user_id,
                    "fps": self.current_fps(),
                    "detectionsPerMinute": len(self.detection_times),
                    "state": "live",
                    "updatedAt": utc_now(),
                }
            ),
        )

    async def publish_state(self, state: str, error: str | None = None) -> None:
        await self.redis.xadd(
            STATE_STREAM,
            encode_fields(
                {
                    "cameraId": self.command.camera_id,
                    "userId": self.command.user_id,
                    "state": state,
                    "error": error,
                    "updatedAt": utc_now(),
                }
            ),
        )

    async def stop(self) -> None:
        self.stop_event.set()
