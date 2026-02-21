"""
Weather service – fetches current weather from Open-Meteo (free, no API key).
"""
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# WMO Weather interpretation codes → simple labels
WMO_CODES = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Foggy", 48: "Icy fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain",
    66: "Freezing rain", 67: "Heavy freezing rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Light showers", 81: "Showers", 82: "Heavy showers",
    85: "Light snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Heavy thunderstorm with hail",
}

# WMO code → emoji
WMO_EMOJI = {
    0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
    45: "🌫️", 48: "🌫️",
    51: "🌦️", 53: "🌧️", 55: "🌧️",
    61: "🌧️", 63: "🌧️", 65: "🌧️",
    66: "🌧️", 67: "🌧️",
    71: "🌨️", 73: "🌨️", 75: "🌨️", 77: "🌨️",
    80: "🌦️", 81: "🌧️", 82: "🌧️",
    85: "🌨️", 86: "🌨️",
    95: "⛈️", 96: "⛈️", 99: "⛈️",
}


async def fetch_weather(lat: float, lon: float) -> Optional[dict]:
    """
    Fetch current weather + today's forecast from Open-Meteo.
    Returns dict with current temp, min/max, condition, emoji, wind, etc.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current_weather": "true",
                    "daily": "temperature_2m_max,temperature_2m_min,weathercode",
                    "forecast_days": 1,
                    "timezone": "auto",
                },
            )
            if resp.status_code != 200:
                logger.warning("Open-Meteo failed (HTTP %s)", resp.status_code)
                return None

            data = resp.json()
            cw = data.get("current_weather", {})
            daily = data.get("daily", {})
            code = cw.get("weathercode", 0)

            # Today's min/max from daily forecast
            temp_max = daily.get("temperature_2m_max", [None])[0]
            temp_min = daily.get("temperature_2m_min", [None])[0]
            daily_code = daily.get("weathercode", [None])[0]

            return {
                "temperature_c": cw.get("temperature"),
                "temp_min_c": temp_min,
                "temp_max_c": temp_max,
                "windspeed_kmh": cw.get("windspeed"),
                "condition": WMO_CODES.get(code, "Unknown"),
                "daily_condition": WMO_CODES.get(daily_code, "") if daily_code is not None else "",
                "emoji": WMO_EMOJI.get(code, "🌡️"),
                "is_day": cw.get("is_day", 1) == 1,
            }

    except Exception as exc:
        logger.error("Weather fetch error: %s", exc)
        return None
