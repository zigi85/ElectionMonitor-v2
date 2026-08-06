import type { MomentumData, PollsData, PartyKey, WeeklyAverage } from "@/lib/types";
import { parties } from "@/lib/parties";

interface MomentumTableProps {
  momentum: MomentumData;
  polls: PollsData;
}

const TABLE_PARTIES: PartyKey[] = [
  "together", "likud", "shas", "otzma_yehudit",
  "yisrael_beiteinu", "democrats", "yashar", "utj",
];

function togetherSeats(week: WeeklyAverage): number {
  if (week.seats.together !== undefined) return week.seats.together;
  return (week.seats.bennett_2026 ?? 0) + (week.seats.yesh_atid ?? 0);
}

function getSeats(week: WeeklyAverage, key: PartyKey): number {
  if (key === "together") return togetherSeats(week);
  return week.seats[key] ?? 0;
}

function formatWeekDateRange(week: WeeklyAverage): string {
  const start = new Date(week.week_start);
  const end = new Date(week.week_end);
  const months = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const endMonth = months[end.getUTCMonth()];
  const endYear = end.getUTCFullYear();
  return `${startDay}–${endDay} ב${endMonth} ${endYear}`;
}

export default function MomentumTable({ momentum, polls }: MomentumTableProps) {
  const { blocs } = momentum;

  const today = new Date().toISOString().slice(0, 10);
  const sortedWeeks = [...polls.weekly_averages].sort((a, b) =>
    a.iso_week.localeCompare(b.iso_week)
  );
  const pastWeeks = sortedWeeks.filter(w => !w.sparse && w.week_start <= today);
  const currentWeek = pastWeeks.at(-1);
  const prevWeek = pastWeeks.at(-2);

  const rows = TABLE_PARTIES.map(key => {
    const meta = parties[key];
    if (!meta) return null;
    const seats = currentWeek ? getSeats(currentWeek, key) : 0;
    if (seats === 0) return null;
    const prevSeats = prevWeek ? getSeats(prevWeek, key) : seats;
    const delta = Math.round(seats) - Math.round(prevSeats);
    return { key, meta, seats: Math.round(seats), delta };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  const weekLabel = currentWeek ? formatWeekDateRange(currentWeek) : "ממוצע אחרון";

  const oppPct = (blocs.opposition.seats / 120) * 100;
  const coalPct = (blocs.coalition.seats / 120) * 100;
  const midPct = Math.max(0, 100 - oppPct - coalPct);
  const markerPctFromLeft = (1 - 61 / 120) * 100;

  return (
    <div className="card momentum-card fade-in">
      <div className="card-header">
        <span className="card-title">מדד מומנטום</span>
        <span className="card-subtitle">ממוצע שבועי · {weekLabel}</span>
      </div>

      <div className="momentum-col-headers">
        <span className="mom-col-h">גוש / מפלגה</span>
        <span className="mom-col-h center">מנדטים</span>
        <span className="mom-col-h center">מגמה</span>
      </div>

      {rows.map(({ key, meta, seats, delta }) => {
        const trendClass = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
        const trendLabel = delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "→ 0";

        return (
          <div key={key} className="momentum-row">
            <div>
              <div className="mom-party-name">{meta.name}</div>
              {meta.leaderFull && (
                <div className="mom-party-sub">בראשות {meta.leaderFull}</div>
              )}
            </div>
            <div className="mom-seats">{seats}</div>
            <div className={`mom-trend ${trendClass}`}>{trendLabel}</div>
          </div>
        );
      })}

      <div className="bloc-bar-section">
        <div className="bloc-bar-labels">
          <div className="bloc-bar-label">
            <span className="bloc-bar-name">גוש המרכז-שמאל</span>
            <span className="bloc-bar-seats opp">{Math.round(blocs.opposition.seats)}</span>
            <span className={`bloc-bar-delta ${blocs.opposition.delta > 0 ? "delta-pos" : blocs.opposition.delta < 0 ? "delta-neg" : "delta-flat"}`}>
              {blocs.opposition.delta > 0 ? `▲ +${Math.round(blocs.opposition.delta)}` : blocs.opposition.delta < 0 ? `▼ ${Math.round(blocs.opposition.delta)}` : "יציב"}
            </span>
          </div>
          <div className="bloc-bar-label" style={{ alignItems: "flex-end" }}>
            <span className="bloc-bar-name">גוש הימין</span>
            <span className="bloc-bar-seats coal">{Math.round(blocs.coalition.seats)}</span>
            <span className={`bloc-bar-delta ${blocs.coalition.delta > 0 ? "delta-pos" : blocs.coalition.delta < 0 ? "delta-neg" : "delta-flat"}`}>
              {blocs.coalition.delta > 0 ? `▲ +${Math.round(blocs.coalition.delta)}` : blocs.coalition.delta < 0 ? `▼ ${Math.round(blocs.coalition.delta)}` : "יציב"}
            </span>
          </div>
        </div>

        <div className="bloc-progress-wrap" style={{ marginBottom: 20 }}>
          <div className="bloc-progress-opp" style={{ width: `${oppPct}%` }} />
          <div className="bloc-progress-mid" style={{ width: `${midPct}%` }} />
          <div className="bloc-progress-coal" style={{ width: `${coalPct}%` }} />
          <div className="majority-marker-wrap" style={{ left: `${markerPctFromLeft}%` }}>
            <div className="majority-marker-line" />
            <span className="majority-marker-label">61 לרוב</span>
          </div>
        </div>
      </div>

      {currentWeek && (
        <div className="mom-disclaimer">
          <p className="mom-disclaimer-sources">
            <span className="mom-disclaimer-label">מקורות:</span>{" "}
            {currentWeek.included_firms.join(", ")}
          </p>
          <p className="mom-disclaimer-note">
            המגמה מחושבת ביחס לתקופת הסקרים הקודמת
          </p>
        </div>
      )}
    </div>
  );
}
