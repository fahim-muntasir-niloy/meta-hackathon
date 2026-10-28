import re
import unicodedata
from datetime import date
from difflib import SequenceMatcher

import httpx
from langchain.tools import tool

from meta_hackathon.utils.bangla import bn_day_label, bn_hour_label

# Open-Meteo: free, no key. Geocoding matches one place name at a time and uses
# GeoNames spellings, so "Shibganj, Bogura" is searched as "Shibganj" and the
# rest of the location only picks between same-named places.
GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

# Official district names that GeoNames only knows by another spelling
# (checked against all 64 districts in frontend/src/lib/bd-locations.ts).
ALIASES = {
    "bogura": "bogra",
    "chattogram": "chittagong",
    "cumilla": "comilla",
    "barishal": "barisal",
    "jashore": "jessore",
    "chapainawabganj": "chapai nawabganj",
    "netrokona": "netrakona",
    "moulvibazar": "moulvi bazar",
}
_ADMIN_SUFFIX = re.compile(r"\s+(district|upazila|division|sadar|bibhag|zila|union)\b", re.I)

_BANGLA = re.compile(r"[ঀ-৿]")


def _norm(s: str) -> str:
    s = s.strip().lower()
    return ALIASES.get(s, s)


def _letters(s: str) -> str:
    """"Sādipur" → "sadipur", "Bogra District" → "bogra": for comparing spellings."""
    s = unicodedata.normalize("NFKD", _ADMIN_SUFFIX.sub("", s))
    return "".join(c for c in s.lower() if c.isalpha())


def _matches(qualifier: str, admin: str) -> bool:
    """Spelling-tolerant: "Bogura" ~ "Bogra District", "Moulvibazar" ~ "Maulvibazar District"."""
    q, a = _letters(qualifier), _letters(admin)
    return bool(q and a) and (q in a or SequenceMatcher(None, q, a).ratio() >= 0.8)


def _condition(code: int) -> str:
    """WMO weather code → the condition words the web UI translates (see frontend/src/lib/bn.ts)."""
    if code in (95, 96, 99):
        return "thunderstorm"
    if code in (65, 67, 82):
        return "heavy rain"
    if code in (63, 81):
        return "moderate rain"
    if code in (61, 66, 80):
        return "light rain"
    if 51 <= code <= 57:
        return "drizzle"
    if code in (45, 48):
        return "fog"
    if code == 3:
        return "cloudy"
    if code in (1, 2):
        return "partly cloudy"
    return "sunny"


async def _geocode(client: httpx.AsyncClient, location: str) -> tuple[dict | None, list[dict]]:
    """Best match for a "place, upazila, district" string in Bangladesh, plus other candidates."""
    parts = [p.strip() for p in location.split(",") if p.strip()] or [location]
    # Most specific part first; fall back to broader parts (e.g. just the district).
    for i, name in enumerate(parts):
        resp = await client.get(
            GEOCODING_URL,
            params={
                "name": _norm(name),
                "count": 10,
                "countryCode": "BD",
                "language": "bn" if _BANGLA.search(name) else "en",
                "format": "json",
            },
        )
        resp.raise_for_status()
        results = resp.json().get("results") or []
        if not results:
            continue
        qualifiers = parts[i + 1 :]

        def score(r: dict) -> int:
            admins = [str(r[k]) for k in ("admin1", "admin2", "admin3", "admin4") if r.get(k)]
            return sum(any(_matches(q, a) for a in admins) for q in qualifiers)

        # Stable sort keeps Open-Meteo's own relevance order among equal scores.
        ranked = sorted(results, key=score, reverse=True)
        return ranked[0], ranked[1:4]
    return None, []


def _place(r: dict) -> dict:
    return {
        "name": r["name"],
        "union": r.get("admin4"),
        "upazila": r.get("admin3"),
        "district": r.get("admin2"),
        "division": r.get("admin1"),
        "lat": r["latitude"],
        "lng": r["longitude"],
    }


@tool
async def get_weather(location: str, days: int = 3) -> dict:
    """Get current weather, the next 24 hours and a daily forecast for a location in
    Bangladesh. Use this before advising on spraying, irrigation, fertiliser or harvest timing.
    Each forecast / next_24h entry has a short Bangla `label` to use as chart labels.

    Args:
        location: Place in English, most specific first, comma-separated:
            "area, district, division" (e.g. "Shibganj, Bogura, Rajshahi"). Transliterate Bangla names.
        days: Forecast days to return (1-7).
    """
    days = max(1, min(days, 7))
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            match, others = await _geocode(client, location)
            if match is None:
                return {
                    "location": location,
                    "error": "Place not found. Retry with the English spelling, or just the upazila or district name.",
                }
            resp = await client.get(
                FORECAST_URL,
                params={
                    "latitude": match["latitude"],
                    "longitude": match["longitude"],
                    "timezone": "Asia/Dhaka",
                    "forecast_days": days,
                    "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code",
                    "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation_probability,weather_code",
                    "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,"
                    "precipitation_sum,relative_humidity_2m_mean,wind_speed_10m_max",
                },
            )
            resp.raise_for_status()
    except httpx.HTTPError as e:
        return {"location": location, "error": f"Weather service unavailable: {e}"}

    data = resp.json()
    cur, hourly, daily = data["current"], data["hourly"], data["daily"]

    # Next 24 hours in 3-hour steps, starting from the current hour: enough to pick a spray window.
    start = next((i for i, t in enumerate(hourly["time"]) if t[:13] >= cur["time"][:13]), 0)
    next_24h = [
        {
            "time": hourly["time"][i],
            "label": bn_hour_label(int(hourly["time"][i][11:13])),
            "condition": _condition(hourly["weather_code"][i]),
            "temp_c": hourly["temperature_2m"][i],
            "humidity_pct": hourly["relative_humidity_2m"][i],
            "rain_chance_pct": hourly["precipitation_probability"][i],
            "wind_kmh": hourly["wind_speed_10m"][i],
        }
        for i in range(start, min(start + 24, len(hourly["time"])), 3)
    ]

    today = date.fromisoformat(cur["time"][:10])
    forecast = [
        {
            "date": daily["time"][i],
            "label": bn_day_label(date.fromisoformat(daily["time"][i]), today),
            "condition": _condition(daily["weather_code"][i]),
            "temp_min_c": daily["temperature_2m_min"][i],
            "temp_max_c": daily["temperature_2m_max"][i],
            "humidity_pct": daily["relative_humidity_2m_mean"][i],
            "rain_chance_pct": daily["precipitation_probability_max"][i],
            "rain_mm": daily["precipitation_sum"][i],
            "wind_kmh": daily["wind_speed_10m_max"][i],
        }
        for i in range(len(daily["time"]))
    ]

    out = {
        "location": location,
        "place": _place(match),
        "source": "Open-Meteo",
        "current": {
            "time": cur["time"],
            "condition": _condition(cur["weather_code"]),
            "temp_c": cur["temperature_2m"],
            "humidity_pct": cur["relative_humidity_2m"],
            "wind_kmh": cur["wind_speed_10m"],
            "rain_mm": cur["precipitation"],
        },
        "next_24h": next_24h,
        "forecast": forecast,
    }
    if others:
        # Same-named places elsewhere: lets the agent check it picked the farmer's one.
        out["other_matches"] = [f"{o['name']} ({o.get('admin3')}, {o.get('admin2')})" for o in others]
    return out
