"""
scrape_polls.py — Israel Hayom Elections Monitor
Scrapes Israeli election polling tables from Wikipedia and writes data/polls.json.

Sources:
  - https://en.wikipedia.org/wiki/Opinion_polling_for_the_2026_Israeli_legislative_election
  - https://en.wikipedia.org/wiki/2025_opinion_polling_for_the_2026_Israeli_legislative_election

Dependencies: requests, beautifulsoup4, pandas
"""

import json
import logging
import os
import re
import time
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup

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
OUTPUT_PATH = DATA_DIR / "polls.json"

# ---------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------
SOURCE_URLS = [
    "https://en.wikipedia.org/wiki/Opinion_polling_for_the_2026_Israeli_legislative_election",
    "https://en.wikipedia.org/wiki/2025_opinion_polling_for_the_2026_Israeli_legislative_election",
]

# Year context per source URL (used when dates lack a year)
SOURCE_YEAR = {
    SOURCE_URLS[0]: 2026,
    SOURCE_URLS[1]: 2025,
}

# ---------------------------------------------------------------------------
# Party canonical key mapping
# ---------------------------------------------------------------------------
PARTY_MAP = {
    "Likud": "likud",
    "Lik.": "likud",
    "Religious Zionism": "religious_zionism",
    "Rel. Zion.": "religious_zionism",
    "Otzma Yehudit": "otzma_yehudit",
    "Otzma": "otzma_yehudit",
    "Shas": "shas",
    "UTJ": "utj",
    "United Torah Judaism": "utj",
    "Yesh Atid": "yesh_atid",
    "Ya": "yesh_atid",
    "Blue and White": "blue_and_white",
    "Yisrael Beiteinu": "yisrael_beiteinu",
    "Y.B.": "yisrael_beiteinu",
    "Democrats": "democrats",
    "Dems": "democrats",
    "Yashar": "yashar",
    "Raam": "raam",
    "Ra'am": "raam",
    "Hadash–Ta'al": "hadash_taal",
    "Hadash-Ta'al": "hadash_taal",
    "Balad": "balad",
    "Joint List": "joint_list",
    "Reservists": "reservists",
    "Bennett 2026": "bennett_2026",
    "Together": "together",
    "Yachad": "together",
}

# ---------------------------------------------------------------------------
# Excluded firms (included in raw_polls but not weekly averages)
# ---------------------------------------------------------------------------
EXCLUDED_FIRMS = {"Filber", "Direct Polls"}
EXCLUDED_REASONS = {
    "Filber": "Channel 14 affiliate; consistently shows Likud 7-10 seats above other firms",
    "Direct Polls": "Methodological outlier; excluded per editorial policy",
}

# ---------------------------------------------------------------------------
# Bloc membership
# ---------------------------------------------------------------------------
COALITION_PARTIES = {"likud", "shas", "utj", "otzma_yehudit", "religious_zionism"}
OPPOSITION_PARTIES = {
    "together", "bennett_2026", "yesh_atid", "yisrael_beiteinu",
    "democrats", "yashar", "reservists",
}
UNALIGNED_PARTIES = {"raam", "hadash_taal", "balad", "joint_list"}

# Month name → number
MONTH_MAP = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
    "January": 1, "February": 2, "March": 3, "April": 4, "June": 6,
    "July": 7, "August": 8, "September": 9, "October": 10, "November": 11,
    "December": 12,
}

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; IsraelHayomElectionsBot/1.0; "
        "+https://www.israelhayom.co.il)"
    )
}

# Set VERIFY_SSL=0 on corporate networks with self-signed proxy certificates.
# On GitHub Actions (clean runner) this defaults to True.
VERIFY_SSL = os.environ.get("VERIFY_SSL", "1") != "0"


