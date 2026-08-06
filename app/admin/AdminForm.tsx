"use client";

import { useState } from "react";

interface AdminFormProps {
  currentJson: string;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontFamily: "'Heebo', sans-serif",
  fontSize: 14,
  direction: "rtl",
  background: "#fff",
  marginTop: 4,
  marginBottom: 12,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
};

export default function AdminForm({ currentJson }: AdminFormProps) {
  const [reporter, setReporter] = useState("");
  const [role, setRole] = useState("כתב פוליטי בכיר");
  const [initials, setInitials] = useState("");
  const [avatarColor, setAvatarColor] = useState("#1a2f7a");
  const [quote, setQuote] = useState("");
  const [articleUrl, setArticleUrl] = useState("https://www.israelhayom.co.il");
  const [articleTitle, setArticleTitle] = useState("");
  const [generated, setGenerated] = useState("");

  function generate() {
    const entry = {
      id: `editorial-${Date.now()}`,
      reporter,
      role,
      initials,
      avatar_color: avatarColor,
      quote,
      article_url: articleUrl,
      article_title: articleTitle,
      published_at: new Date().toISOString(),
    };
    const json = JSON.stringify({ updated_at: new Date().toISOString(), entries: [entry] }, null, 2);
    setGenerated(json);
  }

  return (
    <div>
      {/* Current JSON */}
      <details style={{ marginBottom: 24 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: "#64748b", marginBottom: 8 }}>
          תוכן נוכחי של editorial.json
        </summary>
        <pre style={{
          background: "#1e293b", color: "#e2e8f0",
          padding: 16, borderRadius: 10,
          fontSize: 11, overflow: "auto",
          maxHeight: 200, direction: "ltr",
        }}>
          {currentJson}
        </pre>
      </details>

      {/* Form */}
      <div style={{ background: "#fff", borderRadius: 16, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, color: "#0f172a" }}>פרשנות חדשה</h2>

        <label style={labelStyle}>שם הכתב</label>
        <input style={inputStyle} value={reporter} onChange={e => setReporter(e.target.value)} placeholder="ישראל ישראלי" />

        <label style={labelStyle}>תפקיד</label>
        <input style={inputStyle} value={role} onChange={e => setRole(e.target.value)} />

        <label style={labelStyle}>ראשי תיבות (לתמונה)</label>
        <input style={{ ...inputStyle, width: 80 }} value={initials} onChange={e => setInitials(e.target.value)} placeholder="יי" maxLength={2} />

        <label style={labelStyle}>צבע תמונה</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <input type="color" value={avatarColor} onChange={e => setAvatarColor(e.target.value)}
            style={{ width: 40, height: 36, padding: 2, borderRadius: 6, border: "1px solid #e2e8f0", cursor: "pointer" }} />
          <span style={{ fontSize: 12, color: "#64748b" }}>{avatarColor}</span>
        </div>

        <label style={labelStyle}>טקסט הפרשנות</label>
        <textarea
          style={{ ...inputStyle, height: 100, resize: "vertical" }}
          value={quote}
          onChange={e => setQuote(e.target.value)}
          placeholder="כתוב את הניתוח הפוליטי כאן..."
        />

        <label style={labelStyle}>כתובת הכתבה</label>
        <input style={inputStyle} value={articleUrl} onChange={e => setArticleUrl(e.target.value)} dir="ltr" />

        <label style={labelStyle}>כותרת הכתבה</label>
        <input style={inputStyle} value={articleTitle} onChange={e => setArticleTitle(e.target.value)} placeholder="כותרת הכתבה המלאה" />

        <button
          onClick={generate}
          style={{
            background: "#1a2f7a", color: "#fff",
            border: "none", borderRadius: 10, padding: "10px 24px",
            fontFamily: "'Heebo', sans-serif", fontSize: 14, fontWeight: 700,
            cursor: "pointer", marginTop: 4,
          }}
        >
          צור JSON
        </button>
      </div>

      {/* Output */}
      {generated && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", marginBottom: 8 }}>
            העתק את הטקסט הבא ושמור אותו כ-public/data/editorial.json
          </p>
          <textarea
            readOnly
            style={{
              ...inputStyle,
              height: 260, background: "#1e293b", color: "#e2e8f0",
              fontSize: 12, direction: "ltr", fontFamily: "monospace",
            }}
            value={generated}
            onClick={e => (e.target as HTMLTextAreaElement).select()}
          />
        </div>
      )}
    </div>
  );
}
