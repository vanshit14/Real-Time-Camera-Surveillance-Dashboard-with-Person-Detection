from dataclasses import dataclass


@dataclass
class CameraCommand:
    action: str
    user_id: str
    camera_id: str
    rtsp_url: str | None
    stream_key: str | None

    @staticmethod
    def from_stream(fields: dict[bytes, bytes]) -> "CameraCommand":
        decoded = {key.decode(): value.decode() for key, value in fields.items()}
        return CameraCommand(
            action=decoded["action"],
            user_id=decoded["userId"],
            camera_id=decoded["cameraId"],
            rtsp_url=decoded.get("rtspUrl"),
            stream_key=decoded.get("streamKey"),
        )


def latest_camera_commands(messages: list[tuple[bytes, dict[bytes, bytes]]]) -> list[CameraCommand]:
    latest: list[CameraCommand] = []
    seen: set[str] = set()
    for _, fields in messages:
        try:
            command = CameraCommand.from_stream(fields)
        except (KeyError, UnicodeDecodeError):
            continue
        if command.camera_id in seen:
            continue
        seen.add(command.camera_id)
        latest.append(command)
    return latest
