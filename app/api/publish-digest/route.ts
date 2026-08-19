import { NextRequest, NextResponse } from "next/server";
import { verifyRequest, isAuthConfigured } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  if (isAuthConfigured()) {
    const valid = await verifyRequest();
    if (!valid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 500 });
  }

  const body = await req.json();
  const digest = {
    generated_at: body.generated_at || new Date().toISOString(),
    changes: body.changes,
    story: body.story,
    model: body.model,
    status: "published",
  };

  const existing = await supabaseAdmin
    .from("daily_digests")
    .select("id")
    .eq("status", "published")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let error;
  if (existing.data) {
    ({ error } = await supabaseAdmin
      .from("daily_digests")
      .update(digest)
      .eq("id", existing.data.id));
  } else {
    ({ error } = await supabaseAdmin
      .from("daily_digests")
      .insert(digest));
  }

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await supabaseAdmin
    .from("daily_digests")
    .delete()
    .eq("status", "draft");

  return NextResponse.json({ ok: true, digest });
}
