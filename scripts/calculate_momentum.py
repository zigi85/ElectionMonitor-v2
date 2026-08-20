"""
calculate_momentum.py — Israel Hayom Elections Monitor
Reads polls.json, polymarket.json, and google_trends.json and computes
composite momentum scores. Writes data/momentum.json.

Inputs:
  data/polls.json          — use weekly_averages, find latest two non-sparse weeks
  data/polymarket.json     — compare to data/polymarket_previous.json if it exists
  data/google_trends.json  — may have "status": "error"

Weights:
  polls=0.45, polymarket=0.30, google_trends=0.25
  If google_trends unavailable: polls=0.60, polymarket=0.40

Dependencies: stdlib only (json, datetime, os, shutil)
Output: data/momentum.json
       data/polymarket_previous.json  (copy of current polymarket.json)
"""

import json
import logging
import os
import shutil
from datetime import datetime, date
from pathlib import Path
from typing import Optional

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

POLLS_PATH = DATA_DIR / "polls.json"
POLYMARKET_PATH = DATA_DIR / "polymarket.json"
POLYMARKET_PREV_PATH = DATA_DIR / "polymarket_previous.json"
TRENDS_PATH = DATA_DIR / "google_trends.json"
OUTPUT_PATH = DATA_DIR / "momentum.json"

# ---------------------------------------------------------------------------
# Weights
# ---------------------------------------------------------------------------
WEIGHTS_FULL = {"polls": 0.45, "polymarket": 0.30, "google_trends": 0.25}
WEIGHTS_NO_TRENDS = {"polls": 0.60, "polymarket": 0.40, "google_trends": 0.0}

# ---------------------------------------------------------------------------
# Party config
# ---------------------------------------------------------------------------
PARTIES_TO_COMPUTE = [
    "likud",
    "together",
    "shas",
    "yisrael_beiteinu",
    "democrats",
    "otzma_yehudit",
    "yashar",
    "reservists",
]

PARTY_LABELS = {
    "likud": "הליכוד",
    "together": "יחד",
    "shas": "ש״ס",
    "yisrael_beiteinu": "ישראל ביתנו",
    "democrats": "הדמוקרטים",
    "otzma_yehudit": "עוצמה יהודית",
    "yashar": "ישר",
    "reservists": "המילואימניקים",
    "religious_zionism": "הציונות הדתית",
    "utj": "יהדות התורה",
    "raam": "רע״ם",
    "hadash_taal": "חד״ש-תע״ל",
    "balad": "בל\"ד",
    "joint_list": "הרשימה המשותפת",
    "bennett_2026": "בנט 2026",
    "yesh_atid": "יש עתיד",
    "blue_and_white": "כחול לבן",
}

# Bloc membership
COALITION_PARTIES = {"likud", "shas", "utj", "otzma_yehudit", "religious_zionism"}
OPPOSITION_PARTIES = {
    "together", "bennett_2026", "yesh_atid", "yisrael_beiteinu",
    "democrats", "yashar", "reservists",
}
UNALIGNED_PARTIES = {"raam", "hadash_taal", "balad", "joint_list"}

# Polymarket PM → party mapping
PM_TO_PARTY = {
    "benjamin netanyahu": "likud",
    "netanyahu": "likud",
    "naftali bennett": "together",
    "bennett": "together",
    "gadi eizenkot": "yashar",
    "eizenkot": "yashar",
    "avigdor lieberman": "yisrael_beiteinu",
    "lieberman": "yisrael_beiteinu",
}

# Google Trends keyword → party mapping
TREND_TO_PARTY = {
    "ליכוד": "likud",
    "נפתלי בנט": "together",
    "בנימין נתניהו": "likud",
    "יחד": "together",
    "בחירות 2026": None,  # elections generic — no party mapping
}

# ---------------------------------------------------------------------------
# Data loading helpers
# ---------------------------------------------------------------------------
def load_json(path: Path) -> Optional[dict]:
    """Load a JSON file, returning None if missing or unparseable."""
    if not path.exists():
        log.warning("File not found: %s", path)
        return None
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError) as exc:
        log.error("Failed to load %s: %s", path, exc)
        return None


# ---------------------------------------------------------------------------
# Polls signal
# ---------------------------------------------------------------------------
def get_latest_non_sparse_weeks(
    weekly_averages: list[dict], n: int = 2
) -> list[dict]:
    """Return the n most recent non-sparse weeks up to and including today (sorted newest first)."""
    today = date.today().isoformat()
    non_sparse = [
        w for w in weekly_averages
        if not w.get("sparse", False) and w.get("week_start", "9999") <= today
    ]
    non_sparse.sort(key=lambda w: w["iso_week"], reverse=True)
    return non_sparse[:n]


