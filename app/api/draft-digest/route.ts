import { NextRequest, NextResponse } from "next/server";
import { verifyRequest, isAuthConfigured } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ draft: null, live: null, error: "supabase_not_configured" });
  }

  const [draftRes, liveRes] = await Promise.all([
    supabaseAdmin
      .from("daily_digests")
      .select("generated_at, changes, story, model")
      .eq("status", "draft")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("daily_digests")
      .select("generated_at, changes, story, model")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    draft: draftRes.data ?? null,
    live: liveRes.data ?? null,
  });
}

export async function PUT(req: NextRequest) {
  if (isAuthConfigured()) {
    const valid = await verifyRequest();
    if (!valid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 500 });
  }

  const body = await req.json();

  const existing = await supabaseAdmin
    .from("daily_digests")
    .select("id")
    .eq("status", "draft")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.data) {
    const { error } = await supabaseAdmin
      .from("daily_digests")
      .update({
        changes: body.changes,
        story: body.story,
        model: body.model,
        generated_at: body.generated_at || new Date().toISOString(),
      })
      .eq("id", existing.data.id);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin
      .from("daily_digests")
      .insert({
        changes: body.changes,
        story: body.story,
        model: body.model,
        generated_at: body.generated_at || new Date().toISOString(),
        status: "draft",
      });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, draft: body });
}