def fetch_url(url: str, retries: int = 3) -> Optional[str]:
    """Fetch URL with exponential backoff retries. Returns HTML text or None."""
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=30, verify=VERIFY_SSL)
            resp.raise_for_status()
            return resp.text
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
# Date parsing
# ---------------------------------------------------------------------------
def parse_date(raw: str, default_year: int) -> Optional[date]:
    """
    Parse polling date strings like:
      "25–26 Feb"  → date(default_year, 2, 26)   (use last date)
      "3 Mar"      → date(default_year, 3, 3)
      "3–4 Mar 2026" → date(2026, 3, 4)
    Returns None if unparseable.
    """
    raw = raw.strip()
    # Remove markdown bold/italic artefacts
    raw = re.sub(r"[*_]", "", raw)
    # Normalise dashes
    raw = raw.replace("–", "-").replace("—", "-").replace("−", "-")

    # Try to extract year from string
    year_match = re.search(r"\b(202\d)\b", raw)
    year = int(year_match.group(1)) if year_match else default_year

    # Remove year from string for further parsing
    raw_no_year = re.sub(r"\b202\d\b", "", raw).strip()

    # Pattern: "25-26 Feb" or "25 Feb" or "Feb 25-26" etc.
    # Try "DD[-DD] Mon" format
    m = re.match(
        r"(\d{1,2})(?:-\d{1,2})?\s+([A-Za-z]+)",
        raw_no_year,
    )
    if m:
        day = int(m.group(1))
        # Try to extract the LAST day in range
        range_m = re.match(r"\d{1,2}-(\d{1,2})\s+[A-Za-z]+", raw_no_year)
        if range_m:
            day = int(range_m.group(1))
        month_str = m.group(2)
        month = MONTH_MAP.get(month_str)
        if month:
            try:
                return date(year, month, day)
            except ValueError:
                pass

    # Try "Mon DD[-DD]" format
    m = re.match(
        r"([A-Za-z]+)\s+(\d{1,2})(?:-(\d{1,2}))?",
        raw_no_year,
    )
    if m:
        month_str = m.group(1)
        day = int(m.group(3) or m.group(2))  # use last day if range
        month = MONTH_MAP.get(month_str)
        if month:
            try:
                return date(year, month, day)
            except ValueError:
                pass

    log.debug("Could not parse date: %r", raw)
    return None


# ---------------------------------------------------------------------------
# Cell value parsing
# ---------------------------------------------------------------------------
def parse_seat_value(cell_text: str) -> Optional[int]:
    """
    Parse a seat count from a Wikipedia table cell.
    Rules:
      - "(2.6%)" or similar parenthetical percentage → 0 (below threshold)
      - "–", "—", "-", "" → None (no data)
      - "26" or "26*" → 26
    """
    text = cell_text.strip()
    # Remove footnote markers like [a], [b], *, †
    text = re.sub(r"\[\w+\]", "", text)
    text = re.sub(r"[*†‡]", "", text).strip()

    if not text or text in ("–", "—", "-", "N/A", "n/a"):
        return None

    # Parenthetical percentage → below threshold → 0 seats
    if re.match(r"^\([\d.]+%?\)$", text):
        return 0

    # Plain integer (possibly with decimal that gets rounded)
    m = re.match(r"^(\d+(?:\.\d+)?)$", text)
    if m:
        return int(round(float(m.group(1))))

    return None


# ---------------------------------------------------------------------------
# Table header parsing
# ---------------------------------------------------------------------------
def extract_party_columns(header_row) -> dict[int, str]:
    """
    Given a <tr> header row, return {col_index: canonical_party_key}.
    Skips columns that don't map to a known party.
    """
    cols: dict[int, str] = {}
    cells = header_row.find_all(["th", "td"])
    col_idx = 0
    for cell in cells:
        colspan = int(cell.get("colspan", 1))
        text = cell.get_text(separator=" ", strip=True)
        # Clean up
        text = re.sub(r"\s+", " ", text).strip()
        canonical = PARTY_MAP.get(text)
        if canonical:
            cols[col_idx] = canonical
        col_idx += colspan
    return cols


# ---------------------------------------------------------------------------
# Row-level poll parsing
# ---------------------------------------------------------------------------
def is_event_row(cells) -> bool:
    """Heuristic: event rows have date-like text with a colon, or span the full width."""
    if not cells:
        return False
    first = cells[0].get_text(strip=True)
    # Classic event row: "28 Feb: Something happened"
    if re.search(r"\d+\s+\w+:", first):
        return True
    # Single wide cell spanning multiple columns (colspan > 3) — always an event note
    if len(cells) == 1 and int(cells[0].get("colspan", 1)) > 3:
        return True
    return False


