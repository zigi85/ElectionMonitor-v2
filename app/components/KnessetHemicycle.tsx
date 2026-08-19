"use client";

import { useState, useMemo, Fragment } from "react";
import type { ManualPollsData, ManualTimestamp, ManualPartyMeta, ManualOutletMeta } from "@/lib/types";

const ARAB_PARTIES = new Set(["raam", "hadash_taal", "joint_list", "balad"]);

type DisplayBloc = "netanyahu" | "zionist" | "arab" | "opposition";

const BLOC_COLORS: Record<DisplayBloc, string> = {
  netanyahu: "#FE6969",
  opposition: "#42ABFF",
  zionist: "#FFAB70",
  arab: "#FFD6D6",
};

const BLOC_LABELS: Record<DisplayBloc, string> = {
  netanyahu: "קואליציה",
  zionist: "בית ציוני",
  arab: "מפלגות ערביות",
  opposition: "אופוזיציה",
};

const BLOC_ORDER: DisplayBloc[] = ["netanyahu", "zionist", "arab", "opposition"];

function getDisplayBloc(key: string, bloc: string): DisplayBloc {
  if (ARAB_PARTIES.has(key)) return "arab";
  if (bloc === "coalition") return "netanyahu";
  if (bloc === "opposition") return "opposition";
  return "zionist";
}

const SHORT_NAMES: Record<string, string> = {
  religious_zionism: "ציונות דתית",
};

function computeSeats(ts: ManualTimestamp, outletId: string): Record<string, number> {
  const polls = outletId === "average"
    ? ts.polls
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

  const total = Object.values(averaged).reduce((a, b) => a + b, 0);
  const diff = 120 - total;
  if (diff !== 0 && Object.keys(averaged).length > 0) {
    const largest = Object.entries(averaged).sort((a, b) => b[1] - a[1])[0];
    averaged[largest[0]] = Math.max(0, averaged[largest[0]] + diff);
  }

  return averaged;
}

function computeDisplayBlocs(seats: Record<string, number>, partyMeta: Record<string, ManualPartyMeta>) {
  const blocs: Record<DisplayBloc, number> = { netanyahu: 0, zionist: 0, arab: 0, opposition: 0 };
  for (const [key, count] of Object.entries(seats)) {
    const db = getDisplayBloc(key, partyMeta[key]?.bloc ?? "unaligned");
    blocs[db] += count;
  }
  return blocs;
}

interface BarRow { key: string; name: string; shortName: string; seats: number; pct: number; }

function buildSplitBarData(
  seats: Record<string, number>,
  partyMeta: Record<string, ManualPartyMeta>
): { right: BarRow[]; left: BarRow[] } {
  const right: BarRow[] = [];
  const left: BarRow[] = [];

  for (const [key, count] of Object.entries(seats)) {
    if (count <= 0) continue;
    const meta = partyMeta[key];
    const row: BarRow = {
      key,
      name: meta?.name_he ?? key,
      shortName: SHORT_NAMES[key] ?? meta?.name_he ?? key,
      seats: count,
      pct: 0,
    };
    if (meta?.bloc === "coalition") right.push(row);
    else left.push(row);
  }

  right.sort((a, b) => b.seats - a.seats);
  left.sort((a, b) => b.seats - a.seats);

  const maxAll = Math.max(...right.map(r => r.seats), ...left.map(r => r.seats), 1);
  right.forEach(r => { r.pct = (r.seats / maxAll) * 100; });
  left.forEach(r => { r.pct = (r.seats / maxAll) * 100; });

  return { right, left };
}

function getAvailableOutlets(
  ts: ManualTimestamp,
  outletMeta: Record<string, ManualOutletMeta>
): { id: string; name: string }[] {
  const ids = [...new Set(ts.polls.map(p => p.outlet_id))];
  const result = ids.map(id => ({ id, name: outletMeta[id]?.name ?? id }));
  result.sort((a, b) => (outletMeta[a.id]?.order ?? 99) - (outletMeta[b.id]?.order ?? 99));
  return result;
}

