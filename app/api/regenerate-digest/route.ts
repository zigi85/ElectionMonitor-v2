import { NextResponse } from "next/server";
import { verifyRequest, isAuthConfigured } from "@/lib/auth";

const REPO = process.env.GITHUB_REPO || "zigi85/ElectionMonitor-v2";
const WORKFLOW_FILE = "refresh-data.yml";

export async function POST() {
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
      inputs: { target: "digest" },
    }),
  });

  if (res.status === 204) {
    return NextResponse.json({ ok: true, message: "Digest generation triggered — check back in ~1 min" });
  }

  const errorBody = await res.text();
  return NextResponse.json(
    { ok: false, error: `GitHub API ${res.status}: ${errorBody}` },
    { status: 500 },
  );
}
