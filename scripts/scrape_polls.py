"""
scrape_polls.py — Israel Hayom Elections Monitor
Fetches Israeli election polling data from a Google Sheet and writes data/polls.json.

Source:
  Google Sheet with 7 tabs (one per media outlet / polling firm).
  Each tab: row 0 = dates (dd.mm.yyyy), column A = party names (Hebrew),
  cells = mandate counts.

Dependencies: none (uses stdlib only)
"""

import csv
import io
import json
import logging
import re
import time
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import Optional
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

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
MANUAL_OUTPUT_PATH = DATA_DIR / "polls_manual.json"

# ---------------------------------------------------------------------------
# Google Sheet config
# ---------------------------------------------------------------------------
SHEET_ID = "1dqCTjGIEAY122eO_RX8jzCOV6suVRQtLephyzmAep7o"

TABS = [
    {"name": "כאן 11",       "gid": 0,          "firm": "כאן 11"},
    {"name": "N12",           "gid": 466473480,  "firm": "N12"},
    {"name": "חדשות 13",     "gid": 970279281,  "firm": "חדשות 13"},
    {"name": "עכשיו 14",     "gid": 729874873,  "firm": "עכשיו 14"},
    {"name": "ישראל היום",   "gid": 1719973687, "firm": "ישראל היום"},
    {"name": "וואלה/מעריב",  "gid": 1927654778, "firm": "וואלה/מעריב"},
    {"name": "i24",           "gid": 534841776,  "firm": "i24"},
]

CSV_URL_TEMPLATE = (
    "https://docs.google.com/spreadsheets/d/{sheet_id}"
    "/export?format=csv&gid={gid}"
)

OUTLET_ID_MAP = {
    "כאן 11": "kan11",
    "N12": "news12",
    "חדשות 13": "news13",
    "עכשיו 14": "channel14",
    "ישראל היום": "israel_hayom",
    "וואלה/מעריב": "walla_maariv",
    "i24": "i24",
}

OUTLET_META = {
    "kan11":        {"name": "כאן 11",       "order": 1},
    "news12":       {"name": "N12",           "order": 2},
    "news13":       {"name": "חדשות 13",     "order": 3},
    "channel14":    {"name": "עכשיו 14",     "order": 4},
    "israel_hayom": {"name": "היום",          "order": 0},
    "walla_maariv": {"name": "וואלה/מעריב",  "order": 8},
    "i24":          {"name": "i24",           "order": 10},
}

MANUAL_KEY_MAP = {
    "bennett_2026": "bennett",
}

PARTY_META = {
    "likud":              {"name_he": "הליכוד",          "leader": "נתניהו",     "color": "#003DA5", "bloc": "coalition",  "order": 1},
    "otzma_yehudit":      {"name_he": "עוצמה יהודית",   "leader": "בן גביר",   "color": "#F9A825", "bloc": "coalition",  "order": 2},
    "shas":               {"name_he": 'ש"ס',            "leader": "דרעי",       "color": "#00897B", "bloc": "coalition",  "order": 3},
    "utj":                {"name_he": "יהדות התורה",     "leader": "גפני",       "color": "#1A237E", "bloc": "coalition",  "order": 4},
    "religious_zionism":  {"name_he": "הציונות הדתית",   "leader": "סמוטריץ'",  "color": "#E64A19", "bloc": "coalition",  "order": 5},
    "together":           {"name_he": "ביחד (בנט + לפיד)", "leader": "בנט",     "color": "#2E7D32", "bloc": "opposition", "order": 6},
    "bennett":            {"name_he": "נפתלי בנט",       "leader": "בנט",       "color": "#2E7D32", "bloc": "opposition", "order": 6, "note": "Pre-merger. After 27.04.2026 use 'together'"},
    "yesh_atid":          {"name_he": "יש עתיד",         "leader": "לפיד",      "color": "#FF8F00", "bloc": "opposition", "order": 7, "note": "Merged into 'together' on 27.04.2026"},
    "yashar":             {"name_he": "ישר!",            "leader": "איזנקוט",   "color": "#546E7A", "bloc": "opposition", "order": 8},
    "democrats":          {"name_he": "הדמוקרטים",       "leader": "",           "color": "#C2185B", "bloc": "opposition", "order": 9},
    "yisrael_beiteinu":   {"name_he": "ישראל ביתנו",     "leader": "ליברמן",    "color": "#1565C0", "bloc": "opposition", "order": 10},
    "raam":               {"name_he": 'רע"מ',            "leader": "עבאס",      "color": "#81C784", "bloc": "unaligned",  "order": 11},
    "hadash_taal":        {"name_he": 'חד"ש-תע"ל',      "leader": "",           "color": "#D32F2F", "bloc": "unaligned",  "order": 12},
    "joint_list":         {"name_he": "הרשימה המשותפת",  "leader": "",           "color": "#66BB6A", "bloc": "unaligned",  "order": 11},
    "blue_and_white":     {"name_he": "כחול לבן",        "leader": "גנץ",       "color": "#039BE5", "bloc": "unaligned",  "order": 13, "note": "Consistently below threshold"},
    "reservists":         {"name_he": "המילואימניקים",   "leader": "גרנר",      "color": "#795548", "bloc": "unaligned",  "order": 14, "note": "Consistently below threshold"},
    "balad":              {"name_he": 'בל"ד',            "leader": "",           "color": "#7B1FA2", "bloc": "unaligned",  "order": 15, "note": "Usually below threshold"},
    "beit_zioni":         {"name_he": "בית ציוני",       "leader": "",           "color": "#FF9800", "bloc": "unaligned",  "order": 16},
    "labor":              {"name_he": "העבודה",          "leader": "",           "color": "#E53935", "bloc": "opposition", "order": 17},
    "meretz":             {"name_he": "מרצ",             "leader": "",           "color": "#43A047", "bloc": "opposition", "order": 18},
}