def compute_together_seats(seats: dict) -> Optional[float]:
    """
    For 'together': use direct seats if available; otherwise sum
    bennett_2026 + yesh_atid to handle pre-merger polls.
    """
    if "together" in seats and seats["together"] is not None:
        return float(seats["together"])
    bennett = seats.get("bennett_2026")
    ya = seats.get("yesh_atid")
    if bennett is not None and ya is not None:
        return float(bennett) + float(ya)
    if bennett is not None:
        return float(bennett)
    if ya is not None:
        return float(ya)
    return None


def compute_polls_signals(polls_data: Optional[dict]) -> dict[str, Optional[int]]:
    """
    Signal: compare latest non-sparse week vs previous non-sparse week.
    diff > +1.5 → +1, diff < -1.5 → -1, else 0.
    Returns {party: signal} for each party in PARTIES_TO_COMPUTE.
    """
    if polls_data is None:
        return {p: None for p in PARTIES_TO_COMPUTE}

    weekly_averages = polls_data.get("weekly_averages", [])
    latest_two = get_latest_non_sparse_weeks(weekly_averages, n=2)

    if len(latest_two) < 2:
        log.warning(
            "Not enough non-sparse weeks for polls signal (%d found)", len(latest_two)
        )
        return {p: None for p in PARTIES_TO_COMPUTE}

    current_week, previous_week = latest_two[0], latest_two[1]
    current_seats = current_week.get("seats", {})
    previous_seats = previous_week.get("seats", {})

    signals: dict[str, Optional[int]] = {}
    for party in PARTIES_TO_COMPUTE:
        if party == "together":
            cur = compute_together_seats(current_seats)
            prev = compute_together_seats(previous_seats)
        else:
            cur = current_seats.get(party)
            prev = previous_seats.get(party)
            if cur is not None:
                cur = float(cur)
            if prev is not None:
                prev = float(prev)

        if cur is None or prev is None:
            signals[party] = None
            continue

        diff = cur - prev
        if diff > 1.5:
            signals[party] = 1
        elif diff < -1.5:
            signals[party] = -1
        else:
            signals[party] = 0

        log.debug("  polls signal %s: cur=%.1f prev=%.1f diff=%.1f → %d",
                  party, cur, prev, diff, signals[party])

    return signals


# ---------------------------------------------------------------------------
# Polymarket signal
# ---------------------------------------------------------------------------
def get_pm_probabilities(polymarket_data: Optional[dict]) -> dict[str, float]:
    """Extract {name_lower: probability} from the next_pm market outcomes."""
    if polymarket_data is None:
        return {}

    markets = polymarket_data.get("markets", [])
    pm_market = next((m for m in markets if m and m.get("key") == "next_pm"), None)
    if not pm_market or pm_market.get("error"):
        return {}

    outcomes = pm_market.get("outcomes") or []
    return {o["name"].lower(): o["probability"] for o in outcomes}


def compute_polymarket_signals(
    current_data: Optional[dict],
    previous_data: Optional[dict],
) -> dict[str, Optional[int]]:
    """
    Signal: compare current PM probability vs previous.
    diff > +3% → +1, diff < -3% → -1, else 0.
    Map PM candidates to parties via PM_TO_PARTY.
    If two signals map to same party, average them.
    """
    current_probs = get_pm_probabilities(current_data)
    previous_probs = get_pm_probabilities(previous_data)

    if not current_probs or not previous_probs:
        log.warning(
            "Polymarket probabilities unavailable (current=%s, previous=%s)",
            bool(current_probs), bool(previous_probs),
        )
        return {p: None for p in PARTIES_TO_COMPUTE}

    # Accumulate raw signals per party (may have multiple candidates mapping to same party)
    party_raw: dict[str, list[int]] = {p: [] for p in PARTIES_TO_COMPUTE}

    for name_lower, cur_prob in current_probs.items():
        # Find matching party via PM_TO_PARTY
        party = None
        for key, pkey in PM_TO_PARTY.items():
            if key in name_lower:
                party = pkey
                break

        if party is None or party not in PARTIES_TO_COMPUTE:
            continue

        prev_prob = previous_probs.get(name_lower, 0.0)
        diff_pct = (cur_prob - prev_prob) * 100

        if diff_pct > 3.0:
            sig = 1
        elif diff_pct < -3.0:
            sig = -1
        else:
            sig = 0

        log.debug(
            "  polymarket signal %s (via %r): cur=%.3f prev=%.3f diff=%.1f%% → %d",
            party, name_lower, cur_prob, prev_prob, diff_pct, sig,
        )
        party_raw[party].append(sig)

    # Average multiple signals for same party and round
    signals: dict[str, Optional[int]] = {}
    for party in PARTIES_TO_COMPUTE:
        raw = party_raw.get(party, [])
        if not raw:
            signals[party] = None
        else:
            avg = sum(raw) / len(raw)
            # Round toward the signal direction
            if avg > 0.0:
                signals[party] = 1
            elif avg < 0.0:
                signals[party] = -1
            else:
                signals[party] = 0

    return signals


