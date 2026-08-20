"use client";

import { useRef } from "react";
import type { SocialData, ViralVideo } from "@/lib/types";

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
  const hasViral = (socialData.viral_videos ?? []).length > 0;
  if (!hasViral) return null;

  return (
    <div className="card social-card fade-in">
      <div className="card-header">
        <span className="card-title"># מוניטור רשתות</span>
        <span className="card-subtitle">מגמות ועניין ציבורי</span>
      </div>

      {hasViral && <ViralCarousel videos={socialData.viral_videos!} />}

      <p className="social-disclaimer">
        הנתונים מבוססים על ניתוח כותרות Google News, צפיות בוויקיפדיה העברית ו-YouTube.
        הם משקפים עניין ציבורי יחסי, לא עמדה פוליטית.
      </p>
    </div>
  );
}