# ---------------------------------------------------------------------------
# Hebrew party name → canonical key
# ---------------------------------------------------------------------------
HEBREW_PARTY_MAP = {
    "ישר! גדי איזנקוט": "yashar",
    "ישר!": "yashar",
    "הליכוד": "likud",
    "ביחד": "together",
    "הדמוקרטים": "democrats",
    "ישראל ביתנו": "yisrael_beiteinu",
    "עוצמה יהודית": "otzma_yehudit",
    "יהדות התורה": "utj",
    'ש"ס': "shas",
    "שס": "shas",
    'חד"ש-תע"ל': "hadash_taal",
    "חדש-תעל": "hadash_taal",
    'רע"מ': "raam",
    "ראם": "raam",
    "הציונות הדתית": "religious_zionism",
    'בל"ד': "balad",
    "בלד": "balad",
    "בית ציוני": "beit_zioni",
    "הרשימה המשותפת": "joint_list",
    "נפתלי בנט": "bennett_2026",
    "יש עתיד": "yesh_atid",
    "כחול לבן": "blue_and_white",
    "העבודה": "labor",
    "מרצ": "meretz",
}

# ---------------------------------------------------------------------------
# Excluded firms (included in raw_polls but not weekly averages)
# ---------------------------------------------------------------------------
EXCLUDED_FIRMS: set[str] = set()
EXCLUDED_REASONS: dict[str, str] = {}

# ---------------------------------------------------------------------------
# Bloc membership
# ---------------------------------------------------------------------------
COALITION_PARTIES = {"likud", "shas", "utj", "otzma_yehudit", "religious_zionism"}
OPPOSITION_PARTIES = {
    "together", "bennett_2026", "yesh_atid", "yisrael_beiteinu",
    "democrats", "yashar", "reservists", "blue_and_white",
}
UNALIGNED_PARTIES = {"raam", "hadash_taal", "balad", "joint_list", "beit_zioni"}

# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; IsraelHayomElectionsBot/1.0; "
        "+https://www.israelhayom.co.il)"
    )
}


def fetch_csv(gid: int, retries: int = 3) -> Optional[str]:
    url = CSV_URL_TEMPLATE.format(sheet_id=SHEET_ID, gid=gid)
    req = Request(url, headers=HEADERS)
    for attempt in range(1, retries + 1):
        try:
            with urlopen(req, timeout=30) as resp:
                return resp.read().decode("utf-8")
        except (URLError, HTTPError) as exc:
            wait = 2 ** attempt
            log.warning(
                "ניסיון %d/%d נכשל עבור gid=%s: %s. ממתין %ds…",
                attempt, retries, gid, exc, wait,
            )
            if attempt < retries:
                time.sleep(wait)
    log.error("כל %d הניסיונות נכשלו עבור gid=%s", retries, gid)
    return None


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------
def parse_date_ddmmyyyy(raw: str) -> Optional[date]:
    raw = raw.strip()
    if not raw:
        return None
    m = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", raw)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass
    return None


