"""
fetch_media_mentions.py — Israel Hayom Elections Monitor
Fetches media mention counts and headlines from Google News RSS.
Falls back to israelhayom.co.il /tag/election-2026 when no IHY headlines found.

Schedule: every 3 hours
Output: public/data/media_mentions.json
"""

import json
import logging
import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from html import unescape

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "public" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = DATA_DIR / "media_mentions.json"

PERIOD = "3d"
PERIOD_LABEL = "3 ימים אחרונים"

LEADERS = [
    {"key": "netanyahu", "query": "בנימין נתניהו", "name_he": "בנימין נתניהו", "role": "ראש הממשלה", "party": "likud",
     "aliases": ["נתניהו", "ביבי"]},
    {"key": "eisenkot", "query": "גדי איזנקוט", "name_he": "גדי איזנקוט", "role": 'יו"ר ישר', "party": "yashar",
     "aliases": ["איזנקוט"]},
    {"key": "bennett", "query": "נפתלי בנט", "name_he": "נפתלי בנט", "role": 'יו"ר ביחד', "party": "together",
     "aliases": ["בנט"]},
    {"key": "lieberman", "query": "אביגדור ליברמן", "name_he": "אביגדור ליברמן", "role": 'יו"ר ישראל ביתנו', "party": "yisrael_beiteinu",
     "aliases": ["ליברמן"]},
    {"key": "golan", "query": "יאיר גולן", "name_he": "יאיר גולן", "role": 'יו"ר הדמוקרטים', "party": "democrats",
     "aliases": ["יאיר גולן", "גולן"]},
    {"key": "ben_gvir", "query": "איתמר בן גביר", "name_he": "איתמר בן גביר", "role": 'יו"ר עוצמה יהודית', "party": "otzma_yehudit",
     "aliases": ["בן גביר"]},
    {"key": "smotrich", "query": "בצלאל סמוטריץ'", "name_he": "בצלאל סמוטריץ'", "role": 'יו"ר הציונות הדתית', "party": "religious_zionism",
     "aliases": ["סמוטריץ'", "סמוטריץ"]},
]

IHY_DISPLAY = "ישראל היום"
IHY_RSS_NAMES = {"israelhayom.co.il", "ישראל היום", "Israel Hayom", "היום"}
IHY_TAG_URL = "https://www.israelhayom.co.il/tag/election-2026"
IHY_BASE = "https://www.israelhayom.co.il"
MAX_HEADLINES = 3

RSS_URL_TEMPLATE = (
    "https://news.google.com/rss/search?"
    "q={query}+when:{period}&hl=he&gl=IL&ceid=IL:he"
)

_ihy_cache: list[dict[str, str]] | None = None


def fetch_ihy_tag_articles() -> list[dict[str, str]]:
    """Fetch articles from Israel Hayom's election-2026 tag page."""
    global _ihy_cache
    if _ihy_cache is not None:
        return _ihy_cache

    log.info("Fetching IHY tag page: %s", IHY_TAG_URL)
    req = urllib.request.Request(IHY_TAG_URL, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "he",
    })

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except Exception as exc:
        log.warning("Failed to fetch IHY tag page: %s", exc)
        _ihy_cache = []
        return []

    articles: list[dict[str, str]] = []
    for m in re.finditer(
        r'<a[^>]+href="(/[^"]*?/article/\d+)"[^>]*>\s*([^<]+?)\s*</a>',
        html,
    ):
        path, title = m.group(1), unescape(m.group(2).strip())
        if len(title) < 10:
            continue
        url = IHY_BASE + path
        if not any(a["url"] == url for a in articles):
            articles.append({"title": title, "url": url})

    log.info("  Found %d IHY election articles", len(articles))
    _ihy_cache = articles
    return articles


def find_ihy_fallback(leader: dict[str, Any]) -> dict[str, Any] | None:
    """Find an IHY article mentioning this leader from the tag page."""
    articles = fetch_ihy_tag_articles()
    names = [leader["name_he"]] + leader.get("aliases", [])

    for article in articles:
        title_lower = article["title"]
        if any(name in title_lower for name in names):
            return {
                "title": article["title"],
                "source": IHY_DISPLAY,
                "published_at": "",
                "url": article["url"],
                "fallback": True,
            }
    return None


def resolve_google_news_url(google_url: str) -> str:
    """Follow Google News redirect and strip AMP suffix to get canonical URL."""
    if not google_url or "news.google.com" not in google_url:
        return google_url
    try:
        req = urllib.request.Request(google_url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        })
        req.method = "HEAD"
        with urllib.request.urlopen(req, timeout=8) as resp:
            final_url = resp.url
    except Exception:
        try:
            req = urllib.request.Request(google_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            })
            with urllib.request.urlopen(req, timeout=8) as resp:
                final_url = resp.url
        except Exception:
            return google_url

    final_url = re.sub(r'/amp/?$', '/', final_url)
    final_url = re.sub(r'\?amp=1$', '', final_url)
    final_url = final_url.replace('/amp/', '/')
    return final_url


