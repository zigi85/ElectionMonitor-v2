import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

const FILE = join(process.cwd(), "public", "data", "daily_digest.json");

export async function GET() {
  try {
    const raw = await readFile(FILE, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ changes: [], story: {} });
  }
}
