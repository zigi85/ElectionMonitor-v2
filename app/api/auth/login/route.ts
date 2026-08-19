import { NextResponse } from "next/server";
import {
  verifyLogin,
  createSessionToken,
  isAuthConfigured,
  COOKIE_NAME,
  getSessionSecret,
} from "@/lib/auth";

export async function POST(req: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { ok: false, error: "auth_not_configured" },
      { status: 503 },
    );
  }

  const { password, totp } = await req.json();

  if (!verifyLogin(password, totp)) {
    return NextResponse.json(
      { ok: false, error: "invalid_credentials" },
      { status: 401 },
    );
  }

  const token = createSessionToken(getSessionSecret());
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 86400,
    path: "/",
  });
  return res;
}
