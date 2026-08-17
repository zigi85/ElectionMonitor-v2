"""
generate_daily_digest.py — Israel Hayom Elections Monitor
Reads all data files, sends them to an LLM, and generates a daily digest.

Schedule: daily at 07:00 IST (04:00 UTC)
Output: public/data/daily_digest.json
Requires: OPENAI_APIKEY environment variable
"""

import json
import logging
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "public" / "data"
HISTORY_DIR = DATA_DIR / "digest_history"
OUTPUT_PATH = DATA_DIR / "daily_digest.json"
ENV_PATH = SCRIPT_DIR.parent / ".env"

def load_dotenv() -> None:
    """Load .env file if it exists (for local runs)."""
    if not ENV_PATH.exists():
        return
    with open(ENV_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

load_dotenv()

OPENAI_API_KEY = os.environ.get("OPENAI_APIKEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "o4-mini")
API_URL = "https://api.openai.com/v1/chat/completions"

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def read_json(filename: str) -> dict | list | None:
    path = DATA_DIR / filename
    if not path.exists():
        log.warning("Missing data file: %s", path)
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as exc:
        log.warning("Failed to read %s: %s", path, exc)
        return None


def build_data_context() -> str:
    """Build a text summary of all current data for the LLM."""
    sections = []

    # Polls
    polls = read_json("polls_manual.json")
    if polls and polls.get("timestamps"):
        latest = polls["timestamps"][-1]
        party_meta = polls.get("party_metadata", {})
        sections.append("## סקרים אחרונים")
        sections.append(f"תאריך: {latest.get('label', latest.get('id', ''))}")
        for poll in latest.get("polls", []):
            outlet = poll.get("outlet_id", "")
            parties_str = ", ".join(
                f"{party_meta.get(k, {}).get('name_he', k)}: {v}"
                for k, v in sorted(poll.get("parties", {}).items(), key=lambda x: -x[1])
                if v > 0
            )
            sections.append(f"  {outlet}: {parties_str}")

    # Polymarket
    polymarket = read_json("polymarket.json")
    poly_prev = read_json("polymarket_previous.json")
    if polymarket and polymarket.get("markets"):
        sections.append("\n## פולימרקט (שוק ניבוי)")
        for market in polymarket["markets"]:
            sections.append(f"### {market.get('title', market.get('key', ''))}")
            for outcome in market.get("outcomes", [])[:6]:
                pct = round(outcome["probability"] * 100, 1)
                # Find previous probability
                prev_pct = None
                if poly_prev and poly_prev.get("markets"):
                    prev_market = next((m for m in poly_prev["markets"] if m["key"] == market["key"]), None)
                    if prev_market:
                        prev_outcome = next((o for o in prev_market.get("outcomes", []) if o["name"] == outcome["name"]), None)
                        if prev_outcome:
                            prev_pct = round(prev_outcome["probability"] * 100, 1)
                delta_str = ""
                if prev_pct is not None:
                    delta = pct - prev_pct
                    if abs(delta) >= 0.5:
                        delta_str = f" (שינוי: {'+' if delta > 0 else ''}{delta:.1f}%)"
                sections.append(f"  {outcome['name']}: {pct}%{delta_str}")

    # Media mentions
    media = read_json("media_mentions.json")
    if media and media.get("leaders"):
        sections.append("\n## מי בכותרות (Google News)")
        sections.append(f"תקופה: {media.get('period_label', '')}")
        for leader in sorted(media["leaders"], key=lambda x: -x.get("mention_count", 0)):
            headlines_str = ""
            top_headlines = [h for h in leader.get("headlines", []) if not h.get("fallback")][:2]
            if top_headlines:
                headlines_str = " | כותרות: " + "; ".join(h["title"] for h in top_headlines)
            sections.append(f"  {leader['name_he']} ({leader.get('role', '')}): {leader.get('mention_count', 0)} אזכורים{headlines_str}")

    # Google Trends
    trends = read_json("google_trends.json")
    if trends and trends.get("keywords"):
        sections.append("\n## Google Trends (עניין ציבורי)")
        for kw in trends["keywords"]:
            current = kw.get("current_interest", 0) or 0
            prev = kw.get("previous_interest", 0) or 0
            change = kw.get("change_pct", 0) or 0
            direction = kw.get("direction", "stable")
            arrow = "↑" if direction == "rising" else "↓" if direction == "falling" else "→"
            name = kw.get("keyword", kw.get("label", ""))
            sections.append(f"  {name}: {current} {arrow} (קודם: {prev}, שינוי: {change:+.1f}%)")

    # Social / Wikipedia buzz
    social = read_json("social.json")
    if social and social.get("leader_buzz"):
        sections.append("\n## באזז ויקיפדיה (7 ימים)")
        for leader in sorted(social["leader_buzz"], key=lambda x: -x.get("views_7d", 0)):
            arrow = "↑" if leader.get("direction") == "rising" else "↓" if leader.get("direction") == "falling" else "→"
            sections.append(f"  {leader['name_he']}: {leader.get('views_7d', 0):,} צפיות {arrow} ({leader.get('change_pct', 0):+.0f}%)")

    # Momentum
    momentum = read_json("momentum.json")
    if momentum and momentum.get("parties"):
        sections.append("\n## מומנטום (מדד משולב)")
        for party in momentum["parties"]:
            if party.get("score", 0) != 0 or party.get("direction") != "stable":
                sections.append(f"  {party.get('label', party['party'])}: {party['direction']} (ציון: {party.get('score', 0):.2f})")

    return "\n".join(sections)


def call_llm(data_context: str) -> dict | None:
    """Call OpenAI API to generate the daily digest."""
    if not OPENAI_API_KEY:
        log.error("OPENAI_APIKEY not set")
        return None

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    system_msg = """אתה כתב פוליטי בכיר של ישראל היום — כותב שמכיר כל מסדרון בכנסת.
אתה כותב את הסיכום היומי שפותח את העמוד הפוליטי. הקוראים שלך רוצים לדעת מה זז, מי עולה, מי יורד, ומה הסיפור שמאחורי המספרים.

סגנון:
- כתוב כמו עמיר טיבון או נחום ברנע — חד, תכליתי, עם ניסוח שנדבק.
- משפטים קצרים. פעלים חזקים (זינק, צנח, התרסק, טיפס, דשדש). לא "עלה ב-3%" אלא "קפץ ב-3%".
- אם יש דרמה בנתונים — תן לה לבוא לידי ביטוי. אם אין — אמור את זה ישירות ("יום שקט במרוץ").
- אל תכתוב כמו דוח — כתוב כמו כותרת. כל שינוי הוא משפט שגורם לקורא לרצות לדעת עוד.

מילון מונחים חובה:
- מנדטים (לא "מושבים", לא "מקומות")
- ראש ממשלה (לא "ראש הממשלה הבא")
- שוק הניבוי / פולימרקט
- גוש (קואליציה / אופוזיציה)

החזר רק JSON תקין. בלי markdown, בלי הסברים, בלי עטיפת קוד."""

    user_msg = f"""## הנתונים (תאריך: {today})

{data_context}

## המשימה

צור JSON עם שני שדות:

### 1. changes — מערך של 4-5 שינויים

כל שינוי הוא אובייקט עם:
- "text": משפט אחד קצר, חד ועיתונאי (עד 80 תווים). לא יבש — כתוב כמו כותרת חדשותית.
- "type": אחד מ: "poll", "market", "media", "trend", "buzz"
- "direction": "up", "down", או "neutral"
- "magnitude": "big", "medium", "small"

חובה: גיוון מקורות — לפחות 3 סוגי type שונים מתוך 5. אל תתמקד בקטגוריה אחת.
עדיפויות: שינוי גדול בסקרים > תזוזה בשוק ניבוי > זינוק/צניחה בטרנדים > שינוי באזכורי תקשורת > באזז ויקיפדיה.

### 2. story — הסיפור של היום

אובייקט עם:
- "title": כותרת של 3-6 מילים. חדה, לא גנרית.
- "body": פסקה אחת (2-3 משפטים) שמחברת בין הנתונים ומספרת מה קורה במרוץ. חבר בין מקורות שונים. אם יש אירוע שהנתונים מצביעים עליו (פריימריז, סקר חדש, אירוע ביטחוני) — ציין אותו. בטון עיתונאי: ברור, ענייני, לא דרמטי מדי.

## כללים
- עברית בלבד. מונחים פוליטיים ישראליים מדויקים (מנדטים, כנסת, גושים).
- היצמד רק לנתונים שקיבלת — אל תמציא.
- אם אין שינוי דרמטי, תאר את המצב היציב ("הקפאון נמשך", "שוק הניבוי מתייצב").
- כתוב כמו כתב פוליטי, לא כמו מכונה. משפטים קצרים וחדים.

## דוגמה לפלט טוב

{{"changes":[{{"text":"חיפושי \\"ליכוד\\" בגוגל זינקו ב-55% — ערב הפריימריז","type":"trend","direction":"up","magnitude":"big"}},{{"text":"נתניהו מוביל ב-100 אזכורים בתקשורת, איזנקוט 63","type":"media","direction":"neutral","magnitude":"medium"}},{{"text":"תחזית 25-29 מנדטים לליכוד עלתה ל-34.5% בפולימרקט","type":"market","direction":"up","magnitude":"medium"}},{{"text":"באזז ויקיפדיה של איזנקוט צנח ב-62% השבוע","type":"buzz","direction":"down","magnitude":"medium"}},{{"text":"איזנקוט יציב ב-54% לראשות הממשלה בשוק הניבוי","type":"market","direction":"neutral","magnitude":"small"}}],"story":{{"title":"הפריימריז מכתיבים את סדר היום","body":"ערב הפריימריז בליכוד, המפלגה שולטת בסדר היום הציבורי: חיפושי גוגל זינקו ב-55% ונתניהו מוביל את האזכורים התקשורתיים. אך בשוק הניבוי התמונה יציבה — איזנקוט מחזיק ב-54% לראשות הממשלה, ופער הסקרים בין ישר לליכוד נותר צמוד."}}}}

אל תעתיק את הדוגמה — צור ניתוח מקורי מהנתונים שקיבלת."""

    payload: dict = {
        "model": OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg},
        ],
    }
    is_reasoning = OPENAI_MODEL.startswith("o") and not OPENAI_MODEL.startswith("omni")
    if is_reasoning:
        payload["max_completion_tokens"] = 4096
    else:
        payload["max_tokens"] = 1024

    body = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        API_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        log.error("OpenAI API call failed: %s", exc)
        return None

    text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        log.error("Failed to parse LLM response as JSON: %s\nResponse: %s", exc, text[:500])
        return None


