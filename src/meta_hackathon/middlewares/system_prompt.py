from langchain.agents.middleware import ModelRequest, dynamic_prompt

from meta_hackathon.prompts.date_block import date_block
from meta_hackathon.prompts.system import OPENUI_SECTION, SYSTEM_PROMPT, ReplyFormat, profile_block


def _profile(request: ModelRequest) -> str:
    ctx = request.runtime.context
    server_user = request.runtime.server_info and request.runtime.server_info.user
    return profile_block(
        name=getattr(ctx, "name", None),
        area=getattr(ctx, "area", None),
        district=getattr(ctx, "district", None),
        division=getattr(ctx, "division", None),
        # Same precedence as `phone_number()`: FastAPI context, else the Agent Server identity.
        phone=getattr(ctx, "phone_number", None) or (server_user.identity if server_user else None),
    )


def system_prompt(reply_format: ReplyFormat):
    """Builds the system prompt per model call, so the date block is always current."""
    base_prompt = SYSTEM_PROMPT + (OPENUI_SECTION if reply_format == "openui" else "")

    @dynamic_prompt
    def prompt(request: ModelRequest) -> str:
        # Date and profile first: the openui-lang reference makes the prompt long, and the
        # model must not miss them for "কালকে কি বৃষ্টি হবে?"-style questions.
        return f"{date_block()}\n{_profile(request)}\n{base_prompt}"

    return prompt
