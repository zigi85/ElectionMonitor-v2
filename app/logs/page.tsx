"use client";

import { useState, useEffect, useCallback } from "react";

interface ScriptRun {
  id: string;
  script_name: string;
  status: string;
  summary: string | null;
  records_count: number | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  trigger: string;
}

export default function LogsPage() {
  const [runs, setRuns] = useState<ScriptRun[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/script-runs");
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  return (
    <div className="logs-page">
      <div className="logs-header">
        <h1>לוג ריצות</h1>
        <button className="editor-btn" onClick={loadRuns} style={{ fontSize: 12, padding: "4px 10px" }}>
          רענן
        </button>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>טוען...</p>
      ) : runs.length === 0 ? (
        <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>אין ריצות עדיין</p>
      ) : (
        <div className="run-log-table-wrap">
          <table className="run-log-table">
            <thead>
              <tr>
                <th>סקריפט</th>
                <th>סטטוס</th>
                <th>סיכום</th>
                <th>התחלה</th>
                <th>משך</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const start = new Date(run.started_at);
                const end = run.completed_at ? new Date(run.completed_at) : null;
                const durationSec = end ? Math.round((end.getTime() - start.getTime()) / 1000) : null;
                const durationStr = durationSec !== null
                  ? durationSec < 60 ? `${durationSec}s` : `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`
                  : "—";
                const statusClass = run.status === "success" ? "run-ok" : run.status === "error" ? "run-err" : "run-pending";
                const statusLabel = run.status === "success" ? "הצלחה" : run.status === "error" ? "שגיאה" : "רץ...";
                return (
                  <tr key={run.id}>
                    <td className="run-script-name">{run.script_name.replace(/_/g, " ")}</td>
                    <td><span className={`run-badge ${statusClass}`}>{statusLabel}</span></td>
                    <td className="run-summary" dir="auto">{run.error_message || run.summary || "—"}</td>
                    <td className="run-time">{start.toLocaleString("he-IL", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" })}</td>
                    <td className="run-time">{durationStr}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
