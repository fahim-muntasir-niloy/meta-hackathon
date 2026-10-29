"""The farmer's annotated photos, for the web UI's photo folder (gallery.py).

A sync handler: the store blocks, and FastAPI runs it in a thread."""

from fastapi import APIRouter

from meta_hackathon.api.deps import PhoneNumber
from meta_hackathon.gallery import list_images

router = APIRouter(prefix="/v1/images", tags=["images"])


@router.get("")
def images(phone: PhoneNumber) -> dict[str, list[dict]]:
    return {"images": list_images(phone)}
