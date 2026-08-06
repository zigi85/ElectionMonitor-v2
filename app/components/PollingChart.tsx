import type { PollsData, WeeklyAverage, PartyKey } from "@/lib/types";
import { parties, currentPartyOrder } from "@/lib/parties";

interface PollingChartProps {
  polls: PollsData;
}

// Parties to display in bar chart (skip if no data in current week)
const DISPLAY_PARTIES: PartyKey[] = [
  "together",
  "likud",
  "yisrael_beiteinu",
  "shas",
  "otzma_yehudit",
  "democrats",
  "yashar",
  "utj",
  "reservists",
  "raam",
  "hadash_taal",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** For "together" column: returns merged value for pre-merger weeks */
function togetherSeats(week: WeeklyAverage): number | undefined {
  if (week.seats.together !== undefined) return week.seats.together;
  const b = week.seats.bennett_2026 ?? 0;
  const ya = week.seats.yesh_atid ?? 0;
  const combined = b + ya;
  return combined > 0 ? combined : undefined;
}

/** Get seats for any party key, with special handling for "together" */
function getSeats(week: WeeklyAverage, key: PartyKey): number | undefined {
  if (key === "together") return togetherSeats(week);
  return week.seats[key];
}

/** Two most recent non-sparse weeks */
function getLatestWeeks(
  weeklyAverages: WeeklyAverage[]
): [WeeklyAverage | null, WeeklyAverage | null] {
  const nonSparse = weeklyAverages.filter((w) => !w.sparse);
  const sorted = [...nonSparse].sort((a, b) => b.iso_week.localeCompare(a.iso_week));
  return [sorted[0] ?? null, sorted[1] ?? null];
}

function formatWeekRange(week: WeeklyAverage): string {
  const start = new Date(week.week_start);
  const end = new Date(week.week_end);
  const fmtStart = `${start.getDate()}.${start.getMonth() + 1}`;
  const fmtEnd = `${end.getDate()}.${end.getMonth() + 1}.${end.getFullYear()}`;
  return `${fmtStart}–${fmtEnd}`;
}

function formatPollDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PollingChart({ polls }: PollingChartProps) {
  const { weekly_averages, raw_polls } = polls;
  const [current, previous] = getLatestWeeks(weekly_averages);

  if (!current) {
    return (
      <section className="polling-section">
        <p style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>
          אין נתוני סקרים זמינים
        </p>
      </section>
    );
  }

  // Build party bar data
  const barData = DISPLAY_PARTIES.map((key) => {
    const seats = getSeats(current, key);
    if (seats === undefined || seats === 0) return null;
    const prevSeats = previous ? getSeats(previous, key) : undefined;
    const delta = prevSeats !== undefined ? seats - prevSeats : 0;
    return { key, seats, delta };
  }).filter(Boolean) as Array<{ key: PartyKey; seats: number; delta: number }>;

  barData.sort((a, b) => b.seats - a.seats);
  const maxSeats = barData[0]?.seats ?? 1;

  // Sparkline data for top 6 parties
  const sparkParties = barData.slice(0, 6).map((d) => d.key);
  const allWeeksSorted = [...weekly_averages].sort((a, b) =>
    a.iso_week.localeCompare(b.iso_week)
  );
  const sparkWeeks = allWeeksSorted.slice(-8);

  // Recent polls (last 12 included polls only)
  const recentPolls = [...raw_polls]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  return (
    <section className="polling-section fade-in" aria-label="ממוצע סקרים שבועי">
      {/* ─ Header ─────────────────────────────────────────────── */}
      <div className="section-header">
        <h2 className="section-title">ממוצע סקרים שבועי</h2>
        <span className="section-label week-label">
          {formatWeekRange(current)}
        </span>
      </div>

      {/* ─ Bar chart ──────────────────────────────────────────── */}
      <div className="bar-list">
        {barData.map(({ key, seats, delta }) => {
          const meta = parties[key];
          if (!meta) return null;
          const widthPct = (seats / maxSeats) * 100;
          const deltaClass =
            delta > 0.09
              ? "bar-delta bar-delta--pos"
              : delta < -0.09
              ? "bar-delta bar-delta--neg"
              : "bar-delta bar-delta--zero";
          const deltaStr =
            Math.abs(delta) < 0.05
              ? "–"
              : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;

          return (
            <div key={key} className="bar-row">
              <div className="bar-party-info">
                <span className="bar-party-name">{meta.name}</span>
                {meta.leader && (
                  <span className="bar-party-leader">{meta.leader}</span>
                )}
              </div>
              <div>
                <div className="bar-track" role="img" aria-label={`${meta.name}: ${seats.toFixed(1)} מנדטים`}>
                  <div
                    className="bar-fill"
                    style={{
                      width: `${widthPct}%`,
                      background: `linear-gradient(90deg, ${meta.color}cc, ${meta.color})`,
                    }}
                  >
                    <span className="bar-value">{seats.toFixed(1)}</span>
                  </div>
                </div>
                <span className={deltaClass} style={{ marginTop: 2, display: "inline-block" }}>
                  {deltaStr}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─ Bloc totals ────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 12,
          fontSize: "0.75rem",
          color: "var(--text-muted)",
          marginBottom: 6,
          flexWrap: "wrap",
        }}
      >
        <span>
          <strong style={{ color: "var(--text)" }}>
            {current.blocs.coalition}
          </strong>{" "}
          מנדטים לקואליציה
        </span>
        <span style={{ color: "var(--text-dim)" }}>·</span>
        <span>
          <strong style={{ color: "var(--text)" }}>
            {current.blocs.opposition}
          </strong>{" "}
          לאופוזיציה
        </span>
        <span style={{ color: "var(--text-dim)" }}>·</span>
        <span>צריך 61 לרוב</span>
      </div>

      {/* ─ Sparklines ─────────────────────────────────────────── */}
      {sparkWeeks.length >= 3 && (
        <div className="sparkline-section">
          <p className="sparkline-title">מגמה — 8 שבועות</p>
          <div className="sparkline-rows">
            {sparkParties.map((key) => {
              const meta = parties[key];
              if (!meta) return null;
              const values = sparkWeeks.map((w) => getSeats(w, key) ?? 0);
              const maxVal = Math.max(...values);
              const minVal = Math.min(...values);
              const range = maxVal - minVal || 1;

              return (
                <div key={key} className="sparkline-row">
                  <span className="sparkline-party">{meta.name}</span>
                  <div className="sparkline">
                    {values.map((v, i) => {
                      const isCurrentWeek = i === values.length - 1;
                      const pct = ((v - minVal) / range) * 72 + 28; // 28%–100% range
                      return (
                        <div
                          key={i}
                          className={`sparkline-bar ${isCurrentWeek ? "sparkline-bar--current" : "sparkline-bar--past"}`}
                          style={{
                            height: `${pct}%`,
                            background: meta.color,
                          }}
                          title={`${sparkWeeks[i].iso_week}: ${v.toFixed(1)}`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─ Attribution ────────────────────────────────────────── */}
      <div className="polling-attribution">
        <span className="attribution-label">מכוני סקר: </span>
        {current.included_firms.join(" · ")}
        <br />
        <span className="excluded-note">
          ⚠ סקרי פילבר (ערוץ 14) ו-Direct Polls אינם נכללים בממוצע
        </span>
      </div>

      {/* ─ All recent polls ───────────────────────────────────── */}
      <details className="polls-details">
        <summary>כל הסקרים האחרונים ({recentPolls.length})</summary>
        <div className="polls-table-wrap">
          <table className="polls-table">
            <thead>
              <tr>
                <th>תאריך</th>
                <th>מכון</th>
                <th>ליכוד</th>
                <th>יחד</th>
                <th>ש"ס</th>
                <th>עוצמה</th>
                <th>יב"ל</th>
              </tr>
            </thead>
            <tbody>
              {recentPolls.map((poll) => {
                const combined =
                  (poll.seats.bennett_2026 ?? 0) + (poll.seats.yesh_atid ?? 0);
                const togetherVal =
                  poll.seats.together ?? (combined > 0 ? combined : null);
                return (
                  <tr key={poll.id}>
                    <td>{formatPollDate(poll.date)}</td>
                    <td
                      className={poll.excluded_from_avg ? "firm-excl" : undefined}
                    >
                      {poll.excluded_from_avg && (
                        <span className="excl-badge">✕</span>
                      )}
                      {poll.firm}
                    </td>
                    <td>{poll.seats.likud ?? "–"}</td>
                    <td>{togetherVal ?? "–"}</td>
                    <td>{poll.seats.shas ?? "–"}</td>
                    <td>{poll.seats.otzma_yehudit ?? "–"}</td>
                    <td>{poll.seats.yisrael_beiteinu ?? "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
