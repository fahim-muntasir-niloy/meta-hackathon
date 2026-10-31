"""The farmer's officer sessions, for the web UI's sidebar and booking cards:
list them, cancel one. Booking and moving go through the agent, which offers
the slots. Changes are logged as the farmer's (bookings.py).

Sync handlers: the store blocks, and FastAPI runs these in a thread."""

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from meta_hackathon.api.deps import PhoneNumber
from meta_hackathon.bookings import FARMER, BookingError, cancel, list_bookings

router = APIRouter(prefix="/v1/bookings", tags=["bookings"])


class CancelRequest(BaseModel):
    reason: str = ""


@router.get("")
def bookings(phone: PhoneNumber) -> dict[Literal["bookings"], list[dict]]:
    """Upcoming sessions first (soonest first), then past and cancelled ones."""
    return {"bookings": list_bookings(phone)}


@router.post("/{booking_id}/cancel")
def cancel_booking(booking_id: str, body: CancelRequest, phone: PhoneNumber) -> dict:
    try:
        return cancel(phone, booking_id, reason=body.reason, actor=FARMER)
    except BookingError as e:
        raise HTTPException(status_code=404 if "No booking" in str(e) else 409, detail=str(e)) from None
