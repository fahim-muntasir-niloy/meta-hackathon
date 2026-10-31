"""Push-to-talk speech to text: the browser streams mic audio here and we relay
it to Meta's realtime ASR (muse-voice-transcribe), which only transcribes; the
agent still answers in text.

The proxy keeps META_API_KEY on the server: the upstream wants the key in its
first frame, and browsers can't hide it. One socket is one utterance:

    client → binary frames: PCM s16le mono 24 kHz, sent as recorded
    client → {"type": "endStream"} when the button is released
    server → {"type": "ready"} once Meta has accepted the session
    server → {"type": "transcript", "transcript": str, "final": bool}
             (cumulative: each partial replaces the last; final ends the turn)
    server → {"type": "error", "message": str}

Browsers can't set headers on a WebSocket, so the phone number comes as the
`phone` query parameter."""

import asyncio
import json
import logging

import websockets
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from meta_hackathon.config import settings
from meta_hackathon.utils.phone import normalize_phone

log = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/voice", tags=["voice"])

ASR_URL = "wss://api.meta.ai/v1/asr/realtime"
# Crop and pest words the model tends to miss in farmers' speech.
KEYWORDS = ["ধান", "পাট", "গম", "আলু", "বেগুন", "টমেটো", "মরিচ", "পোকা", "ছত্রাক", "ব্লাস্ট", "মাজরা", "কীটনাশক", "বিঘা"]
# Push-to-talk turns are short; this caps a stuck button.
MAX_SECONDS = 120


@router.websocket("/transcribe")
async def transcribe(ws: WebSocket, phone: str = "") -> None:
    try:
        normalize_phone(phone)
    except ValueError:
        await ws.close(code=1008, reason="Invalid phone")
        return
    await ws.accept()

    try:
        async with websockets.connect(ASR_URL, open_timeout=10) as asr:
            await asr.send(
                json.dumps(
                    {
                        "authorization": {"accessToken": f"Bearer {settings.META_API_KEY}"},
                        "audioEncoding": "PCM_24KHZ",
                        "model": settings.TRANSCRIBE_MODEL_NAME,
                        "mode": "PUSH_TO_TALK",
                        "languageBias": ["Bengali", "English"],
                        "keywords": KEYWORDS,
                        "emitAudioProgress": False,
                    }
                )
            )
            ack = json.loads(await asyncio.wait_for(asr.recv(), timeout=10))
            if "sessionId" not in ack:
                raise RuntimeError(ack.get("message") or "ASR handshake failed")
            await ws.send_json({"type": "ready"})
            await asyncio.wait_for(_relay(ws, asr), timeout=MAX_SECONDS + 15)
    except WebSocketDisconnect:
        return
    except Exception as exc:  # upstream refused, timed out or dropped
        log.warning("voice transcription failed: %s", exc)
        try:
            await ws.send_json({"type": "error", "message": "transcription_failed"})
        except Exception:
            return
    try:
        await ws.close()
    except Exception:
        pass


async def _relay(ws: WebSocket, asr: websockets.ClientConnection) -> None:
    """Pump mic audio up and transcripts down until Meta sends the final text."""

    async def upstream() -> None:
        sent = 0
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                raise WebSocketDisconnect()
            if chunk := msg.get("bytes"):
                sent += len(chunk)
                if sent > MAX_SECONDS * 48_000:  # 24 kHz × 2 bytes
                    break
                await asr.send(chunk)
            elif (text := msg.get("text")) and json.loads(text).get("type") == "endStream":
                break
        await asr.send(json.dumps({"type": "endStream"}))

    async def downstream() -> None:
        async for raw in asr:
            event = json.loads(raw)
            if event.get("type") == "transcript":
                await ws.send_json({"type": "transcript", "transcript": event["transcript"], "final": event["final"]})
                if event["final"]:
                    return
            elif event.get("type") == "error":
                raise RuntimeError(event.get("message"))

    up, down = asyncio.create_task(upstream()), asyncio.create_task(downstream())
    try:
        await asyncio.wait({up, down}, return_when=asyncio.FIRST_COMPLETED)
        if up.done() and up.exception():
            raise up.exception()  # the browser left mid-utterance
        await down  # endStream sent: wait for the final transcript
    finally:
        up.cancel()
        down.cancel()
