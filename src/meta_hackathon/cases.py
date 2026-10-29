"""Crop cases KrishiBondhu tracks for a farmer: storage, the plan's rules, and
how a case is shown to the web UI and to the model (docs/04-case-lifecycle.md).

A case is one crop problem (rice blast in one plot, aphids on brinjal in
another) with a treatment plan: dated steps from today to the last check.

    {
        "id": "s3",                  # stable within the case
        "title": "ট্রাইসাইক্লাজল স্প্রে করুন",
        "kind": "action",            # action: something to do | check: look at the plants and report
        "details": "১০ লিটার পানিতে ৬ গ্রাম, বিকেলে",
        "safety_note": "মাস্ক ও গ্লাভস পরুন",
        "due": "2026-10-30",         # ISO date, or None
        "status": "todo",            # see Status
        "outcome": None,             # for checks: better | same | worse
        "note": "",                  # KrishiBondhu's comment on how it went
    }

Both the agent (tools/cases.py) and the farmer (the pane, api/cases.py) change
a case. Every change reads and writes the row inside one write transaction, so
neither overwrites the other, and is logged to the case's `activity` -- who did
what, newest last -- so the agent knows what the farmer did in the pane between
messages.

Stored with db.py: calls block, so async code runs them with asyncio.to_thread.
"""

import json
import sqlite3
import uuid
from datetime import date, datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from meta_hackathon.db import connect

Kind = Literal["action", "check"]
# todo: not yet. done: done, or a check answered. attention: something went
# wrong (the note says what). skipped: does not apply any more.
Status = Literal["todo", "done", "attention", "skipped"]
Outcome = Literal["better", "same", "worse"]
Stage = Literal["in_treatment", "escalated", "resolved", "abandoned"]
Confidence = Literal["high", "medium", "low"]
CLOSED_STAGES = {"resolved", "abandoned"}

MAX_OPEN_CASES = 5
MAX_STEPS = 20
MAX_PHOTOS = 12
MAX_ACTIVITY = 40
MAX_TEXT = 300
MAX_TITLE = 120
AGENT, FARMER = "agent", "farmer"
Actor = Literal["agent", "farmer"]


def _iso_date(value: str | None) -> str | None:
    """A YYYY-MM-DD date, or None for an empty value."""
    value = (value or "").strip()
    if not value:
        return None
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        raise ValueError(f"{value!r} is not a date; write it as YYYY-MM-DD") from None


class PlanStepInput(BaseModel):
    """One step of a treatment plan, as the agent writes it."""

    title: str = Field(description='Short Bangla instruction, e.g. "আক্রান্ত পাতা তুলে পুড়িয়ে ফেলুন".')
    kind: Kind = Field(
        default="action",
        description='"action" for something the farmer does; "check" for a follow-up where they look at the plants '
        "(and send a photo) and tell you if it is better, the same or worse.",
    )
    details: str = Field(default="", description="How exactly: dose, mixing, time of day, where. Bangla.")
    safety_note: str = Field(default="", description="PPE, pre-harvest interval, weather to avoid. Bangla. Empty if none.")
    due: str | None = Field(default=None, description="YYYY-MM-DD to do it on.")

    @field_validator("due")
    @classmethod
    def _due(cls, v):
        return _iso_date(v)


class StepChange(BaseModel):
    """A change to one step already in the plan."""

    step_id: str
    status: Status | None = None
    outcome: Outcome | None = Field(default=None, description="For a check: what the farmer reported.")
    note: str | None = Field(default=None, description="What you made of it, in one Bangla sentence. Shown under the step.")
    due: str | None = Field(default=None, description='YYYY-MM-DD; "" removes the date.')

    @field_validator("due")
    @classmethod
    def _due(cls, v):
        # None leaves the date alone; "" clears it.
        return v if v is None else (_iso_date(v) or "")


class PhotoInput(BaseModel):
    url: str = Field(description="An annotated_image_url from segment_image.")
    caption: str = Field(default="", description='Short Bangla caption, e.g. "৩য় দিন: দাগ কমেছে".')


class CaseError(ValueError):
    """A change that cannot be made, in words for the model or the farmer."""


def _clip(value: str | None, limit: int = MAX_TEXT) -> str:
    return " ".join((value or "").split())[:limit]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _event(actor: Actor, text: str) -> dict:
    return {"at": _now(), "actor": actor, "text": text}


