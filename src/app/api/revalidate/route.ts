import { revalidatePath } from "next/cache";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  isValidRevalidatePath,
  MAX_REVALIDATE_PATHS,
} from "@/lib/studio/revalidate-bridge";

/**
 * Revalidation bridge for the eve agent service (v2.1 Studio tools).
 *
 * The agent runtime cannot call revalidatePath directly (it is a separate
 * service from Next), so tool mutations buffer their target paths and flush
 * them here in a single authorized POST. The caller authenticates with a
 * shared secret (STUDIO_REVALIDATE_SECRET) and may only refresh the
 * data-backed public pages — see the whitelist in revalidate-bridge.ts.
 */

function bearerMatches(header: string, secret: string): boolean {
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  const digestA = createHash("sha256").update(token).digest();
  const digestB = createHash("sha256").update(secret).digest();
  return timingSafeEqual(digestA, digestB);
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.STUDIO_REVALIDATE_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization || !bearerMatches(authorization, secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const paths = (body as { paths?: unknown } | null)?.paths;
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_REVALIDATE_PATHS) {
    return Response.json({ error: "invalid paths" }, { status: 400 });
  }

  const valid = [...new Set(paths)].filter(isValidRevalidatePath);
  if (valid.length === 0) {
    return Response.json({ error: "no valid paths" }, { status: 400 });
  }

  for (const path of valid) {
    revalidatePath(path);
  }
  return Response.json({ revalidated: valid.length });
}
