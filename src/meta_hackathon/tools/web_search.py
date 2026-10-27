from langchain.tools import tool


@tool
def search_internet(query: str, max_results: int = 3) -> list[dict]:
    """Search the internet for recent or general information not covered by the
    knowledge base (e.g. market prices, news, new pest outbreaks).

    Args:
        query: What to search for.
        max_results: Number of results to return (1-5).
    """
    # SIMULATED: replace with a real search API (Tavily / Brave / SerpAPI).
    max_results = max(1, min(max_results, 5))
    return [
        {
            "title": f"[simulated] Result {i + 1} for '{query}'",
            "url": f"https://example.com/search?q={query.replace(' ', '+')}&r={i + 1}",
            "snippet": (
                f"Simulated snippet about {query}. Real web results will appear "
                "here once the search integration is wired up."
            ),
        }
        for i in range(max_results)
    ]
