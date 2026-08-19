"use client";

import { useState, useEffect, useCallback } from "react";

interface EditorialNote {
  text: string;
  url?: string;
}

interface DigestChange {
  text: string;
  type: string;
  direction: string;
  magnitude: string;
}

interface Digest {
  generated_at?: string;
  model?: string;
  changes: DigestChange[];
  story: { title?: string; body?: string };
}

interface EditorialNotes {
  date: string;
  notes: EditorialNote[];
}

interface ScriptInfo {
  id: string;
  label: string;
}

const TYPE_OPTIONS = [
  { value: "poll", label: "סקר" },
  { value: "market", label: "שוק ניבוי" },
  { value: "media", label: "תקשורת" },
  { value: "trend", label: "טרנד" },
  { value: "buzz", label: "באזז" },
];

const DIR_OPTIONS = [
  { value: "up", label: "עלייה ↑" },
  { value: "down", label: "ירידה ↓" },
  { value: "neutral", label: "יציב ↔" },
];

const MAG_OPTIONS = [
  { value: "big", label: "גדול" },
  { value: "medium", label: "בינוני" },
  { value: "small", label: "קטן" },
];

function normalizeNotes(raw: unknown[]): EditorialNote[] {
  return raw.map((n) =>
    typeof n === "string" ? { text: n } : (n as EditorialNote),
  );
}

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, totp }),
      });
      const data = await res.json();
      if (data.ok) {
        onLogin();
      } else if (data.error === "auth_not_configured") {
        setError("האימות לא הוגדר. הרץ: node scripts/setup_editor_auth.js");
      } else {
        setError("סיסמה או קוד אימות שגויים");
      }
    } catch {
      setError("שגיאת רשת");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="editor-login-wrap">
      <form className="editor-login-card" onSubmit={submit}>
        <h1>כניסת עורך</h1>
        <p className="editor-hint">ממשק עריכת הדייג'סט מוגן באימות כפול.</p>
        <label className="editor-field-label">סיסמה</label>
        <input type="password" className="editor-field" value={password}
          onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus />
        <label className="editor-field-label">קוד אימות (Authenticator)</label>
        <input type="text" className="editor-field editor-field-totp" value={totp}
          onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric" maxLength={6} placeholder="000000" autoComplete="one-time-code" />
        {error && <div className="editor-status editor-status-error">{error}</div>}
        <button type="submit" className="editor-btn editor-btn-save editor-btn-login"
          disabled={loading || !password || totp.length !== 6}>
          {loading ? "מתחבר..." : "כניסה"}
        </button>
      </form>
    </div>
  );
}

