import { NextRequest, NextResponse } from "next/server";
import { verifyRequest, isAuthConfigured } from "@/lib/auth";

const REPO = process.env.GITHUB_REPO || "zigi85/ElectionMonitor-v2";
const WORKFLOW_FILE = "refresh-data.yml";

const SCRIPTS: Record<string, { target: string; label: string }> = {
  polls: { target: "polls", label: "סקרים" },
  polymarket: { target: "polymarket", label: "שוקי ניבוי" },
  media: { target: "media", label: "אזכורים בתקשורת" },
  social: { target: "social", label: "סיגנלים חברתיים" },
  trends: { target: "trends", label: "Google Trends" },
  digest: { target: "digest", label: "דייג'סט יומי" },
  all: { target: "all", label: "הרץ הכל" },
};

export async function GET() {
  return NextResponse.json({
    scripts: Object.entries(SCRIPTS)
      .filter(([id]) => id !== "all")
      .map(([id, s]) => ({ id, label: s.label })),
  });
}

export async function POST(req: NextRequest) {
  if (isAuthConfigured()) {
    const valid = await verifyRequest();
    if (!valid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ghToken = process.env.GITHUB_ACTIONS_TOKEN;
  if (!ghToken) {
    return NextResponse.json(
      { ok: false, error: "GITHUB_ACTIONS_TOKEN not configured" },
      { status: 500 },
    );
  }

  const { scriptId } = await req.json();
  const script = SCRIPTS[scriptId];
  if (!script) {
    return NextResponse.json({ ok: false, error: "unknown script" }, { status: 400 });
  }

  const url = `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ghToken}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: "master",
      inputs: { target: script.target },
    }),
  });

  if (res.status === 204) {
    return NextResponse.json({ ok: true, scriptId, message: "Workflow triggered" });
  }

  const errorBody = await res.text();
  return NextResponse.json(
    { ok: false, scriptId, error: `GitHub API ${res.status}: ${errorBody}` },
    { status: 500 },
  );
}
