"use client";

import { useRef } from "react";
import type { SocialData, SocialLeaderBuzz, ViralVideo } from "@/lib/types";

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

function DirectionBadge({ direction, changePct }: { direction: string; changePct: number }) {
  const cls =
    direction === "rising" ? "buzz-dir-up" :
    direction === "falling" ? "buzz-dir-down" : "buzz-dir-stable";
  const arrow =
    direction === "rising" ? "▲" :
    direction === "falling" ? "▼" : "→";
  const label = `${changePct > 0 ? "+" : ""}${changePct}%`;

  return (
    <span className={`buzz-direction ${cls}`}>
      {arrow} {label}
    </span>
  );
}

function BuzzBar({ leader, maxViews }: { leader: SocialLeaderBuzz; maxViews: number }) {
  const pct = maxViews > 0 ? (leader.views_7d / maxViews) * 100 : 0;

  return (
    <div className="buzz-row">
      <div className="buzz-row-header">
        <span className="buzz-leader-name">{leader.name_he}</span>
        <span className="buzz-views">{fmtViews(leader.views_7d)}</span>
        <DirectionBadge direction={leader.direction} changePct={leader.change_pct} />
      </div>
      <div className="buzz-bar-track">
        <div
          className={`buzz-bar-fill buzz-fill-${leader.direction}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ViralCard({ video }: { video: ViralVideo }) {
  return (
    <div className="yt-embed-card">
      <div className="yt-embed-wrap">
        <iframe
          src={`https://www.youtube.com/embed/${video.video_id}`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="yt-embed-iframe"
        />
        <span className="viral-views-badge">{video.views_str}</span>
      </div>
      <div className="yt-embed-meta">
        <span className="yt-embed-name">{video.channel}</span>
        <span className="yt-embed-title">{video.title}</span>
        <span className="yt-embed-date">
          {video.duration}
          {video.published_text && ` · ${video.published_text}`}
        </span>
      </div>
    </div>
  );
}

function ViralCarousel({ videos }: { videos: ViralVideo[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => {
    ref.current?.scrollBy({ left: dir * 220, behavior: "smooth" });
  };
  return (
    <div className="yt-section">
      <div className="social-section-header">
        <span className="social-section-title">סרטונים ויראליים</span>
        <span className="social-section-source">YouTube · לפי צפיות</span>
        <div className="carousel-nav">
          <button className="carousel-btn" onClick={() => scroll(1)} aria-label="הקודם">&#8249;</button>
          <button className="carousel-btn" onClick={() => scroll(-1)} aria-label="הבא">&#8250;</button>
        </div>
      </div>
      <div className="yt-carousel" ref={ref}>
        {videos.slice(0, 8).map(video => (
          <ViralCard key={video.video_id} video={video} />
        ))}
      </div>
    </div>
  );
}

interface Props {
  socialData: SocialData;
}

export default function SocialMonitor({ socialData }: Props) {
  const hasTopics = socialData.hot_topics.length > 0;
  const hasBuzz = socialData.leader_buzz.length > 0;
  const hasViral = (socialData.viral_videos ?? []).length > 0;
  if (!hasTopics && !hasBuzz) return null;

  const maxViews = hasBuzz
    ? Math.max(...socialData.leader_buzz.map(l => l.views_7d))
    : 1;

  return (
    <div className="card social-card fade-in">
      <div className="card-header">
        <span className="card-title"># מוניטור רשתות</span>
        <span className="card-subtitle">מגמות ועניין ציבורי</span>
      </div>

      {/* ── Hot Topics (disabled — uncomment to restore) ──
      {hasTopics && (
        <div className="hot-topics-section">
          <div className="social-section-header">
            <span className="social-section-title">נושאים חמים</span>
            <span className="social-section-source">Google News · 3 ימים</span>
          </div>
          <div className="hot-topics-grid">
            {socialData.hot_topics.slice(0, 6).map(topic => (
              <div key={topic.id} className="hot-topic-card">
                <div className="hot-topic-header">
                  <span className="hot-topic-label">{topic.label}</span>
                  <span className="hot-topic-count">{topic.mention_count} כתבות</span>
                </div>
                {topic.sample_headline && (
                  <p className="hot-topic-sample">
                    {topic.sample_source && (
                      <span className="hot-topic-source">{topic.sample_source}: </span>
                    )}
                    {topic.sample_headline}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      ── */}

      {/* ── Viral Videos Carousel ─────────────── */}
      {hasViral && <ViralCarousel videos={socialData.viral_videos!} />}


      {/* ── Leader Buzz (Wikipedia) ───────────────── */}
      {hasBuzz && (
        <div className="buzz-section">
          <div className="social-section-header">
            <span className="social-section-title">מדד הבאזז</span>
            <span className="social-section-source">Wikipedia · 7 ימים</span>
          </div>
          <div className="buzz-bars">
            {socialData.leader_buzz.map(leader => (
              <BuzzBar key={leader.key} leader={leader} maxViews={maxViews} />
            ))}
          </div>
          <p className="buzz-explainer">
            צפיות בוויקיפדיה העברית כמדד לעניין ציבורי בפוליטיקאים. עלייה חדה מעידה על אירוע תקשורתי.
          </p>
        </div>
      )}

      <p className="social-disclaimer">
        הנתונים מבוססים על ניתוח כותרות Google News, צפיות בוויקיפדיה העברית ו-YouTube.
        הם משקפים עניין ציבורי יחסי, לא עמדה פוליטית.
      </p>
    </div>
  );
}
