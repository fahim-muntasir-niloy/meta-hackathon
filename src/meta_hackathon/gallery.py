"""The annotated photos segment_image made for each farmer, newest first: the
web UI's photo folder (api/images.py). The files themselves are in MEDIA_DIR,
served at /media/<name>; this records whose they are, from which
conversation, and what was marked on them.

Stored in Postgres (the images table) under row-level security per farmer
(db.py). Calls block, so async code runs them with asyncio.to_thread.
"""

from psycopg.types.json import Jsonb

from meta_hackathon.config import settings
from meta_hackathon.db import farmer


def media_url(name: str) -> str:
    return f"{settings.PUBLIC_BASE_URL.rstrip('/')}/media/{name}"


def record_image(phone: str, name: str, *, thread_id: str | None, labels: list[dict]) -> None:
    """labels: what was marked, e.g. [{"label": "বাদামি গাছফড়িং", "count": 3}]."""
    with farmer(phone) as conn:
        conn.execute(
            "INSERT INTO images (name, phone, thread_id, labels) VALUES (%s, %s, %s, %s) "
            "ON CONFLICT (name) DO UPDATE SET thread_id = EXCLUDED.thread_id, labels = EXCLUDED.labels",
            (name, phone, thread_id, Jsonb(labels)),
        )


def list_images(phone: str, limit: int = 200) -> list[dict]:
    with farmer(phone) as conn:
        rows = conn.execute(
            "SELECT name, thread_id, labels, created_at FROM images ORDER BY created_at DESC LIMIT %s", (limit,)
        ).fetchall()
    return [
        {
            "url": media_url(r["name"]),
            "thread_id": r["thread_id"],
            "labels": r["labels"],
            "created_at": r["created_at"].isoformat(timespec="seconds"),
        }
        for r in rows
    ]
