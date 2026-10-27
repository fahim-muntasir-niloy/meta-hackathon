import uuid
from datetime import datetime, timedelta
from typing import Literal

from langchain.tools import ToolRuntime, tool

from meta_hackathon.agent.context import UserContext, phone_number


@tool
def schedule_officer_session(
    location: str,
    issue_summary: str,
    preferred_date: str | None = None,
    session_type: Literal["phone_call", "field_visit", "office_visit"] = "phone_call",
    *,
    runtime: ToolRuntime[UserContext],
) -> dict:
    """Book a session with the local agriculture extension officer (SAAO).
    Only call this AFTER the farmer has explicitly confirmed they want a booking
    and agreed to the location, session type and date.

    Args:
        location: Farmer's union / upazila / district.
        issue_summary: Short summary of the crop problem for the officer.
        preferred_date: ISO date (YYYY-MM-DD) the farmer prefers, if any.
        session_type: "phone_call", "field_visit" or "office_visit".
    """
    # SIMULATED: replace with officer roster lookup + slot calculation (B1-B4).
    phone = phone_number(runtime)
    day = (
        datetime.fromisoformat(preferred_date)
        if preferred_date
        else datetime.now() + timedelta(days=1)
    )
    slot = day.replace(hour=10, minute=30, second=0, microsecond=0)
    return {
        "booking_id": f"BK-{uuid.uuid4().hex[:8].upper()}",
        "status": "confirmed",
        "simulated": True,
        "farmer_phone": phone,
        "officer": {
            "name": "Md. Rahim Uddin (simulated)",
            "designation": "Sub-Assistant Agriculture Officer",
            "phone": "+8801700000000",
            "union": location,
        },
        "session_type": session_type,
        "slot": slot.isoformat(timespec="minutes"),
        "issue_summary": issue_summary,
    }
