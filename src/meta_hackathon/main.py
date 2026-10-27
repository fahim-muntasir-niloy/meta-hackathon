from contextlib import asynccontextmanager

import openai
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from langgraph.checkpoint.memory import InMemorySaver

from meta_hackathon.config import settings, setup_langsmith

# Must run before any LangChain object is created so tracing picks up the env.
setup_langsmith()

from meta_hackathon.agent.build_agent import build_agent  # noqa: E402
from meta_hackathon.api.chat import router as chat_router  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.agent = build_agent(checkpointer=InMemorySaver())
    yield


app = FastAPI(title="KrishiBondhu.AI", version="0.1.0", lifespan=lifespan)
app.include_router(chat_router)


@app.exception_handler(openai.BadRequestError)
async def model_bad_request(request: Request, exc: openai.BadRequestError) -> JSONResponse:
    code = (exc.body or {}).get("code") if isinstance(exc.body, dict) else None
    if code == "content_policy_violation":
        return JSONResponse(
            status_code=422,
            content={"detail": "Message was blocked by the model provider's content filter."},
        )
    return JSONResponse(status_code=502, content={"detail": f"Model request failed: {exc.message}"})


@app.get("/health", tags=["meta"])
async def health() -> dict:
    return {"status": "ok", "model": settings.MODEL_NAME}
