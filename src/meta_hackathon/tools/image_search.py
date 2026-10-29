"""Reference photos from Wikimedia Commons.

KrishiBondhu shows example photos -- what a disease, a pest, a crop variety
or a practice looks like -- so the farmer can compare with their own field.
A model cannot be trusted to remember an image URL, so every example image it
shows comes from here: free-licensed photos, each with the author and licence
to credit.

Commons is free and needs no key. Its API policy asks for a descriptive
User-Agent and modest request rates; one call searches several subjects at
once, in parallel.
"""

import asyncio
import logging
import re
from html import unescape

import httpx
from langchain.tools import ToolException, tool

logger = logging.getLogger(__name__)

COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "KrishiBondhu/0.1 (crop-health assistant for farmers in Bangladesh; muntasirfahim.niloy@gmail.com)"

MAX_QUERIES = 6
MAX_PER_QUERY = 3
THUMB_WIDTH = 960
# Smaller than this is an icon or a scan crop, not a photo to show.
MIN_WIDTH = 640
# Commons throttles bursts: six requests at once sometimes came back 429.
MAX_CONCURRENT = 3
RETRY_STATUSES = {429, 500, 502, 503, 504}

_client: httpx.AsyncClient | None = None


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0), headers={"User-Agent": USER_AGENT}
        )
    return _client


def _plain(html: str | None) -> str:
    """Commons metadata is HTML (an author is often a link)."""
    return " ".join(unescape(re.sub(r"<[^>]+>", " ", html or "")).split())


def compact_images(data: dict, limit: int) -> list[dict]:
    """Usable photos from a Commons search, best match first."""
    pages = sorted(((data.get("query") or {}).get("pages") or {}).values(), key=lambda p: p.get("index", 0))
    images = []
    for page in pages:
        info = (page.get("imageinfo") or [None])[0]
        if not info or not info.get("thumburl") or (info.get("width") or 0) < MIN_WIDTH:
            continue
        meta = info.get("extmetadata") or {}
        title = page.get("title", "").removeprefix("File:")
        images.append(
            {
                # Without Commons' tracking parameters: shorter for the model to copy.
                "url": info["thumburl"].split("?", 1)[0],
                "page": info.get("descriptionurl"),
                "title": re.sub(r"\.\w+$", "", title),
                "description": _plain((meta.get("ImageDescription") or {}).get("value"))[:200],
                "author": _plain((meta.get("Artist") or {}).get("value"))[:80] or "Unknown",
                "license": _plain((meta.get("LicenseShortName") or {}).get("value")) or "See source",
            }
        )
        if len(images) == limit:
            break
    return images


async def _search(query: str, limit: int, slots: asyncio.Semaphore) -> list[dict]:
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        # Photos only: no SVG maps, flags or diagrams.
        "gsrsearch": f"{query} filetype:bitmap",
        "gsrnamespace": 6,
        # Extra candidates, for the ones dropped as too small.
        "gsrlimit": limit * 4,
        "prop": "imageinfo",
        "iiprop": "url|size|extmetadata",
        "iiurlwidth": THUMB_WIDTH,
        "iiextmetadatafilter": "Artist|LicenseShortName|ImageDescription",
    }
    async with slots:
        response = await _http().get(COMMONS_API_URL, params=params)
        if response.status_code in RETRY_STATUSES:
            await asyncio.sleep(1.0)
            response = await _http().get(COMMONS_API_URL, params=params)
    response.raise_for_status()
    return compact_images(response.json(), limit)


@tool
async def search_images(queries: list[str], per_query: int = 1) -> dict:
    """Find real, free-licensed reference photos on Wikimedia Commons.

    Use it when an example photo helps the farmer recognise something: what a
    disease or pest looks like, a beneficial insect, a crop variety, a
    practice (AWD pipe, pheromone trap, line sowing). Search every subject in
    one call. Show only URLs this returns, and credit each photo's author and
    license. Not for the farmer's own photo: use segment_image for that.

    Args:
        queries: Up to 6 subjects in English, one per image you need, short
            like a photo title: "rice blast", "rice brown spot",
            "Nilaparvata lugens", "Spodoptera frugiperda". Extra words
            ("lesion on leaf close-up") find fewer photos; for pests the
            scientific name works best.
        per_query: Photos per subject, 1 to 3.

    Returns:
        {"images": {query: [{"url", "page", "title", "description",
        "author", "license"}]}} -- a query with no usable photo maps to [].
    """
    queries = [q.strip() for q in queries if q and q.strip()][:MAX_QUERIES]
    if not queries:
        raise ToolException("No search: pass at least one subject in `queries`.")
    per_query = max(1, min(per_query, MAX_PER_QUERY))

    slots = asyncio.Semaphore(MAX_CONCURRENT)
    results = await asyncio.gather(*(_search(q, per_query, slots) for q in queries), return_exceptions=True)

    images = {}
    for query, result in zip(queries, results):
        if isinstance(result, Exception):
            logger.warning("Commons image search failed for %r: %s", query, result)
            images[query] = []
        else:
            images[query] = result
    if all(isinstance(r, Exception) for r in results):
        raise ToolException("Image search is unavailable right now. Answer without images.")
    return {"images": images}