EVENT_TEXT_PATTERN = re.compile(
    r"(merge[sd]?|dissolv|coalition|opposition|knesset|chosen|elected|join|resign|appoint|footnote|\[\s*\d+\s*\])",
    re.IGNORECASE,
)


def is_event_firm(firm: str) -> bool:
    """Return True if the parsed firm name looks like a Wikipedia event note rather than a pollster."""
    if len(firm) > 60:
        return True
    if EVENT_TEXT_PATTERN.search(firm):
        return True
    return False


def parse_firm_and_publisher(cell_text: str) -> tuple[str, str]:
    """
    Extract firm and publisher from a cell that may look like:
      "Midgam / N12"
      "Midgam"
      "Lazar Research / Kan 11"
    """
    text = cell_text.strip()
    if "/" in text:
        parts = [p.strip() for p in text.split("/", 1)]
        return parts[0], parts[1]
    return text, ""


# ---------------------------------------------------------------------------
# Main table scraper
# ---------------------------------------------------------------------------
def scrape_page(url: str, default_year: int) -> list[dict]:
    """Scrape all polling tables from a Wikipedia page. Returns list of raw poll dicts."""
    html = fetch_url(url)
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    polls: list[dict] = []

    # Wikipedia polling tables use class "wikitable"
    tables = soup.find_all("table", class_=lambda c: c and "wikitable" in c)
    log.info("Found %d wikitable(s) on %s", len(tables), url)

    for table_idx, table in enumerate(tables):
        try:
            polls.extend(
                _parse_table(table, table_idx, url, default_year)
            )
        except Exception as exc:
            log.warning(
                "Table %d on %s failed with: %s — skipping",
                table_idx, url, exc, exc_info=True,
            )

    return polls


