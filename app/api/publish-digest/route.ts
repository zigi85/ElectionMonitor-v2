import { NextResponse } from "next/server";
import { verifyRequest, isAuthConfigured } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST() {
  if (isAuthConfigured()) {
    const valid = await verifyRequest();
    if (!valid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 500 });
  }

  const { data: draft, error: fetchErr } = await supabaseAdmin
    .from("daily_digests")
    .select("*")
    .eq("status", "draft")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchErr || !draft) {
    return NextResponse.json({ ok: false, error: "no_draft" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("daily_digests")
    .update({
      changes: draft.changes,
      story: draft.story,
      model: draft.model,
      generated_at: draft.generated_at,
      status: "published",
    })
    .eq("id", draft.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const digest = {
    generated_at: draft.generated_at,
    changes: draft.changes,
    story: draft.story,
    model: draft.model,
  };

  return NextResponse.json({ ok: true, digest });
}
