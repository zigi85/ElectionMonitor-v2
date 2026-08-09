"use client";

import { useState, useEffect } from "react";

const ELECTION_DATE = new Date("2026-10-27T07:00:00+03:00");

interface Milestone {
  date: string;
  label: string;
}

const MILESTONES: Milestone[] = [
  { date: "2026-08-18", label: "קביעת אזורי קלפי" },
  { date: "2026-09-03", label: "פרסום רשימת בוחרים" },
  { date: "2026-09-08", label: "הגשת רשימות מועמדים" },
  { date: "2026-09-27", label: "אישור סופי של רשימות" },
  { date: "2026-10-13", label: "תחילת תעמולה בטלוויזיה" },
  { date: "2026-10-20", label: "הצבעה מוקדמת בחו\"ל" },
  { date: "2026-10-23", label: "סקר אחרון" },
  { date: "2026-10-27", label: "יום הבחירות" },
];

function getDaysLeft(now: Date): number {
  const diff = ELECTION_DATE.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

function daysUntil(dateStr: string, now: Date): number {
  const d = new Date(dateStr).getTime();
  return Math.max(0, Math.ceil((d - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function ElectionCountdown() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const days = getDaysLeft(now);
  const todayStr = now.toISOString().slice(0, 10);

  const nextIdx = MILESTONES.findIndex(m => m.date > todayStr);
  const nextMilestone = nextIdx >= 0 ? MILESTONES[nextIdx] : null;

  return (
    <div className="card countdown-card fade-in">
      <div className="cd-hero">
        <div className="cd-days-ring">
          <span className="cd-days-num">{days}</span>
          <span className="cd-days-word">ימים</span>
        </div>
        <div className="cd-hero-text">
          <span className="cd-hero-title">עד הבחירות לכנסת ה-26</span>
          <span className="cd-hero-date">27 באוקטובר 2026</span>
        </div>
      </div>

      {nextMilestone && (
        <div className="cd-next">
          <span className="cd-next-label">האירוע הבא</span>
          <span className="cd-next-event">{nextMilestone.label}</span>
          <span className="cd-next-in">בעוד {daysUntil(nextMilestone.date, now)} ימים</span>
        </div>
      )}

      <div className="cd-track">
        {MILESTONES.map((m, i) => {
          const isPast = m.date <= todayStr;
          const isNext = nextIdx === i;
          const isElection = m.date === "2026-10-27";

          return (
            <div
              key={m.date}
              className={`cd-stop${isPast ? " cd-done" : ""}${isNext ? " cd-active" : ""}${isElection ? " cd-final" : ""}`}
            >
              <div className="cd-stop-dot" />
              <span className="cd-stop-date">{formatDate(m.date)}</span>
              <span className="cd-stop-label">{m.label}</span>
            </div>
          );
        })}
        <div className="cd-track-line" />
      </div>
    </div>
  );
}
