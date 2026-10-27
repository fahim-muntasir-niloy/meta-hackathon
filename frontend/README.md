# Krishi Advisor — web UI

Next.js chat UI for the Python agent. See the [root README](../README.md) for how to run both parts.

- `src/components/chat-app.tsx` — `useStream` against the LangGraph Agent Server (`NEXT_PUBLIC_LANGGRAPH_API_URL`, default `http://localhost:2024`), sidebar of the phone number's conversations.
- `src/components/assistant-reply.tsx` — renders the agent's openui-lang reply with OpenUI's `Renderer` and `openuiChatLibrary`; button and form actions are sent back as user messages.
- `src/components/tool-activity.tsx` + `src/lib/narration.ts` — narrates each tool call ("Checking the 3-day forecast for Bogura" → "Checked the forecast for Bogura"). Add a narrator there when you add a tool.
- `src/lib/library.ts` — component library and extra prompt rules; `npm run generate:prompt` regenerates the backend system prompt from it.

`AGENTS.md` is OpenUI's guide for coding agents, added by the scaffold.
