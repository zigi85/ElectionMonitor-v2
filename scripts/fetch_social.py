"""
fetch_social.py — Israel Hayom Elections Monitor
Fetches social signal data from free sources:
- Hot topics from Google News RSS headline analysis
- Wikipedia pageview buzz for each leader

Schedule: every 6 hours
Output: public/data/social.json
"""

import json
import logging
import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from html import unescape

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "public" / "data"
OUTPUT_PATH = DATA_DIR / "social.json"

# ── Google News RSS for hot topic extraction ─────────────────────────────────

RSS_URL = (
    "https://news.google.com/rss/search?"
    "q={query}+when:3d&hl=he&gl=IL&ceid=IL:he"
)

ELECTION_QUERIES = [
    "בחירות ישראל 2026",
    "בחירות לכנסת",
]

TOPICS = [
    {"id": "elections",    "label": "בחירות וסקרים",    "keywords": ["בחירות", "קלפי", "הצבעה", "סקר", "סקרים", "מנדט", "מנדטים", "קמפיין", "תעמולה"]},
    {"id": "security",     "label": "ביטחון",            "keywords": ["ביטחון", "צבא", "צה\"ל", "מלחמה", "טרור", "חמאס", "חיזבאללה", "עזה", "לבנון", "איראן", "גבול"]},
    {"id": "economy",      "label": "כלכלה ויוקר המחיה", "keywords": ["כלכלה", "יוקר המחיה", "יוקר", "מחירים", "תקציב", "דיור", "משכנתא", "אינפלציה", "שכר מינימום", "מע\"מ"]},
    {"id": "coalition",    "label": "קואליציה וכנסת",    "keywords": ["קואליציה", "אופוזיציה", "ממשלה", "כנסת", "חקיקה", "הצעת חוק", "פיזור"]},
    {"id": "haredim",      "label": "חרדים וגיוס",       "keywords": ["חרדים", "חרדי", "גיוס חרדים", "פטור", "ישיבות", "ש\"ס", "יהדות התורה"]},
    {"id": "judiciary",    "label": "מערכת המשפט",       "keywords": ["בג\"ץ", "משפט", "שופט", "פרקליט", "רפורמה משפטית", "נאשם"]},
    {"id": "negotiations", "label": "דיפלומטיה",         "keywords": ["מו\"מ", "שלום", "פלסטינים", "מדינה פלסטינית", "הסכם", "נורמליזציה", "סעודיה"]},
    {"id": "social",       "label": "חברה וחינוך",       "keywords": ["חינוך", "בריאות", "רווחה", "תחבורה", "שוויון", "מחאה", "הפגנה"]},
]

# ── Leader configuration for Wikipedia pageviews ─────────────────────────────

LEADERS = [
    {"key": "netanyahu",  "name_he": "בנימין נתניהו",     "wiki_article": "בנימין_נתניהו"},
    {"key": "eisenkot",   "name_he": "גדי איזנקוט",       "wiki_article": "גדי_איזנקוט"},
    {"key": "bennett",    "name_he": "נפתלי בנט",         "wiki_article": "נפתלי_בנט"},
    {"key": "lieberman",  "name_he": "אביגדור ליברמן",    "wiki_article": "אביגדור_ליברמן"},
    {"key": "golan",      "name_he": "יאיר גולן",         "wiki_article": "יאיר_גולן"},
    {"key": "ben_gvir",   "name_he": "איתמר בן גביר",     "wiki_article": "איתמר_בן_גביר"},
    {"key": "smotrich",   "name_he": "בצלאל סמוטריץ'",    "wiki_article": "בצלאל_סמוטריץ'"},
]

WIKI_API = (
    "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article"
    "/he.wikipedia/all-access/all-agents/{article}/daily/{start}/{end}"
)

# ── YouTube channels (RSS feeds, no API key needed) ──────────────────────────

YT_RSS = "https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"

