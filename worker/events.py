import json
from datetime import datetime, timezone
from typing import Any


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def encode_fields(payload: dict[str, Any]) -> dict[str, str]:
    encoded: dict[str, str] = {}
    for key, value in payload.items():
        encoded[key] = value if isinstance(value, str) else json.dumps(value)
    return encoded
