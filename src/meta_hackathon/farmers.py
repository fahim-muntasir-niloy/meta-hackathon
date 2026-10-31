"""The farmer's profile (name, place) in the farmers table, under row-level
security (db.py). The web UI sends it with every run; it is saved here so
other channels and tools (officer booking) know it too.

Calls block, so async code runs them with asyncio.to_thread.
"""

import threading

from meta_hackathon.db import farmer

_FIELDS = ("name", "area", "district", "division")
# What was last saved per phone, so an unchanged profile costs no write.
_saved: dict[str, tuple] = {}
_lock = threading.Lock()


def save_profile(phone: str, **profile: str | None) -> None:
    values = tuple((profile.get(f) or "").strip()[:120] or None for f in _FIELDS)
    if not any(values):
        return
    with _lock:
        if _saved.get(phone) == values:
            return
    with farmer(phone) as conn:
        conn.execute(
            "UPDATE farmers SET name = COALESCE(%s, name), area = COALESCE(%s, area), "
            "district = COALESCE(%s, district), division = COALESCE(%s, division), updated_at = now() WHERE phone = %s",
            (*values, phone),
        )
    with _lock:
        _saved[phone] = values


def get_profile(phone: str) -> dict:
    with farmer(phone) as conn:
        row = conn.execute(f"SELECT {', '.join(_FIELDS)} FROM farmers WHERE phone = %s", (phone,)).fetchone()
    return dict(row) if row else {}
