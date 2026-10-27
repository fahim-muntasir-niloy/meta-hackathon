"""Agent tools. All simulated for now; swap each body for the real integration."""

from meta_hackathon.tools.booking import schedule_officer_session
from meta_hackathon.tools.knowledge import search_knowledgebase
from meta_hackathon.tools.weather import get_weather
from meta_hackathon.tools.web_search import search_internet

ALL_TOOLS = [
    search_internet,
    get_weather,
    search_knowledgebase,
    schedule_officer_session,
]

__all__ = ["ALL_TOOLS"]
