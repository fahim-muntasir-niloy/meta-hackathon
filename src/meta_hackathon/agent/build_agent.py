from langchain import create_agent

from meta_hackathon.config import settings


async def build_agent():
    agent = create_agent()
    return agent