YT_CHANNELS = [
    {"key": "netanyahu",  "name_he": "בנימין נתניהו",     "channel_id": "UCzuhZvXZVi7KQAPbOQfBIgw"},
    {"key": "bennett",    "name_he": "נפתלי בנט",         "channel_id": "UC4x7LYSzgGH-TMKc9J8pwgQ"},
    {"key": "ben_gvir",   "name_he": "איתמר בן גביר",     "channel_id": "UC3y5Z7NKpA8Ylc_YAqDwSfg"},
    {"key": "lieberman",  "name_he": "אביגדור ליברמן",    "channel_id": "UCXlgsb8j1pRJfBY1GAsiyvg"},
    {"key": "smotrich",   "name_he": "בצלאל סמוטריץ'",    "channel_id": "UClHfYQSOP49VxCPWHwxeORA"},
    {"key": "golan",      "name_he": "יאיר גולן",         "channel_id": "UC_U4u8YT_4w5MzAhYzug-2w"},
    {"key": "eisenkot",   "name_he": "גדי איזנקוט",       "channel_id": "UCMd2FK_hnsms4XzYCYtnwCw"},
]

# ── Telegram channels (public web scraping, no API key) ────────────────────

TG_CHANNELS = [
    {"key": "netanyahu",   "name_he": "בנימין נתניהו",   "username": "bnetanyahu",         "type": "politician"},
    {"key": "bennett",     "name_he": "נפתלי בנט",       "username": "naftalibennett1",     "type": "politician"},
    {"key": "ben_gvir",    "name_he": "איתמר בן גביר",   "username": "bengvir",             "type": "politician"},
    {"key": "smotrich",    "name_he": "בצלאל סמוטריץ'",  "username": "smutrich",            "type": "politician"},
    {"key": "israelhayom", "name_he": "ישראל היום",       "username": "israelhayomofficial", "type": "news"},
    {"key": "ynet",        "name_he": "ynet",             "username": "ynetalerts",          "type": "news"},
    {"key": "ch13",        "name_he": "חדשות 13",         "username": "newsisrael13_il",     "type": "news"},
    {"key": "ch12",        "name_he": "חדשות 12",         "username": "N12_News",            "type": "news"},
    {"key": "walla",       "name_he": "וואלה",            "username": "walla_newschannel",   "type": "news"},
    {"key": "ch14",        "name_he": "ערוץ 14",          "username": "now14tv",             "type": "news"},
]


def fetch_election_headlines() -> list[dict[str, str]]:
    """Fetch headlines with source from Google News RSS for election-related queries."""
    all_headlines: list[dict[str, str]] = []

    for query in ELECTION_QUERIES:
        url = RSS_URL.format(query=urllib.request.quote(query))
        log.info("Fetching RSS for hot topics: %s", query)

        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
        except Exception as exc:
            log.warning("Failed to fetch RSS for %s: %s", query, exc)
            continue

        try:
            root = ET.fromstring(data)
        except ET.ParseError:
            continue

        for item in root.findall(".//item"):
            title_el = item.find("title")
            if title_el is None or title_el.text is None:
                continue
            title = unescape(title_el.text.strip())
            source_el = item.find("source")
            source = source_el.text.strip() if source_el is not None and source_el.text else ""
            if source and title.endswith(f" - {source}"):
                title = title[:-(len(source) + 3)]
            all_headlines.append({"title": title, "source": source})

        time.sleep(1)

    log.info("  Collected %d election headlines", len(all_headlines))
    return all_headlines


def extract_hot_topics(headlines: list[dict[str, str]]) -> list[dict[str, Any]]:
    """Match headlines against predefined topics and rank by frequency."""
    topic_results: list[dict[str, Any]] = []

    for topic in TOPICS:
        count = 0
        sample_title = ""
        sample_source = ""
        best_score = 0
        for h in headlines:
            title = h["title"]
            matches = sum(1 for kw in topic["keywords"] if kw in title)
            if matches > 0:
                count += 1
                if matches > best_score or (matches == best_score and len(title) > len(sample_title)):
                    best_score = matches
                    sample_title = title
                    sample_source = h["source"]

        if count > 0:
            topic_results.append({
                "id": topic["id"],
                "label": topic["label"],
                "mention_count": count,
                "sample_headline": sample_title[:120] if sample_title else "",
                "sample_source": sample_source,
            })

    topic_results.sort(key=lambda t: t["mention_count"], reverse=True)
    return topic_results


