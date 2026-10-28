# Krishi Advisor

Bangla crop-health advisor for WhatsApp/Messenger/Web: photo/voice/text in, grounded Bangla advice out, with tracked cases, follow-ups and officer booking.

## Run locally

Two processes:

```bash
# 1. Agent backend — LangGraph Agent Server on :2024 (also serves the FastAPI routes)
uv sync
uv run meta-hackathon

# 2. Web UI — Next.js + OpenUI on :3000
cd frontend && npm install && npm run dev
```

Open http://localhost:3000 and enter a mobile number (e.g. `01712345678`). There is no auth yet: the
`X-Phone-Number` header is the user identity, and each number only sees its own conversations.

## How it fits together

- **Agent** (`src/meta_hackathon/agent/`): LangChain `create_agent` on Muse, with five tools in
  `src/meta_hackathon/tools/` (`get_weather` uses Open-Meteo, `geocode_location` OpenStreetMap Nominatim and `search_internet` Muse's built-in web search; the rest are simulated for now). LangSmith tracing comes from `.env`.
- **Agent Server** (`langgraph.json`): serves the graph to the web UI, stores threads, and runs
  `src/meta_hackathon/auth.py`, which turns `X-Phone-Number` into the user identity and scopes threads to it.
- **Web UI** (`frontend/`): `useStream` from `@langchain/react` + OpenUI's `Renderer`, following the
  [LangChain OpenUI guide](https://docs.langchain.com/oss/python/langchain/frontend/integrations/openui).
  The agent replies in openui-lang (cards, sources, images, forms, follow-ups) and each tool call is
  narrated as a step in the chat.
- **Plain-text API** (`src/meta_hackathon/api/`): `/v1/chat`, `/v1/chat/stream`, `/v1/chat/history` for
  text channels (WhatsApp later), mounted on the Agent Server, e.g. `http://localhost:2024/v1/chat`.

### Changing the UI components

The agent's openui-lang system prompt is generated from the component library in
`frontend/src/lib/library.ts` into `src/meta_hackathon/prompts/openui_prompt.md`. After editing the
library, run `npm run generate:prompt` in `frontend/` (it also runs on `npm run dev`) and commit the
regenerated prompt.