def new_steps(inputs: list[PlanStepInput], start: int = 1) -> list[dict]:
    return [
        {
            "id": f"s{start + n}",
            "title": _clip(step.title, MAX_TITLE) or "ধাপ",
            "kind": step.kind,
            "details": _clip(step.details),
            "safety_note": _clip(step.safety_note),
            "due": step.due,
            "status": "todo",
            "outcome": None,
            "note": "",
        }
        for n, step in enumerate(inputs)
    ]


def _next_step_number(steps: list[dict]) -> int:
    numbers = [int(s["id"][1:]) for s in steps if s.get("id", "").startswith("s") and s["id"][1:].isdigit()]
    return max(numbers, default=0) + 1


def progress(steps: list[dict]) -> dict:
    """Counts over the steps still in the plan."""
    live = [s for s in steps if s["status"] != "skipped"]
    return {
        "total": len(live),
        "done": sum(s["status"] == "done" for s in live),
        "attention": sum(s["status"] == "attention" for s in live),
    }


def next_due(steps: list[dict]) -> dict | None:
    """The earliest step still to do."""
    open_steps = [s for s in steps if s["status"] in ("todo", "attention")]
    return min(open_steps, key=lambda s: s.get("due") or "9999", default=None)


def case_view(case: dict) -> dict:
    """A case as the web UI gets it: in a tool message's artifact and from the API."""
    return {**case, "progress": progress(case["steps"]), "activity": case["activity"][-20:]}


def case_for_model(view: dict) -> str:
    """The whole case in a compact form the agent can act on."""
    p = view["progress"]
    lines = [
        f"case_id: {view['id']}",
        f"{view['problem']} on {view['crop']}" + (f" ({view['plot']})" if view["plot"] else "")
        + f" -- stage: {view['stage']}, confidence: {view['confidence']}",
        f"started {view['started_on']}" + (f", plan ends {view['end_date']}" if view["end_date"] else ""),
        f"{p['done']} of {p['total']} steps done, {p['attention']} need attention.",
        f"next step shown: {view['next_step'] or '(none)'}",
        "steps:",
    ]
    for s in view["steps"]:
        line = f"- {s['id']} [{s['status']}] {s['title']} ({s['kind']})"
        if s.get("due"):
            line += f" due {s['due']}"
        if s.get("outcome"):
            line += f" -- reported {s['outcome']}"
        if s["note"]:
            line += f" -- note: {s['note']}"
        lines.append(line)
    if view["photos"]:
        lines.append(f"{len(view['photos'])} photo(s) on file, latest: {view['photos'][-1]['caption'] or '(no caption)'}")
    if recent := view["activity"][-8:]:
        lines.append("recent activity, oldest first:")
        lines += [
            f"- {a['at'][:16].replace('T', ' ')} {'the farmer' if a['actor'] == FARMER else 'you'}: {a['text']}"
            for a in recent
        ]
    return "\n".join(lines)


def summary_line(case: dict) -> str:
    """One line per case, for the system prompt."""
    p = progress(case["steps"])
    line = (
        f"- {case['problem']} on {case['crop']} (case_id: {case['id']}) -- {case['stage']}, "
        f"{p['done']} of {p['total']} steps done" + (f", {p['attention']} need attention" if p["attention"] else "")
    )
    if case["end_date"]:
        line += f", plan ends {case['end_date']}"
    if due := next_due(case["steps"]):
        line += f", next: {due['title']}" + (f" on {due['due']}" if due.get("due") else "")
    return line


# The activity log is shown to the farmer, so it is in Bangla; the model reads it as well.
STATUS_WORDS = {"todo": "বাকি", "done": "সম্পন্ন", "attention": "নজর দরকার", "skipped": "বাদ"}
OUTCOME_WORDS = {"better": "ভালো হচ্ছে", "same": "একই রকম", "worse": "খারাপ হচ্ছে"}
STAGE_WORDS = {"in_treatment": "চিকিৎসা চলছে", "escalated": "অফিসারের কাছে", "resolved": "সেরে গেছে", "abandoned": "বন্ধ"}


