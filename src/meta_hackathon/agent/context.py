from dataclasses import dataclass

from langchain.tools import ToolRuntime


@dataclass
class UserContext:
    """Per-request runtime context, available to tools via `ToolRuntime`."""

    phone_number: str | None = None


def phone_number(runtime: ToolRuntime) -> str | None:
    """Caller's phone: from the FastAPI context, or the Agent Server auth identity."""
    if runtime.context and runtime.context.phone_number:
        return runtime.context.phone_number
    if runtime.server_info and runtime.server_info.user:
        return runtime.server_info.user.identity
    return None
