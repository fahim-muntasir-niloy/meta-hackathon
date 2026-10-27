from langchain.agents import create_agent
from langchain.agents.middleware import ModelRequest, dynamic_prompt
from langgraph.types import Checkpointer

from meta_hackathon.agent.content_filter import content_filter_guard
from meta_hackathon.agent.context import UserContext
from meta_hackathon.agent.dates import date_block
from meta_hackathon.agent.model import llm
from meta_hackathon.agent.prompts import OPENUI_SECTION, SYSTEM_PROMPT, ReplyFormat
from meta_hackathon.tools import ALL_TOOLS


def build_agent(*, reply_format: ReplyFormat = "text", checkpointer: Checkpointer = None):
    """`text` for plain chat channels (WhatsApp, /v1/chat); `openui` for the web UI,
    where replies are openui-lang rendered by the OpenUI Renderer."""
    base_prompt = SYSTEM_PROMPT + (OPENUI_SECTION if reply_format == "openui" else "")

    @dynamic_prompt
    def system_prompt(request: ModelRequest) -> str:
        # Date first: the openui-lang reference makes the prompt long, and the
        # model must not miss it for "কালকে কি বৃষ্টি হবে?"-style questions.
        return f"{date_block()}\n{base_prompt}"

    return create_agent(
        model=llm,
        tools=ALL_TOOLS,
        middleware=[system_prompt, content_filter_guard(reply_format)],
        context_schema=UserContext,
        checkpointer=checkpointer,
        name="krishi_advisor",
    )