def _describe(before: dict, after: dict) -> list[str]:
    """What changed on one step, in a few words each."""
    title = f'"{after["title"]}"'
    said = []
    if after.get("outcome") != before.get("outcome") and after.get("outcome"):
        said.append(f"{title}: {OUTCOME_WORDS[after['outcome']]}")
    if after["status"] != before["status"]:
        text = f"{title}: {STATUS_WORDS[after['status']]}"
        if after["status"] == "attention" and after["note"]:
            text += f" ({after['note']})"
        said.append(text)
    if after.get("due") != before.get("due"):
        said.append(f"{title} সরানো হলো {after['due']}" if after.get("due") else f"{title}-এর তারিখ সরানো হলো")
    return said


# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------
_SCHEMA = """
CREATE TABLE IF NOT EXISTS crop_cases (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS crop_cases_phone ON crop_cases (phone, updated_at);
"""


def list_cases(phone: str, *, include_closed: bool = True) -> list[dict]:
    with connect(_SCHEMA) as conn:
        rows = conn.execute(
            "SELECT data FROM crop_cases WHERE phone = ? ORDER BY updated_at DESC", (phone,)
        ).fetchall()
    cases = [json.loads(r[0]) for r in rows]
    return cases if include_closed else [c for c in cases if c["stage"] not in CLOSED_STAGES]


def get_case(phone: str, case_id: str) -> dict | None:
    with connect(_SCHEMA) as conn:
        row = conn.execute("SELECT data FROM crop_cases WHERE id = ? AND phone = ?", (case_id, phone)).fetchone()
    return json.loads(row[0]) if row else None


def _write(conn: sqlite3.Connection, phone: str, case: dict, *, insert: bool = False) -> None:
    case["updated_at"] = _now()
    data = json.dumps(case, ensure_ascii=False)
    if insert:
        conn.execute(
            "INSERT INTO crop_cases (id, phone, data, updated_at) VALUES (?, ?, ?, ?)",
            (case["id"], phone, data, case["updated_at"]),
        )
    else:
        conn.execute("UPDATE crop_cases SET data = ?, updated_at = ? WHERE id = ?", (data, case["updated_at"], case["id"]))


def create_case(
    phone: str,
    *,
    crop: str,
    problem: str,
    plot: str,
    diagnosis: str,
    confidence: Confidence,
    steps: list[PlanStepInput],
    warning_signs: list[str],
    next_step: str,
    end_date: str | None,
    thread_id: str | None,
) -> dict:
    if not steps:
        raise CaseError("The plan is empty. List what the farmer should do and when to check in `steps`.")
    if len(steps) > MAX_STEPS:
        raise CaseError(f"The plan has more than {MAX_STEPS} steps. Merge the small ones.")
    try:
        end = _iso_date(end_date) or max((s.due for s in steps if s.due), default=None)
    except ValueError as e:
        raise CaseError(f"end_date: {e}") from None

    with connect(_SCHEMA) as conn:
        conn.execute("BEGIN IMMEDIATE")
        open_count = sum(
            json.loads(r[0])["stage"] not in CLOSED_STAGES
            for r in conn.execute("SELECT data FROM crop_cases WHERE phone = ?", (phone,))
        )
        if open_count >= MAX_OPEN_CASES:
            conn.execute("ROLLBACK")
            raise CaseError(
                f"The farmer already has {MAX_OPEN_CASES} open cases. Ask which one is over "
                "(mark it resolved or abandoned) before starting another."
            )
        case = {
            "id": f"c{uuid.uuid4().hex[:10]}",
            "crop": _clip(crop, 40),
            "problem": _clip(problem, MAX_TITLE),
            "plot": _clip(plot, 60),
            "diagnosis": _clip(diagnosis),
            "confidence": confidence,
            "stage": "in_treatment",
            "started_on": date.today().isoformat(),
            "end_date": end,
            "next_step": _clip(next_step),
            "warning_signs": [_clip(w, 160) for w in warning_signs[:6] if w.strip()],
            "steps": new_steps(steps),
            "photos": [],
            "thread_id": thread_id,
            "created_at": _now(),
            "activity": [_event(AGENT, f"{len(steps)}টি ধাপের পরিকল্পনা শুরু হলো")],
        }
        _write(conn, phone, case, insert=True)
        conn.execute("COMMIT")
    return case