def fetch_rss(query: str) -> tuple[int, list[dict[str, Any]]]:
    url = RSS_URL_TEMPLATE.format(
        query=urllib.request.quote(query),
        period=PERIOD,
    )
    log.info("Fetching RSS: %s", query)

    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
    except Exception as exc:
        log.warning("Failed to fetch RSS for %s: %s", query, exc)
        return 0, []

    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        log.warning("Failed to parse RSS for %s: %s", query, exc)
        return 0, []

    items = root.findall(".//item")
    count = len(items)

    headlines: list[dict[str, Any]] = []
    for item in items:
        title_el = item.find("title")
        source_el = item.find("source")
        link_el = item.find("link")
        pub_el = item.find("pubDate")

        if title_el is None or title_el.text is None:
            continue

        title = unescape(title_el.text.strip())
        source = source_el.text.strip() if source_el is not None and source_el.text else "לא ידוע"
        link = link_el.text.strip() if link_el is not None and link_el.text else None
        pub_date = pub_el.text.strip() if pub_el is not None and pub_el.text else None

        is_ihy = source in IHY_RSS_NAMES
        display_source = IHY_DISPLAY if is_ihy else source

        if title.endswith(f" - {source}"):
            title = title[: -(len(source) + 3)]

        resolved_url = None
        if link:
            resolved_url = resolve_google_news_url(link)

        headline: dict[str, Any] = {
            "title": title,
            "source": display_source,
            "published_at": pub_date or "",
        }
        if resolved_url:
            headline["url"] = resolved_url

        headlines.append(headline)

    return count, headlines


def pick_headlines(all_headlines: list[dict[str, Any]], leader: dict[str, Any]) -> list[dict[str, Any]]:
    ihy = [h for h in all_headlines if h["source"] == IHY_DISPLAY]
    other = [h for h in all_headlines if h["source"] != IHY_DISPLAY]

    if not ihy:
        fallback = find_ihy_fallback(leader)
        if fallback:
            ihy = [fallback]
            log.info("  IHY fallback for %s: %s", leader["name_he"], fallback["title"][:40])

    result: list[dict[str, Any]] = []
    if ihy:
        result.append(ihy[0])

    for h in other:
        if len(result) >= MAX_HEADLINES:
            break
        result.append(h)

    while len(result) < MAX_HEADLINES and len(ihy) > 1:
        idx = sum(1 for r in result if r["source"] == IHY_DISPLAY)
        if idx < len(ihy):
            result.append(ihy[idx])
        else:
            break

    return result[:MAX_HEADLINES]


def main() -> None:
    from run_logger import RunLogger
    rl = RunLogger("fetch_media_mentions")
    rl.start()

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    leaders_data: list[dict[str, Any]] = []

    for leader in LEADERS:
        count, headlines = fetch_rss(leader["query"])
        picked = pick_headlines(headlines, leader)

        leaders_data.append({
            "key": leader["key"],
            "name_he": leader["name_he"],
            "role": leader["role"],
            "party": leader["party"],
            "mention_count": count,
            "headlines": picked,
        })

        time.sleep(1)

    total_mentions = sum(ld["mention_count"] for ld in leaders_data)

    if total_mentions == 0 and OUTPUT_PATH.exists():
        log.warning("All mention counts are 0 — Google News likely blocked. Keeping previous data.")
        try:
            with open(OUTPUT_PATH, "r", encoding="utf-8") as fh:
                prev = json.load(fh)
            prev_total = sum(l.get("mention_count", 0) for l in prev.get("leaders", []))
            if prev_total > 0:
                log.info("Previous file has %d total mentions — preserved.", prev_total)
                print("SKIPPED: Google News returned 0 results, keeping previous data.")
                rl.success(summary="Google News חסום — נשמר מידע קודם", records_count=0)
                return
        except Exception:
            pass

    output = {
        "generated_at": generated_at,
        "period": PERIOD,
        "period_label": PERIOD_LABEL,
        "source": "Google News",
        "leaders": leaders_data,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(output, fh, ensure_ascii=False, indent=2)

    log.info("Wrote %s", OUTPUT_PATH)

    print("=" * 60)
    print("media_mentions.json summary")
    for ld in leaders_data:
        ihy_count = sum(1 for h in ld["headlines"] if h["source"] == IHY_DISPLAY)
        fallback = " [fallback]" if ihy_count > 0 and not any(
            h["source"] == IHY_DISPLAY for h in ld["headlines"] if "news.google.com" in h.get("url", "")
        ) else ""
        print(f"  {ld['name_he']:20s}  mentions={ld['mention_count']:>4d}  headlines={len(ld['headlines'])}  ihy={ihy_count}{fallback}")
    print(f"  Output: {OUTPUT_PATH}")
    print("=" * 60)

    rl.success(
        summary=f"{total_mentions} אזכורים, {len(leaders_data)} מנהיגים",
        records_count=total_mentions,
    )


if __name__ == "__main__":
    main()
