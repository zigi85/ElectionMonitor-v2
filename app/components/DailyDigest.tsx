import type { DailyDigestData } from "@/lib/types";

const TYPE_ICONS: Record<string, string> = {
  poll: "📊",
  market: "📈",
  media: "📰",
  trend: "🔍",
  buzz: "⚡",
};

const TYPE_LABELS: Record<string, string> = {
  poll: "סקרים",
  market: "שוק ניבוי",
  media: "תקשורת",
  trend: "מגמה",
  buzz: "באזז",
};

function DirectionArrow({ direction }: { direction: string }) {
  if (direction === "up") return <span className="dd-arrow dd-arrow-up">▲</span>;
  if (direction === "down") return <span className="dd-arrow dd-arrow-down">▼</span>;
  return <span className="dd-arrow dd-arrow-neutral">●</span>;
}

interface Props {
  dailyDigest: DailyDigestData | null;
}

export default function DailyDigest({ dailyDigest }: Props) {
  if (!dailyDigest || !dailyDigest.changes?.length) return null;

  const generatedDate = dailyDigest.generated_at
    ? new Date(dailyDigest.generated_at).toLocaleDateString("he-IL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <div className="card dd-card fade-in">
      <div className="card-header">
        <span className="card-title">מה השתנה היום?</span>
        {generatedDate && <span className="card-subtitle">{generatedDate}</span>}
      </div>

      <div className="dd-changes">
        {dailyDigest.changes.map((change, i) => (
          <div key={i} className={`dd-change dd-mag-${change.magnitude}`}>
            <div className="dd-change-icon">
              <DirectionArrow direction={change.direction} />
            </div>
            <div className="dd-change-body">
              <span className="dd-change-text">{change.text}</span>
              <span className="dd-change-tag">{TYPE_LABELS[change.type] || change.type}</span>
            </div>
          </div>
        ))}
      </div>

      {dailyDigest.story && dailyDigest.story.title && (
        <div className="dd-story">
          <div className="dd-story-label">הסיפור של היום</div>
          <h3 className="dd-story-title">{dailyDigest.story.title}</h3>
          <p className="dd-story-body">{dailyDigest.story.body}</p>
        </div>
      )}
    </div>
  );
}
