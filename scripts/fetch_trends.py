"""
fetch_trends.py — Israel Hayom Elections Monitor
Fetches Google Trends data via pytrends and writes data/google_trends.json.

Keywords: ליכוד, נפתלי בנט, בנימין נתניהו, יחד, בחירות 2026
Config: hl='he', tz=120, geo='IL', timeframe='today 3-m'

Direction logic:
  - Compare avg of last 2 weeks vs avg of prior 2 weeks
  - change > +15% → "rising"
  - change < -15% → "falling"
  - else → "stable"

Dependencies: pytrends, pandas
Output: data/google_trends.json
"""

import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "public" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = DATA_DIR / "google_trends.json"

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
KEYWORDS = ["ליכוד", "נפתלי בנט", "בנימין נתניהו", "יחד", "בחירות 2026"]
KEYWORD_EN = {
    "ליכוד": "Likud",
    "נפתלי בנט": "Naftali Bennett",
    "בנימין נתניהו": "Benjamin Netanyahu",
    "יחד": "Together",
    "בחירות 2026": "Elections 2026",
}
TIMEFRAME = "today 3-m"
GEO = "IL"
HL = "he"
TZ = 120  # Israel Standard Time offset

DIRECTION_THRESHOLD = 15.0  # percent


# ---------------------------------------------------------------------------
# Direction calculation
# ---------------------------------------------------------------------------
def calculate_direction(weekly_values: list[dict]) -> tuple[float, float, float, str]:
    """
    Given a list of {"date": "YYYY-MM-DD", "value": int}, compute:
    - avg of last 2 weeks (current)
    - avg of prior 2 weeks (previous)
    - change_pct
    - direction string
    Returns (current_avg, previous_avg, change_pct, direction)
    """
    if len(weekly_values) < 4:
        # Not enough data for comparison
        if weekly_values:
            last_val = weekly_values[-1]["value"]
            return float(last_val), float(last_val), 0.0, "stable"
        return 0.0, 0.0, 0.0, "stable"

    recent = weekly_values[-2:]
    prior = weekly_values[-4:-2]

    current_avg = sum(w["value"] for w in recent) / len(recent)
    previous_avg = sum(w["value"] for w in prior) / len(prior)

    if previous_avg == 0:
        change_pct = 0.0
    else:
        change_pct = ((current_avg - previous_avg) / previous_avg) * 100

    if change_pct > DIRECTION_THRESHOLD:
        direction = "rising"
    elif change_pct < -DIRECTION_THRESHOLD:
        direction = "falling"
    else:
        direction = "stable"

    return current_avg, previous_avg, round(change_pct, 1), direction


# ---------------------------------------------------------------------------
# pytrends wrapper
# ---------------------------------------------------------------------------
def fetch_trends_data() -> list[dict]:
    """
    Fetch Google Trends interest-over-time for all keywords.
    All pytrends calls are wrapped in try/except.
    Returns list of keyword result dicts, or raises on total failure.
    """
    try:
        from pytrends.request import TrendReq  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "pytrends is not installed. Run: pip install pytrends"
        ) from exc

    try:
        pytrends = TrendReq(hl=HL, tz=TZ)
    except Exception as exc:
        raise RuntimeError(f"Failed to initialise TrendReq: {exc}") from exc

    keyword_results: list[dict] = []

    for keyword in KEYWORDS:
        log.info("Fetching trends for: %s", keyword)
        try:
            # Build payload with single keyword (avoids cross-keyword normalisation issues)
            pytrends.build_payload(
                [keyword],
                cat=0,
                timeframe=TIMEFRAME,
                geo=GEO,
                gprop="",
            )

            # Sleep between calls to avoid rate limiting
            time.sleep(5)

            df = pytrends.interest_over_time()

            if df is None or df.empty:
                log.warning("Empty response for keyword: %s", keyword)
                keyword_results.append(_empty_keyword_result(keyword))
                continue

            # Drop the isPartial column if present
            if "isPartial" in df.columns:
                df = df.drop(columns=["isPartial"])

            # Extract weekly data
            weekly_data: list[dict] = []
            if keyword in df.columns:
                for ts, row in df.iterrows():
                    val = int(row[keyword])
                    weekly_data.append({
                        "date": ts.strftime("%Y-%m-%d"),
                        "value": val,
                    })
            else:
                log.warning(
                    "Keyword %r not in returned columns: %s",
                    keyword, list(df.columns),
                )
                keyword_results.append(_empty_keyword_result(keyword))
                continue

            current_avg, previous_avg, change_pct, direction = calculate_direction(
                weekly_data
            )

            keyword_results.append({
                "keyword": keyword,
                "keyword_en": KEYWORD_EN.get(keyword, keyword),
                "current_interest": round(current_avg, 1),
                "previous_interest": round(previous_avg, 1),
                "change_pct": change_pct,
                "direction": direction,
                "weekly_data": weekly_data,
            })

            log.info(
                "  %s → current=%.1f previous=%.1f change=%.1f%% direction=%s",
                keyword, current_avg, previous_avg, change_pct, direction,
            )

        except Exception as exc:
            log.warning(
                "Failed to fetch trends for %r: %s — using empty result",
                keyword, exc,
            )
            keyword_results.append(_empty_keyword_result(keyword))

    return keyword_results


def _empty_keyword_result(keyword: str) -> dict:
    """Return a placeholder result for a keyword that couldn't be fetched."""
    return {
        "keyword": keyword,
        "keyword_en": KEYWORD_EN.get(keyword, keyword),
        "current_interest": None,
        "previous_interest": None,
        "change_pct": None,
        "direction": "stable",
        "weekly_data": [],
        "error": "No data returned from Google Trends",
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    generated_at = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    try:
        keyword_results = fetch_trends_data()

        output: dict[str, Any] = {
            "generated_at": generated_at,
            "status": "ok",
            "timeframe": TIMEFRAME,
            "geo": GEO,
            "keywords": keyword_results,
        }

        # If all keywords errored, set status to partial
        all_errored = all(bool(k.get("error")) for k in keyword_results)
        some_errored = any(bool(k.get("error")) for k in keyword_results)
        if all_errored:
            output["status"] = "error"
            output["error_message"] = "All keyword fetches failed"
        elif some_errored:
            output["status"] = "partial"

    except Exception as exc:
        log.error("Fatal error in fetch_trends: %s", exc, exc_info=True)
        output = {
            "generated_at": generated_at,
            "status": "error",
            "error_message": str(exc),
        }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(output, fh, ensure_ascii=False, indent=2)

    log.info("Wrote %s", OUTPUT_PATH)

    # Summary
    print("=" * 60)
    print("google_trends.json summary")
    print(f"  Status : {output['status']}")
    if output["status"] in ("ok", "partial"):
        for kw in output.get("keywords", []):
            direction = kw.get("direction", "?")
            change = kw.get("change_pct")
            change_str = f"{change:+.1f}%" if change is not None else "N/A"
            err = " [ERROR]" if kw.get("error") else ""
            print(
                f"  {kw['keyword_en']:25s}  {direction:8s}  {change_str}{err}"
            )
    elif output["status"] == "error":
        print(f"  Error  : {output.get('error_message', 'unknown')}")
    print(f"  Output : {OUTPUT_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()
