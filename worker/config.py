import os


REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
MEDIAMTX_RTSP_URL = os.getenv("MEDIAMTX_RTSP_URL", "rtsp://localhost:8554")
CONSUMER_NAME = os.getenv("WORKER_CONSUMER_NAME", "worker-1")
DETECTION_CONFIDENCE = float(os.getenv("DETECTION_CONFIDENCE", "0.35"))
DETECTION_INTERVAL_MS = int(os.getenv("DETECTION_INTERVAL_MS", "500"))

COMMAND_STREAM = "camera.commands"
EVENT_STREAM = "detection.events"
STATS_STREAM = "camera.stats"
STATE_STREAM = "camera.states"
GROUP = "camera-workers"
MODEL_NAME = "yolov8n-coco"