def _parse_table(
    table, table_idx: int, source_url: str, default_year: int
) -> list[dict]:
    """Parse a single wikitable and return poll dicts."""
    rows = table.find_all("tr")
    if not rows:
        return []

    # Find header row(s): rows where >50% of cells are <th>
    party_cols: dict[int, str] = {}
    date_col: Optional[int] = None
    firm_col: Optional[int] = None
    data_start_row = 0

    for i, row in enumerate(rows):
        ths = row.find_all("th")
        if len(ths) < 2:
            continue

        header_texts = [th.get_text(strip=True) for th in ths]

        # Look for date and firm columns
        has_date = any(
            re.search(r"date|fieldwork|poll\s*date", t, re.IGNORECASE)
            for t in header_texts
        )
        has_firm = any(
            re.search(r"pollster|firm|source|company", t, re.IGNORECASE)
            for t in header_texts
        )

        if has_date or has_firm:
            # Build col index map for all cells (th or td)
            all_cells = row.find_all(["th", "td"])
            col_idx = 0
            for cell in all_cells:
                colspan = int(cell.get("colspan", 1))
                text = cell.get_text(strip=True)
                text_lower = text.lower()

                if re.search(r"date|fieldwork", text_lower):
                    date_col = col_idx
                elif re.search(r"pollster|firm|source|company", text_lower):
                    firm_col = col_idx
                else:
                    canonical = PARTY_MAP.get(text)
                    if canonical:
                        party_cols[col_idx] = canonical

                col_idx += colspan

            data_start_row = i + 1
            # Re-parse party columns more carefully
            party_cols = extract_party_columns(row)
            # Re-detect date/firm after party_cols extraction
            col_idx = 0
            for cell in row.find_all(["th", "td"]):
                colspan = int(cell.get("colspan", 1))
                text = cell.get_text(strip=True).lower()
                if date_col is None and re.search(r"date|fieldwork", text):
                    date_col = col_idx
                if firm_col is None and re.search(r"pollster|firm|source|company", text):
                    firm_col = col_idx
                col_idx += colspan
            break

    if not party_cols:
        log.debug("Table %d: no party columns found, skipping", table_idx)
        return []

    # Defaults if we still haven't found date/firm cols
    if date_col is None:
        date_col = 0
    if firm_col is None:
        firm_col = 1

    polls: list[dict] = []

    for row in rows[data_start_row:]:
        cells = row.find_all(["td", "th"])
        if not cells or len(cells) < 2:
            continue

        # Skip event rows
        if is_event_row(cells):
            continue

        # Skip rows that are sub-headers (all th cells)
        if all(c.name == "th" for c in cells):
            # Only replace party_cols if this row is a genuine new full header
            # (must include at least one primary party — not just Arab-bloc sub-headers)
            PRIMARY = {"likud", "together", "shas", "yesh_atid", "bennett_2026"}
            new_cols = extract_party_columns(row)
            if new_cols and PRIMARY.intersection(new_cols.values()):
                party_cols = new_cols
            col_idx = 0
            for cell in cells:
                colspan = int(cell.get("colspan", 1))
                text = cell.get_text(strip=True).lower()
                if re.search(r"date|fieldwork", text):
                    date_col = col_idx
                if re.search(r"pollster|firm|source|company", text):
                    firm_col = col_idx
                col_idx += colspan
            continue

        # Build flat cell list respecting colspan
        flat: list[str] = []
        for cell in cells:
            colspan = int(cell.get("colspan", 1))
            text = cell.get_text(separator=" ", strip=True)
            text = re.sub(r"\s+", " ", text).strip()
            flat.extend([text] * colspan)

        if len(flat) <= max(date_col, firm_col):
            continue

        # Date
        raw_date_str = flat[date_col] if date_col < len(flat) else ""
        poll_date = parse_date(raw_date_str, default_year)
        if poll_date is None:
            continue

        # Firm / publisher
        raw_firm = flat[firm_col] if firm_col < len(flat) else ""
        firm, publisher = parse_firm_and_publisher(raw_firm)
        if not firm or is_event_firm(firm):
            continue

        # Seats
        seats: dict[str, Optional[int]] = {}
        for col_idx, party_key in party_cols.items():
            if col_idx < len(flat):
                seats[party_key] = parse_seat_value(flat[col_idx])
            else:
                seats[party_key] = None

        # Build poll record
        iso_year, iso_week, _ = poll_date.isocalendar()
        iso_week_str = f"{iso_year}-W{iso_week:02d}"
        firm_slug = re.sub(r"[^a-z0-9]+", "_", firm.lower()).strip("_")
        poll_id = f"{firm_slug}-{poll_date.isoformat()}"

        excluded = any(
            ex.lower() in firm.lower() for ex in EXCLUDED_FIRMS
        )

        poll: dict = {
            "id": poll_id,
            "date": poll_date.isoformat(),
            "iso_week": iso_week_str,
            "firm": firm,
            "publisher": publisher,
            "source_url": source_url,
            "excluded_from_avg": excluded,
            "seats": {k: v for k, v in seats.items() if v is not None},
        }

        polls.append(poll)

    log.info(
        "Table %d (%s): parsed %d polls",
        table_idx, source_url.split("/")[-1], len(polls),
    )
    return polls


# ---------------------------------------------------------------------------
# Weekly aggregation
# ---------------------------------------------------------------------------
def iso_week_bounds(iso_year: int, iso_week: int) -> tuple[date, date]:
    """Return (monday, sunday) for an ISO week."""
    jan4 = date(iso_year, 1, 4)
    start_of_week1 = jan4 - timedelta(days=jan4.isoweekday() - 1)
    week_start = start_of_week1 + timedelta(weeks=iso_week - 1)
    week_end = week_start + timedelta(days=6)
    return week_start, week_end