# ---------------------------------------------------------------------------
# Google Trends signal
# ---------------------------------------------------------------------------
def compute_trends_signals(
    trends_data: Optional[dict],
) -> dict[str, Optional[int]]:
    """
    Signal from google_trends.json direction field.
    Map: ליכוד→likud, נפתלי בנט→together, בנימין נתניהו→likud (average if two → same party)
    direction: "rising"→+1, "stable"→0, "falling"→-1
    """
    if trends_data is None or trends_data.get("status") == "error":
        return {p: None for p in PARTIES_TO_COMPUTE}

    keywords_data = trends_data.get("keywords", [])
    if not keywords_data:
        return {p: None for p in PARTIES_TO_COMPUTE}

    direction_to_int = {"rising": 1, "stable": 0, "falling": -1}

    party_raw: dict[str, list[int]] = {p: [] for p in PARTIES_TO_COMPUTE}

    for kw_entry in keywords_data:
        keyword = kw_entry.get("keyword", "")
        direction = kw_entry.get("direction", "stable")
        party = TREND_TO_PARTY.get(keyword)

        if party is None or party not in PARTIES_TO_COMPUTE:
            continue

        sig = direction_to_int.get(direction, 0)
        log.debug(
            "  trends signal %s (via %r): direction=%s → %d",
            party, keyword, direction, sig,
        )
        party_raw[party].append(sig)

    signals: dict[str, Optional[int]] = {}
    for party in PARTIES_TO_COMPUTE:
        raw = party_raw.get(party, [])
        if not raw:
            signals[party] = None
        else:
            avg = sum(raw) / len(raw)
            # Average (e.g. two keywords both point to likud)
            if avg > 0.0:
                signals[party] = 1
            elif avg < 0.0:
                signals[party] = -1
            else:
                signals[party] = 0

    return signals


# ---------------------------------------------------------------------------
# Composite score
# ---------------------------------------------------------------------------
def is_trends_available(trends_data: Optional[dict]) -> bool:
    if trends_data is None:
        return False
    return trends_data.get("status") in ("ok", "partial")


def is_polymarket_available(polymarket_data: Optional[dict]) -> bool:
    if polymarket_data is None:
        return False
    markets = polymarket_data.get("markets", [])
    pm = next((m for m in markets if m and m.get("key") == "next_pm"), None)
    return pm is not None and not pm.get("error") and pm.get("outcomes")


def compute_composite(
    polls_sig: Optional[int],
    poly_sig: Optional[int],
    trends_sig: Optional[int],
    weights: dict[str, float],
) -> float:
    """
    Weighted sum of available signals (skip None).
    Renormalise weights if a source is None.
    """
    available: list[tuple[str, int]] = []
    if polls_sig is not None:
        available.append(("polls", polls_sig))
    if poly_sig is not None:
        available.append(("polymarket", poly_sig))
    if trends_sig is not None:
        available.append(("google_trends", trends_sig))

    if not available:
        return 0.0

    total_weight = sum(weights[src] for src, _ in available)
    if total_weight == 0:
        return 0.0

    score = sum(weights[src] * sig for src, sig in available) / total_weight
    return round(score, 4)


def classify_direction(score: float) -> str:
    if score > 0.3:
        return "gaining"
    elif score < -0.3:
        return "losing"
    return "stable"


