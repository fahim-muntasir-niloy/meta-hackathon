import random
from datetime import date, timedelta

from langchain.tools import tool


@tool
def get_weather(location: str, days: int = 3) -> dict:
    """Get current weather and a short forecast for a location in Bangladesh.
    Use this before advising on spraying, irrigation, fertiliser or harvest timing.

    Args:
        location: District, upazila or union name (e.g. "Bogura", "Sherpur").
        days: Forecast days to return (1-7).
    """
    # SIMULATED: replace with a real weather API (Open-Meteo / BMD).
    days = max(1, min(days, 7))
    rng = random.Random(f"{location}-{date.today()}")
    conditions = ["sunny", "partly cloudy", "cloudy", "light rain", "heavy rain"]
    forecast = []
    for i in range(days):
        rain_chance = rng.randint(0, 100)
        forecast.append(
            {
                "date": (date.today() + timedelta(days=i)).isoformat(),
                "condition": conditions[min(rain_chance // 20, 4)],
                "temp_min_c": rng.randint(20, 25),
                "temp_max_c": rng.randint(28, 35),
                "humidity_pct": rng.randint(60, 95),
                "rain_chance_pct": rain_chance,
                "wind_kmh": rng.randint(3, 25),
            }
        )
    return {"location": location, "simulated": True, "forecast": forecast}
