import { createHash, timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";
import type { AuthFn } from "eve/channels/auth";

// NOTE: keep this module free of `next/*` imports — it is pulled into the
// eve authored-module bundle via agent/channels/eve.ts, and eve's ESM loader
// cannot resolve Next's extensionless entrypoints. Server-only Next helpers
// that need `next/headers` live in studio-session.ts instead.

export const STUDIO_COOKIE = "studio_session";
export const STUDIO_OWNER = "studio-owner";

/**
 * The Studio passcode comes from STUDIO_PASSCODE (env). Without it, the
 * Studio login is disabled and /studio only exposes the public chat demo.
 */
export function studioPasscodeConfigured(): boolean {
  return Boolean(process.env.STUDIO_PASSCODE);
}

export function isValidPasscode(passcode: string): boolean {
  const expected = process.env.STUDIO_PASSCODE ?? "";
  if (!expected || !passcode) return false;
  return timingSafeEqual(passcode, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  const da = createHash("sha256").update(a).digest();
  const db = createHash("sha256").update(b).digest();
  return cryptoTimingSafeEqual(da, db);
}

export function studioToken(): string {
  // The cookie value is a SHA-256 of the passcode: never the secret itself.
  return createHash("sha256")
    .update(`studio:${process.env.STUDIO_PASSCODE ?? ""}`)
    .digest("hex");
}

/**
 * eve route-auth entry: authenticates a request carrying the Studio cookie
 * as the owner principal. Used ahead of `none()` in the channel walk.
 */
export function studioOwnerAuth(): AuthFn<Request> {
  return async (request) => {
    if (!studioPasscodeConfigured()) return null;
    const header = request.headers.get("cookie") ?? "";
    const token = studioToken();
    const cookie = parseCookie(header, STUDIO_COOKIE);
    if (!cookie) return null;
    if (cookie !== token) return null;
    return {
      authenticator: "app",
      principalId: STUDIO_OWNER,
      principalType: "user",
      attributes: { role: "owner" },
    };
  };
}

function parseCookie(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}
