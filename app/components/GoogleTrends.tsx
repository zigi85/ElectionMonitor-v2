"use client";

import type { GoogleTrendsData, TrendsKeywordResult } from "@/lib/types";

const DIRECTION_CONFIG: Record<string, { label: string; arrow: string; className: string }> = {
  rising: { label: "עולה", arrow: "↑", className: "trend-rising" },
  falling: { label: "יורד", arrow: "↓", className: "trend-falling" },
  stable: { label: "יציב", arrow: "→", className: "trend-stable" },
};

function Sparkline({ data, direction }: { data: { date: string; value: number }[]; direction: string }) {
  if (data.length < 2) return null;

  const w = 120;
  const h = 36;
  const pad = 4;
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((v - min) / range) * (h - 2 * pad);
    return `${x},${y}`;
  }).join(" ");

  const strokeColor =
    direction === "rising" ? "var(--green)" :
    direction === "falling" ? "var(--red-accent)" :
    "var(--text-muted)";

  const lastPt = points.split(" ").at(-1)!;
  const [cx, cy] = lastPt.split(",");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="trends-sparkline" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={cx} cy={cy} r="3" fill={strokeColor} />
    </svg>
  );
}

function TrendRow({ kw }: { kw: TrendsKeywordResult }) {
  const cfg = DIRECTION_CONFIG[kw.direction] ?? DIRECTION_CONFIG.stable;
  const changePct = kw.change_pct != null
    ? `${kw.change_pct > 0 ? "+" : ""}${kw.change_pct.toFixed(1)}%`
    : "";

  return (
    <div className="trend-row">
      <span className="trend-keyword">{kw.keyword}</span>
      <Sparkline data={kw.weekly_data} direction={kw.direction} />
      <span className={`trend-badge ${cfg.className}`}>
        <span className="trend-arrow">{cfg.arrow}</span>
        <span className="trend-dir-label">{cfg.label}</span>
      </span>
      {changePct && <span className={`trend-change ${cfg.className}`}>{changePct}</span>}
    </div>
  );
}

interface Props {
  trends: GoogleTrendsData;
}

export default function GoogleTrends({ trends }: Props) {
  if (!trends.keywords || trends.keywords.length === 0) return null;

  const validKeywords = trends.keywords.filter(k => k.weekly_data.length > 0);
  if (validKeywords.length === 0) return null;

  return (
    <div className="card trends-card fade-in">
      <div className="card-header">
        <span className="card-title">הלך הרוח ברשתות</span>
        <span className="card-subtitle">Google Trends</span>
      </div>

      <div className="trends-list">
        {validKeywords.map(kw => (
          <TrendRow key={kw.keyword} kw={kw} />
        ))}
      </div>

      <p className="trends-disclaimer">
        הנתונים מבוססים על נפח חיפושים ב-Google בישראל ומשקפים עניין ציבורי יחסי,
        לא עמדה פוליטית או סנטימנט חיובי/שלילי.
        עלייה בחיפוש אינה בהכרח מעידה על תמיכה — היא יכולה לנבוע מאירועים חדשותיים, מחלוקות, או סקרנות.
      </p>
    </div>
  );
}
