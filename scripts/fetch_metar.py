#!/usr/bin/env python3
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

STATIONS = ("LFMD", "LFMN", "LFTH")
OUTPUT = Path("public/metar-latest.json")
URL = "https://aviationweather.gov/api/data/metar?ids=" + ",".join(STATIONS) + "&format=raw"
USER_AGENT = "CoachBrief/0.1 (+https://github.com/sbcanard-hub/CoachBrief)"


def signed_temperature(value: str) -> int:
    return -int(value[1:]) if value.startswith("M") else int(value)


def parse_report(raw: str) -> dict | None:
    station_match = re.search(r"\b(LFMD|LFMN|LFTH)\b", raw)
    if not station_match:
        return None

    time_match = re.search(r"\b(\d{2})(\d{2})(\d{2})Z\b", raw)
    wind_match = re.search(r"\b(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT\b", raw)
    temperature_match = re.search(r"\b(M?\d{2})/(M?\d{2})\b", raw)
    pressure_match = re.search(r"\bQ(\d{4})\b", raw)

    observation = {
        "station": station_match.group(1),
        "raw": raw.strip(),
        "reportTime": time_match.group(0) if time_match else None,
        "windDirection": None,
        "variableWind": False,
        "windSpeed": None,
        "gust": None,
        "temperature": None,
        "dewPoint": None,
        "pressure": None,
    }

    if wind_match:
        observation["variableWind"] = wind_match.group(1) == "VRB"
        observation["windDirection"] = None if observation["variableWind"] else int(wind_match.group(1))
        observation["windSpeed"] = int(wind_match.group(2))
        observation["gust"] = int(wind_match.group(3)) if wind_match.group(3) else None

    if temperature_match:
        observation["temperature"] = signed_temperature(temperature_match.group(1))
        observation["dewPoint"] = signed_temperature(temperature_match.group(2))

    if pressure_match:
        observation["pressure"] = int(pressure_match.group(1))

    return observation


def write_payload(observations: list[dict], error: str | None = None) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "AviationWeather.gov Data API",
        "stations": list(STATIONS),
        "observations": observations,
        "error": error,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    request = Request(URL, headers={"User-Agent": USER_AGENT, "Accept": "text/plain"})
    try:
        with urlopen(request, timeout=25) as response:
            text = response.read().decode("utf-8", errors="replace")
        observations = []
        for line in text.splitlines():
            parsed = parse_report(line)
            if parsed:
                observations.append(parsed)
        write_payload(observations)
        print(f"METAR cache: {len(observations)} observation(s) written to {OUTPUT}")
    except Exception as exc:
        # A weather-source outage must not block the website deployment.
        write_payload([], str(exc))
        print(f"METAR cache unavailable: {exc}")


if __name__ == "__main__":
    main()
