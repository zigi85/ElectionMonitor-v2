import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { verifyRequest, isAuthConfigured } from "@/lib/auth";

const DRAFT = join(process.cwd(), "public", "data", "daily_digest_draft.json");
const LIVE = join(process.cwd(), "public", "data", "daily_digest.json");

export async function GET() {
  let draft = null;
  let live = null;

  try {
    draft = JSON.parse(await readFile(DRAFT, "utf-8"));
  } catch { /* no draft */ }

  try {
    live = JSON.parse(await readFile(LIVE, "utf-8"));
  } catch { /* no live */ }

  return NextResponse.json({ draft, live });
}

export async function PUT(req: NextRequest) {
  if (isAuthConfigured()) {
    const valid = await verifyRequest();
    if (!valid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  await writeFile(DRAFT, JSON.stringify(body, null, 2), "utf-8");
  return NextResponse.json({ ok: true, draft: body });
}
