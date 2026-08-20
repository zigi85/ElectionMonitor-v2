import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ runs: [], error: "supabase_not_configured" });
  }

  const { data, error } = await supabaseAdmin
    .from("script_runs")
    .select("id, script_name, status, summary, records_count, started_at, completed_at, error_message, trigger")
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ runs: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ runs: data ?? [] });
}
