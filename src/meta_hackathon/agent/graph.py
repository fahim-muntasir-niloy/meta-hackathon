"""Entry point for the LangGraph Agent Server (see langgraph.json).

The server owns persistence (the Postgres checkpointer and store from
persistence.py, named in langgraph.json), so neither is passed here."""

from meta_hackathon.config import setup_langsmith

setup_langsmith()

from meta_hackathon.agent.build_agent import build_agent  # noqa: E402

graph = build_agent(reply_format="openui")
