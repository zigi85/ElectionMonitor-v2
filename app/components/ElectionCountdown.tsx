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

function getTimeLeft(now: Date) {
  const diff = Math.max(0, ELECTION_DATE.getTime() - now.getTime());
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

function daysUntil(dateStr: string, now: Date): number {
  const d = new Date(dateStr).getTime();
  return Math.max(0, Math.ceil((d - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export default function ElectionCountdown() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return (
      <div className="card countdown-card">
        <div className="cd-clock-section">
          <div className="cd-clock" dir="ltr">
            <div className="cd-clock-unit cd-clock-days"><span className="cd-clock-num">--</span><span className="cd-clock-label">ימים</span></div>
            <span className="cd-clock-sep">:</span>
            <div className="cd-clock-unit"><span className="cd-clock-num">--</span><span className="cd-clock-label">שעות</span></div>
            <span className="cd-clock-sep">:</span>
            <div className="cd-clock-unit"><span className="cd-clock-num">--</span><span className="cd-clock-label">דקות</span></div>
            <span className="cd-clock-sep">:</span>
            <div className="cd-clock-unit"><span className="cd-clock-num">--</span><span className="cd-clock-label">שניות</span></div>
          </div>
          <p className="cd-subtitle">עד הבחירות לכנסת ה-26</p>
        </div>
      </div>
    );
  }

  const { days, hours, minutes, seconds } = getTimeLeft(now);
  const todayStr = now.toISOString().slice(0, 10);

  const nextIdx = MILESTONES.findIndex(m => m.date > todayStr);
  const nextMilestone = nextIdx >= 0 ? MILESTONES[nextIdx] : null;

  return (
    <div className="card countdown-card">
      <div className="cd-clock-section">
        <div className="cd-clock" dir="ltr">
          <div className="cd-clock-unit cd-clock-days">
            <span className="cd-clock-num">{days}</span>
            <span className="cd-clock-label">ימים</span>
          </div>
          <span className="cd-clock-sep">:</span>
          <div className="cd-clock-unit">
            <span className="cd-clock-num">{pad(hours)}</span>
            <span className="cd-clock-label">שעות</span>
          </div>
          <span className="cd-clock-sep">:</span>
          <div className="cd-clock-unit">
            <span className="cd-clock-num">{pad(minutes)}</span>
            <span className="cd-clock-label">דקות</span>
          </div>
          <span className="cd-clock-sep">:</span>
          <div className="cd-clock-unit">
            <span className="cd-clock-num">{pad(seconds)}</span>
            <span className="cd-clock-label">שניות</span>
          </div>
        </div>
        <p className="cd-subtitle">עד הבחירות לכנסת ה-26</p>
      </div>

      {nextMilestone && (
        <div className="cd-next">
          <span className="cd-next-label">האירוע הבא:</span>
          <span className="cd-next-in">בעוד {daysUntil(nextMilestone.date, now)} ימים</span>
          <span className="cd-next-event">{nextMilestone.label}</span>
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
