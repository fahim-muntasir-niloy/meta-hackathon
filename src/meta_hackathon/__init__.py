import os
import sys
from pathlib import Path


def main() -> None:
    """Start the LangGraph Agent Server on :2024.

    It serves the agent to the web UI and also mounts the FastAPI routes
    (`/health`, `/v1/chat`, ...) from `meta_hackathon.main`, so this is the only
    backend process needed."""
    config = Path(__file__).resolve().parents[2] / "langgraph.json"
    langgraph = Path(sys.executable).with_name("langgraph")
    os.chdir(config.parent)
    os.execv(langgraph, [str(langgraph), "dev", "--config", str(config), "--port", "2024", "--no-browser"])
