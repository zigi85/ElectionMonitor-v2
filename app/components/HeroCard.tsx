import type { MomentumData, PollsData } from "@/lib/types";

interface HeroCardProps {
  momentum: MomentumData;
  polls: PollsData;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "עכשיו";
  if (mins === 1) return "לפני דקה";
  if (mins < 60) return `לפני ${mins} דקות`;
  const hrs = Math.floor(mins / 60);
  if (hrs === 1) return "לפני שעה";
  if (hrs === 2) return "לפני שעתיים";
  if (hrs < 24) return `לפני ${hrs} שעות`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "אתמול";
  if (days === 2) return "לפני יומיים";
  return `לפני ${days} ימים`;
}

function buildSummary(momentum: MomentumData, polls: PollsData): string {
  const { blocs } = momentum;
  const opp = blocs.opposition;
  const coal = blocs.coalition;

  const latestWeek = [...polls.weekly_averages]
    .filter(w => !w.sparse)
    .sort((a, b) => b.iso_week.localeCompare(a.iso_week))[0];

  const together = latestWeek?.seats?.together ?? 0;
  const likud = latestWeek?.seats?.likud ?? 0;

  let line1 = "";
  if (together > 0 && likud > 0) {
    if (together >= likud) {
      line1 = `יחד חוצה את הליכוד, ${Math.round(together)} מול ${Math.round(likud)} מנדטים.`;
    } else {
      line1 = `הליכוד מוביל, ${Math.round(likud)} מול ${Math.round(together)} מנדטים ליחד.`;
    }
  }

  const oppDir = opp.direction === "gaining" ? "מתחזקת" : opp.direction === "losing" ? "נחלשת" : "יציבה";
  const line2 = `האופוזיציה ${oppDir}, ${Math.round(opp.seats)} מנדטים מול ${Math.round(coal.seats)} לקואליציה.`;

  const oppGap = 61 - opp.seats;
  const line3 = oppGap > 0
    ? `הפער ${Math.round(oppGap)} מנדטים מ-61 הדרושים למהפך.`
    : `האופוזיציה הגיעה לרוב, ${Math.round(opp.seats)} מנדטים.`;

  return [line1, line2, line3].filter(Boolean).join(" ");
}

function buildChips(momentum: MomentumData): string[] {
  const { blocs } = momentum;
  const coalSeats = Math.round(blocs.coalition.seats);
  const oppSeats = Math.round(blocs.opposition.seats);

  const chips: string[] = [];
  if (coalSeats > 0) chips.push(`גוש הימין ${coalSeats} מנדטים`);
  if (oppSeats > 0) chips.push(`גוש המרכז-שמאל ${oppSeats} מנדטים`);
  return chips;
}

export default function HeroCard({ momentum, polls }: HeroCardProps) {
  const summary = buildSummary(momentum, polls);
  const updatedAgo = timeAgo(polls.generated_at);
  const chips = buildChips(momentum);

  return (
    <div className="hero-card fade-in" role="region" aria-label="תמונת מצב פוליטית">
      <div className="hero-top-row">
        <span className="hero-live-badge" aria-label="נתונים חיים">LIVE</span>
        <span className="hero-freshness">עודכן {updatedAgo}</span>
      </div>

      <h2 className="hero-title">בחירות 2026 - תמונת מצב</h2>

      <p className="hero-summary">{summary}</p>

      {chips.length > 0 && (
        <div className="hero-chips" aria-label="אותות מרכזיים">
          {chips.map((chip, i) => (
            <span key={i} className="hero-chip">{chip}</span>
          ))}
        </div>
      )}
    </div>
  );
}
