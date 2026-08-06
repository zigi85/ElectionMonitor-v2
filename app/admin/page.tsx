import { readFile } from "node:fs/promises";
import path from "node:path";
import AdminForm from "./AdminForm";

export const dynamic = "force-dynamic";

async function getCurrentEditorial(): Promise<string> {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "editorial.json");
    return await readFile(filePath, "utf8");
  } catch {
    return "{}";
  }
}

export default async function AdminPage() {
  const current = await getCurrentEditorial();

  return (
    <div style={{
      fontFamily: "'Heebo', sans-serif",
      direction: "rtl",
      maxWidth: 700,
      margin: "0 auto",
      padding: "32px 24px",
      background: "#f0f4f8",
      minHeight: "100vh",
    }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0d1b55", marginBottom: 8 }}>
        עריכת פרשנות המערכת
      </h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>
        מלא את השדות ולחץ על &ldquo;צור JSON&rdquo;. העתק את התוצאה לקובץ{" "}
        <code style={{ background: "#e2e8f0", padding: "1px 5px", borderRadius: 4 }}>
          public/data/editorial.json
        </code>{" "}
        ודחוף ל-Git כדי לפרסם.
      </p>

      <AdminForm currentJson={current} />
    </div>
  );
}