def save_history(output: dict) -> None:
    """Save a dated copy for future trend analysis."""
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    history_path = HISTORY_DIR / f"{date_str}.json"
    with open(history_path, "w", encoding="utf-8") as fh:
        json.dump(output, fh, ensure_ascii=False, indent=2)
    log.info("History saved: %s", history_path)


def save_to_supabase(output: dict) -> None:
    """Insert digest into Supabase."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        log.info("Supabase not configured, skipping DB insert")
        return

    row = {
        "generated_at": output["generated_at"],
        "model": output.get("model"),
        "changes": output["changes"],
        "story": output["story"],
        "raw": output,
    }

    body = json.dumps(row, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/daily_digests",
        data=body,
        headers={
            "Content-Type": "application/json",
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Prefer": "return=minimal",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            log.info("Saved to Supabase (status %d)", resp.status)
    except Exception as exc:
        log.warning("Supabase insert failed: %s", exc)


def main() -> None:
    log.info("Generating daily digest (model: %s)...", OPENAI_MODEL)

    data_context = build_data_context()
    log.info("Data context: %d characters", len(data_context))

    digest = call_llm(data_context)
    if not digest:
        log.error("Failed to generate digest")
        return

    output = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "model": OPENAI_MODEL,
        "changes": digest.get("changes", []),
        "story": digest.get("story", {}),
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(output, fh, ensure_ascii=False, indent=2)
    log.info("Wrote %s", OUTPUT_PATH)

    save_history(output)
    save_to_supabase(output)

    print(f"Changes: {len(output['changes'])}")
    print(f"Story: {output['story'].get('title', 'N/A')}")


if __name__ == "__main__":
    main()