def build_weekly_averages(raw_polls: list[dict]) -> list[dict]:
    """
    Aggregate raw polls into weekly averages.
    - One poll per firm per week (latest date wins)
    - Exclude EXCLUDED_FIRMS
    - Flag sparse weeks (<3 firms)
    """
    # Collect by (iso_week) → {firm: poll}
    weeks: dict[str, dict[str, dict]] = {}

    for poll in raw_polls:
        if poll["excluded_from_avg"]:
            continue
        wk = poll["iso_week"]
        firm = poll["firm"]
        if wk not in weeks:
            weeks[wk] = {}
        # Keep latest date for this firm in this week
        existing = weeks[wk].get(firm)
        if existing is None or poll["date"] > existing["date"]:
            weeks[wk][firm] = poll

    weekly_averages: list[dict] = []

    for iso_week_str in sorted(weeks.keys()):
        firm_polls = list(weeks[iso_week_str].values())
        included_firms = sorted(p["firm"] for p in firm_polls)

        sparse = len(included_firms) < 3

        # Aggregate seat averages
        seat_sums: dict[str, list[int]] = {}
        for poll in firm_polls:
            for party, seats in poll["seats"].items():
                if seats is not None:
                    seat_sums.setdefault(party, []).append(seats)

        avg_seats: dict[str, float] = {
            party: round(sum(vals) / len(vals), 1)
            for party, vals in seat_sums.items()
        }

        # Blocs
        coalition = sum(
            avg_seats.get(p, 0) for p in COALITION_PARTIES
        )
        opposition = sum(
            avg_seats.get(p, 0) for p in OPPOSITION_PARTIES
        )
        unaligned = sum(
            avg_seats.get(p, 0) for p in UNALIGNED_PARTIES
        )

        # Parse iso_week for bounds
        m = re.match(r"(\d{4})-W(\d{1,2})", iso_week_str)
        if m:
            wy, wn = int(m.group(1)), int(m.group(2))
            ws, we = iso_week_bounds(wy, wn)
        else:
            ws = we = date.fromisoformat(firm_polls[0]["date"])

        weekly_averages.append(
            {
                "iso_week": iso_week_str,
                "week_start": ws.isoformat(),
                "week_end": we.isoformat(),
                "sparse": sparse,
                "included_firms": included_firms,
                "seats": avg_seats,
                "blocs": {
                    "coalition": round(coalition, 1),
                    "opposition": round(opposition, 1),
                    "unaligned": round(unaligned, 1),
                },
            }
        )

    return weekly_averages


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    from run_logger import RunLogger
    rl = RunLogger("scrape_polls")
    rl.start()

    all_polls: list[dict] = []

    for url in SOURCE_URLS:
        year = SOURCE_YEAR[url]
        log.info("Scraping %s (year context: %d)…", url, year)
        page_polls = scrape_page(url, year)
        log.info("Got %d polls from %s", len(page_polls), url)
        all_polls.extend(page_polls)

    # De-duplicate by id (keep latest)
    seen: dict[str, dict] = {}
    for poll in all_polls:
        seen[poll["id"]] = poll
    unique_polls = sorted(seen.values(), key=lambda p: p["date"], reverse=True)

    weekly_avgs = build_weekly_averages(unique_polls)

    output = {
        "generated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source_urls": SOURCE_URLS,
        "excluded_firms": {
            firm: EXCLUDED_REASONS[firm] for firm in EXCLUDED_FIRMS
        },
        "raw_polls": unique_polls,
        "weekly_averages": weekly_avgs,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(output, fh, ensure_ascii=False, indent=2)

    log.info("Wrote %s", OUTPUT_PATH)

    # Print summary
    print("=" * 60)
    print(f"polls.json summary")
    print(f"  Total raw polls : {len(unique_polls)}")
    print(f"  Unique firms    : {len({p['firm'] for p in unique_polls})}")
    print(f"  Date range      : "
          f"{min(p['date'] for p in unique_polls) if unique_polls else 'N/A'} to "
          f"{max(p['date'] for p in unique_polls) if unique_polls else 'N/A'}")
    print(f"  Weekly buckets  : {len(weekly_avgs)}")
    sparse_count = sum(1 for w in weekly_avgs if w["sparse"])
    print(f"  Sparse weeks    : {sparse_count}")
    print(f"  Output          : {OUTPUT_PATH}")
    print("=" * 60)

    rl.success(
        summary=f"{len(unique_polls)} סקרים, {len(weekly_avgs)} שבועות",
        records_count=len(unique_polls),
    )


if __name__ == "__main__":
    main()