# ---------------------------------------------------------------------------
# Tab parsing
# ---------------------------------------------------------------------------
def parse_tab(tab: dict) -> list[dict]:
    csv_text = fetch_csv(tab["gid"])
    if not csv_text:
        return []

    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)

    if len(rows) < 2:
        log.warning("טאב %s: פחות מ-2 שורות", tab["name"])
        return []

    date_row = rows[0]
    dates = [parse_date_ddmmyyyy(cell) for cell in date_row[1:]]

    polls_by_date: dict[str, dict] = {}

    for row in rows[1:]:
        if not row or not row[0].strip():
            continue

        party_name_raw = row[0].strip()
        canonical = HEBREW_PARTY_MAP.get(party_name_raw)
        if canonical is None:
            log.debug("טאב %s: מפלגה לא מוכרת: %r", tab["name"], party_name_raw)
            continue

        for col_idx, cell in enumerate(row[1:]):
            if col_idx >= len(dates) or dates[col_idx] is None:
                continue
            poll_date = dates[col_idx]
            cell_val = cell.strip()
            if not cell_val:
                continue
            try:
                seats = int(cell_val)
            except ValueError:
                continue

            date_iso = poll_date.isoformat()
            if date_iso not in polls_by_date:
                polls_by_date[date_iso] = {
                    "date": poll_date,
                    "seats": {},
                }
            polls_by_date[date_iso]["seats"][canonical] = seats

    firm = tab["firm"]
    excluded = firm in EXCLUDED_FIRMS
    firm_slug = re.sub(r"[^a-z0-9֐-׿]+", "_", firm.lower()).strip("_")

    polls: list[dict] = []
    for date_iso, poll_data in sorted(polls_by_date.items(), reverse=True):
        poll_date = poll_data["date"]
        seats = poll_data["seats"]

        if not seats:
            continue

        iso_year, iso_week, _ = poll_date.isocalendar()
        iso_week_str = f"{iso_year}-W{iso_week:02d}"
        poll_id = f"{firm_slug}-{date_iso}"

        polls.append({
            "id": poll_id,
            "date": date_iso,
            "iso_week": iso_week_str,
            "firm": firm,
            "publisher": tab["name"],
            "source_url": f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit?gid={tab['gid']}",
            "excluded_from_avg": excluded,
            "seats": seats,
        })

    log.info("טאב %s: %d סקרים", tab["name"], len(polls))
    return polls


# ---------------------------------------------------------------------------
# Weekly aggregation
# ---------------------------------------------------------------------------
def iso_week_bounds(iso_year: int, iso_week: int) -> tuple[date, date]:
    jan4 = date(iso_year, 1, 4)
    start_of_week1 = jan4 - timedelta(days=jan4.isoweekday() - 1)
    week_start = start_of_week1 + timedelta(weeks=iso_week - 1)
    week_end = week_start + timedelta(days=6)
    return week_start, week_end


