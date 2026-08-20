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

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function BuzzCard({ leader }: { leader: SocialLeaderBuzz }) {
  const ringClass =
    leader.direction === "rising"
      ? "wiki-ring-rising"
      : leader.direction === "falling"
        ? "wiki-ring-falling"
        : "wiki-ring-stable";

  const arrowClass =
    leader.direction === "rising"
      ? "wiki-arrow-up"
      : leader.direction === "falling"
        ? "wiki-arrow-down"
        : "wiki-arrow-stable";

  const arrow =
    leader.direction === "rising"
      ? "▲"
      : leader.direction === "falling"
        ? "▼"
        : "–";

  const initials = INITIALS[leader.key] || leader.name_he.charAt(0);

  return (
    <div className="wiki-card">
      <div className={`wiki-ring ${ringClass}`}>
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
      <span className={`wiki-arrow ${arrowClass}`}>{arrow}</span>
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
          <svg
            className="wiki-logo-icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <text
              x="12"
              y="16.5"
              textAnchor="middle"
              fontSize="14"
              fontWeight="800"
              fontFamily="serif"
              fill="currentColor"
            >
              W
            </text>
          </svg>
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
