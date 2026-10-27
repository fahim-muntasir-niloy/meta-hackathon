"""Muse's content filter sometimes blocks a turn, in two ways:

- on the prompt: the request fails with 400 `content_policy_violation`;
- on the reply: the call "succeeds" with `finish_reason="content_filter"` and an
  empty message, so the agent would end the turn with a blank reply.

Both are intermittent (the same question usually passes on another attempt),
so retry with a short nudge, and if the turn is still blocked, answer with a
fixed fallback instead of nothing.
"""

import logging

import openai
from langchain.agents.middleware import ModelRequest, ModelResponse, wrap_model_call
from langchain.messages import AIMessage, SystemMessage

from meta_hackathon.agent.prompts import ReplyFormat

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 2

RETRY_NOTE = (
    "\n\nNote: your previous attempt at this reply was blocked by the model provider's "
    "content filter. Write it again: calm, factual and practical. Mention pesticide names "
    "and doses only exactly as given in knowledge base results."
)

FALLBACK_TEXT = (
    "দুঃখিত, এই প্রশ্নের উত্তর এই মুহূর্তে দিতে পারছি না। "
    "একটু অন্যভাবে লিখে আবার চেষ্টা করুন, অথবা আপনার এলাকার কৃষি অফিসারের সাথে কথা বলুন।"
)

FALLBACK_OPENUI = """\
root = Card([header, note, followUps])
header = CardHeader("দুঃখিত, উত্তর দিতে পারিনি")
note = Callout("warning", "উত্তর তৈরি করা যায়নি", "এই প্রশ্নের উত্তর এই মুহূর্তে দিতে পারছি না। একটু অন্যভাবে লিখে আবার চেষ্টা করুন, অথবা আপনার এলাকার কৃষি অফিসারের সাথে কথা বলুন।")
followUps = FollowUpBlock([f1])
f1 = FollowUpItem("কৃষি অফিসারের সাথে কথা বলতে চাই")"""


def _is_blocked(response: ModelResponse) -> bool:
    for message in response.result:
        if isinstance(message, AIMessage):
            if message.response_metadata.get("finish_reason") == "content_filter":
                return True
            if not message.text.strip() and not message.tool_calls:
                return True  # empty turn: nothing for the farmer to see
    return False


def _is_prompt_rejected(error: openai.BadRequestError) -> bool:
    return isinstance(error.body, dict) and error.body.get("code") == "content_policy_violation"


def content_filter_guard(reply_format: ReplyFormat):
    fallback = FALLBACK_OPENUI if reply_format == "openui" else FALLBACK_TEXT

    @wrap_model_call(name="ContentFilterGuard")
    async def guard(request: ModelRequest, handler) -> ModelResponse:
        for attempt in range(1, MAX_ATTEMPTS + 1):
            if attempt > 1:
                base = request.system_message.text if request.system_message else ""
                request = request.override(system_message=SystemMessage(base + RETRY_NOTE))
            try:
                response = await handler(request)
            except openai.BadRequestError as e:
                if not _is_prompt_rejected(e):
                    raise
                logger.warning("Prompt blocked by content filter (attempt %d/%d)", attempt, MAX_ATTEMPTS)
                continue
            if not _is_blocked(response):
                return response
            logger.warning("Reply blocked by content filter (attempt %d/%d)", attempt, MAX_ATTEMPTS)
        return ModelResponse(result=[AIMessage(fallback)])

    return guard
