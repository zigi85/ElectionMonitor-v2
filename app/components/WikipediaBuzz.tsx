"use client";

import type { SocialLeaderBuzz } from "@/lib/types";

const INITIALS: Record<string, string> = {
  eisenkot: "ג.א",
  netanyahu: "ב.נ",
  golan: "י.ג",
  bennett: "נ.ב",
  lieberman: "א.ל",
  ben_gvir: "א.ב",
  smotrich: "ב.ס",
  lapid: "י.ל",
  gantz: "ב.ג",
  saar: "ג.ס",
  deri: "א.ד",
  shaked: "א.ש",
};

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const STROKE = 5;

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function BuzzCard({ leader }: { leader: SocialLeaderBuzz }) {
  const arcFraction = Math.min(Math.abs(leader.change_pct) / 60, 0.75);
  const dashOffset = CIRCUMFERENCE * (1 - arcFraction);
  const arcColor =
    leader.direction === "rising"
      ? "#4ade80"
      : leader.direction === "falling"
        ? "#fe6969"
        : "#42abff";

  const arrowColor =
    leader.direction === "rising"
      ? "#4ade80"
      : leader.direction === "falling"
        ? "#fe6969"
        : "rgba(255,255,255,0.4)";

  const initials = INITIALS[leader.key] || leader.name_he.charAt(0);

  return (
    <div className="wiki-card">
      <div className="wiki-ring-container">
        <svg className="wiki-ring-svg" viewBox="0 0 100 100">
          <circle
            className="wiki-ring-track"
            cx="50"
            cy="50"
            r={RADIUS}
          />
          <circle
            className="wiki-ring-arc"
            cx="50"
            cy="50"
            r={RADIUS}
            style={{
              strokeDasharray: CIRCUMFERENCE,
              strokeDashoffset: dashOffset,
              stroke: arcColor,
            }}
          />
        </svg>
        <div className="wiki-photo">
          <img
            src={`/images/politicians/${leader.key}.png`}
            alt=""
            className="wiki-photo-img"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="wiki-initials">{initials}</span>
        </div>
      </div>
      <span className="wiki-arrow">
        {leader.direction === "stable" ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <line x1="3" y1="8" x2="13" y2="8" stroke={arrowColor} strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={leader.direction === "falling" ? { transform: "rotate(180deg)" } : undefined}>
            <path d="M8 2L14 11H2L8 2Z" fill={arrowColor} />
          </svg>
        )}
      </span>
      <div className="wiki-info">
        <span className="wiki-name">{leader.name_he}</span>
        <span className="wiki-views">{fmtViews(leader.views_7d)} צפיות</span>
      </div>
    </div>
  );
}

interface Props {
  leaderBuzz: SocialLeaderBuzz[];
}

export default function WikipediaBuzz({ leaderBuzz }: Props) {
  if (!leaderBuzz.length) return null;

  return (
    <section className="wiki-buzz-section fade-in">
      <div className="wiki-buzz-header">
        <span className="wiki-buzz-title">מדד הבאז</span>
        <span className="wiki-buzz-source">
          <img
            src="/images/wikipedia.png"
            alt="Wikipedia"
            className="wiki-logo-icon"
            width={18}
            height={18}
          />
          ויקיפדיה
        </span>
      </div>
      <div className="wiki-cards-row">
        {leaderBuzz.slice(0, 6).map((leader) => (
          <BuzzCard key={leader.key} leader={leader} />
        ))}
      </div>
      <p className="wiki-buzz-footer">
        צפיות בוויקיפדיה העברית כמדד לעניין ציבורי בפוליטיקאים. עלייה חדה מעידה
        על אירוע תקשורתי.
      </p>
    </section>
  );
}
