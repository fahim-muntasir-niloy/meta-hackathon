import httpx
from langchain.tools import tool

# OpenStreetMap Nominatim: free, no key; its usage policy asks for an identifying
# User-Agent and at most 1 request/second, so results are cached per process.
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "KrishiBondhu.AI/0.1 (hackathon demo)"

_cache: dict[str, dict] = {}


@tool
async def geocode_location(place: str) -> dict:
    """Find map coordinates for a place in Bangladesh (village, union, upazila,
    district, or a landmark like an agriculture office). Call this before showing
    a Map; never guess coordinates.

    Args:
        place: Place name in Bangla or English, most specific first
            (e.g. "Shibganj, Bogura" or "শিবগঞ্জ, বগুড়া").
    """
    key = place.strip().lower()
    if key in _cache:
        return _cache[key]
    try:
        async with httpx.AsyncClient(timeout=8, headers={"User-Agent": USER_AGENT}) as client:
            resp = await client.get(
                NOMINATIM_URL,
                params={"q": place, "format": "jsonv2", "countrycodes": "bd", "limit": 3, "accept-language": "bn,en"},
            )
            resp.raise_for_status()
    except httpx.HTTPError as e:
        return {"place": place, "results": [], "error": f"Geocoding failed: {e}"}

    results = [
        {
            "name": r.get("name") or r["display_name"].split(",")[0],
            "display_name": r["display_name"],
            "lat": round(float(r["lat"]), 5),
            "lng": round(float(r["lon"]), 5),
            "type": r.get("addresstype") or r.get("type"),
        }
        for r in resp.json()
    ]
    out = {"place": place, "results": results}
    if not results:
        out["hint"] = "No match. Retry with a broader or English name, e.g. just the upazila or district."
    else:
        _cache[key] = out
    return out
