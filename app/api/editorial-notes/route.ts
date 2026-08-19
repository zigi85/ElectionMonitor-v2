import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { verifyRequest, isAuthConfigured } from "@/lib/auth";

const FILE = join(process.cwd(), "public", "data", "editorial_notes.json");

async function requireAuth() {
  if (!isAuthConfigured()) return null;
  const valid = await verifyRequest();
  if (!valid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    const raw = await readFile(FILE, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ date: "", notes: [] });
  }
}

export async function PUT(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const body = await req.json();
  const data = {
    date: body.date || new Date().toISOString().slice(0, 10),
    notes: Array.isArray(body.notes) ? body.notes : [],
  };
  await writeFile(FILE, JSON.stringify(data, null, 2), "utf-8");
  return NextResponse.json(data);
}