def fetch_wiki_pageviews(article: str, days: int = 7) -> dict[str, Any]:
    """Fetch Wikipedia pageview data for an article over the last N days."""
    end = datetime.now(timezone.utc) - timedelta(days=1)
    start = end - timedelta(days=days - 1)
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=days - 1)

    def _fetch_range(s: datetime, e: datetime) -> int:
        url = WIKI_API.format(
            article=urllib.request.quote(article),
            start=s.strftime("%Y%m%d"),
            end=e.strftime("%Y%m%d"),
        )
        req = urllib.request.Request(url, headers={
            "User-Agent": "IsraelHayomElectionMonitor/1.0 (moranp@israelhayom.co.il)",
        })
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
            return sum(item.get("views", 0) for item in data.get("items", []))
        except Exception as exc:
            log.warning("Wiki pageviews failed for %s: %s", article, exc)
            return 0

    current = _fetch_range(start, end)
    previous = _fetch_range(prev_start, prev_end)

    if previous > 0 and current > 0:
        change_pct = ((current - previous) / previous) * 100
        if change_pct > 15:
            direction = "rising"
        elif change_pct < -15:
            direction = "falling"
        else:
            direction = "stable"
    else:
        change_pct = 0.0
        direction = "stable"

    return {
        "views_7d": current,
        "prev_views_7d": previous,
        "change_pct": round(change_pct, 1),
        "direction": direction,
    }


def fetch_leader_buzz() -> list[dict[str, Any]]:
    """Fetch Wikipedia pageviews for all leaders as a buzz metric."""
    results: list[dict[str, Any]] = []

    for leader in LEADERS:
        log.info("Fetching Wikipedia buzz: %s", leader["name_he"])
        wiki_data = fetch_wiki_pageviews(leader["wiki_article"])

        results.append({
            "key": leader["key"],
            "name_he": leader["name_he"],
            **wiki_data,
        })
        time.sleep(0.5)

    results.sort(key=lambda r: r["views_7d"], reverse=True)
    return results


VIRAL_QUERIES = [
    "בחירות 2026 סקר מנדטים",
    "נתניהו בחירות 2026",
    "בנט בחירות 2026",
    "איזנקוט בחירות 2026",
    "סמוטריץ בן גביר בחירות",
    "קמפיין בחירות כנסת 2026",
    "ליברמן בחירות 2026",
    "קואליציה אופוזיציה בחירות",
]


def _parse_yt_views(text: str) -> int:
    """Parse YouTube view count text like '174,501 צפיות' to int."""
    if not text:
        return 0
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else 0


def _parse_relative_days(text: str) -> int:
    """Parse YouTube relative time text to approximate number of days ago.

    Handles Hebrew ('לפני 3 ימים') and English ('3 days ago').
    Hebrew has singular/dual/plural forms with different stems, so we list
    all three explicitly (e.g. שעה / שעתיים / שעות).
    Returns 999 when the text cannot be parsed.
    """
    if not text:
        return 999
    t = text.strip()
    if any(w in t for w in ("שניה", "שניות", "שנייה", "שניתיים")) or "second" in t.lower():
        return 0
    if any(w in t for w in ("דקה", "דקות", "דקתיים")) or "minute" in t.lower():
        return 0
    if any(w in t for w in ("שעה", "שעות", "שעתיים")) or "hour" in t.lower():
        return 0
    if any(w in t for w in ("יום", "ימים", "יומיים")) or "day" in t.lower():
        m = re.search(r"(\d+)", t)
        return int(m.group(1)) if m else 1
    if "שבוע" in t or "week" in t.lower():
        m = re.search(r"(\d+)", t)
        return (int(m.group(1)) if m else 1) * 7
    if "חודש" in t or "month" in t.lower():
        m = re.search(r"(\d+)", t)
        return (int(m.group(1)) if m else 1) * 30
    if any(w in t for w in ("שנה", "שנים", "שנתיים")) or "year" in t.lower():
        return 365
    return 999


MAX_VIDEO_AGE_DAYS = 5

CHANNEL_BLACKLIST = {"ועדת הבחירות המרכזית", "ועדת הבחירות", "אם תרצו"}

ISRAEL_KEYWORDS = [
    "ישראל", "כנסת", "מנדט", "קואליציה", "אופוזיציה", "קלפי",
    "נתניהו", "ביבי", "בנט", "איזנקוט", "סמוטריץ", "בן גביר",
    "ליברמן", "לפיד", "גולן", "גנץ", "דרעי",
    "ליכוד", "עוצמה", "ש\"ס", "מחנה", "ישר!",
]


