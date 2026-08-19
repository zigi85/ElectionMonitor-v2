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

const TYPE_LABELS: Record<string, string> = {
  poll: "סקר",
  market: "שוק ניבוי",
  media: "תקשורת",
  trend: "טרנד",
  buzz: "באזז",
};

const DIR_ICONS: Record<string, string> = {
  up: "↑",
  down: "↓",
  neutral: "↔",
};

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
        <input
          type="password"
          className="editor-field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
        />

        <label className="editor-field-label">קוד אימות (Authenticator)</label>
        <input
          type="text"
          className="editor-field editor-field-totp"
          value={totp}
          onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          autoComplete="one-time-code"
        />

        {error && <div className="editor-status editor-status-error">{error}</div>}

        <button
          type="submit"
          className="editor-btn editor-btn-save editor-btn-login"
          disabled={loading || !password || totp.length !== 6}
        >
          {loading ? "מתחבר..." : "כניסה"}
        </button>
      </form>
    </div>
  );
}

export default function EditorPage() {
  const [authState, setAuthState] = useState<"checking" | "login" | "editor">("checking");
  const [notes, setNotes] = useState<EditorialNotes>({ date: "", notes: [] });
  const [digest, setDigest] = useState<Digest | null>(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/check");
      const data = await res.json();
      if (!data.configured || data.authenticated) {
        setAuthState("editor");
      } else {
        setAuthState("login");
      }
    } catch {
      setAuthState("login");
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const load = useCallback(async () => {
    const [notesRes, digestRes] = await Promise.all([
      fetch("/api/editorial-notes"),
      fetch("/api/daily-digest"),
    ]);
    if (notesRes.ok) {
      const raw = await notesRes.json();
      setNotes({ date: raw.date || "", notes: normalizeNotes(raw.notes || []) });
    }
    if (digestRes.ok) setDigest(await digestRes.json());
  }, []);

  useEffect(() => {
    if (authState === "editor") load();
  }, [authState, load]);

  const save = async () => {
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
        setStatus("saved");
      }
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
        setDigest(data.digest ?? null);
        setStatus("regenerated");
        if (!data.digest) await load();
      } else {
        setStatus("error: " + (data.error || "unknown"));
      }
    } catch (e) {
      setStatus("error: " + (e instanceof Error ? e.message : "network"));
    } finally {
      setRegenerating(false);
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
    setNotes((prev) => ({
      ...prev,
      notes: prev.notes.filter((_, i) => i !== idx),
    }));
  };

  const updateNoteText = (idx: number, text: string) => {
    setNotes((prev) => ({
      ...prev,
      notes: prev.notes.map((n, i) => (i === idx ? { ...n, text } : n)),
    }));
  };

  const updateNoteUrl = (idx: number, url: string) => {
    setNotes((prev) => ({
      ...prev,
      notes: prev.notes.map((n, i) => (i === idx ? { ...n, url: url || undefined } : n)),
    }));
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
    return <LoginForm onLogin={() => { setAuthState("editor"); }} />;
  }

  return (
    <div className="editor-page">
      <header className="editor-header">
        <h1>עורך דייג'סט יומי</h1>
        <span className="editor-date">{notes.date || "---"}</span>
        <button className="editor-btn editor-btn-logout" onClick={logout}>
          יציאה
        </button>
      </header>

      <div className="editor-grid">
        <section className="editor-card">
          <h2>הערות עריכתיות</h2>
          <p className="editor-hint">
            הקשרים ומידע שהעורך רוצה שיופיעו בדייג'סט. אפשר לצרף לינק למקור.
          </p>

          <div className="editor-notes-list">
            {notes.notes.map((note, i) => (
              <div key={i} className="editor-note-card">
                <div className="editor-note-row">
                  <textarea
                    className="editor-note-input"
                    value={note.text}
                    onChange={(e) => updateNoteText(i, e.target.value)}
                    rows={2}
                  />
                  <button
                    className="editor-remove-btn"
                    onClick={() => removeNote(i)}
                    title="הסר"
                  >
                    &times;
                  </button>
                </div>
                <div className="editor-url-row">
                  <span className="editor-url-icon">&#128279;</span>
                  <input
                    type="url"
                    className="editor-url-input"
                    placeholder="לינק למקור (אופציונלי)"
                    value={note.url || ""}
                    onChange={(e) => updateNoteUrl(i, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="editor-note-card editor-note-card-new">
            <div className="editor-note-row">
              <textarea
                className="editor-note-input"
                placeholder="הוסף הערה חדשה..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey) {
                    e.preventDefault();
                    addNote();
                  }
                }}
              />
              <button className="editor-add-btn" onClick={addNote}>
                +
              </button>
            </div>
            <div className="editor-url-row">
              <span className="editor-url-icon">&#128279;</span>
              <input
                type="url"
                className="editor-url-input"
                placeholder="לינק למקור (אופציונלי)"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="editor-actions">
            <button
              className="editor-btn editor-btn-save"
              onClick={save}
              disabled={saving}
            >
              {saving ? "שומר..." : "שמור הערות"}
            </button>
            <button
              className="editor-btn editor-btn-regen"
              onClick={regenerate}
              disabled={regenerating}
            >
              {regenerating ? "מייצר דייג'סט..." : "ייצר דייג'סט מחדש"}
            </button>
          </div>

          {status && (
            <div
              className={`editor-status ${status.startsWith("error") ? "editor-status-error" : "editor-status-ok"}`}
            >
              {status === "saved"
                ? "ההערות נשמרו בהצלחה"
                : status === "regenerated"
                  ? "הדייג'סט נוצר מחדש בהצלחה"
                  : status}
            </div>
          )}
        </section>

        <section className="editor-card">
          <h2>דייג'סט נוכחי</h2>
          {digest?.generated_at && (
            <span className="editor-meta">
              נוצר: {new Date(digest.generated_at).toLocaleString("he-IL")} |{" "}
              {digest.model}
            </span>
          )}

          {digest?.story?.title && (
            <div className="editor-story">
              <h3>{digest.story.title}</h3>
              <p>{digest.story.body}</p>
            </div>
          )}

          <div className="editor-changes">
            <h3>שינויים</h3>
            {digest?.changes.map((c, i) => (
              <div key={i} className="editor-change-row">
                <span className="editor-change-dir">
                  {DIR_ICONS[c.direction] || ""}
                </span>
                <span className="editor-change-type">
                  {TYPE_LABELS[c.type] || c.type}
                </span>
                <span className="editor-change-text">{c.text}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
