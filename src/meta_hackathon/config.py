from pydantic_settings import BaseSettings


class Config(BaseSettings):
    META_API_KEY: str
    META_BASE_URL: str
    MODEL_NAME: str

    LANGSMITH_TRACING: str
    LANGSMITH_ENDPOINT: str
    LANGSMITH_API_KEY: str
    LANGSMITH_AGENT_ID: str
    LANGSMITH_AGENT_ENVIRONMENT: str

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Config()