"""Booking a session with the farmer's agriculture officer (bookings.py has the
roster, the slots and the rules).

find_officer_slots shows who serves the farmer's area and when they are free;
book_officer_session books one slot once the farmer has said yes;
change_officer_booking moves or cancels it. The booking tools return the
booking, as the web UI shows it, as the ToolMessage's `artifact`; the model
gets a compact text form.

The store blocks, so these are sync tools: LangChain runs them in a thread.
"""

from datetime import date
from typing import Literal

from langchain.tools import ToolException, ToolRuntime, tool

from meta_hackathon import bookings
from meta_hackathon.agent.context import UserContext, phone_number
from meta_hackathon.bookings import BookingError, SessionType, booking_for_model, when_en
from meta_hackathon.farmers import get_profile

_SHOWN = "The booking is shown as a card in the chat and in the sidebar; do not repeat every detail."


def _phone(runtime: ToolRuntime) -> str:
    phone = phone_number(runtime)
    if not phone:
        raise ToolException("No farmer identity on this request, so nothing can be booked.")
    return phone


def _place(runtime: ToolRuntime, phone: str) -> dict:
    """The farmer's area, district and division: from the web profile, else as saved."""
    ctx = runtime.context
    place = {k: getattr(ctx, k, None) for k in ("area", "district", "division")}
    if not place["district"]:
        place = {k: v for k, v in get_profile(phone).items() if k != "name"} or place
    return place


@tool
def find_officer_slots(
    session_type: SessionType,
    *,
    runtime: ToolRuntime[UserContext],
    from_date: str | None = None,
    district: str | None = None,
) -> str:
    """Find the agriculture officers who serve the farmer's area and their next free slots.

    Call it when the farmer wants to talk to or meet an officer, or when you are offering one
    (a case getting worse, low confidence, a severe problem). Then offer the farmer two or three
    of the slots and the session type, and book only after they say yes.

    - session_type: phone_call (quickest), field_visit (the officer comes to the field; for a
      problem that needs to be seen) or office_visit (the farmer goes to the upazila office).
    - from_date: YYYY-MM-DD, if the farmer wants a day from then on.
    - district: English district name, only if the farmer asks for another district than in
      their profile.
    """
    phone = _phone(runtime)
    place = _place(runtime, phone)
    officers, matched = bookings.find_officers(district or place.get("district"), place.get("division"))
    if not officers:
        return (
            "No officer found: the farmer's district is not known. Ask which district (and upazila) "
            "they are in, then call this again with `district`."
        )
    try:
        start = date.fromisoformat(from_date) if from_date else None
    except ValueError:
        raise ToolException(f"from_date {from_date!r} is not YYYY-MM-DD.") from None

    lines = [
        f"Officers for {officers[0]['district']} ({'the farmer’s district' if matched == 'district' else 'same division; none listed for the district'}), "
        f"session: {session_type}. Officers work Sunday to Thursday; slots are Bangladesh time."
    ]
    for o in officers[:2]:
        slots = bookings.free_slots(o["id"], from_date=start)
        lines.append(
            f"\nofficer_id: {o['id']} -- {o['name_bn']}, {o['designation_bn']} ({o['designation_en']}), {o['office_bn']}"
        )
        lines += [f"- {s.strftime('%Y-%m-%dT%H:%M')} = {when_en(s)}" for s in slots] or ["- no free slot in the next 7 days"]
    lines.append(
        "\nPrefer the SAAO for a first visit. Pass the exact YYYY-MM-DDTHH:MM to book_officer_session after the farmer agrees."
    )
    return "\n".join(lines)


@tool(response_format="content_and_artifact")
def book_officer_session(
    officer_id: str,
    starts_at: str,
    session_type: SessionType,
    issue_summary: str,
    *,
    runtime: ToolRuntime[UserContext],
    case_id: str | None = None,
) -> tuple[str, dict]:
    """Book a session with an officer, in a slot from find_officer_slots.

    Only call this AFTER the farmer has explicitly agreed to the officer, the slot and the
    session type. Never book a slot you did not get from find_officer_slots.

    - starts_at: the slot, YYYY-MM-DDTHH:MM, Bangladesh time.
    - issue_summary: two or three Bangla sentences for the officer: crop, problem, what has
      been tried and how it went. The officer reads it before the session.
    - case_id: the crop case this is about, if any. The case is moved to "escalated" and the
      booking is logged on it.
    """
    phone = _phone(runtime)
    place = _place(runtime, phone)
    try:
        view = bookings.book(
            phone,
            officer_id=officer_id,
            starts_at=starts_at,
            session_type=session_type,
            issue_summary=issue_summary,
            case_id=case_id,
            thread_id=(runtime.config or {}).get("configurable", {}).get("thread_id"),
            location=", ".join(v for v in (place.get("area"), place.get("district")) if v),
        )
    except BookingError as e:
        raise ToolException(f"Not booked: {e}") from e
    return f"Booked. {_SHOWN}\n{booking_for_model(view)}", view


@tool(response_format="content_and_artifact")
def change_officer_booking(
    booking_id: str,
    action: Literal["reschedule", "cancel"],
    *,
    runtime: ToolRuntime[UserContext],
    new_starts_at: str | None = None,
    reason: str = "",
) -> tuple[str, dict]:
    """Move or cancel one of the farmer's officer sessions, after the farmer asked for it.

    - reschedule: new_starts_at is a free slot from find_officer_slots for the same officer,
      YYYY-MM-DDTHH:MM, Bangladesh time.
    - cancel: reason in a few Bangla words, if the farmer gave one.
    """
    phone = _phone(runtime)
    try:
        if action == "reschedule":
            if not new_starts_at:
                raise BookingError("new_starts_at is needed to reschedule.")
            view = bookings.reschedule(phone, booking_id, new_starts_at)
        else:
            view = bookings.cancel(phone, booking_id, reason=reason)
    except BookingError as e:
        raise ToolException(f"Nothing was changed: {e}") from e
    return f"{'Moved' if action == 'reschedule' else 'Cancelled'}. {_SHOWN}\n{booking_for_model(view)}", view


for _t in (find_officer_slots, book_officer_session, change_officer_booking):
    # A ToolException becomes an error ToolMessage the model can read and fix.
    _t.handle_tool_error = True
