import { NextResponse } from "next/server";
import { verifyRequest, isAuthConfigured } from "@/lib/auth";

export async function GET() {
  if (!isAuthConfigured()) {
    return NextResponse.json({ authenticated: false, configured: false });
  }

  const valid = await verifyRequest();
  return NextResponse.json({ authenticated: valid, configured: true });
}