def fetch_viral_videos() -> list[dict[str, Any]]:
    """Search YouTube for viral election-related videos, sorted by views."""
    seen_ids: set[str] = set()
    seen_titles: set[str] = set()
    all_videos: list[dict[str, Any]] = []

    for query in VIRAL_QUERIES:
        log.info("YouTube search: %s", query)
        url = (
            "https://www.youtube.com/results?search_query="
            + urllib.request.quote(query)
        )
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept-Language": "he-IL,he;q=0.9",
        })
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                html = resp.read().decode("utf-8")
        except Exception as exc:
            log.warning("  YouTube search failed for %s: %s", query, exc)
            time.sleep(1)
            continue

        m = re.search(r"ytInitialData\s*=\s*(\{.+?\});\s*</script>", html, re.DOTALL)
        if not m:
            log.warning("  Could not find ytInitialData for %s", query)
            time.sleep(1)
            continue

        try:
            data = json.loads(m.group(1))
        except json.JSONDecodeError:
            time.sleep(1)
            continue

        contents = (
            data.get("contents", {})
            .get("twoColumnSearchResultsRenderer", {})
            .get("primaryContents", {})
            .get("sectionListRenderer", {})
            .get("contents", [])
        )

        for section in contents:
            items = section.get("itemSectionRenderer", {}).get("contents", [])
            for item in items:
                vr = item.get("videoRenderer")
                if not vr:
                    continue

                vid_id = vr.get("videoId", "")
                if not vid_id or vid_id in seen_ids:
                    continue
                seen_ids.add(vid_id)

                title = vr.get("title", {}).get("runs", [{}])[0].get("text", "")
                if not re.search(r"[֐-׿]", title):
                    continue

                channel = vr.get("ownerText", {}).get("runs", [{}])[0].get("text", "")
                if channel in CHANNEL_BLACKLIST:
                    continue

                combined = title + " " + channel
                if not any(kw in combined for kw in ISRAEL_KEYWORDS):
                    continue

                title_norm = title.strip()[:40]
                if title_norm in seen_titles:
                    continue
                seen_titles.add(title_norm)
                views_text = vr.get("viewCountText", {}).get("simpleText", "")
                length_text = vr.get("lengthText", {}).get("simpleText", "")

                published_text = vr.get("publishedTimeText", {}).get("simpleText", "")
                days_ago = _parse_relative_days(published_text)
                if days_ago > MAX_VIDEO_AGE_DAYS:
                    continue

                thumbs = vr.get("thumbnail", {}).get("thumbnails", [])
                thumb_url = thumbs[-1].get("url", "") if thumbs else ""

                views = _parse_yt_views(views_text)

                all_videos.append({
                    "video_id": vid_id,
                    "title": title,
                    "channel": channel,
                    "views": views,
                    "views_str": fmt_volume(views),
                    "duration": length_text,
                    "published_text": published_text,
                    "thumbnail": thumb_url,
                    "url": f"https://www.youtube.com/watch?v={vid_id}",
                })

        time.sleep(1)

    all_videos.sort(key=lambda v: v["views"], reverse=True)
    max_per_channel = 2
    channel_counts: dict[str, int] = {}
    result: list[dict[str, Any]] = []
    for v in all_videos:
        ch = v["channel"]
        if channel_counts.get(ch, 0) >= max_per_channel:
            continue
        if not _is_video_available(v["video_id"]):
            log.info("  Skipping unavailable video: %s", v["title"][:40])
            continue
        channel_counts[ch] = channel_counts.get(ch, 0) + 1
        result.append(v)
        if len(result) >= 8:
            break
    log.info("  Found %d unique videos, returning %d (max %d/channel)", len(all_videos), len(result), max_per_channel)
    return result


def _is_video_available(video_id: str) -> bool:
    """Check if a YouTube video is embeddable via the oEmbed endpoint."""
    url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    req = urllib.request.Request(url, method="GET", headers={
        "User-Agent": "Mozilla/5.0",
    })
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status == 200
    except Exception:
        return False


def fmt_volume(n: int) -> str:
    """Format a number as a compact string (1.2K, 45K, etc.)."""
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.1f}K"
    return str(n)


def _parse_tg_views(text: str) -> int:
    """Parse Telegram view count string like '12.5K' or '1.2M' to int."""
    text = text.strip().replace(" ", "")
    if not text:
        return 0
    try:
        if text.endswith("K"):
            return int(float(text[:-1]) * 1_000)
        elif text.endswith("M"):
            return int(float(text[:-1]) * 1_000_000)
        else:
            return int(text.replace(",", ""))
    except (ValueError, TypeError):
        return 0


