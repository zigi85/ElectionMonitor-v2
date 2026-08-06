"use client";

import { useState, useMemo } from "react";
import type { ManualPollsData, ManualTimestamp, ManualPartyMeta, ManualOutletMeta } from "@/lib/types";

// ─── Hemicycle geometry — Sainte-Laguë ring algorithm ────────────────────────
// Ported from github.com/juliuste/parliament-svg (MIT).
// Same math, no npm dependency: avoids ESM/bundling edge-cases.

// Fill order: coalition RIGHT → unaligned CENTER → opposition LEFT
const HEMICYCLE_ORDER: string[] = [
  "likud", "otzma_yehudit", "shas", "utj", "religious_zionism",
  "raam", "hadash_taal", "joint_list", "balad", "blue_and_white", "reservists",
  "yisrael_beiteinu", "democrats", "yashar",
  "together", "bennett", "yesh_atid",
];

const SHORT_NAMES: Record<string, string> = {
  religious_zionism: "ציונות דתית",
};

interface HemiSeat { x: number; y: number; r: number; fill: string; party: string; }

// Sainte-Laguë proportional allocation of `total` units across `values`.
function sainteLague(values: number[], total: number): number[] {
  const counts = new Array(values.length).fill(0);
  const q = [...values];
  for (let s = 0; s < total; s++) {
    let mx = 0;
    for (let j = 1; j < q.length; j++) if (q[j] > q[mx]) mx = j;
    counts[mx]++;
    q[mx] = values[mx] / (2 * counts[mx] + 1);
  }
  return counts;
}

interface HemiGeometry {
  seats: HemiSeat[];
  seatR: number;
  vb: [number, number, number, number]; // [minX, minY, width, height]
}

function generateHemicycleSeats(
  seats: Record<string, number>,
  partyMeta: Record<string, ManualPartyMeta>,
  r0 = 20
): HemiGeometry {
  const PI = Math.PI;
  const r10 = (x: number) => Math.round(x * 1e10) / 1e10;

  const total = Math.max(Object.values(seats).reduce((s, n) => s + n, 0), 1);

  // Optimal ring count: minimise |seatDist·n/r0 − 5/7|
  const calcDist = (m: number, n: number, r: number) => {
    const x = (PI * n * r) / (m - n);
    const y = 1 + (PI * (n - 1) * n / 2) / (m - n);
    return x / y;
  };
  const sf = (n: number) => Math.abs(calcDist(total, n, r0) * n / r0 - 5 / 7);
  let nR = Math.max(1, Math.floor(Math.log(total) / Math.log(2)));
  let dir = sf(nR + 1) < sf(nR) ? 1 : (nR > 1 && sf(nR - 1) < sf(nR) ? -1 : 0);
  while (dir !== 0 && nR > 0 && sf(nR + dir) < sf(nR)) nR += dir;

  const d = calcDist(total, nR, r0);   // seat-to-seat distance
  const seatR = 0.4 * d;

  const radii = Array.from({ length: nR }, (_, i) => r0 - i * d);
  const perRing = sainteLague(radii, total);

  // Seat positions: angle 0 (right) → π (left), dome opens upward (y negative)
  const rings: HemiSeat[][] = radii.map((r, ri) => {
    const n = perRing[ri];
    return Array.from({ length: n }, (_, j) => {
      const angle = n > 1 ? (j / (n - 1)) * PI : PI / 2;
      return { x: r10(r * Math.cos(angle)), y: r10(-r * Math.sin(angle)), r: seatR, fill: "#e2e8f0", party: "" };
    });
  });

  // Sort all positions by angle right→left so each party forms one contiguous wedge.
  // Dome center is at origin (0,0). atan2(-y, x): right≈0, top≈π/2, left≈π.
  const all = rings.flat();
  all.sort((a, b) => Math.atan2(-a.y, a.x) - Math.atan2(-b.y, b.x));

  // Build ordered seat list: coalition → unaligned → opposition
  const orderedSeats: { party: string; fill: string }[] = [];
  for (const key of HEMICYCLE_ORDER) {
    const n = seats[key] ?? 0;
    const colour = partyMeta[key]?.color ?? "#94a3b8";
    for (let s = 0; s < n; s++) orderedSeats.push({ party: key, fill: colour });
  }

  // Assign each ordered seat to its angle-sorted position
  for (let i = 0; i < all.length; i++) {
    const os = orderedSeats[i];
    if (os) { all[i].fill = os.fill; all[i].party = os.party; }
  }
  const pad = d / 2;
  return {
    seats: all,
    seatR,
    vb: [-(r0 + pad), -(r0 + pad), 2 * (r0 + pad), r0 + 2 * pad],
  };
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

function computeSeats(ts: ManualTimestamp, outletId: string): Record<string, number> {
  const polls = outletId === "average"
    ? ts.polls.filter(p => p.outlet_id !== "channel14")
    : ts.polls.filter(p => p.outlet_id === outletId);

  if (polls.length === 0) return {};
  if (polls.length === 1) return { ...polls[0].parties };

  const accum: Record<string, { sum: number; n: number }> = {};
  for (const poll of polls) {
    for (const [party, count] of Object.entries(poll.parties)) {
      if (count > 0) {
        if (!accum[party]) accum[party] = { sum: 0, n: 0 };
        accum[party].sum += count;
        accum[party].n++;
      }
    }
  }

  const averaged: Record<string, number> = {};
  for (const [party, { sum, n }] of Object.entries(accum)) {
    averaged[party] = Math.round(sum / n);
  }

  // Normalize to exactly 120 by adjusting the largest party
  const total = Object.values(averaged).reduce((a, b) => a + b, 0);
  const diff = 120 - total;
  if (diff !== 0 && Object.keys(averaged).length > 0) {
    const largest = Object.entries(averaged).sort((a, b) => b[1] - a[1])[0];
    averaged[largest[0]] = Math.max(0, averaged[largest[0]] + diff);
  }

  return averaged;
}


function computeBlocs(seats: Record<string, number>, partyMeta: Record<string, ManualPartyMeta>) {
  let coalition = 0, opposition = 0, unaligned = 0;
  for (const [key, count] of Object.entries(seats)) {
    const bloc = partyMeta[key]?.bloc;
    if (bloc === "coalition") coalition += count;
    else if (bloc === "opposition") opposition += count;
    else unaligned += count;
  }
  return { coalition, opposition, unaligned };
}

interface BarRow { key: string; name: string; shortName: string; seats: number; color: string; pct: number; }

function buildBarData(seats: Record<string, number>, partyMeta: Record<string, ManualPartyMeta>): BarRow[] {
  const rows = Object.entries(seats)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => ({
      key,
      name: partyMeta[key]?.name_he ?? key,
      shortName: SHORT_NAMES[key] ?? partyMeta[key]?.name_he ?? key,
      seats: n,
      color: partyMeta[key]?.color ?? "#94a3b8",
    }))
    .sort((a, b) => b.seats - a.seats);
  const max = rows[0]?.seats ?? 1;
  return rows.map(r => ({ ...r, pct: (r.seats / max) * 100 }));
}

