import type { PolymarketData, PollsData } from "@/lib/types";

interface QuickSignalsProps {
  polymarket: PolymarketData;
  polls: PollsData;
  daysLeft: number;
}

export default function QuickSignals({ polymarket, polls, daysLeft }: QuickSignalsProps) {
  // Polls freshness
  const pollsMinAgo = Math.round((Date.now() - new Date(polls.generated_at).getTime()) / 60000);
  const pollsLabel = pollsMinAgo < 120 ? "מעודכן" : "ממוצע אחרון";

  // Polymarket freshness
  const pmMarket = polymarket.markets.find(m => m.key === "next_pm");
  const pmMinAgo = pmMarket ? Math.round((Date.now() - new Date(pmMarket.updated_at).getTime()) / 60000) : null;
  const pmFresh = pmMinAgo !== null && pmMinAgo < 30;

  return (
    <div className="card fade-in">
      <div className="card-header">
        <span className="card-title">⚡ אותות מהירים</span>
        <span className="card-subtitle">{daysLeft} ימים לבחירות</span>
      </div>
      <div className="signals-grid">
        {/* Polls */}
        <div className="signal-chip">
          <div className="signal-icon-circle" style={{ background: "#dbeafe" }}>📊</div>
          <span className="signal-chip-label">סקרים</span>
          <span className="signal-chip-desc">ממוצע אחרון</span>
          <span className="signal-status green">✓ {pollsLabel}</span>
        </div>

        {/* Knesset */}
        <div className="signal-chip">
          <div className="signal-icon-circle" style={{ background: "#fef3c7" }}>🏛</div>
          <span className="signal-chip-label">כנסת</span>
          <span className="signal-chip-desc">הצבעות היום</span>
          <span className="signal-status live">● עדכונים חיים</span>
        </div>

        {/* Social */}
        <div className="signal-chip">
          <div className="signal-icon-circle" style={{ background: "#ede9fe" }}>📱</div>
          <span className="signal-chip-label">רשתות</span>
          <span className="signal-chip-desc">מדד שיח</span>
          <span className="signal-status amber">↑ בעלייה</span>
        </div>

        {/* Forecast */}
        <div className="signal-chip">
          <div className="signal-icon-circle" style={{ background: "#fee2e2" }}>🎯</div>
          <span className="signal-chip-label">תחזית</span>
          <span className="signal-chip-desc">הכרעת תוצאה</span>
          <span className="signal-status gray">→ יציבה</span>
        </div>
      </div>
    </div>
  );
}
