import os

from pydantic_settings import BaseSettings


class Config(BaseSettings):
    META_API_KEY: str
    META_BASE_URL: str
    MODEL_NAME: str
    SEGMENT_MODEL_NAME: str = "sam-3.1"

    # Annotated images are saved here and served at {PUBLIC_BASE_URL}/media/<file>.
    MEDIA_DIR: str = ".media"
    PUBLIC_BASE_URL: str = "http://localhost:2024"
    # SQLite database for crop cases (cases.py).
    DATA_DIR: str = ".data"

    LANGSMITH_TRACING: str
    LANGSMITH_ENDPOINT: str
    LANGSMITH_API_KEY: str
    LANGSMITH_AGENT_ID: str
    LANGSMITH_AGENT_ENVIRONMENT: str

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


settings = Config()


def setup_langsmith() -> None:
    """LangSmith reads its settings from os.environ, not from pydantic-settings,
    so export them before any LangChain object runs.

    Runs are addressed to the LangSmith agent (LANGSMITH_AGENT_ID + _ENVIRONMENT).
    Don't also set LANGSMITH_PROJECT: with both in the environment the SDK
    traces nothing ("neither outranks the other")."""
    for key in (
        "LANGSMITH_TRACING",
        "LANGSMITH_ENDPOINT",
        "LANGSMITH_API_KEY",
        "LANGSMITH_AGENT_ID",
        "LANGSMITH_AGENT_ENVIRONMENT",
    ):
        os.environ.setdefault(key, getattr(settings, key))
    os.environ.pop("LANGSMITH_PROJECT", None)
