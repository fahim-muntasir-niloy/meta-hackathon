from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class ToolCall(BaseModel):
    name: str
    args: dict[str, Any]
    result: Any = None


class ChatResponse(BaseModel):
    reply: str
    tool_calls: list[ToolCall] = []


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant", "tool"]
    content: Any
    name: str | None = None


class HistoryResponse(BaseModel):
    phone_number: str
    messages: list[HistoryMessage]
