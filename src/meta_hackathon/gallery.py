"""The annotated photos segment_image made for each farmer, newest first: the
web UI's photo folder (api/images.py). The files themselves are in MEDIA_DIR,
served at /media/<name>; this records whose they are, from which
conversation, and what was marked on them.

Stored with db.py: calls block, so async code runs them with asyncio.to_thread.
"""

import json
from datetime import datetime, timezone

from meta_hackathon.config import settings
from meta_hackathon.db import connect

_SCHEMA = """
CREATE TABLE IF NOT EXISTS images (
    name TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    thread_id TEXT,
    labels TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS images_phone ON images (phone, created_at);
"""


def media_url(name: str) -> str:
    return f"{settings.PUBLIC_BASE_URL.rstrip('/')}/media/{name}"


def record_image(phone: str, name: str, *, thread_id: str | None, labels: list[dict]) -> None:
    """labels: what was marked, e.g. [{"label": "বাদামি গাছফড়িং", "count": 3}]."""
    with connect(_SCHEMA) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO images (name, phone, thread_id, labels, created_at) VALUES (?, ?, ?, ?, ?)",
            (
                name,
                phone,
                thread_id,
                json.dumps(labels, ensure_ascii=False),
                datetime.now(timezone.utc).isoformat(timespec="seconds"),
            ),
        )


def list_images(phone: str, limit: int = 200) -> list[dict]:
    with connect(_SCHEMA) as conn:
        rows = conn.execute(
            "SELECT name, thread_id, labels, created_at FROM images WHERE phone = ? ORDER BY created_at DESC LIMIT ?",
            (phone, limit),
        ).fetchall()
    return [
        {"url": media_url(name), "thread_id": thread_id, "labels": json.loads(labels), "created_at": created_at}
        for name, thread_id, labels, created_at in rows
    ]
