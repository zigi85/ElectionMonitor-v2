import { NextResponse } from "next/server";
import { verifyRequest, isAuthConfigured } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function requireAuth() {
  if (!isAuthConfigured()) return null;
  const valid = await verifyRequest();
  if (!valid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  if (!supabaseAdmin) {
    return NextResponse.json({ date: "", notes: [] });
  }

  const { data } = await supabaseAdmin
    .from("editorial_notes")
    .select("date, notes")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json(data ?? { date: "", notes: [] });
}

export async function PUT(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 500 });
  }

  const body = await req.json();
  const date = body.date || new Date().toISOString().slice(0, 10);
  const notes = Array.isArray(body.notes) ? body.notes : [];

  const { error } = await supabaseAdmin
    .from("editorial_notes")
    .upsert(
      { date, notes, updated_at: new Date().toISOString() },
      { onConflict: "date" },
    );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ date, notes });
}
