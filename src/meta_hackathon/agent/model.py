from langchain_openai import ChatOpenAI

from meta_hackathon.config import settings

# Web search is not bound here: Muse's built-in `web_search` runs inside the
# `search_internet` tool (see tools/web_search.py).
llm = ChatOpenAI(
    model=settings.MODEL_NAME,
    reasoning_effort="medium",
    base_url=settings.META_BASE_URL,
    api_key=settings.META_API_KEY,
    max_retries=3
)
