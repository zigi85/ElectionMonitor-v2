"use client";
import { useState, useEffect } from "react";
import type { PolymarketData, PolymarketMarket } from "@/lib/types";

interface PredictionMarketsProps {
  polymarket: PolymarketData;
}

const HEBREW_NAMES: Record<string, string> = {
  "Benjamin Netanyahu": "בנימין נתניהו",
  "Naftali Bennett": "נפתלי בנט",
  "Yair Lapid": "יאיר לפיד",
  "Avigdor Lieberman": "אביגדור ליברמן",
  "Benny Gantz": "בני גנץ",
  "Gadi Eizenkot": "גדי איזנקוט",
  "Yair Golan": "יאיר גולן",
};

const MARKET_TITLES: Record<string, string> = {
  next_pm: "ראש הממשלה הבא",
  hung_parliament: "האם הבחירות יסתיימו ללא רוב לאף אחד מהגושים?",
  likud_seats: "ליכוד — כמה מנדטים?",
};

const MARKET_ORDER = ["next_pm", "hung_parliament", "likud_seats"] as const;

function fmt(p: number): string {
  return `${Math.round(p * 100)}%`;
}

function PMCard({ market }: { market: PolymarketMarket }) {
  const sorted = [...market.outcomes].sort((a, b) => b.probability - a.probability).slice(0, 4);

  return (
    <div className="market-section">
      <div className="market-title">{MARKET_TITLES[market.key] ?? market.title}</div>
      <div className="pm-list">
        {sorted.map((o, i) => (
          <div key={o.name} className="pm-bar-row">
            <div className="pm-bar-header">
              <span className="pm-rank-num">{i + 1}</span>
              <span className="pm-name-plain">{HEBREW_NAMES[o.name] ?? o.name}</span>
              <span className="pm-pct-num">{fmt(o.probability)}</span>
            </div>
            <div className="pm-bar-track">
              <div
                className="pm-bar-fill"
                style={{ width: `${o.probability * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {market.url && (
        <a href={market.url} target="_blank" rel="noopener noreferrer" className="market-link">
          Polymarket ↗
        </a>
      )}
    </div>
  );
}

function BinaryCard({ market }: { market: PolymarketMarket }) {
  const yes = market.outcomes.find(o => o.name.toLowerCase() === "yes");
  const no = market.outcomes.find(o => o.name.toLowerCase() === "no");
  const yesP = yes?.probability ?? 0;
  const noP = no?.probability ?? (1 - yesP);

  return (
    <div className="market-section">
      <div className="market-title">{MARKET_TITLES[market.key] ?? market.title}</div>
      <div className="market-binary-row">
        <div className={`market-binary-box${yesP >= noP ? " market-binary-leading" : ""}`}>
          <div className="market-binary-label">כן</div>
          <div className="market-binary-pct">{fmt(yesP)}</div>
        </div>
        <div className={`market-binary-box${noP > yesP ? " market-binary-leading" : ""}`}>
          <div className="market-binary-label">לא</div>
          <div className="market-binary-pct">{fmt(noP)}</div>
        </div>
      </div>
      {market.url && (
        <a href={market.url} target="_blank" rel="noopener noreferrer" className="market-link">
          Polymarket ↗
        </a>
      )}
    </div>
  );
}

function PlaceholderCard({ marketKey }: { marketKey: string }) {
  return (
    <div className="market-section market-placeholder">
      <div className="market-title">{MARKET_TITLES[marketKey] ?? marketKey}</div>
      <div className="market-placeholder-text">אין נתונים זמינים</div>
    </div>
  );
}

export default function PredictionMarkets({ polymarket: initial }: PredictionMarketsProps) {
  const [data, setData] = useState<PolymarketData>(initial);
  const [updatedAt, setUpdatedAt] = useState<string | null>(() =>
    initial.generated_at
      ? new Date(initial.generated_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
      : null
  );
  const [isLive, setIsLive] = useState(initial.is_live ?? false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/polymarket");
        if (!res.ok) return;
        const live = (await res.json()) as PolymarketData & { is_live?: boolean };
        if (live.markets && live.markets.length > 0) {
          setData(live);
          setUpdatedAt(
            new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
          );
          setIsLive(live.is_live ?? true);
        }
      } catch {
        /* keep initial */
      }
    }
    load();
  }, []);

  return (
    <div className="card markets-card fade-in">
      <div className="card-header">
        <span className="card-title">מה הסיכויים?</span>
        <span className="card-subtitle">Polymarket</span>
      </div>

      <p className="polymarket-context">
        פולימרקט הוא שוק ניבוי מבוזר שבו משתמשים מהמרים בכסף אמיתי על תוצאות אירועים פוליטיים.{" "}
        בבחירות לנשיאות ארה&quot;ב ב-<bdi>2024</bdi>, השוק חזה את ניצחון טראמפ בדיוק רב יותר מרוב הסקרים המסורתיים.{" "}
        המחירים משקפים הערכת סיכויים בזמן אמת של אלפי סוחרים ברחבי העולם.
      </p>

      <div className="markets-grid">
        {MARKET_ORDER.map(key => {
          const market = data.markets.find(m => m.key === key);
          if (!market) return <PlaceholderCard key={key} marketKey={key} />;
          if (key === "next_pm" || key === "likud_seats") return <PMCard key={key} market={market} />;
          return <BinaryCard key={key} market={market} />;
        })}
      </div>
    </div>
  );
}
