import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { verifyRequest, isAuthConfigured } from "@/lib/auth";

const SCRIPTS: Record<string, { cmd: string; label: string }> = {
  polls: { cmd: "python scripts/scrape_polls.py", label: "סקרים" },
  polymarket: { cmd: "python scripts/fetch_polymarket.py", label: "שוקי ניבוי" },
  media: { cmd: "python scripts/fetch_media_mentions.py", label: "אזכורים בתקשורת" },
  social: { cmd: "python scripts/fetch_social.py", label: "סיגנלים חברתיים" },
  trends: { cmd: "python scripts/fetch_trends.py", label: "Google Trends" },
  momentum: { cmd: "python scripts/calculate_momentum.py", label: "חישוב מומנטום" },
  digest: { cmd: "python scripts/generate_daily_digest.py", label: "דייג'סט יומי" },
};

export async function GET() {
  return NextResponse.json({
    scripts: Object.entries(SCRIPTS).map(([id, s]) => ({ id, label: s.label })),
  });
}

export async function POST(req: NextRequest) {
  if (isAuthConfigured()) {
    const valid = await verifyRequest();
    if (!valid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { scriptId } = await req.json();
  const script = SCRIPTS[scriptId];
  if (!script) {
    return NextResponse.json({ ok: false, error: "unknown script" }, { status: 400 });
  }

  return new Promise<NextResponse>((resolve) => {
    exec(script.cmd, { cwd: process.cwd(), timeout: 180_000 }, (error, stdout, stderr) => {
      if (error) {
        resolve(
          NextResponse.json(
            { ok: false, scriptId, error: stderr || error.message },
            { status: 500 },
          ),
        );
        return;
      }
      resolve(NextResponse.json({ ok: true, scriptId, log: stdout, warnings: stderr || undefined }));
    });
  });
}