def build_weekly_averages(raw_polls: list[dict]) -> list[dict]:
    weeks: dict[str, dict[str, dict]] = {}

    for poll in raw_polls:
        if poll["excluded_from_avg"]:
            continue
        wk = poll["iso_week"]
        firm = poll["firm"]
        if wk not in weeks:
            weeks[wk] = {}
        existing = weeks[wk].get(firm)
        if existing is None or poll["date"] > existing["date"]:
            weeks[wk][firm] = poll

    weekly_averages: list[dict] = []

    for iso_week_str in sorted(weeks.keys()):
        firm_polls = list(weeks[iso_week_str].values())
        included_firms = sorted(p["firm"] for p in firm_polls)

        sparse = len(included_firms) < 3

        seat_sums: dict[str, list[int]] = {}
        for poll in firm_polls:
            for party, seats in poll["seats"].items():
                if seats is not None:
                    seat_sums.setdefault(party, []).append(seats)

        avg_seats: dict[str, float] = {
            party: round(sum(vals) / len(vals), 1)
            for party, vals in seat_sums.items()
        }

        coalition = sum(avg_seats.get(p, 0) for p in COALITION_PARTIES)
        opposition = sum(avg_seats.get(p, 0) for p in OPPOSITION_PARTIES)
        unaligned = sum(avg_seats.get(p, 0) for p in UNALIGNED_PARTIES)

        m = re.match(r"(\d{4})-W(\d{1,2})", iso_week_str)
        if m:
            wy, wn = int(m.group(1)), int(m.group(2))
            ws, we = iso_week_bounds(wy, wn)
        else:
            ws = we = date.fromisoformat(firm_polls[0]["date"])

        weekly_averages.append({
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
        })

    return weekly_averages


# ---------------------------------------------------------------------------
# polls_manual.json generation
# ---------------------------------------------------------------------------
def build_manual_polls(raw_polls: list[dict]) -> dict:
    by_date: dict[str, list[dict]] = {}
    for poll in raw_polls:
        by_date.setdefault(poll["date"], []).append(poll)

    timestamps: list[dict] = []
    for date_iso in sorted(by_date.keys()):
        polls_for_date = by_date[date_iso]
        d = date.fromisoformat(date_iso)
        label = f"{d.day:02d}.{d.month:02d}.{d.year}"

        manual_polls: list[dict] = []
        for poll in polls_for_date:
            outlet_id = OUTLET_ID_MAP.get(poll["firm"], poll["firm"])
            parties: dict[str, int] = {}
            for key, val in poll["seats"].items():
                if val is not None and val > 0:
                    manual_key = MANUAL_KEY_MAP.get(key, key)
                    parties[manual_key] = val
            total = sum(parties.values())
            manual_polls.append({
                "outlet": poll["firm"],
                "outlet_id": outlet_id,
                "parties": parties,
                "total": total,
            })

        manual_polls.sort(key=lambda p: OUTLET_META.get(p["outlet_id"], {}).get("order", 99))
        timestamps.append({
            "id": date_iso,
            "label": label,
            "polls": manual_polls,
        })

    used_party_keys: set[str] = set()
    for ts in timestamps:
        for p in ts["polls"]:
            used_party_keys.update(p["parties"].keys())

    party_metadata = {
        k: v for k, v in PARTY_META.items() if k in used_party_keys
    }

    used_outlet_ids: set[str] = set()
    for ts in timestamps:
        for p in ts["polls"]:
            used_outlet_ids.add(p["outlet_id"])

    outlet_metadata = {
        k: v for k, v in OUTLET_META.items() if k in used_outlet_ids
    }

    return {
        "last_updated": date.today().isoformat(),
        "timestamps": timestamps,
        "party_metadata": party_metadata,
        "outlet_metadata": outlet_metadata,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    from run_logger import RunLogger
    rl = RunLogger("scrape_polls")
    rl.start()

    all_polls: list[dict] = []

    for tab in TABS:
        log.info("מוריד נתונים מטאב: %s (gid=%s)…", tab["name"], tab["gid"])
        tab_polls = parse_tab(tab)
        all_polls.extend(tab_polls)

    seen: dict[str, dict] = {}
    for poll in all_polls:
        seen[poll["id"]] = poll
    unique_polls = sorted(seen.values(), key=lambda p: p["date"], reverse=True)

    weekly_avgs = build_weekly_averages(unique_polls)

    source_url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}"
    output = {
        "generated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source_urls": [source_url],
        "excluded_firms": {
            firm: EXCLUDED_REASONS[firm] for firm in EXCLUDED_FIRMS
        },
        "raw_polls": unique_polls,
        "weekly_averages": weekly_avgs,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(output, fh, ensure_ascii=False, indent=2)
    log.info("Wrote %s", OUTPUT_PATH)

    manual_output = build_manual_polls(unique_polls)
    with open(MANUAL_OUTPUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(manual_output, fh, ensure_ascii=False, indent=2)
    log.info("Wrote %s", MANUAL_OUTPUT_PATH)

    print("=" * 60)
    print("polls.json summary")
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
