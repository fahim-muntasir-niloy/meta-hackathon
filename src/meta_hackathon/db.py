"""The app's own records (crop cases, the photo folder) in one SQLite file
under DATA_DIR, with the standard library for now (F8 replaces it).

Calls block, so async code runs them with asyncio.to_thread: the Agent
Server rejects blocking calls on its event loop."""

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from meta_hackathon.config import settings


@contextmanager
def connect(schema: str) -> Iterator[sqlite3.Connection]:
    """A connection in autocommit mode, with the caller's tables created if missing."""
    path = Path(settings.DATA_DIR) / "krishi.sqlite3"
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=10, isolation_level=None)
    try:
        conn.executescript(schema)
        yield conn
    finally:
        conn.close()
