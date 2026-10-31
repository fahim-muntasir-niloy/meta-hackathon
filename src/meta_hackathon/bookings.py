"""Sessions with an agriculture officer: find the farmer's officers, their free
slots, and book, move or cancel a session (docs/05-officer-booking.md).

The roster (`officers`, assets/officers.csv, seeded by `krishi-db migrate`)
is fake but shaped like the real one: a Sub-Assistant Agriculture Officer and
the Upazila Agriculture Officer per district. Officers see farmers on working
days (Sunday to Thursday) at fixed one-hour slots, Bangladesh time.

Bookings are the farmer's rows, under row-level security like cases (db.py).
Other farmers' bookings are invisible, so free slots come from
officer_busy(), which says when an officer is taken but not by whom, and the
unique index on (officer, slot) stops a double booking even when two farmers
pick the same slot at once.

A booking for a crop case is logged on the case and moves it to "escalated",
in the same transaction.

Calls block, so async code runs them with asyncio.to_thread.
"""

import re
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal

from psycopg import Connection
from psycopg.errors import UniqueViolation
from psycopg.types.json import Jsonb

from meta_hackathon.cases import AGENT, FARMER, Actor, CaseError, log_event
from meta_hackathon.db import farmer, reference_rows

# Bangladesh has no daylight saving time.
DHAKA = timezone(timedelta(hours=6), "Asia/Dhaka")
SLOT_HOURS = (10, 11, 12, 14, 15)  # 13:00 is lunch
WORKING_DAYS = {6, 0, 1, 2, 3}  # Sunday to Thursday (Monday = 0)
MIN_NOTICE = timedelta(hours=1)
MAX_DAYS_AHEAD = 30
MAX_UPCOMING = 3
MAX_ACTIVITY = 20

SessionType = Literal["phone_call", "field_visit", "office_visit"]
SESSION = {
    "phone_call": {"label": "ফোনে কথা", "minutes": 30},
    "field_visit": {"label": "মাঠ পরিদর্শন", "minutes": 60},
    "office_visit": {"label": "অফিসে সাক্ষাৎ", "minutes": 30},
}
STATUS_WORDS = {"confirmed": "নিশ্চিত", "cancelled": "বাতিল", "completed": "সম্পন্ন"}


class BookingError(ValueError):
    """A booking that cannot be made or changed, in words for the model or the farmer."""


def _now() -> datetime:
    return datetime.now(DHAKA)