function ArcChart({ blocs }: { blocs: Record<DisplayBloc, number> }) {
  const total = 120;
  const CX = 200;
  const CY = 200;
  const R = 170;
  const STROKE = 60;
  const circumference = 2 * Math.PI * R;
  const halfCirc = circumference / 2;

  const arcOrder: DisplayBloc[] = ["opposition", "arab", "zionist", "netanyahu"];

  let cumOffset = 0;
  const segments = arcOrder.map(bloc => {
    const seats = blocs[bloc] || 0;
    const length = (seats / total) * halfCirc;
    const seg = { bloc, color: BLOC_COLORS[bloc], length, offset: cumOffset };
    cumOffset += length;
    return seg;
  });

  return (
    <svg viewBox="0 0 400 205" className="arc-chart-svg" aria-hidden="true">
      <circle
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={STROKE}
        strokeDasharray={`${halfCirc} ${circumference}`}
        transform={`rotate(180 ${CX} ${CY})`}
      />
      {segments.map(seg => (
        <circle
          key={seg.bloc}
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke={seg.color}
          strokeWidth={STROKE}
          strokeDasharray={`${seg.length} ${circumference}`}
          strokeDashoffset={-seg.offset}
          transform={`rotate(180 ${CX} ${CY})`}
        />
      ))}
    </svg>
  );
}

interface Props { manualPolls: ManualPollsData; }