function ChangeEditor({ change, onChange, onRemove }: {
  change: DigestChange;
  onChange: (c: DigestChange) => void;
  onRemove: () => void;
}) {
  return (
    <div className="editor-change-card">
      <div className="editor-change-top">
        <select className="editor-select" value={change.direction}
          onChange={(e) => onChange({ ...change, direction: e.target.value })}>
          {DIR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="editor-select" value={change.type}
          onChange={(e) => onChange({ ...change, type: e.target.value })}>
          {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="editor-select" value={change.magnitude}
          onChange={(e) => onChange({ ...change, magnitude: e.target.value })}>
          {MAG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button className="editor-remove-btn" onClick={onRemove} title="הסר">&times;</button>
      </div>
      <textarea className="editor-change-text" value={change.text} rows={2}
        onChange={(e) => onChange({ ...change, text: e.target.value })} />
    </div>
  );
}

function ScriptRunner({ scripts }: { scripts: ScriptInfo[] }) {
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [disabled, setDisabled] = useState<Record<string, boolean>>({});

  const runScript = async (scriptId: string) => {
    setRunning((prev) => ({ ...prev, [scriptId]: true }));
    setResults((prev) => { const n = { ...prev }; delete n[scriptId]; return n; });
    try {
      const res = await fetch("/api/run-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptId }),
      });
      const data = await res.json();
      if (data.ok) {
        setResults((prev) => ({ ...prev, [scriptId]: { ok: true, message: "הסתיים בהצלחה" } }));
      } else {
        setResults((prev) => ({ ...prev, [scriptId]: { ok: false, message: data.error || "שגיאה" } }));
      }
    } catch (e) {
      setResults((prev) => ({
        ...prev,
        [scriptId]: { ok: false, message: e instanceof Error ? e.message : "שגיאת רשת" },
      }));
    } finally {
      setRunning((prev) => ({ ...prev, [scriptId]: false }));
    }
  };

  const toggleDisabled = (scriptId: string) => {
    setDisabled((prev) => ({ ...prev, [scriptId]: !prev[scriptId] }));
  };

  const runAll = async () => {
    const enabled = scripts.filter((s) => !disabled[s.id]);
    for (const s of enabled) {
      await runScript(s.id);
    }
  };

  const anyRunning = Object.values(running).some(Boolean);

  return (
    <div className="editor-scripts">
      <div className="editor-scripts-list">
        {scripts.map((s) => (
          <div key={s.id} className={`editor-script-row ${disabled[s.id] ? "editor-script-disabled" : ""}`}>
            <label className="editor-script-toggle">
              <input type="checkbox" checked={!disabled[s.id]}
                onChange={() => toggleDisabled(s.id)} />
              <span className="editor-toggle-slider" />
            </label>
            <span className="editor-script-name">{s.label}</span>
            <button className="editor-btn editor-btn-run"
              onClick={() => runScript(s.id)}
              disabled={running[s.id] || disabled[s.id]}>
              {running[s.id] ? "רץ..." : "הרץ"}
            </button>
            {results[s.id] && (
              <span className={`editor-script-result ${results[s.id].ok ? "editor-script-ok" : "editor-script-err"}`}>
                {results[s.id].message}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="editor-actions">
        <button className="editor-btn editor-btn-run-all" onClick={runAll} disabled={anyRunning}>
          {anyRunning ? "מריץ..." : "הרץ הכל"}
        </button>
      </div>
    </div>
  );
}

export default function EditorPage() {
  const [authState, setAuthState] = useState<"checking" | "login" | "editor">("checking");
  const [notes, setNotes] = useState<EditorialNotes>({ date: "", notes: [] });
  const [draft, setDraft] = useState<Digest | null>(null);
  const [live, setLive] = useState<Digest | null>(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [scripts, setScripts] = useState<ScriptInfo[]>([]);

  const hasDraft = draft !== null;
  const draftDiffers = hasDraft && JSON.stringify(draft) !== JSON.stringify(live);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/check");
      const data = await res.json();
      setAuthState(!data.configured || data.authenticated ? "editor" : "login");
    } catch {
      setAuthState("login");
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const load = useCallback(async () => {
    const [notesRes, digestRes, scriptsRes] = await Promise.all([
      fetch("/api/editorial-notes"),
      fetch("/api/draft-digest"),
      fetch("/api/run-script"),
    ]);
    if (notesRes.ok) {
      const raw = await notesRes.json();
      setNotes({ date: raw.date || "", notes: normalizeNotes(raw.notes || []) });
    }
    if (digestRes.ok) {
      const data = await digestRes.json();
      if (data.draft) {
        setDraft(data.draft);
      } else if (data.live) {
        setDraft(JSON.parse(JSON.stringify(data.live)));
      }
      setLive(data.live);
    }
    if (scriptsRes.ok) {
      const data = await scriptsRes.json();
      setScripts(data.scripts || []);
    }
  }, []);

  useEffect(() => {
    if (authState === "editor") load();
  }, [authState, load]);

  const saveNotes = async () => {
    setSaving(true);
    setStatus("");
    try {
      const res = await fetch("/api/editorial-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notes),
      });
      if (res.ok) {
        const raw = await res.json();
        setNotes({ date: raw.date, notes: normalizeNotes(raw.notes || []) });
        setStatus("notes_saved");
      }
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    setStatus("");
    try {
      const res = await fetch("/api/draft-digest", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) setStatus("draft_saved");
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async () => {
    setRegenerating(true);
    setStatus("");
    try {
      const res = await fetch("/api/regenerate-digest", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setDraft(data.digest ?? null);
        setStatus("draft_generated");
      } else {
        setStatus("error: " + (data.error || "unknown"));
      }
    } catch (e) {
      setStatus("error: " + (e instanceof Error ? e.message : "network"));
    } finally {
      setRegenerating(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    setStatus("");
    try {
      if (draft) {
        await fetch("/api/draft-digest", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
      }
      const res = await fetch("/api/publish-digest", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setLive(data.digest);
        setStatus("published");
        setConfirmPublish(false);
      } else {
        setStatus("error: " + (data.error || "publish failed"));
      }
    } finally {
      setPublishing(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthState("login");
  };

  const addNote = () => {
    const text = newNote.trim();
    if (!text) return;
    const note: EditorialNote = { text };
    if (newUrl.trim()) note.url = newUrl.trim();
    setNotes((prev) => ({
      date: prev.date || new Date().toISOString().slice(0, 10),
      notes: [...prev.notes, note],
    }));
    setNewNote("");
    setNewUrl("");
  };

  const removeNote = (idx: number) => {
    setNotes((prev) => ({ ...prev, notes: prev.notes.filter((_, i) => i !== idx) }));
  };

  const updateNoteText = (idx: number, text: string) => {
    setNotes((prev) => ({
      ...prev, notes: prev.notes.map((n, i) => (i === idx ? { ...n, text } : n)),
    }));
  };

  const updateNoteUrl = (idx: number, url: string) => {
    setNotes((prev) => ({
      ...prev, notes: prev.notes.map((n, i) => (i === idx ? { ...n, url: url || undefined } : n)),
    }));
  };

  const updateChange = (idx: number, change: DigestChange) => {
    if (!draft) return;
    setDraft({
      ...draft,
      changes: draft.changes.map((c, i) => (i === idx ? change : c)),
    });
  };

  const removeChange = (idx: number) => {
    if (!draft) return;
    setDraft({ ...draft, changes: draft.changes.filter((_, i) => i !== idx) });
  };

  const addChange = () => {
    if (!draft) return;
    setDraft({
      ...draft,
      changes: [...draft.changes, { text: "", type: "poll", direction: "up", magnitude: "medium" }],
    });
  };

  const updateStory = (field: "title" | "body", value: string) => {
    if (!draft) return;
    setDraft({ ...draft, story: { ...draft.story, [field]: value } });
  };

  if (authState === "checking") {
    return (
      <div className="editor-login-wrap">
        <div className="editor-login-card">
          <p style={{ textAlign: "center", color: "var(--text-muted)" }}>בודק הרשאות...</p>
        </div>
      </div>
    );
  }

  if (authState === "login") {
    return <LoginForm onLogin={() => setAuthState("editor")} />;
  }

  const statusText: Record<string, string> = {
    notes_saved: "ההערות נשמרו בהצלחה",
    draft_saved: "הטיוטה נשמרה",
    draft_generated: "טיוטת דייג'סט נוצרה — ניתן לערוך ולפרסם",
    published: "הדייג'סט פורסם בהצלחה!",
  };

  return (
    <div className="editor-page">
      <header className="editor-header">
        <h1>עורך דייג'סט יומי</h1>
        <span className="editor-date">{notes.date || "---"}</span>
        <button className="editor-btn editor-btn-logout" onClick={logout}>יציאה</button>
      </header>

      <div className="editor-grid">
        {/* Left column: Editorial Notes */}
        <section className="editor-card">
          <h2>הערות עריכתיות</h2>
          <p className="editor-hint">הקשרים ומידע שהעורך רוצה שיופיעו בדייג'סט. אפשר לצרף לינק למקור.</p>

          <div className="editor-notes-list">
            {notes.notes.map((note, i) => (
              <div key={i} className="editor-note-card">
                <div className="editor-note-row">
                  <textarea className="editor-note-input" value={note.text}
                    onChange={(e) => updateNoteText(i, e.target.value)} rows={2} />
                  <button className="editor-remove-btn" onClick={() => removeNote(i)} title="הסר">&times;</button>
                </div>
                <div className="editor-url-row">
                  <span className="editor-url-icon">&#128279;</span>
                  <input type="url" className="editor-url-input" placeholder="לינק למקור (אופציונלי)"
                    value={note.url || ""} onChange={(e) => updateNoteUrl(i, e.target.value)} />
                </div>
              </div>
            ))}
          </div>

          <div className="editor-note-card editor-note-card-new">
            <div className="editor-note-row">
              <textarea className="editor-note-input" placeholder="הוסף הערה חדשה..." value={newNote}
                onChange={(e) => setNewNote(e.target.value)} rows={2}
                onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); addNote(); } }} />
              <button className="editor-add-btn" onClick={addNote}>+</button>
            </div>
            <div className="editor-url-row">
              <span className="editor-url-icon">&#128279;</span>
              <input type="url" className="editor-url-input" placeholder="לינק למקור (אופציונלי)"
                value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
            </div>
          </div>

          <div className="editor-actions">
            <button className="editor-btn editor-btn-save" onClick={saveNotes} disabled={saving}>
              {saving ? "שומר..." : "שמור הערות"}
            </button>
            <button className="editor-btn editor-btn-regen" onClick={regenerate} disabled={regenerating}>
              {regenerating ? "מייצר טיוטה..." : "ייצר טיוטה חדשה"}
            </button>
          </div>
        </section>

        {/* Right column: Draft Editor */}
        <section className="editor-card">
          <div className="editor-draft-header">
            <h2>
              טיוטה
              {hasDraft && draftDiffers && <span className="editor-draft-badge">טרם פורסם</span>}
              {hasDraft && !draftDiffers && <span className="editor-published-badge">מפורסם</span>}
            </h2>
          </div>

          {hasDraft && (
            <>
              {draft.generated_at && (
                <span className="editor-meta">
                  נוצר: {new Date(draft.generated_at).toLocaleString("he-IL")} | {draft.model}
                </span>
              )}

              <div className="editor-story-edit">
                <h3>הסיפור של היום</h3>
                <input type="text" className="editor-story-title"
                  placeholder="כותרת הסיפור"
                  value={draft.story?.title || ""}
                  onChange={(e) => updateStory("title", e.target.value)} />
                <textarea className="editor-story-body"
                  placeholder="גוף הסיפור"
                  value={draft.story?.body || ""}
                  onChange={(e) => updateStory("body", e.target.value)}
                  rows={5} />
              </div>

              <div className="editor-changes-edit">
                <div className="editor-changes-header">
                  <h3>מה השתנה היום?</h3>
                  <button className="editor-btn editor-btn-add" onClick={addChange}>+ הוסף בולט</button>
                </div>

                {draft.changes.map((c, i) => (
                  <ChangeEditor key={i} change={c}
                    onChange={(updated) => updateChange(i, updated)}
                    onRemove={() => removeChange(i)} />
                ))}
              </div>

              <div className="editor-actions editor-draft-actions">
                <button className="editor-btn editor-btn-save" onClick={saveDraft} disabled={saving}>
                  {saving ? "שומר..." : "שמור טיוטה"}
                </button>

                {!confirmPublish ? (
                  <button className="editor-btn editor-btn-publish" onClick={() => setConfirmPublish(true)}>
                    פרסם דייג'סט
                  </button>
                ) : (
                  <div className="editor-confirm-wrap">
                    <span className="editor-confirm-text">בטוח לפרסם?</span>
                    <button className="editor-btn editor-btn-publish" onClick={publish} disabled={publishing}>
                      {publishing ? "מפרסם..." : "אשר פרסום"}
                    </button>
                    <button className="editor-btn editor-btn-cancel" onClick={() => setConfirmPublish(false)}>
                      ביטול
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {!hasDraft && (
            <p className="editor-hint">אין דייג'סט עדיין. צור טיוטה חדשה מהעמודה השמאלית.</p>
          )}
        </section>
      </div>

      {/* Scripts / Cron management */}
      {scripts.length > 0 && (
        <section className="editor-card editor-card-scripts">
          <h2>עדכון נתונים</h2>
          <p className="editor-hint">הרצה ידנית של סקריפטים לעדכון מקורות מידע. ניתן להפעיל/לכבות כל סקריפט.</p>
          <ScriptRunner scripts={scripts} />
        </section>
      )}

      {status && (
        <div className={`editor-toast ${status.startsWith("error") ? "editor-toast-error" : "editor-toast-ok"}`}>
          {statusText[status] || status}
        </div>
      )}
    </div>
  );
}
