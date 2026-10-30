# Backend: the LangGraph Agent Server (agent + FastAPI routes from langgraph.json).
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim

# Pillow's bundled raqm loads fribidi at runtime; without it Bangla labels on
# annotated photos render unshaped.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libfribidi0 libharfbuzz0b \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PATH="/app/.venv/bin:$PATH"

COPY pyproject.toml uv.lock README.md ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev --no-install-project

COPY langgraph.json ./
COPY src ./src
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev

EXPOSE 2024
# langgraph.json names ".env"; compose passes the settings as environment
# variables and an empty file keeps the CLI happy.
RUN touch .env
CMD ["langgraph", "dev", "--host", "0.0.0.0", "--port", "2024", "--no-browser", "--no-reload"]