export default function KnessetHemicycle({ manualPolls }: Props) {
  const { timestamps, party_metadata: partyMeta, outlet_metadata: outletMeta } = manualPolls;

  const [dateId, setDateId] = useState(timestamps[timestamps.length - 1]?.id ?? "");
  const [outlet, setOutlet] = useState<string>("average");
  const [showAll, setShowAll] = useState(false);
  const MOBILE_LIMIT = 4;

  const dateIdx = timestamps.findIndex(t => t.id === dateId);
  const currentTs = timestamps[dateIdx] ?? timestamps[timestamps.length - 1];

  const availableOutlets = useMemo(
    () => (currentTs ? getAvailableOutlets(currentTs, outletMeta) : []),
    [currentTs, outletMeta]
  );
  const seats = useMemo(() => (currentTs ? computeSeats(currentTs, outlet) : {}), [currentTs, outlet]);
  const blocs = useMemo(() => computeDisplayBlocs(seats, partyMeta), [seats, partyMeta]);
  const { right: coalitionBars, left: oppositionBars } = useMemo(
    () => buildSplitBarData(seats, partyMeta),
    [seats, partyMeta]
  );

  const allBars = useMemo(() => {
    const merged = [...coalitionBars, ...oppositionBars];
    merged.sort((a, b) => b.seats - a.seats);
    const max = Math.max(...merged.map(r => r.seats), 1);
    merged.forEach(r => { r.pct = (r.seats / max) * 100; });
    return merged;
  }, [coalitionBars, oppositionBars]);

  function goTo(idx: number) {
    setDateId(timestamps[idx].id);
    setOutlet("average");
  }

  return (
    <>
      <div className="hemicycle-controls-section card">
        <h2 className="cb-title">קרב הקואליציה</h2>

        <div className="hemicycle-date-row" dir="ltr">
          <button className="date-nav-btn" onClick={() => goTo(dateIdx - 1)} disabled={dateIdx <= 0} aria-label="תאריך ישן יותר">←</button>
          <select className="date-select" value={dateId} onChange={e => goTo(timestamps.findIndex(t => t.id === e.target.value))} aria-label="בחר תאריך">
            {[...timestamps].reverse().map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <button className="date-nav-btn" onClick={() => goTo(dateIdx + 1)} disabled={dateIdx >= timestamps.length - 1} aria-label="תאריך חדש יותר">→</button>
        </div>

        <div className="outlet-pills-wrap" role="group" aria-label="בחר מקור סקר">
          <button
            className={`outlet-pill outlet-pill-avg${outlet === "average" ? " active" : ""}`}
            onClick={() => setOutlet("average")}
            style={outlet === "average"
              ? { background: "#69C5FE", borderColor: "#69C5FE", color: "#fff" }
              : { background: "transparent", border: "1px solid rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.7)" }
            }
          >ממוצע</button>
          {availableOutlets.filter(o => o.id !== "walla").map(o => {
            const isActive = outlet === o.id;
            return (
              <button
                key={o.id}
                className={`outlet-pill${isActive ? " active" : ""}`}
                onClick={() => setOutlet(o.id)}
                aria-label={o.name}
                style={isActive ? { background: "#fff", borderColor: "transparent" } : undefined}
              >
                <img
                  src={isActive ? `/images/outlets/${o.id}-color.png` : `/images/outlets/${o.id}.png`}
                  className="outlet-pill-icon"
                  alt={o.name}
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    const fallback = `/images/outlets/${o.id}.png`;
                    if (!img.src.endsWith(`/${o.id}.png`)) {
                      img.src = fallback;
                    } else {
                      img.style.display = "none";
                      (img.parentElement as HTMLElement).insertAdjacentText("afterbegin", o.name);
                    }
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="card hemicycle-card" role="region" aria-label="קרב הקואליציה">
        <div className="cb-blocs-row">
          {BLOC_ORDER.map((bloc, i) => (
            <Fragment key={bloc}>
              {i > 0 && <div className="cb-bloc-divider" />}
              <div className="cb-bloc-item">
                <span className="cb-bloc-label" style={{ color: BLOC_COLORS[bloc] }}>{BLOC_LABELS[bloc]}</span>
                <span className="cb-bloc-num">{blocs[bloc]}</span>
              </div>
            </Fragment>
          ))}
        </div>

        <div className="cb-hemicycle-area" dir="ltr">
          <div className="cb-politician">
            <img src="/images/eisenkot.png" alt="אייזנקוט" />
          </div>
          <div className="cb-hemicycle-center">
            <ArcChart blocs={blocs} />
            <div className="cb-total-label">
              <span className="cb-total-num">120</span>
              <span className="cb-total-text">מנדטים</span>
            </div>
          </div>
          <div className="cb-politician">
            <img src="/images/netanyahu.png" alt="נתניהו" />
          </div>
        </div>

        {/* Mobile: single merged list */}
        <div className="cb-bars-mobile">
          <div className="cb-bars-col">
            {(showAll ? allBars : allBars.slice(0, MOBILE_LIMIT)).map(row => (
              <div key={row.key} className="cb-bar-row" role="listitem">
                <span className="cb-bar-num">{row.seats}</span>
                <div className="cb-bar-track">
                  <div className="cb-bar-fill" style={{ width: `${row.pct}%` }} />
                </div>
                <span className="cb-bar-name">{row.shortName}</span>
              </div>
            ))}
          </div>

          {allBars.length > MOBILE_LIMIT && (
            <div className="cb-see-more-wrap">
              <button className="cb-see-more-btn" onClick={() => setShowAll(prev => !prev)}>
                {showAll ? "ראה פחות" : "ראה עוד"}
                <span className={`cb-see-more-chevron${showAll ? " expanded" : ""}`}>▼</span>
              </button>
            </div>
          )}
        </div>

        {/* Desktop: two-column split */}
        <div className="cb-bars-split">
          <div className="cb-bars-col cb-bars-coalition">
            {coalitionBars.map(row => (
              <div key={row.key} className="cb-bar-row" role="listitem">
                <span className="cb-bar-name">{row.shortName}</span>
                <div className="cb-bar-track">
                  <div className="cb-bar-fill" style={{ width: `${row.pct}%` }} />
                </div>
                <span className="cb-bar-num">{row.seats}</span>
              </div>
            ))}
          </div>
          <div className="cb-bars-col cb-bars-opposition">
            {oppositionBars.map(row => (
              <div key={row.key} className="cb-bar-row" role="listitem">
                <span className="cb-bar-name">{row.shortName}</span>
                <div className="cb-bar-track">
                  <div className="cb-bar-fill" style={{ width: `${row.pct}%` }} />
                </div>
                <span className="cb-bar-num">{row.seats}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
