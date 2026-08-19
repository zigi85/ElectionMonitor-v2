import { NextResponse } from "next/server";
import { exec } from "child_process";
import { readFile } from "fs/promises";
import { join } from "path";
import { verifyRequest, isAuthConfigured } from "@/lib/auth";

const DIGEST_PATH = join(process.cwd(), "public", "data", "daily_digest.json");

export async function POST() {
  if (isAuthConfigured()) {
    const valid = await verifyRequest();
    if (!valid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return new Promise<NextResponse>((resolve) => {
    exec(
      "python scripts/generate_daily_digest.py",
      { cwd: process.cwd(), timeout: 120_000 },
      async (error, stdout, stderr) => {
        if (error) {
          resolve(
            NextResponse.json(
              { ok: false, error: stderr || error.message },
              { status: 500 },
            ),
          );
          return;
        }

        try {
          const raw = await readFile(DIGEST_PATH, "utf-8");
          resolve(NextResponse.json({ ok: true, digest: JSON.parse(raw), log: stdout }));
        } catch {
          resolve(NextResponse.json({ ok: true, log: stdout }));
        }
      },
    );
  });
}
