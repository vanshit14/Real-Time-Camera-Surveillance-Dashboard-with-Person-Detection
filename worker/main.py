import asyncio
import signal

from worker import Worker


async def main() -> None:
    worker = Worker()
    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    runner = asyncio.create_task(worker.run())
    await stop_event.wait()
    runner.cancel()
    await worker.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
