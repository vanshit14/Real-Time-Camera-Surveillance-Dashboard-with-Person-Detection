import asyncio
from contextlib import suppress

from redis.asyncio import Redis
from ultralytics import YOLO

from camera_runner import CameraRunner
from commands import CameraCommand, latest_camera_commands
from config import COMMAND_STREAM, CONSUMER_NAME, GROUP, REDIS_URL


class Worker:
    def __init__(self) -> None:
        self.redis = Redis.from_url(REDIS_URL)
        self.model = YOLO("yolov8n.pt")
        self.runners: dict[str, tuple[CameraRunner, asyncio.Task[None]]] = {}

    async def ensure_group(self) -> None:
        try:
            await self.redis.xgroup_create(COMMAND_STREAM, GROUP, id="0", mkstream=True)
        except Exception as exc:
            if "BUSYGROUP" not in str(exc):
                raise

    async def start_camera(self, command: CameraCommand) -> None:
        await self.stop_camera(command.camera_id)
        print(f"starting camera {command.camera_id}", flush=True)
        runner = CameraRunner(self.redis, self.model, command)
        task = asyncio.create_task(runner.run())
        self.runners[command.camera_id] = (runner, task)

    async def stop_camera(self, camera_id: str) -> None:
        existing = self.runners.pop(camera_id, None)
        if not existing:
            return
        print(f"stopping camera {camera_id}", flush=True)
        runner, task = existing
        await runner.stop()
        try:
            await asyncio.wait_for(task, timeout=10)
        except asyncio.TimeoutError:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
            await runner.stop_restream()
            await runner.publish_state("stopped")
        except asyncio.CancelledError:
            await runner.stop_restream()
            await runner.publish_state("stopped")

    async def handle_command(self, command: CameraCommand) -> None:
        print(f"received {command.action} command for camera {command.camera_id}", flush=True)
        if command.action == "start":
            await self.start_camera(command)
        elif command.action == "stop":
            await self.stop_camera(command.camera_id)

    async def restore_active_cameras(self) -> None:
        messages = await self.redis.xrevrange(COMMAND_STREAM, count=1000)
        restored = 0
        for command in latest_camera_commands(messages):
            if command.action == "start":
                await self.start_camera(command)
                restored += 1
        print(f"worker ready; restored {restored} active camera(s)", flush=True)

    async def run(self) -> None:
        await self.ensure_group()
        await self.restore_active_cameras()
        while True:
            response = await self.redis.xreadgroup(
                GROUP,
                CONSUMER_NAME,
                {COMMAND_STREAM: ">"},
                count=10,
                block=5000,
            )
            for _, messages in response:
                for message_id, fields in messages:
                    try:
                        await self.handle_command(CameraCommand.from_stream(fields))
                        await self.redis.xack(COMMAND_STREAM, GROUP, message_id)
                    except Exception as exc:
                        print(f"command {message_id!r} failed: {exc}", flush=True)

    async def shutdown(self) -> None:
        for camera_id in list(self.runners):
            await self.stop_camera(camera_id)
        await self.redis.aclose()
