import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { verifyRequest, isAuthConfigured } from "@/lib/auth";

const DRAFT = join(process.cwd(), "public", "data", "daily_digest_draft.json");
const LIVE = join(process.cwd(), "public", "data", "daily_digest.json");

export async function POST() {
  if (isAuthConfigured()) {
    const valid = await verifyRequest();
    if (!valid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let draft;
  try {
    draft = await readFile(DRAFT, "utf-8");
  } catch {
    return NextResponse.json({ ok: false, error: "no_draft" }, { status: 404 });
  }

  await writeFile(LIVE, draft, "utf-8");
  return NextResponse.json({ ok: true, digest: JSON.parse(draft) });
}
