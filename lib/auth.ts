import { createHmac, randomBytes } from "crypto";
import { cookies } from "next/headers";

const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;
const COOKIE_NAME = "editor_session";

function base32Decode(encoded: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of encoded.toUpperCase().replace(/[= ]/g, "")) {
    const val = alphabet.indexOf(c);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTOTP(secret: string, unixSeconds: number): string {
  const key = base32Decode(secret);
  const counter = Math.floor(unixSeconds / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    1000000;
  return code.toString().padStart(6, "0");
}

export function verifyTOTP(secret: string, token: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  for (const offset of [0, -30, 30]) {
    if (generateTOTP(secret, now + offset) === token.trim()) return true;
  }
  return false;
}

export function createSessionToken(secret: string): string {
  const ts = Date.now().toString();
  const nonce = randomBytes(8).toString("hex");
  const payload = `${ts}:${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string, secret: string): boolean {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return false;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (sig !== expected) return false;
  const ts = parseInt(payload.split(":")[0]);
  return Date.now() - ts < SESSION_MAX_AGE;
}

function getSessionSecret(): string {
  return process.env.EDITOR_SESSION_SECRET || "";
}

export function isAuthConfigured(): boolean {
  return !!(process.env.EDITOR_PASSWORD && process.env.EDITOR_TOTP_SECRET && getSessionSecret());
}

export async function verifyRequest(): Promise<boolean> {
  if (!isAuthConfigured()) return false;
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME)?.value;
  if (!session) return false;
  return verifySessionToken(session, getSessionSecret());
}

export function verifyLogin(password: string, totpCode: string): boolean {
  const expectedPassword = process.env.EDITOR_PASSWORD || "";
  const totpSecret = process.env.EDITOR_TOTP_SECRET || "";
  if (!expectedPassword || !totpSecret) return false;
  if (password !== expectedPassword) return false;
  return verifyTOTP(totpSecret, totpCode);
}

export { COOKIE_NAME, getSessionSecret };
