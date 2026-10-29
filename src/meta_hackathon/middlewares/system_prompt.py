import asyncio
import logging

from langchain.agents.middleware import ModelRequest, dynamic_prompt

from meta_hackathon.cases import case_for_model, case_view, get_case, list_cases, summary_line
from meta_hackathon.prompts.date_block import date_block
from meta_hackathon.prompts.system import OPENUI_SECTION, SYSTEM_PROMPT, ReplyFormat, profile_block

logger = logging.getLogger(__name__)


def _phone(request: ModelRequest) -> str | None:
    # Same precedence as `phone_number()`: FastAPI context, else the Agent Server identity.
    server_user = request.runtime.server_info and request.runtime.server_info.user
    return getattr(request.runtime.context, "phone_number", None) or (server_user.identity if server_user else None)


def _profile(request: ModelRequest) -> str:
    ctx = request.runtime.context
    return profile_block(
        name=getattr(ctx, "name", None),
        area=getattr(ctx, "area", None),
        district=getattr(ctx, "district", None),
        division=getattr(ctx, "division", None),
        phone=_phone(request),
    )


def _cases_block(phone: str | None, focus_id: str | None) -> str:
    """The farmer's open crop cases, one line each, and the one open in the
    tracker pane in full, so a message or a photo is matched to the right case."""
    if not phone:
        return ""
    try:
        cases = list_cases(phone, include_closed=False)
        focused = get_case(phone, focus_id) if focus_id else None
    except Exception:
        logger.exception("Could not load crop cases for %s", phone)
        return "# Farmer's crop cases\nUnknown: they could not be loaded. Use get_crop_case to list them.\n"
    if not cases and not focused:
        return ""
    block = "# Farmer's crop cases\nOpen treatment plans you are tracking with this farmer:\n"
    block += "\n".join(summary_line(c) for c in cases) or "(none open)"
    if focused:
        block += (
            "\n\nThe farmer has this case open beside the chat; their message is about it unless they say otherwise:\n"
            + case_for_model(case_view(focused))
        )
    return block + "\n"


def system_prompt(reply_format: ReplyFormat):
    """Builds the system prompt per model call, so the date block and the cases are always current."""
    base_prompt = SYSTEM_PROMPT + (OPENUI_SECTION if reply_format == "openui" else "")

    @dynamic_prompt
    async def prompt(request: ModelRequest) -> str:
        # The case store blocks, and the Agent Server rejects blocking calls on its event loop.
        cases = await asyncio.to_thread(_cases_block, _phone(request), getattr(request.runtime.context, "case_id", None))
        # Date, profile and cases first: the openui-lang reference makes the prompt long, and the
        # model must not miss them for "কালকে কি বৃষ্টি হবে?"-style questions.
        return f"{date_block()}\n{_profile(request)}\n{cases}\n{base_prompt}"

    return prompt
