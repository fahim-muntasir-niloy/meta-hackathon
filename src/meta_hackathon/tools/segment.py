"""SAM 3.1 segmentation: find what the farmer's photo shows (insects, lesions,
spots) and draw labelled boxes on it, so they can see exactly what the
diagnosis refers to."""

import asyncio
import base64
import io
import re
import uuid
from pathlib import Path

import httpx
from langchain.messages import HumanMessage
from langchain.tools import ToolRuntime, tool
from openai import AsyncOpenAI, OpenAIError
from PIL import Image, ImageDraw, ImageFont
from pydantic import BaseModel, Field

from meta_hackathon.agent.context import phone_number
from meta_hackathon.config import settings
from meta_hackathon.gallery import media_url, record_image

_client = AsyncOpenAI(base_url=settings.META_BASE_URL, api_key=settings.META_API_KEY)
_FONT = Path(__file__).parent.parent / "assets" / "fonts" / "HindSiliguri-SemiBold.ttf"

# SAM answers with text: "0<|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..|><|mask;...|>,1<|box;...". Masks use an
# undocumented encoding, so only the boxes are used.
_BOX = re.compile(r"<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)\|>")

# Distinct on green fields; white text stays readable on each.
_COLORS = ["#e11d48", "#2563eb", "#d97706", "#7c3aed"]
# Many small boxes (e.g. 30 spots) are drawn, but only this many carry a label.
_MAX_LABELS_PER_TARGET = 3


class Target(BaseModel):
    query: str = Field(description='What SAM should find: one short English noun, e.g. "insect", "spot", "caterpillar".')
    label: str = Field(description='Bangla name to write on the image, e.g. "বাদামি গাছফড়িং".')


def _photos(runtime: ToolRuntime) -> list[str]:
    """Image URLs of the farmer's most recent message that has any."""
    for m in reversed(runtime.state.get("messages", [])):
        if not isinstance(m, HumanMessage) or isinstance(m.content, str):
            continue
        urls = []
        for b in m.content:
            if not isinstance(b, dict):
                continue
            if b.get("type") == "image_url":
                url = b["image_url"]
                urls.append(url if isinstance(url, str) else url.get("url", ""))
            elif b.get("type") == "image":
                urls.append(b.get("url") or f"data:{b.get('mime_type', 'image/jpeg')};base64,{b.get('base64', '')}")
        if urls := [u for u in urls if u]:
            return urls
    return []


async def _fetch(url: str) -> bytes:
    if url.startswith("data:"):
        return base64.b64decode(url.split(",", 1)[1])
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content


def _decode(data: bytes) -> tuple[Image.Image, str]:
    """The photo, plus a JPEG data URL of exactly these pixels for SAM."""
    img = Image.open(io.BytesIO(data)).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
    return img, "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


async def _boxes(data_url: str, query: str, size: tuple[int, int]) -> list[tuple[int, int, int, int]]:
    resp = await _client.responses.create(
        model=settings.SEGMENT_MODEL_NAME,
        input=[
            {
                "type": "message",
                "role": "user",
                "content": [
                    {"type": "input_text", "text": query},
                    {"type": "input_image", "image_url": data_url},
                ],
            }
        ],
    )
    out = []
    for x1, y1, x2, y2, w, h in (tuple(map(int, g)) for g in _BOX.findall(resp.output_text)):
        sx, sy = size[0] / w, size[1] / h  # SAM reports the size it saw; map back to ours
        out.append((round(x1 * sx), round(y1 * sy), round(x2 * sx), round(y2 * sy)))
    return out


def _draw_and_save(img: Image.Image, found: list[tuple[Target, str, list]]) -> str:
    """Draws the boxes and labels, saves to MEDIA_DIR and returns the file name."""
    img = img.copy()
    draw = ImageDraw.Draw(img)
    scale = max(img.size) / 1000
    width = max(3, round(4 * scale))
    font = ImageFont.truetype(str(_FONT), max(16, round(26 * scale)))
    pad = round(6 * scale) + 2
    for target, color, boxes in found:
        # Label the biggest boxes; they are what the farmer looks at first.
        ranked = sorted(boxes, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]), reverse=True)
        for i, (x1, y1, x2, y2) in enumerate(ranked):
            draw.rectangle((x1, y1, x2, y2), outline=color, width=width)
            if i >= _MAX_LABELS_PER_TARGET:
                continue
            tx0, ty0, tx1, ty1 = draw.textbbox((0, 0), target.label, font=font)
            tw, th = tx1 - tx0 + 2 * pad, ty1 - ty0 + 2 * pad
            # Tag above the box, or inside its top edge when there is no room above.
            lx = min(max(0, x1), img.width - tw)
            ly = y1 - th if y1 - th >= 0 else y1
            draw.rectangle((lx, ly, lx + tw, ly + th), fill=color)
            draw.text((lx + pad - tx0, ly + pad - ty0), target.label, font=font, fill="white")
    name = f"{uuid.uuid4().hex}.jpg"
    media = Path(settings.MEDIA_DIR)
    media.mkdir(parents=True, exist_ok=True)
    img.save(media / name, "JPEG", quality=88)
    return name


@tool
async def segment_image(targets: list[Target], photo: int = 1, *, runtime: ToolRuntime) -> dict:
    """Find and mark things in the farmer's latest photo (SAM 3.1): insects, pests,
    lesions, spots, holes, rotten parts. Returns a URL of the photo with labelled
    boxes, so the farmer can see exactly what your diagnosis refers to. Use it once
    you know what to look for, e.g. after describing the photo.

    Args:
        targets: 1-4 things to find, each a short English noun for the search plus the
            Bangla label to draw.
        photo: Which photo of the latest message (1 or 2).
    """
    photos = _photos(runtime)
    if not photos:
        return {"error": "The farmer has not sent a photo."}
    if not 1 <= photo <= len(photos):
        return {"error": f"Only {len(photos)} photo(s) in the latest message."}
    targets = targets[:4]
    try:
        # Image work runs in a thread: it is CPU and disk bound, and the Agent Server
        # rejects blocking calls on its event loop.
        img, data_url = await asyncio.to_thread(_decode, await _fetch(photos[photo - 1]))
        results = await asyncio.gather(*(_boxes(data_url, t.query, img.size) for t in targets))
    except (OpenAIError, httpx.HTTPError, OSError) as e:
        return {"error": f"Segmentation failed: {e}"}

    found = [(t, _COLORS[i % len(_COLORS)], boxes) for i, (t, boxes) in enumerate(zip(targets, results)) if boxes]
    out: dict = {
        "photo": photo,
        "found": [
            {
                "label": t.label,
                "query": t.query,
                "count": len(boxes),
                # Box area as a rough share of the photo; overlapping boxes count twice.
                "area_pct": round(min(100, 100 * sum((b[2] - b[0]) * (b[3] - b[1]) for b in boxes) / (img.width * img.height)), 1),
            }
            for t, _, boxes in found
        ],
        "not_found": [t.label for t, boxes in zip(targets, results) if not boxes],
    }
    if found:
        name = await asyncio.to_thread(_draw_and_save, img, found)
        out["annotated_image_url"] = media_url(name)
        # Filed in the farmer's photo folder in the web UI.
        if phone := phone_number(runtime):
            thread_id = (runtime.config or {}).get("configurable", {}).get("thread_id")
            labels = [{"label": f["label"], "count": f["count"]} for f in out["found"]]
            await asyncio.to_thread(record_image, phone, name, thread_id=thread_id, labels=labels)
    return out