// Returns all outlets with data for the timestamp, sorted by outlet_metadata.order.
// Walla and Maariv shown as separate pills (the JSON already has them as separate entries).
function getAvailableOutlets(
  ts: ManualTimestamp,
  outletMeta: Record<string, ManualOutletMeta>
): { id: string; name: string }[] {
  const ids = [...new Set(ts.polls.map(p => p.outlet_id))];
  const result = ids.map(id => ({ id, name: outletMeta[id]?.name ?? id }));
  result.sort((a, b) => (outletMeta[a.id]?.order ?? 99) - (outletMeta[b.id]?.order ?? 99));
  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { manualPolls: ManualPollsData; }

export default function KnessetHemicycle({ manualPolls }: Props) {
  const { timestamps, party_metadata: partyMeta, outlet_metadata: outletMeta } = manualPolls;

  const [dateId, setDateId] = useState(timestamps[timestamps.length - 1]?.id ?? "");
  const [outlet, setOutlet] = useState<string>("average");

  const dateIdx = timestamps.findIndex(t => t.id === dateId);
  const currentTs = timestamps[dateIdx] ?? timestamps[timestamps.length - 1];

  const availableOutlets = useMemo(
    () => (currentTs ? getAvailableOutlets(currentTs, outletMeta) : []),
    [currentTs, outletMeta]
  );
  const seats   = useMemo(() => (currentTs ? computeSeats(currentTs, outlet) : {}), [currentTs, outlet]);
  const hemi    = useMemo(() => generateHemicycleSeats(seats, partyMeta), [seats, partyMeta]);
  const blocs   = useMemo(() => computeBlocs(seats, partyMeta), [seats, partyMeta]);
  const barData = useMemo(() => buildBarData(seats, partyMeta), [seats, partyMeta]);

  // Majority line: midpoint between the 60th and 61st seats sorted right-to-left
  const majorityLineX = useMemo(() => {
    if (hemi.seats.length < 62) return 0;
    const sorted = [...hemi.seats].sort((a, b) => b.x - a.x);
    return (sorted[60].x + sorted[61].x) / 2;
  }, [hemi.seats]);

  function goTo(idx: number) {
    setDateId(timestamps[idx].id);
    setOutlet("average");
  }

  return (
    <>
      {/* ── Controls — separate card between hero and hemicycle ──────────── */}
      <div className="hemicycle-controls-section card fade-in">

        {/* Date navigation — dir="ltr" prevents RTL bidi-mirroring of arrow chars */}
        <div className="hemicycle-date-row" dir="ltr">
          <button
            className="date-nav-btn"
            onClick={() => goTo(dateIdx - 1)}
            disabled={dateIdx <= 0}
            aria-label="תאריך ישן יותר"
          >←</button>
          <select
            className="date-select"
            value={dateId}
            onChange={e => goTo(timestamps.findIndex(t => t.id === e.target.value))}
            aria-label="בחר תאריך"
          >
            {[...timestamps].reverse().map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <button
            className="date-nav-btn"
            onClick={() => goTo(dateIdx + 1)}
            disabled={dateIdx >= timestamps.length - 1}
            aria-label="תאריך חדש יותר"
          >→</button>
        </div>

        {/* Outlet pills */}
        <div className="outlet-pills-wrap" role="group" aria-label="בחר מקור סקר">
          <button
            className={`outlet-pill${outlet === "average" ? " active" : ""}`}
            onClick={() => setOutlet("average")}
          >ממוצע</button>
          {availableOutlets.map(o => (
            <button
              key={o.id}
              className={`outlet-pill${outlet === o.id ? " active" : ""}`}
              onClick={() => setOutlet(o.id)}
            >
              {o.name}
              <img
                src={`/images/outlets/${o.id}.png`}
                className="outlet-pill-icon"
                alt=""
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            </button>
          ))}
        </div>

        {outlet === "channel14" && (
          <p className="channel14-note">ערוץ 14 מבוסס על מכון פילבר הקשור פוליטית — אינו נכלל בממוצע</p>
        )}
      </div>

      {/* ── Hemicycle visualization card ─────────────────────────────────── */}
      <div className="card hemicycle-card fade-in" role="region" aria-label="מפת הכנסת">
        <div className="hemicycle-cols">

          {/* Left column (visual): SVG arc + bloc totals + party legend */}
          <div className="hemicycle-left-col">
            <div className="hemicycle-svg-wrap" aria-hidden="true">
              <svg
                viewBox={hemi.vb.join(" ")}
                className="hemicycle-svg"
              >
                {/* Majority line drawn FIRST — seats render on top, dots never clipped */}
                <line
                  x1={majorityLineX} y1={hemi.vb[1]}
                  x2={majorityLineX} y2={hemi.seatR}
                  stroke="#475569" strokeWidth="0.3" strokeDasharray="1 0.8"
                />
                {/* Seat circles — keyed on dateId+outlet so animations re-fire on data change */}
                <g key={dateId + outlet}>
                  {hemi.seats.map((s, i) => (
                    <circle
                      key={i}
                      cx={s.x} cy={s.y} r={s.r}
                      fill={s.fill}
                      className="hemicycle-seat"
                      style={{ animationDelay: `${i * 8}ms` } as React.CSSProperties}
                    />
                  ))}
                </g>
                {/* "61" label drawn last — always visible above dots */}
                <text
                  x={majorityLineX} y={hemi.vb[1] + 1.8}
                  textAnchor="middle" fontSize="1.5" fill="#64748b" fontWeight="700"
                >61</text>
              </svg>
            </div>

            {/* Bloc totals — always all three */}
            <div className="hemicycle-blocs">
              <span className="hemicycle-bloc hemicycle-bloc-right">
                ימין <strong>{blocs.coalition}</strong>
              </span>
              <span className="hemicycle-bloc hemicycle-bloc-unaligned">
                ערבי/עצמאי <strong>{blocs.unaligned}</strong>
              </span>
              <span className="hemicycle-bloc hemicycle-bloc-left">
                מרכז-שמאל <strong>{blocs.opposition}</strong>
              </span>
            </div>

            {/* Party color legend */}
            <div className="party-legend">
              {barData.map(row => (
                <span key={row.key} className="legend-chip">
                  <span className="legend-dot" style={{ background: row.color }} aria-hidden="true" />
                  {row.shortName}
                </span>
              ))}
            </div>
          </div>

          {/* Right column (visual): bar chart */}
          <div className="hemicycle-right-col">
            <div className="bar-chart-header">חלוקת מנדטים לפי מפלגה</div>
            <div className="bar-chart" role="list" aria-label="מנדטים לפי מפלגה">
              {barData.map(row => (
                <div key={row.key} className="bar-row" role="listitem">
                  <span className="bar-party-name" title={row.name}>{row.shortName}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${row.pct}%`, background: row.color }}
                    />
                  </div>
                  <span className="bar-seats-num">{row.seats}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
