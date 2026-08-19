"use client";

import { useState, useRef, useEffect } from "react";
import type { MediaMentionsData, MediaLeader, MediaHeadline } from "@/lib/types";

const IHY = "ישראל היום";
const MAX_HEADLINES = 5;
const IHY_MIN = 1;
const IHY_MAX = 3;

type HeadlineFilter = "all" | "ihy";

const LEADER_IMAGES: Record<string, string> = {
  netanyahu: "/images/politicians/netanyahu.png",
  eisenkot: "/images/politicians/eisenkot.png",
  bennett: "/images/politicians/bennett.png",
  lieberman: "/images/politicians/lieberman.png",
  golan: "/images/politicians/golan.png",
  ben_gvir: "/images/politicians/ben_gvir.png",
  smotrich: "/images/politicians/smotrich.png",
};

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

function splitName(name: string): [string, string] {
  const parts = name.split(" ");
  if (parts.length <= 1) return [name, ""];
  return [parts[0], parts.slice(1).join(" ")];
}

interface Props {
  mediaMentions: MediaMentionsData;
}

export default function MediaMentions({ mediaMentions }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<HeadlineFilter>("all");
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  if (!mediaMentions.leaders || mediaMentions.leaders.length === 0) return null;

  const sorted = [...mediaMentions.leaders].sort((a, b) => b.mention_count - a.mention_count);
  const activeKey = selectedKey ?? sorted[0]?.key;
  const selectedLeader = sorted.find(l => l.key === activeKey) ?? sorted[0];
  const selectedHeadlines = selectedLeader.headlines.filter(h => !h.fallback).slice(0, 3);

  const topHeadlines = filter === "ihy"
    ? buildIhyOnlyHeadlines(sorted)
    : buildMixedHeadlines(sorted);

  const scrollCarousel = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir, behavior: "smooth" });
  };

  useEffect(() => {
    const update = () => {
      const panel = panelRef.current;
      const row = scrollRef.current;
      if (!panel || !row) return;

      const activeBtn = row.querySelector(".mm-avatar-active") as HTMLElement;
      if (!activeBtn) {
        panel.style.setProperty("--tab-vis", "0");
        return;
      }

      const panelRect = panel.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();

      if (btnRect.right <= rowRect.left + 10 || btnRect.left >= rowRect.right - 10) {
        panel.style.setProperty("--tab-vis", "0");
        return;
      }

      const pad = 14;
      panel.style.setProperty("--tab-vis", "1");
      panel.style.setProperty("--tab-left", `${btnRect.left - panelRect.left - pad}px`);
      panel.style.setProperty("--tab-width", `${btnRect.width + pad * 2}px`);
      panel.style.setProperty("--tab-height", `${panelRect.top - btnRect.top + pad + 6}px`);
    };

    const t = setTimeout(update, 60);
    const r = scrollRef.current;
    r?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      clearTimeout(t);
      r?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [activeKey]);

  return (
    <section className="mm-section fade-in">
      <div className="mm-inner">
        <div className="mm-header">
          <h2 className="mm-title">מי בכותרות?</h2>
          <span className="mm-label">Google News</span>
        </div>

        <p className="mm-subtitle">
          ספירת אזכורים ב-Google News ב{mediaMentions.period_label}. כמות האזכורים משקפת נוכחות תקשורתית, לא סנטימנט חיובי או שלילי.
        </p>

        <div className="mm-content-wrap">
        <div className="mm-carousel-wrap">
          <button className="mm-carousel-arrow" onClick={() => scrollCarousel(150)} aria-label="הקודם">
            <span className="mm-carousel-chevron mm-chevron-right" />
          </button>
          <div className="mm-avatars-row" ref={scrollRef}>
            {sorted.map((leader, idx) => {
              const isActive = leader.key === activeKey;
              const [firstName, lastName] = splitName(leader.name_he);
              const leaderImg = LEADER_IMAGES[leader.key];
              return (
                <button
                  key={leader.key}
                  className={`mm-avatar-btn${isActive ? " mm-avatar-active" : ""}`}
                  onClick={() => setSelectedKey(leader.key)}
                  aria-pressed={isActive}
                >
                  <div className="mm-avatar-img-wrap">
                    <span className={`mm-rank${isActive ? " mm-rank-active" : ""}`}>{idx + 1}</span>
                    <div className={`mm-avatar-img${isActive ? " mm-avatar-img-active" : ""}`}>
                      {leaderImg ? (
                        <img src={leaderImg} alt={leader.name_he} />
                      ) : (
                        <span className="mm-avatar-placeholder">{firstName[0]}</span>
                      )}
                    </div>
                  </div>
                  <span className={`mm-avatar-name${isActive ? " mm-avatar-name-active" : ""}`}>
                    {firstName}
                    <br />
                    {lastName}
                  </span>
                </button>
              );
            })}
          </div>
          <button className="mm-carousel-arrow" onClick={() => scrollCarousel(-150)} aria-label="הבא">
            <span className="mm-carousel-chevron mm-chevron-left" />
          </button>
        </div>

        <div ref={panelRef} className="mm-detail-panel">
          <div className="mm-badge">
            {selectedLeader.role} | {selectedLeader.mention_count} כתבות
          </div>

          <div className="mm-leader-headlines">
            {selectedHeadlines.map((h, i) => {
              const isIhy = h.source === IHY;
              return (
                <div key={i} className="mm-hl-row">
                  <span className="mm-hl-source">{h.source}</span>
                  <span className="mm-hl-divider" />
                  {isIhy && h.url ? (
                    <a href={h.url} target="_blank" rel="noopener noreferrer" className="mm-hl-text mm-hl-link">
                      {h.title}
                    </a>
                  ) : (
                    <span className="mm-hl-text">{h.title}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        </div>

        <div className="mm-top-section">
          <h3 className="mm-top-title">כותרות בולטות</h3>
          <div className="mm-tabs-card">
            <div className="mm-tabs">
              <button
                className={`mm-tab${filter === "ihy" ? " mm-tab-active" : ""}`}
                onClick={() => setFilter("ihy")}
              >
                <img src="/images/outlets/israel_hayom.png" alt="ישראל היום" className="mm-tab-logo" />
              </button>
              <button
                className={`mm-tab mm-tab-all${filter === "all" ? " mm-tab-active" : ""}`}
                onClick={() => setFilter("all")}
              >
                כל המקורות
              </button>
            </div>
            <div className="mm-top-headlines">
              {topHeadlines.map((h, i) => {
                const isIhy = h.source === IHY;
                const showSource = filter !== "ihy";
                return (
                  <div key={i} className="mm-top-hl-row">
                    {showSource && (
                      <>
                        <span className="mm-hl-source">{h.source}</span>
                        <span className="mm-hl-divider" />
                      </>
                    )}
                    <span className="mm-top-hl-arrow" />
                    {isIhy && h.url ? (
                      <a href={h.url} target="_blank" rel="noopener noreferrer" className="mm-top-hl-text mm-hl-link">
                        {h.title}
                      </a>
                    ) : (
                      <span className="mm-top-hl-text">{h.title}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
