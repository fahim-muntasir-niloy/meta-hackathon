import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, status
from fastapi.responses import StreamingResponse
from langchain.messages import AIMessage, AIMessageChunk, HumanMessage, ToolMessage

from meta_hackathon.agent.context import UserContext
from meta_hackathon.api.deps import Agent, PhoneNumber
from meta_hackathon.api.schemas import (
    ChatRequest,
    ChatResponse,
    HistoryMessage,
    HistoryResponse,
    ToolCall,
)

router = APIRouter(prefix="/v1/chat", tags=["chat"])


def _run_config(phone: str) -> dict:
    # thread_id scopes conversation memory; metadata makes traces filterable in LangSmith.
    return {
        "configurable": {"thread_id": phone},
        "metadata": {"phone_number": phone},
        "tags": ["api"],
    }


def _parse_tool_content(content):
    if isinstance(content, str):
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return content
    return content


@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest, phone: PhoneNumber, agent: Agent) -> ChatResponse:
    before = await agent.aget_state(_run_config(phone))
    seen = len(before.values.get("messages", []))

    result = await agent.ainvoke(
        {"messages": [HumanMessage(body.message)]},
        config=_run_config(phone),
        context=UserContext(phone_number=phone),
    )
    new_messages = result["messages"][seen:]

    tool_results = {
        m.tool_call_id: _parse_tool_content(m.content)
        for m in new_messages
        if isinstance(m, ToolMessage)
    }
    tool_calls = [
        ToolCall(name=tc["name"], args=tc["args"], result=tool_results.get(tc["id"]))
        for m in new_messages
        if isinstance(m, AIMessage)
        for tc in m.tool_calls
    ]
    return ChatResponse(reply=result["messages"][-1].text, tool_calls=tool_calls)


@router.post("/stream")
async def chat_stream(body: ChatRequest, phone: PhoneNumber, agent: Agent) -> StreamingResponse:
    """Server-sent events: `token`, `tool_call`, `tool_result`, then `done`."""

    async def events() -> AsyncIterator[str]:
        def sse(event: str, data) -> str:
            return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

        async for msg, _meta in agent.astream(
            {"messages": [HumanMessage(body.message)]},
            config=_run_config(phone),
            context=UserContext(phone_number=phone),
            stream_mode="messages",
        ):
            if isinstance(msg, AIMessageChunk):
                if msg.text:
                    yield sse("token", {"text": msg.text})
                for tc in msg.tool_call_chunks:
                    if tc.get("name"):
                        yield sse("tool_call", {"name": tc["name"], "id": tc.get("id")})
            elif isinstance(msg, ToolMessage):
                yield sse(
                    "tool_result",
                    {"name": msg.name, "id": msg.tool_call_id, "result": _parse_tool_content(msg.content)},
                )
        yield sse("done", {})

    return StreamingResponse(events(), media_type="text/event-stream")


@router.get("/history", response_model=HistoryResponse)
async def history(phone: PhoneNumber, agent: Agent) -> HistoryResponse:
    state = await agent.aget_state(_run_config(phone))
    messages = []
    for m in state.values.get("messages", []):
        if isinstance(m, HumanMessage):
            messages.append(HistoryMessage(role="user", content=m.content))
        elif isinstance(m, AIMessage) and m.text:
            messages.append(HistoryMessage(role="assistant", content=m.text))
        elif isinstance(m, ToolMessage):
            messages.append(
                HistoryMessage(role="tool", name=m.name, content=_parse_tool_content(m.content))
            )
    return HistoryResponse(phone_number=phone, messages=messages)


@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
async def clear_history(phone: PhoneNumber, agent: Agent) -> None:
    await agent.checkpointer.adelete_thread(phone)