def change_case(
    phone: str,
    case_id: str,
    *,
    changes: list[StepChange] = (),
    add_steps: list[PlanStepInput] = (),
    remove_step_ids: list[str] = (),
    add_photo: PhotoInput | None = None,
    stage: Stage | None = None,
    next_step: str | None = None,
    end_date: str | None = None,
    warning_signs: list[str] | None = None,
    actor: Actor = AGENT,
) -> dict:
    """Apply a set of changes at once, and log them as `actor`'s; nothing is
    saved if any of them fails."""
    with connect(_SCHEMA) as conn:
        conn.execute("BEGIN IMMEDIATE")
        try:
            case = _apply(conn, phone, case_id, changes, add_steps, remove_step_ids, add_photo, stage, next_step, end_date, warning_signs, actor)
        except Exception:
            conn.execute("ROLLBACK")
            raise
        conn.execute("COMMIT")
    return case


def _apply(conn, phone, case_id, changes, add_steps, remove_step_ids, add_photo, stage, next_step, end_date, warning_signs, actor) -> dict:
    row = conn.execute("SELECT data FROM crop_cases WHERE id = ? AND phone = ?", (case_id, phone)).fetchone()
    if row is None:
        raise CaseError(f"No case {case_id} for this farmer.")
    case = json.loads(row[0])

    steps = case["steps"]
    by_id = {s["id"]: s for s in steps}
    before = {s["id"]: dict(s) for s in steps}
    said: list[str] = []

    for change in changes:
        step = by_id.get(change.step_id)
        if step is None:
            raise CaseError(f"No step {change.step_id} in this case. Its steps are: {', '.join(by_id)}.")
        if change.outcome is not None:
            step["outcome"] = change.outcome
            if change.status is None and step["status"] == "todo":
                step["status"] = "done"
        if change.status is not None:
            step["status"] = change.status
        if change.note is not None:
            step["note"] = _clip(change.note)
        if change.due is not None:
            step["due"] = change.due or None
    for step_id in dict.fromkeys(c.step_id for c in changes):
        said += _describe(before[step_id], by_id[step_id])

    removed = set(remove_step_ids)
    if unknown := removed - by_id.keys():
        raise CaseError(f"No step {', '.join(sorted(unknown))} in this case.")
    steps = [s for s in steps if s["id"] not in removed]
    said += [f'"{before[i]["title"]}" বাদ দেওয়া হলো' for i in remove_step_ids]

    added = new_steps(list(add_steps), start=_next_step_number(steps))
    steps += added
    if len(steps) > MAX_STEPS:
        raise CaseError(f"The plan would have more than {MAX_STEPS} steps. Merge the small ones.")
    said += [f'নতুন ধাপ: "{s["title"]}"' for s in added]
    case["steps"] = steps

    if add_photo is not None:
        if not add_photo.url.startswith(("http://", "https://")):
            raise CaseError("add_photo.url must be an annotated_image_url from segment_image.")
        case["photos"] = [*case["photos"], {"url": add_photo.url, "caption": _clip(add_photo.caption, 120), "at": _now()}][-MAX_PHOTOS:]
        said.append("ছবি যোগ হলো" + (f": {add_photo.caption}" if add_photo.caption else ""))
    if stage is not None and stage != case["stage"]:
        case["stage"] = stage
        said.append(f"অবস্থা: {STAGE_WORDS[stage]}")
    if next_step is not None:
        case["next_step"] = _clip(next_step)
    if warning_signs is not None:
        case["warning_signs"] = [_clip(w, 160) for w in warning_signs[:6] if w.strip()]
    if end_date is not None:
        try:
            end = _iso_date(end_date)
        except ValueError as e:
            raise CaseError(f"end_date: {e}") from None
        if end != case["end_date"]:
            case["end_date"] = end
            said.append(f"শেষ চেকআপ {end}" if end else "শেষ চেকআপের তারিখ সরানো হলো")
    if said:
        case["activity"] = [*case["activity"], *(_event(actor, t) for t in said)][-MAX_ACTIVITY:]

    _write(conn, phone, case)
    return case


def delete_case(phone: str, case_id: str) -> bool:
    with connect(_SCHEMA) as conn:
        cur = conn.execute("DELETE FROM crop_cases WHERE id = ? AND phone = ?", (case_id, phone))
    return cur.rowcount > 0
