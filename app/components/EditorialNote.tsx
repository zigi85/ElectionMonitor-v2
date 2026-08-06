import type { EditorialData } from "@/lib/types";

interface EditorialNoteProps {
  editorial: EditorialData;
}

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "לפני פחות משעה";
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

export default function EditorialNote({ editorial }: EditorialNoteProps) {
  if (!editorial.entries || editorial.entries.length === 0) return null;

  return (
    <div className="card editorial-card fade-in">
      <div className="card-header">
        <span className="card-title">פרשנות המערכת</span>
        <span className="card-subtitle">כתבי ישראל היום</span>
      </div>

      <div className="editorial-entries">
        {editorial.entries.map((entry) => (
          <div key={entry.id} className="editorial-entry">
            <div className="editorial-author-row">
              <div
                className="editorial-avatar"
                style={{ background: entry.avatar_color }}
              >
                {entry.initials}
              </div>
              <div className="editorial-author-info">
                <span className="editorial-reporter">{entry.reporter}</span>
                <span className="editorial-role">{entry.role}</span>
              </div>
              <span className="editorial-time">{timeAgo(entry.published_at)}</span>
            </div>

            <blockquote className="editorial-quote">{entry.quote}</blockquote>

            <a
              href={entry.article_url}
              target="_blank"
              rel="noopener noreferrer"
              className="editorial-link"
            >
              {entry.article_title} ←
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
