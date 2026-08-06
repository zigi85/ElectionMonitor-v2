import type { MomentumDirection } from "@/lib/types";

interface BlocCardProps {
  label: string;
  seats: number;
  delta: number;
  direction: MomentumDirection;
  majorityTarget?: number;
}

const ARROWS: Record<MomentumDirection, string> = {
  gaining: "↑",
  losing: "↓",
  stable: "→",
};

export default function BlocCard({
  label,
  seats,
  delta,
  direction,
  majorityTarget = 61,
}: BlocCardProps) {
  const gap = majorityTarget - seats;
  const fillPct = Math.min((seats / majorityTarget) * 100, 100);
  const deltaSign = delta > 0 ? "+" : "";
  const deltaClass =
    delta > 0 ? "bloc-delta--pos" : delta < 0 ? "bloc-delta--neg" : "bloc-delta--zero";
  const arrowClass = `bloc-arrow--${direction}`;
  const cardClass = `bloc-card bloc-card--${direction}`;
  const fillClass = `bloc-majority-fill bloc-majority-fill--${direction}`;

  return (
    <div className={cardClass}>
      <span className="bloc-label">{label}</span>

      <div className="bloc-seats-row">
        <span className="bloc-seats">{seats.toFixed(1)}</span>
        <span className={`bloc-arrow ${arrowClass}`}>{ARROWS[direction]}</span>
      </div>

      {delta !== 0 && (
        <span className={`bloc-delta ${deltaClass}`}>
          {deltaSign}{delta.toFixed(1)} מנדטים
        </span>
      )}

      <div className="bloc-majority-bar">
        <div
          className={fillClass}
          style={{ width: `${fillPct}%` }}
          aria-valuenow={seats}
          aria-valuemax={majorityTarget}
          role="progressbar"
        />
      </div>

      <span className="bloc-gap">
        {gap > 0
          ? `${gap.toFixed(1)} מנדטים מרוב`
          : "הגיע לרוב"}
      </span>
    </div>
  );
}
