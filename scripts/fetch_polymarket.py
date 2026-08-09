"""
fetch_polymarket.py — Israel Hayom Elections Monitor
Fetches Israeli election prediction market data from Polymarket Gamma API
and writes data/polymarket.json.

API base: https://gamma-api.polymarket.com  (public, no auth)

Dependencies: requests
Output: data/polymarket.json
"""

import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import requests

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
OUTPUT_PATH = DATA_DIR / "polymarket.json"

# ---------------------------------------------------------------------------
# API config
# ---------------------------------------------------------------------------
API_BASE = "https://gamma-api.polymarket.com"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; IsraelHayomElectionsBot/1.0; "
        "+https://www.israelhayom.co.il)"
    ),
    "Accept": "application/json",
}

# Market definitions
MARKETS = [
    {
        "key": "next_pm",
        "slug": "who-will-be-the-next-prime-minister-of-israel-after-the-next-election",
        "title_fallback": "Who will be the next Prime Minister of Israel?",
        "title_keywords": ["prime minister", "israel"],
    },
    {
        "key": "likud_seats",
        "slug": "israel-election-likud-of-seats",
        "title_fallback": "Israel Election: Likud # of seats?",
        "title_keywords": ["likud", "seats"],
    },
    {
        "key": "hung_parliament",
        "slug": "israeli-election-results-in-a-hung-parliament",
        "title_fallback": "Israeli election results in a hung parliament?",
        "title_keywords": ["hung parliament", "israel"],
    },
]


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------
def fetch_json(url: str, params: Optional[dict] = None, retries: int = 3) -> Any:
    """GET JSON with exponential backoff. Returns parsed JSON or None."""
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, headers=HEADERS, params=params, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            wait = 2 ** attempt
            log.warning(
                "Attempt %d/%d failed for %s: %s. Retrying in %ds…",
                attempt, retries, url, exc, wait,
            )
            if attempt < retries:
                time.sleep(wait)
    log.error("All %d attempts failed for %s", retries, url)
    return None


# ---------------------------------------------------------------------------
# Event / market extraction
# ---------------------------------------------------------------------------
def fetch_event_by_slug(slug: str) -> Optional[dict]:
    """Fetch event data using slug parameter."""
    data = fetch_json(f"{API_BASE}/events", params={"slug": slug})
    if not data:
        return None
    # API returns array; take first
    if isinstance(data, list) and data:
        return data[0]
    if isinstance(data, dict):
        return data
    return None


def fetch_event_by_fallback(title_keywords: list[str]) -> Optional[dict]:
    """Fallback: search active Israel-tagged events and filter by title."""
    log.info("Using fallback search for keywords: %s", title_keywords)
    data = fetch_json(
        f"{API_BASE}/events",
        params={"tag": "Israel", "limit": 50, "active": "true"},
    )
    if not data:
        return None

    events = data if isinstance(data, list) else data.get("data", [])
    for event in events:
        title = (event.get("title") or "").lower()
        if all(kw.lower() in title for kw in title_keywords):
            log.info("Fallback matched event: %s", event.get("title"))
            return event

    return None


def parse_outcomes(event: dict) -> list[dict]:
    """
    Extract outcomes from the event's markets array.

    Polymarket multi-outcome events have one sub-market per option, each with
    binary ["Yes","No"] outcomes.  We use ``groupItemTitle`` (or fall back to
    parsing ``question``) as the option name, and the "Yes" price as its
    probability.

    For simple binary markets (e.g. "hung parliament?") with a single market,
    we keep Yes/No as-is.
    """
    markets_data = event.get("markets", [])
    if not markets_data:
        return []

    is_multi = len(markets_data) > 1

    all_outcomes: list[dict] = []

    for market in markets_data:
        raw_outcomes = market.get("outcomes", "[]")
        raw_prices = market.get("outcomePrices", "[]")

        if isinstance(raw_outcomes, str):
            try:
                raw_outcomes = json.loads(raw_outcomes)
            except json.JSONDecodeError:
                raw_outcomes = []
        if isinstance(raw_prices, str):
            try:
                raw_prices = json.loads(raw_prices)
            except json.JSONDecodeError:
                raw_prices = []

        if is_multi:
            name = market.get("groupItemTitle") or ""
            if not name:
                q = market.get("question", "")
                name = q.replace("Will ", "").split(" be ")[0].strip() or q
            yes_idx = None
            for i, o in enumerate(raw_outcomes):
                if str(o).lower() == "yes":
                    yes_idx = i
                    break
            if yes_idx is not None and yes_idx < len(raw_prices):
                try:
                    prob = float(raw_prices[yes_idx])
                except (ValueError, TypeError):
                    prob = 0.0
                all_outcomes.append({"name": name, "probability": round(prob, 4)})
        else:
            for oname, price in zip(raw_outcomes, raw_prices):
                try:
                    prob = float(price)
                except (ValueError, TypeError):
                    prob = 0.0
                all_outcomes.append({"name": str(oname), "probability": round(prob, 4)})

    all_outcomes.sort(key=lambda o: o["probability"], reverse=True)
    return all_outcomes


def build_market_record(market_def: dict, event: dict) -> dict:
    """Build a normalised market record from a Polymarket event dict."""
    outcomes = parse_outcomes(event)

    # Build URL from event slug or id
    slug = event.get("slug") or market_def["slug"]
    event_url = f"https://polymarket.com/event/{slug}"

    # Updated timestamp
    updated_at = (
        event.get("updatedAt")
        or event.get("updated_at")
        or datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    )

    return {
        "key": market_def["key"],
        "title": event.get("title") or market_def["title_fallback"],
        "slug": slug,
        "url": event_url,
        "updated_at": updated_at,
        "outcomes": outcomes,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    result_markets: list[Optional[dict]] = []

    for market_def in MARKETS:
        log.info("Fetching market: %s (slug: %s)", market_def["key"], market_def["slug"])
        event = None

        # Primary: slug lookup
        event = fetch_event_by_slug(market_def["slug"])

        # Fallback: title keyword search
        if not event:
            log.warning(
                "Slug lookup failed for %s, trying fallback…", market_def["slug"]
            )
            event = fetch_event_by_fallback(market_def["title_keywords"])

        if event:
            record = build_market_record(market_def, event)
            log.info(
                "  OK — %d outcomes found for %s",
                len(record["outcomes"]), market_def["key"],
            )
            result_markets.append(record)
        else:
            log.error(
                "Could not fetch market %s — recording as null", market_def["key"]
            )
            result_markets.append(
                {
                    "key": market_def["key"],
                    "title": market_def["title_fallback"],
                    "slug": market_def["slug"],
                    "url": f"https://polymarket.com/event/{market_def['slug']}",
                    "updated_at": None,
                    "outcomes": None,
                    "error": f"Market not found via slug or fallback search",
                }
            )

    output = {
        "generated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "markets": result_markets,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(output, fh, ensure_ascii=False, indent=2)

    log.info("Wrote %s", OUTPUT_PATH)

    # Summary
    print("=" * 60)
    print("polymarket.json summary")
    for m in result_markets:
        if m is None:
            continue
        if m.get("error"):
            print(f"  {m['key']:20s}  ERROR: {m['error']}")
        else:
            outcomes = m.get("outcomes") or []
            top = outcomes[0] if outcomes else None
            top_str = (
                f"{top['name']} {top['probability']:.1%}" if top else "no outcomes"
            )
            print(f"  {m['key']:20s}  {len(outcomes)} outcomes  top={top_str}")
    print(f"  Output: {OUTPUT_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()