def scrape_telegram_channel(username: str) -> list[dict[str, Any]]:
    """Scrape recent posts from a public Telegram channel via t.me/s/."""
    url = f"https://t.me/s/{username}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8")
    except Exception as exc:
        log.warning("Telegram scrape failed for @%s: %s", username, exc)
        return []

    messages: list[dict[str, Any]] = []
    posts = list(re.finditer(r'data-post="([^"]+)"', html))

    for i, match in enumerate(posts):
        start = match.start()
        end = posts[i + 1].start() if i + 1 < len(posts) else len(html)
        block = html[start:end]

        text_m = re.search(r'js-message_text[^>]*>(.*?)</div>', block, re.DOTALL)
        text = ""
        if text_m:
            text = re.sub(r'<[^>]+>', ' ', text_m.group(1))
            text = unescape(text)
            text = re.sub(r'\s+', ' ', text).strip()

        views_m = re.search(r'tgme_widget_message_views[^>]*>([^<]+)<', block)
        views_str = views_m.group(1).strip() if views_m else ""

        date_m = re.search(r'datetime="([^"]+)"', block)
        date_str = date_m.group(1) if date_m else ""

        if text or views_str:
            messages.append({
                "text": text[:200],
                "views_str": views_str,
                "views": _parse_tg_views(views_str),
                "date": date_str,
            })

    return messages


def fetch_telegram_data() -> list[dict[str, Any]]:
    """Scrape Telegram channels and compute per-channel metrics."""
    results: list[dict[str, Any]] = []

    for ch in TG_CHANNELS:
        log.info("Scraping Telegram: %s (@%s)", ch["name_he"], ch["username"])
        messages = scrape_telegram_channel(ch["username"])

        if not messages:
            log.warning("  No messages found for @%s", ch["username"])
            time.sleep(1)
            continue

        total_views = sum(m["views"] for m in messages)
        avg_views = total_views // len(messages) if messages else 0
        top = max(messages, key=lambda m: m["views"])

        results.append({
            "key": ch["key"],
            "name_he": ch["name_he"],
            "username": ch["username"],
            "type": ch["type"],
            "post_count": len(messages),
            "avg_views": avg_views,
            "avg_views_str": fmt_volume(avg_views),
            "top_post": {
                "text": top["text"][:120],
                "views": top["views"],
                "views_str": top["views_str"],
                "date": top["date"],
            } if top["text"] else None,
        })

        time.sleep(1)

    results.sort(key=lambda r: r["avg_views"], reverse=True)
    return results


def main() -> None:
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Phase 1: Hot topics from Google News
    headlines = fetch_election_headlines()
    hot_topics = extract_hot_topics(headlines)

    # Phase 2: Leader buzz from Wikipedia
    leader_buzz = fetch_leader_buzz()

    # Phase 3: Viral videos from YouTube search
    viral_videos = fetch_viral_videos()

    # Phase 4: Telegram channels
    telegram_channels = fetch_telegram_data()

    output = {
        "generated_at": generated_at,
        "headline_count": len(headlines),
        "hot_topics": hot_topics,
        "leader_buzz": leader_buzz,
        "viral_videos": viral_videos,
        "telegram_channels": telegram_channels,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(output, fh, ensure_ascii=False, indent=2)

    log.info("Wrote %s", OUTPUT_PATH)

    print("=" * 60)
    print("social.json summary")
    print(f"  Headlines analyzed: {len(headlines)}")
    print(f"  Hot topics found: {len(hot_topics)}")
    for t in hot_topics[:6]:
        print(f"    {t['label']:25s}  {t['mention_count']:>3d} mentions")
    print(f"  Leader buzz (Wikipedia 7d pageviews):")
    for lb in leader_buzz:
        arrow = {"rising": "↑", "falling": "↓", "stable": "→"}.get(lb["direction"], "→")
        print(f"    {lb['name_he']:20s}  {fmt_volume(lb['views_7d']):>6s}  {arrow} {lb['change_pct']:+.1f}%")
    print(f"  Viral videos: {len(viral_videos)}")
    for vv in viral_videos[:5]:
        print(f"    {vv['views_str']:>6s} views  {vv['channel'][:18]:18s}  {vv['title'][:45]}")
    print(f"  Telegram channels: {len(telegram_channels)}")
    for tg in telegram_channels[:5]:
        print(f"    {tg['name_he']:20s}  {tg['post_count']:>3d} posts  avg {tg['avg_views_str']:>6s} views")
    print(f"  Output: {OUTPUT_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()