def _event(actor: Actor, text: str) -> dict:
    return {"at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "actor": actor, "text": text}


def when_en(at: datetime) -> str:
    """"2026-11-02 (Sunday) 10:00", Bangladesh time: for the model."""
    return at.astimezone(DHAKA).strftime("%Y-%m-%d (%A) %H:%M")


_BN_DIGITS = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")
_BN_MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"]
_BN_DAYS = ["সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার", "রবিবার"]


def when_bn(at: datetime) -> str:
    """"২ নভেম্বর, রবিবার, সকাল ১০টা": for the activity log the farmer reads."""
    local = at.astimezone(DHAKA)
    part = "সকাল" if local.hour < 12 else "দুপুর" if local.hour < 15 else "বিকাল"
    hour = local.hour if local.hour <= 12 else local.hour - 12
    text = f"{local.day} {_BN_MONTHS[local.month - 1]}, {_BN_DAYS[local.weekday()]}, {part} {hour}টা"
    return text.translate(_BN_DIGITS)


# ---------------------------------------------------------------------------
# Officers and slots (shared reference data)
# ---------------------------------------------------------------------------
_OFFICER_COLUMNS = "id, name_bn, designation_bn, designation_en, phone, division, district, district_bn, office_bn"


def _english(place: str | None) -> str:
    """The web profile sends "বগুড়া (Bogura)"; the roster is keyed by the English name."""
    place = (place or "").strip()
    if m := re.search(r"\(([^)]+)\)\s*$", place):
        return m.group(1).strip()
    return place


def find_officers(district: str | None, division: str | None = None) -> tuple[list[dict], str]:
    """The officers who serve a district (SAAO first), else those of the
    division; and which of the two matched ("district", "division" or "")."""
    district, division = _english(district), _english(division)
    order = "ORDER BY designation_en LIKE 'Sub-Assistant%%' DESC, id"
    if district:
        rows = reference_rows(
            f"SELECT {_OFFICER_COLUMNS} FROM officers WHERE active AND lower(district) = lower(%s) {order}", (district,)
        )
        if rows:
            return rows, "district"
    if division:
        rows = reference_rows(
            f"SELECT {_OFFICER_COLUMNS} FROM officers WHERE active AND lower(division) = lower(%s) {order} LIMIT 4",
            (division,),
        )
        if rows:
            return rows, "division"
    return [], ""


def get_officer(officer_id: str) -> dict | None:
    rows = reference_rows(f"SELECT {_OFFICER_COLUMNS} FROM officers WHERE id = %s AND active", (officer_id,))
    return rows[0] if rows else None


def _slot_times(day: date) -> list[datetime]:
    if day.weekday() not in WORKING_DAYS:
        return []
    return [datetime.combine(day, time(h), DHAKA) for h in SLOT_HOURS]


def free_slots(officer_id: str, *, from_date: date | None = None, days: int = 7, limit: int = 6) -> list[datetime]:
    """The officer's next free slots, from `from_date` (default: now + notice)."""
    earliest = _now() + MIN_NOTICE
    start_day = max(from_date or earliest.date(), earliest.date())
    end_day = start_day + timedelta(days=days)
    busy = {
        r["officer_busy"]
        for r in reference_rows(
            "SELECT officer_busy(%s, %s, %s)",
            (officer_id, datetime.combine(start_day, time(0), DHAKA), datetime.combine(end_day, time(0), DHAKA)),
        )
    }
    slots = []
    day = start_day
    while day < end_day and len(slots) < limit:
        slots += [s for s in _slot_times(day) if s >= earliest and s not in busy]
        day += timedelta(days=1)
    return slots[:limit]


def parse_slot(value: str) -> datetime:
    """A slot start, "YYYY-MM-DDTHH:MM" in Bangladesh time (an offset is honoured),
    checked against the officers' hours."""
    try:
        at = datetime.fromisoformat(value.strip().replace(" ", "T"))
    except ValueError:
        raise BookingError(f"{value!r} is not a time; write it as YYYY-MM-DDTHH:MM (Bangladesh time).") from None
    at = (at.replace(tzinfo=DHAKA) if at.tzinfo is None else at).astimezone(DHAKA).replace(second=0, microsecond=0)
    if at.date().weekday() not in WORKING_DAYS:
        raise BookingError(f"{at.date()} is a {at.strftime('%A')}; officers see farmers Sunday to Thursday.")
    if at.minute or at.hour not in SLOT_HOURS:
        raise BookingError("Sessions start at 10:00, 11:00, 12:00, 14:00 or 15:00.")
    if at < _now() + MIN_NOTICE:
        raise BookingError("That time has passed or is less than an hour away; pick a later slot.")
    if at.date() > _now().date() + timedelta(days=MAX_DAYS_AHEAD):
        raise BookingError(f"Bookings can be made up to {MAX_DAYS_AHEAD} days ahead.")
    return at


# ---------------------------------------------------------------------------
# Bookings (the farmer's own, under RLS)
# ---------------------------------------------------------------------------
_SELECT = f"""
SELECT b.*, {", ".join(f"o.{c} AS officer_{c}" for c in _OFFICER_COLUMNS.split(", "))}
FROM bookings b JOIN officers o ON o.id = b.officer_id
"""


def booking_view(row: dict) -> dict:
    """A booking as the web UI gets it: in a tool message's artifact and from the API."""
    officer = {k.removeprefix("officer_"): v for k, v in row.items() if k.startswith("officer_") and k != "officer_id"}
    return {
        "id": row["id"],
        "status": row["status"],
        "session_type": row["session_type"],
        "session_label": SESSION[row["session_type"]]["label"],
        "starts_at": row["starts_at"].astimezone(DHAKA).isoformat(timespec="minutes"),
        "ends_at": row["ends_at"].astimezone(DHAKA).isoformat(timespec="minutes"),
        "past": row["ends_at"] < _now(),
        "officer": officer,
        "case_id": row["case_id"],
        "thread_id": row["thread_id"],
        "issue_summary": row["issue_summary"],
        "location": row["location"],
        "activity": row["activity"][-MAX_ACTIVITY:],
        "created_at": row["created_at"].isoformat(timespec="seconds"),
        "updated_at": row["updated_at"].isoformat(timespec="seconds"),
    }


def booking_for_model(view: dict) -> str:
    o = view["officer"]
    return "\n".join(
        [
            f"booking_id: {view['id']} -- {view['status']}" + (" (already over)" if view["past"] else ""),
            f"{view['session_type']} with {o['name_bn']}, {o['designation_en']} ({o['office_bn']}, phone {o['phone']})",
            f"when: {when_en(datetime.fromisoformat(view['starts_at']))} Bangladesh time, "
            f"{SESSION[view['session_type']]['minutes']} minutes",
            f"about: {view['issue_summary']}" + (f" (case_id: {view['case_id']})" if view["case_id"] else ""),
        ]
    )


def summary_line(view: dict) -> str:
    """One line per upcoming booking, for the system prompt."""
    o = view["officer"]
    return (
        f"- {view['session_type']} with {o['name_bn']} ({o['designation_en']}) on "
        f"{when_en(datetime.fromisoformat(view['starts_at']))} (booking_id: {view['id']})"
        + (f", for case {view['case_id']}" if view["case_id"] else "")
    )


def list_bookings_in(conn: Connection, *, upcoming_only: bool = False) -> list[dict]:
    """The calling farmer's bookings in an open db.farmer() transaction: upcoming
    first (soonest first), then the rest, most recent first."""
    where = "WHERE b.status = 'confirmed' AND b.ends_at > now()" if upcoming_only else ""
    rows = conn.execute(f"{_SELECT} {where} ORDER BY b.starts_at").fetchall()
    views = [booking_view(r) for r in rows]
    upcoming = [v for v in views if v["status"] == "confirmed" and not v["past"]]
    rest = [v for v in reversed(views) if v not in upcoming]
    return upcoming + rest


def list_bookings(phone: str, *, upcoming_only: bool = False) -> list[dict]:
    with farmer(phone) as conn:
        return list_bookings_in(conn, upcoming_only=upcoming_only)


def _load(conn: Connection, phone: str, booking_id: str) -> dict:
    row = conn.execute(f"{_SELECT} WHERE b.id = %s AND b.phone = %s FOR UPDATE OF b", (booking_id, phone)).fetchone()
    if row is None:
        raise BookingError(f"No booking {booking_id} for this farmer.")
    return row


def _taken(at: datetime, officer_id: str) -> BookingError:
    others = [when_en(s) for s in free_slots(officer_id, from_date=at.date(), days=3, limit=4)]
    return BookingError(
        f"{when_en(at)} was just taken by another farmer. Free slots nearby: {', '.join(others) or 'none in the next 3 days'}."
    )


def book(
    phone: str,
    *,
    officer_id: str,
    starts_at: str,
    session_type: SessionType,
    issue_summary: str,
    case_id: str | None = None,
    thread_id: str | None = None,
    location: str = "",
    actor: Actor = AGENT,
) -> dict:
    officer = get_officer(officer_id)
    if officer is None:
        raise BookingError(f"No officer {officer_id}; use the officer_id from find_officer_slots.")
    at = parse_slot(starts_at)
    ends = at + timedelta(minutes=SESSION[session_type]["minutes"])
    summary = " ".join(issue_summary.split())[:300]
    if not summary:
        raise BookingError("issue_summary is empty: say in a sentence what the officer should look at.")

    booking_id = f"BK-{uuid.uuid4().hex[:6].upper()}"
    try:
        with farmer(phone) as conn:
            upcoming = conn.execute(
                "SELECT starts_at FROM bookings WHERE status = 'confirmed' AND ends_at > now()"
            ).fetchall()
            if len(upcoming) >= MAX_UPCOMING:
                raise BookingError(
                    f"The farmer already has {MAX_UPCOMING} upcoming sessions. Cancel or wait for one before booking another."
                )
            if any(r["starts_at"] == at for r in upcoming):
                raise BookingError(f"The farmer already has a session at {when_en(at)}.")
            text = f"{SESSION[session_type]['label']} বুক হলো: {officer['name_bn']}, {when_bn(at)}"
            conn.execute(
                """INSERT INTO bookings (id, phone, officer_id, case_id, thread_id, session_type, starts_at, ends_at,
                                         status, issue_summary, location, activity)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'confirmed', %s, %s, %s)""",
                (booking_id, phone, officer_id, case_id, thread_id, session_type, at, ends, summary,
                 " ".join(location.split())[:160], Jsonb([_event(actor, text)])),
            )
            if case_id:
                log_event(conn, phone, case_id, f"অফিসারের সাথে {text}", actor=actor, stage="escalated")
            return booking_view(_load(conn, phone, booking_id))
    except UniqueViolation:
        raise _taken(at, officer_id) from None
    except CaseError as e:
        raise BookingError(f"Not booked: {e}") from None


def cancel(phone: str, booking_id: str, *, reason: str = "", actor: Actor = AGENT) -> dict:
    with farmer(phone) as conn:
        row = _load(conn, phone, booking_id)
        if row["status"] != "confirmed":
            raise BookingError(f"Booking {booking_id} is already {row['status']}.")
        text = "সাক্ষাৎ বাতিল হলো" + (f": {' '.join(reason.split())[:120]}" if reason.strip() else "")
        conn.execute(
            "UPDATE bookings SET status = 'cancelled', activity = activity || %s, updated_at = now() WHERE id = %s",
            (Jsonb([_event(actor, text)]), booking_id),
        )
        if row["case_id"]:
            _log_on_case(conn, phone, row["case_id"], f"{text} ({row['officer_name_bn']})", actor)
        return booking_view(_load(conn, phone, booking_id))


def reschedule(phone: str, booking_id: str, new_starts_at: str, *, actor: Actor = AGENT) -> dict:
    at = parse_slot(new_starts_at)
    try:
        with farmer(phone) as conn:
            row = _load(conn, phone, booking_id)
            if row["status"] != "confirmed":
                raise BookingError(f"Booking {booking_id} is {row['status']}; book a new session instead.")
            if row["starts_at"] == at:
                raise BookingError(f"Booking {booking_id} is already at {when_en(at)}.")
            ends = at + timedelta(minutes=SESSION[row["session_type"]]["minutes"])
            text = f"সময় বদলানো হলো: {when_bn(row['starts_at'])} থেকে {when_bn(at)}"
            conn.execute(
                "UPDATE bookings SET starts_at = %s, ends_at = %s, activity = activity || %s, updated_at = now() WHERE id = %s",
                (at, ends, Jsonb([_event(actor, text)]), booking_id),
            )
            if row["case_id"]:
                _log_on_case(conn, phone, row["case_id"], f"অফিসারের সাথে {text}", actor)
            return booking_view(_load(conn, phone, booking_id))
    except UniqueViolation:
        raise _taken(at, row["officer_id"]) from None


def _log_on_case(conn: Connection, phone: str, case_id: str, text: str, actor: Actor) -> None:
    """Best effort: the case may have been deleted since (case_id is then NULL anyway)."""
    try:
        with conn.transaction():  # a savepoint, so a missing case does not undo the booking change
            log_event(conn, phone, case_id, text, actor=actor)
    except CaseError:
        pass


__all__ = [
    "AGENT",
    "FARMER",
    "BookingError",
    "SessionType",
    "book",
    "booking_for_model",
    "booking_view",
    "cancel",
    "find_officers",
    "free_slots",
    "list_bookings",
    "list_bookings_in",
    "reschedule",
    "summary_line",
]
