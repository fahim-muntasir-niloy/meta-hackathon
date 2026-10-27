from langchain.agents.middleware import ModelRequest, dynamic_prompt

from meta_hackathon.prompts.date_block import date_block
from meta_hackathon.prompts.system import OPENUI_SECTION, SYSTEM_PROMPT, ReplyFormat


def system_prompt(reply_format: ReplyFormat):
    """Builds the system prompt per model call, so the date block is always current."""
    base_prompt = SYSTEM_PROMPT + (OPENUI_SECTION if reply_format == "openui" else "")

    @dynamic_prompt
    def prompt(request: ModelRequest) -> str:
        # Date first: the openui-lang reference makes the prompt long, and the
        # model must not miss it for "কালকে কি বৃষ্টি হবে?"-style questions.
        return f"{date_block()}\n{base_prompt}"

    return prompt
