"""The farmer's crop cases, for the web UI's tracker pane: list them, tick a
step off, move a date, close or delete a case. Changes are logged as the
farmer's, so the agent sees them next turn (cases.py).

Sync handlers: the store blocks, and FastAPI runs these in a thread."""

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from meta_hackathon.api.deps import PhoneNumber
from meta_hackathon.cases import FARMER, CaseError, Stage, Status, StepChange, case_view, change_case, delete_case, list_cases

router = APIRouter(prefix="/v1/cases", tags=["cases"])


class StepPatch(BaseModel):
    status: Status | None = None
    due: str | None = None


class CasePatch(BaseModel):
    stage: Stage | None = None
    end_date: str | None = None


def _changed(phone: str, case_id: str, **changes) -> dict:
    try:
        return case_view(change_case(phone, case_id, actor=FARMER, **changes))
    except CaseError as e:
        raise HTTPException(status_code=404 if "No case" in str(e) else 422, detail=str(e)) from None
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None


@router.get("")
def cases(phone: PhoneNumber) -> dict[Literal["cases"], list[dict]]:
    return {"cases": [case_view(c) for c in list_cases(phone)]}


@router.patch("/{case_id}")
def update_case(case_id: str, body: CasePatch, phone: PhoneNumber) -> dict:
    return _changed(phone, case_id, stage=body.stage, end_date=body.end_date)


@router.patch("/{case_id}/steps/{step_id}")
def update_step(case_id: str, step_id: str, body: StepPatch, phone: PhoneNumber) -> dict:
    try:
        change = StepChange(step_id=step_id, status=body.status, due=body.due)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None
    return _changed(phone, case_id, changes=[change])


@router.delete("/{case_id}")
def remove_case(case_id: str, phone: PhoneNumber) -> dict[str, str]:
    if not delete_case(phone, case_id):
        raise HTTPException(status_code=404, detail=f"No case {case_id}.")
    return {"deleted": case_id}
