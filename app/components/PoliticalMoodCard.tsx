interface SentimentItem {
  label: string;
  value: number;
  tone: "positive" | "neutral" | "negative";
  tooltip: string;
}

const MOCK_SENTIMENT: SentimentItem[] = [
  { label: "חיובי",   value: 28, tone: "positive", tooltip: "שיח תומך או אופטימי" },
  { label: "נייטרלי", value: 42, tone: "neutral",  tooltip: "דיווחים, עובדות או שיח ללא עמדה ברורה" },
  { label: "שלילי",   value: 30, tone: "negative", tooltip: "ביקורת, כעס או שיח שלילי" },
];

export default function PoliticalMoodCard() {
  return (
    <div className="card mood-card fade-in">
      <div className="mood-card-header">
        <div className="mood-card-titles">
          <div className="mood-card-top-row">
            <span className="card-title">אווירה פוליטית ברשת</span>
            <span
              className="mood-info-icon"
              title="הפילוח מבוסס על ניתוח אוטומטי של שיח ציבורי ברשתות חברתיות ומקורות פתוחים."
              aria-label="מידע על המדד"
            >
              ⓘ
            </span>
          </div>
          <p className="mood-card-subtitle">גוון השיח הפוליטי ברשתות החברתיות · 7 ימים אחרונים</p>
        </div>
      </div>

      <div className="mood-bars">
        {MOCK_SENTIMENT.map((item) => (
          <div
            key={item.label}
            className="mood-bar-row"
            title={item.tooltip}
            role="meter"
            aria-label={`${item.label}, ${item.value} אחוז`}
            aria-valuenow={item.value}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span className="mood-bar-label">{item.label}</span>
            <div className="mood-bar-track">
              <div
                className={`mood-bar-fill mood-${item.tone}`}
                style={{ width: `${item.value}%` }}
              />
            </div>
            <span className={`mood-bar-pct mood-${item.tone}`}>{item.value}%</span>
          </div>
        ))}
      </div>

      <div className="mood-footer">
        <p className="mood-disclaimer">
          ניתוח אוטומטי של שיח ציבורי גלוי בזמן אמת
        </p>
      </div>
    </div>
  );
}
