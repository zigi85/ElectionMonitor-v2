"use client";

import type { GoogleTrendsData, TrendsKeywordResult } from "@/lib/types";

const DIRECTION_CONFIG: Record<string, { label: string; className: string }> = {
  rising: { label: "עולה", className: "gt-rising" },
  falling: { label: "יורד", className: "gt-falling" },
  stable: { label: "יציב", className: "gt-stable" },
};

function Sparkline({ data, direction }: { data: { date: string; value: number }[]; direction: string }) {
  if (data.length < 2) return null;
  const w = 55;
  const h = 22;
  const pad = 2;
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
    direction === "rising" ? "#38c1a1" :
    direction === "falling" ? "var(--red)" :
    "var(--text-dim)";
  const lastPt = points.split(" ").at(-1)!;
  const [cx, cy] = lastPt.split(",");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="gt-sparkline" aria-hidden="true">
      <polyline points={points} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={cx} cy={cy} r="2.5" fill={strokeColor} />
    </svg>
  );
}

function TrendCard({ kw }: { kw: TrendsKeywordResult }) {
  const cfg = DIRECTION_CONFIG[kw.direction] ?? DIRECTION_CONFIG.stable;
  const changePct = kw.change_pct != null
    ? `${kw.change_pct > 0 ? "+" : ""}${kw.change_pct.toFixed(1)}%`
    : "0.0%";
  return (
    <div className="gt-card">
      <span className="gt-name">{kw.keyword}</span>
      <Sparkline data={kw.weekly_data} direction={kw.direction} />
      <span className="gt-pct">{changePct}</span>
      <span className={`gt-direction ${cfg.className}`}>
        <span className="gt-arrow" />
        {cfg.label}
      </span>
    </div>
  );
}

interface Props { trends: GoogleTrendsData; }

export default function GoogleTrends({ trends }: Props) {
  if (!trends.keywords || trends.keywords.length === 0) return null;
  const validKeywords = trends.keywords.filter(k => k.weekly_data.length > 0);
  if (validKeywords.length === 0) return null;
  return (
    <section className="gt-section fade-in">
      <div className="gt-inner">
        <div className="gt-header">
          <h2 className="gt-title">הלך הרוח ברשתות</h2>
          <span className="gt-label">Google Trends</span>
        </div>
        <div className="gt-cards">
          {validKeywords.map(kw => (
            <TrendCard key={kw.keyword} kw={kw} />
          ))}
        </div>
        <p className="gt-disclaimer">
          הנתונים מבוססים על נפח חיפושים ב-Google בישראל ומשקפים עניין ציבורי יחסי,
          לא עמדה פוליטית או סנטימנט חיובי/שלילי.
          עלייה בחיפוש אינה בהכרח מעידה על תמיכה — היא יכולה לנבוע מאירועים חדשותיים, מחלוקות, או סקרנות.
        </p>
      </div>
    </section>
  );
}
