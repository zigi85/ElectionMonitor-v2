"use client";
import { useState, useEffect } from "react";
import type { PolymarketData, PolymarketMarket } from "@/lib/types";

interface Props {
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

const BAR_COLORS: Record<string, { bg: string; text: string }> = {
  "Benjamin Netanyahu": { bg: "#ffaa6f", text: "#fff" },
  "בנימין נתניהו": { bg: "#ffaa6f", text: "#fff" },
  "Gadi Eizenkot": { bg: "#fe6969", text: "#fff" },
  "גדי איזנקוט": { bg: "#fe6969", text: "#fff" },
  "Naftali Bennett": { bg: "#ffd6d6", text: "#000037" },
  "נפתלי בנט": { bg: "#ffd6d6", text: "#000037" },
  "Avigdor Lieberman": { bg: "#42abff", text: "#fff" },
  "אביגדור ליברמן": { bg: "#42abff", text: "#fff" },
};
const DEFAULT_BAR = { bg: "rgba(255,255,255,0.15)", text: "#fff" };

const BINARY_TITLES: Record<string, string> = {
  hung_parliament: "האם הבחירות יסתיימו ללא רוב?",
  likud_seats: "ליכוד — כמה מנדטים?",
  likud_lose_seats: "הליכוד יאבד מנדטים?",
  election_winner: "איזו מפלגה תהיה הגדולה?",
};

function NextPMSection({ market }: { market: PolymarketMarket }) {
  const top = [...market.outcomes].sort((a, b) => b.probability - a.probability).slice(0, 4);
  const maxP = top[0]?.probability ?? 1;

  return (
    <div className="poly-section">
      <h3 className="poly-sub-title">ראש הממשלה הבא</h3>
      <div className="poly-bars">
        {top.map(o => {
          const pct = Math.round(o.probability * 100);
          const widthPct = (o.probability / maxP) * 100;
          const colors = BAR_COLORS[o.name] ?? DEFAULT_BAR;
          return (
            <div
              key={o.name}
              className="poly-bar"
              style={{ width: `${widthPct}%`, background: colors.bg, color: colors.text }}
            >
              <span className="poly-bar-name">{HEBREW_NAMES[o.name] ?? o.name}</span>
              <span className="poly-bar-pct">
                <span className="poly-bar-pct-num">{pct}</span>
                <span className="poly-bar-pct-sign">%</span>
              </span>
            </div>
          );
        })}
      </div>
      {market.url && (
        <a href={market.url} target="_blank" rel="noopener noreferrer" className="poly-market-link">
          צפה בסקר המלא ב-Polymarket ←
        </a>
      )}
    </div>
  );
}

function BinaryCard({ market }: { market: PolymarketMarket }) {
  const yes = market.outcomes.find(o => o.name.toLowerCase() === "yes" || o.name === "כן");
  const no = market.outcomes.find(o => o.name.toLowerCase() === "no" || o.name === "לא");
  const isBinary = !!(yes || no);

  if (!isBinary) {
    const sorted = [...market.outcomes].sort((a, b) => b.probability - a.probability);
    return (
      <div className="poly-bet-card">
        <div className="poly-bet-badge">
          {BINARY_TITLES[market.key] ?? market.title}
        </div>
        <div className="poly-multi-outcomes">
          {sorted.map(o => {
            const pct = Math.round(o.probability * 100);
            return (
              <div key={o.name} className="poly-multi-row">
                <span className="poly-multi-name">{o.name}</span>
                <span className="poly-multi-pct">{pct}%</span>
              </div>
            );
          })}
        </div>
        {market.url && (
          <a href={market.url} target="_blank" rel="noopener noreferrer" className="poly-bet-link">
            Polymarket ←
          </a>
        )}
      </div>
    );
  }

  const yesP = Math.round((yes?.probability ?? 0) * 100);
  const noP = Math.round((no?.probability ?? (1 - (yes?.probability ?? 0))) * 100);

  return (
    <div className="poly-bet-card">
      <div className="poly-bet-badge">
        {BINARY_TITLES[market.key] ?? market.title}
      </div>
      <div className="poly-bet-values">
        <div className="poly-bet-side poly-bet-no">
          <span className="poly-bet-label">לא</span>
          <span className="poly-bet-num">
            <span className="poly-bet-num-val">{noP}</span>
            <span className="poly-bet-num-pct">%</span>
          </span>
        </div>
        <div className="poly-bet-divider" />
        <div className="poly-bet-side poly-bet-yes">
          <span className="poly-bet-label">כן</span>
          <span className="poly-bet-num">
            <span className="poly-bet-num-val">{yesP}</span>
            <span className="poly-bet-num-pct">%</span>
          </span>
        </div>
      </div>
      {market.url && (
        <a href={market.url} target="_blank" rel="noopener noreferrer" className="poly-bet-link">
          Polymarket ←
        </a>
      )}
    </div>
  );
}

export default function PredictionMarkets({ polymarket: initial }: Props) {
  const [data, setData] = useState<PolymarketData>(initial);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/polymarket");
        if (!res.ok) return;
        const live = (await res.json()) as PolymarketData;
        if (live.markets?.length > 0) setData(live);
      } catch { /* keep initial */ }
    }
    load();
  }, []);

  const nextPm = data.markets.find(m => m.key === "next_pm");
  const binaryMarkets = data.markets.filter(m => m.key !== "next_pm");

  return (
    <div className="poly-card">
      <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" className="poly-logo-link">
        <svg width="12" height="7" viewBox="0 0 12 7" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 5.5L4 1.5L7 4L11 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="poly-logo-text">polymarket</span>
      </a>

      <div className="poly-header">
        <h2 className="poly-title">מה הסיכויים?</h2>
        <p className="poly-desc">
          פולימרקט הוא שוק ניבוי מבוזר שבו משתמשים מהמרים בכסף אמיתי על תוצאות אירועים פוליטיים.{" "}
          בבחירות לנשיאות ארה&quot;ב ב-2024, השוק חזה את ניצחון טראמפ בדיוק רב יותר מרוב הסקרים המסורתיים.{" "}
          המחירים משקפים הערכת סיכויים בזמן אמת של אלפי סוחרים ברחבי העולם.
        </p>
      </div>

      {nextPm && <NextPMSection market={nextPm} />}

      {binaryMarkets.length > 0 && (
        <div className="poly-section">
          <h3 className="poly-sub-title">הימורים מובילים</h3>
          <div className="poly-bets-row">
            {binaryMarkets.map(m => (
              <BinaryCard key={m.key} market={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
