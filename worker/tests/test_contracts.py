import json

from events import encode_fields
from commands import latest_camera_commands


def test_encode_fields_json_encodes_nested_values():
    payload = {
        "eventId": "event-id",
        "type": "person_detected",
        "bbox": {"x": 1, "y": 2, "width": 3, "height": 4},
        "confidence": 0.9,
        "snapshotUrl": None,
    }

    encoded = encode_fields(payload)

    assert encoded["type"] == "person_detected"
    assert json.loads(encoded["bbox"]) == payload["bbox"]
    assert json.loads(encoded["confidence"]) == 0.9
    assert json.loads(encoded["snapshotUrl"]) is None


def test_latest_camera_commands_keeps_only_each_cameras_newest_action():
    def fields(action: str, camera_id: str) -> dict[bytes, bytes]:
        return {
            b"action": action.encode(),
            b"userId": b"user-a",
            b"cameraId": camera_id.encode(),
            b"rtspUrl": b"rtsp://camera/live",
            b"streamKey": f"stream-{camera_id}".encode(),
        }

    messages = [
        (b"3-0", fields("stop", "camera-a")),
        (b"2-0", fields("start", "camera-b")),
        (b"1-0", fields("start", "camera-a")),
    ]

    latest = latest_camera_commands(messages)

    assert [(command.camera_id, command.action) for command in latest] == [
        ("camera-a", "stop"),
        ("camera-b", "start"),
    ]
