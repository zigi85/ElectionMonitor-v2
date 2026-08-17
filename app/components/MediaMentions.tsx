"use client";

import { useState } from "react";
import type { MediaMentionsData, MediaLeader, MediaHeadline } from "@/lib/types";

const IHY = "ישראל היום";
const MAX_HEADLINES = 5;
const IHY_MIN = 1;
const IHY_MAX = 3;

type HeadlineFilter = "all" | "ihy";

function buildMixedHeadlines(
  sorted: MediaLeader[],
): (MediaHeadline & { leader: string })[] {
  const ihyPool: (MediaHeadline & { leader: string })[] = [];
  const otherPool: (MediaHeadline & { leader: string })[] = [];

  for (const l of sorted) {
    for (const h of l.headlines) {
      if (h.fallback) continue;
      const entry = { ...h, leader: l.name_he };
      if (h.source === IHY) ihyPool.push(entry);
      else otherPool.push(entry);
    }
  }

  const ihyCount = Math.max(IHY_MIN, Math.min(IHY_MAX, ihyPool.length));
  const otherCount = MAX_HEADLINES - ihyCount;

  const ihyPick = ihyPool.slice(0, ihyCount);
  const otherPick = otherPool.slice(0, otherCount);

  const result: (MediaHeadline & { leader: string })[] = [];
  let ii = 0;
  let oi = 0;
  for (let i = 0; i < MAX_HEADLINES; i++) {
    if (i % 2 === 0 && ii < ihyPick.length) {
      result.push(ihyPick[ii++]);
    } else if (oi < otherPick.length) {
      result.push(otherPick[oi++]);
    } else if (ii < ihyPick.length) {
      result.push(ihyPick[ii++]);
    }
  }
  while (ii < ihyPick.length && result.length < MAX_HEADLINES) result.push(ihyPick[ii++]);
  while (oi < otherPick.length && result.length < MAX_HEADLINES) result.push(otherPick[oi++]);

  return result;
}

function buildIhyOnlyHeadlines(
  sorted: MediaLeader[],
): (MediaHeadline & { leader: string })[] {
  const result: (MediaHeadline & { leader: string })[] = [];
  for (const l of sorted) {
    for (const h of l.headlines) {
      if (h.source === IHY) {
        result.push({ ...h, leader: l.name_he });
        if (result.length >= MAX_HEADLINES) return result;
      }
    }
  }
  return result;
}

function MentionBar({ leader, maxCount, expanded }: { leader: MediaLeader; maxCount: number; expanded: boolean }) {
  const pct = maxCount > 0 ? (leader.mention_count / maxCount) * 100 : 0;

  return (
    <div className="mm-bar-row">
      <div className="mm-bar-header">
        <span className="mm-leader-name">{leader.name_he}</span>
        <span className="mm-leader-role">{leader.role}</span>
        <span className={`mm-chevron${expanded ? " mm-chevron-open" : ""}`}>&#x25BC;</span>
      </div>
      <div className="mm-bar-track">
        <div className="mm-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function HeadlineItem({ title, source, url, highlight }: { title: string; source: string; url?: string; highlight?: boolean }) {
  const isIhy = source === IHY;

  return (
    <div className={`mm-headline${highlight ? " mm-headline-ihy" : ""}`}>
      <span className={`mm-headline-source${highlight ? " mm-source-ihy" : ""}`}>{source}</span>
      {isIhy && url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="mm-headline-title mm-headline-link">
          {title}
        </a>
      ) : (
        <span className="mm-headline-title">{title}</span>
      )}
    </div>
  );
}

interface Props {
  mediaMentions: MediaMentionsData;
}

export default function MediaMentions({ mediaMentions }: Props) {
  const [expandedLeader, setExpandedLeader] = useState<string | null>(null);
  const [filter, setFilter] = useState<HeadlineFilter>("all");

  if (!mediaMentions.leaders || mediaMentions.leaders.length === 0) return null;

  const sorted = [...mediaMentions.leaders].sort((a, b) => b.mention_count - a.mention_count);
  const maxCount = sorted[0]?.mention_count ?? 1;

  const topHeadlines = filter === "ihy"
    ? buildIhyOnlyHeadlines(sorted)
    : buildMixedHeadlines(sorted);

  return (
    <div className="card mm-card fade-in">
      <div className="card-header">
        <span className="card-title">מי בכותרות?</span>
        <span className="card-subtitle">{mediaMentions.period_label} · {mediaMentions.source}</span>
      </div>

      <div className="mm-bars">
        {sorted.map(leader => {
          const headlines = filter === "ihy"
            ? leader.headlines.filter(h => h.source === IHY)
            : leader.headlines.filter(h => !h.fallback);
          return (
            <div key={leader.key}>
              <button
                className={`mm-bar-btn${expandedLeader === leader.key ? " mm-expanded" : ""}`}
                onClick={() => setExpandedLeader(expandedLeader === leader.key ? null : leader.key)}
                aria-expanded={expandedLeader === leader.key}
              >
                <MentionBar leader={leader} maxCount={maxCount} expanded={expandedLeader === leader.key} />
              </button>
              {expandedLeader === leader.key && headlines.length > 0 && (
                <div className="mm-headlines-expand">
                  {headlines.map((h, i) => (
                    <HeadlineItem key={i} title={h.title} source={h.source} url={h.url} highlight={h.source === IHY} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mm-top-headlines">
        <div className="mm-headlines-header">
          <span className="mm-section-title">כותרות בולטות</span>
          <div className="mm-filter-pills" role="group" aria-label="סינון מקור">
            <button
              className={`mm-filter-pill${filter === "all" ? " mm-filter-active" : ""}`}
              onClick={() => setFilter("all")}
            >
              כל המקורות
            </button>
            <button
              className={`mm-filter-pill mm-filter-ihy${filter === "ihy" ? " mm-filter-active" : ""}`}
              onClick={() => setFilter("ihy")}
            >
              ישראל היום
            </button>
          </div>
        </div>
        {topHeadlines.map((h, i) => (
          <HeadlineItem key={i} title={h.title} source={h.source} url={h.url} highlight={h.source === IHY} />
        ))}
      </div>

      <p className="mm-disclaimer">
        ספירת אזכורים ב-Google News ב{mediaMentions.period_label}. כמות האזכורים משקפת נוכחות תקשורתית, לא סנטימנט חיובי או שלילי.
      </p>
    </div>
  );
}