# ---------------------------------------------------------------------------
# Bloc aggregation
# ---------------------------------------------------------------------------
def compute_bloc_stats(
    weekly_averages: list[dict],
) -> dict[str, dict]:
    """
    Compute latest and previous bloc totals, delta, and direction.
    Uses the two most recent non-sparse weeks.
    """
    latest_two = get_latest_non_sparse_weeks(weekly_averages, n=2)

    blocs: dict[str, dict] = {
        "coalition": {},
        "opposition": {},
        "unaligned": {},
    }
    bloc_parties = {
        "coalition": COALITION_PARTIES,
        "opposition": OPPOSITION_PARTIES,
        "unaligned": UNALIGNED_PARTIES,
    }

    if not latest_two:
        for bloc in blocs:
            blocs[bloc] = {"seats": None, "delta": None, "direction": "stable"}
        return blocs

    current_seats = latest_two[0].get("seats", {})
    previous_seats = latest_two[1].get("seats", {}) if len(latest_two) > 1 else {}

    for bloc_name, parties in bloc_parties.items():
        cur_total = sum(float(current_seats.get(p, 0) or 0) for p in parties)
        prev_total = sum(float(previous_seats.get(p, 0) or 0) for p in parties)
        delta = round(cur_total - prev_total, 1) if previous_seats else 0.0

        if abs(delta) > 10:
            log.warning(
                "Bloc %s delta=%.1f exceeds plausible range — treating as 0",
                bloc_name, delta,
            )
            delta = 0.0

        if delta > 1.0:
            direction = "gaining"
        elif delta < -1.0:
            direction = "losing"
        else:
            direction = "stable"

        blocs[bloc_name] = {
            "seats": round(cur_total, 1),
            "delta": delta,
            "direction": direction,
        }

    return blocs


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    from run_logger import RunLogger
    rl = RunLogger("calculate_momentum")
    rl.start()

    # Load all data sources
    polls_data = load_json(POLLS_PATH)
    polymarket_data = load_json(POLYMARKET_PATH)
    polymarket_prev_data = load_json(POLYMARKET_PREV_PATH)
    trends_data = load_json(TRENDS_PATH)

    # Determine availability
    trends_ok = is_trends_available(trends_data)
    polymarket_ok = is_polymarket_available(polymarket_data)

    degraded_sources: list[str] = []
    if not trends_ok:
        degraded_sources.append("google_trends")
    if not polymarket_ok:
        degraded_sources.append("polymarket")
    if polls_data is None:
        degraded_sources.append("polls")

    # Select weights
    if not trends_ok:
        weights = WEIGHTS_NO_TRENDS.copy()
        log.info("Google Trends unavailable — using degraded weights")
    else:
        weights = WEIGHTS_FULL.copy()

    # Compute per-source signals
    log.info("Computing polls signals…")
    polls_signals = compute_polls_signals(polls_data)

    log.info("Computing polymarket signals…")
    polymarket_signals = compute_polymarket_signals(
        polymarket_data, polymarket_prev_data
    )

    log.info("Computing trends signals…")
    trends_signals = compute_trends_signals(trends_data)

    # Build party momentum records
    parties_output: list[dict] = []

    for party in PARTIES_TO_COMPUTE:
        p_sig = polls_signals.get(party)
        pm_sig = polymarket_signals.get(party)
        t_sig = trends_signals.get(party)

        score = compute_composite(p_sig, pm_sig, t_sig, weights)
        direction = classify_direction(score)

        parties_output.append({
            "party": party,
            "direction": direction,
            "score": score,
            "label": PARTY_LABELS.get(party, party),
            "signals": {
                "polls": p_sig,
                "polymarket": pm_sig,
                "google_trends": t_sig,
            },
        })

        log.info(
            "  %s: score=%.3f direction=%s  (polls=%s poly=%s trends=%s)",
            party, score, direction, p_sig, pm_sig, t_sig,
        )

    # Compute bloc stats
    blocs_output: dict = {}
    if polls_data:
        weekly_averages = polls_data.get("weekly_averages", [])
        blocs_output = compute_bloc_stats(weekly_averages)
    else:
        blocs_output = {
            bloc: {"seats": None, "delta": None, "direction": "stable"}
            for bloc in ("coalition", "opposition", "unaligned")
        }

    # Build output
    output = {
        "generated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "weights": {k: v for k, v in weights.items() if v > 0},
        "degraded_sources": degraded_sources,
        "parties": parties_output,
        "blocs": blocs_output,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(output, fh, ensure_ascii=False, indent=2)

    log.info("Wrote %s", OUTPUT_PATH)

    # Copy polymarket.json → polymarket_previous.json
    if POLYMARKET_PATH.exists():
        shutil.copy2(POLYMARKET_PATH, POLYMARKET_PREV_PATH)
        log.info(
            "Copied %s → %s", POLYMARKET_PATH.name, POLYMARKET_PREV_PATH.name
        )

    # Summary
    print("=" * 60)
    print("momentum.json summary")
    print(f"  Degraded sources : {degraded_sources or 'none'}")
    print(f"  Weights          : {weights}")
    print()
    print(f"  {'Party':<22}  {'Score':>7}  Direction")
    print(f"  {'-'*22}  {'-'*7}  ---------")
    for p in parties_output:
        print(
            f"  {p['party']:<22}  {p['score']:>+7.3f}  {p['direction']}"
        )
    print()
    print(f"  Blocs:")
    for bloc_name, bdata in blocs_output.items():
        seats = bdata.get("seats")
        delta = bdata.get("delta")
        direction = bdata.get("direction", "stable")
        seats_str = f"{seats:.1f}" if seats is not None else "N/A"
        delta_str = f"{delta:+.1f}" if delta is not None else "N/A"
        print(f"    {bloc_name:<12}  seats={seats_str}  delta={delta_str}  {direction}")
    print(f"\n  Output : {OUTPUT_PATH}")
    print("=" * 60)

    degraded_he = ", ".join(degraded_sources) if degraded_sources else "אין"
    rl.success(
        summary=f"{len(parties_output)} מפלגות, חסרים: {degraded_he}",
        records_count=len(parties_output),
    )


if __name__ == "__main__":
    main()
