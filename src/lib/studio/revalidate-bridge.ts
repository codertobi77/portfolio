/**
 * Revalidation bridge between the eve agent service and the Next.js app.
 *
 * The eve service runs as its own runtime (channel on /eve/v1/*) and cannot
 * call next/cache's revalidatePath directly, so Studio tool mutations buffer
 * the paths exec.ts wants refreshed and flush them in a single authorized
 * POST to /api/revalidate.
 *
 * NOTE: keep this module free of `next/*` imports — it is pulled into the eve
 * authored-module bundle (via src/lib/studio/agent-tools.ts) and compiled
 * outside Next for scratch tests. The route handler imports only the pure
 * whitelist helpers from here.
 */

/** Pages that render portfolio data — the only paths a mutation may refresh. */
export const STUDIO_REVALIDATE_PATH_PATTERN =
  /^\/(fr|en)(\/(about|cv|contact|guestbook|projects))?$/;

/** Hard cap per bridge call (exec.ts refreshes at most 4 paths per command). */
export const MAX_REVALIDATE_PATHS = 16;

export function isValidRevalidatePath(path: unknown): path is string {
  return typeof path === "string" && STUDIO_REVALIDATE_PATH_PATTERN.test(path);
}

/**
 * Base URL of the Next.js app as seen from the eve service:
 * STUDIO_SITE_URL → the deployment's VERCEL_URL → localhost (dev).
 */
export function revalidateBaseUrl(): string {
  const explicit = process.env.STUDIO_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export interface RevalidationOutcome {
  ok: boolean;
  revalidated: number;
  error?: string;
}

export interface RevalidationCollector {
  /** Buffer one revalidatePath target (whitelisted; duplicates collapse). */
  add(pathname: string): void;
  /** POST the buffered paths once — safe to call with nothing buffered. */
  flush(): Promise<RevalidationOutcome>;
}

/**
 * Buffers revalidation paths while a Studio command runs, then flushes them
 * through the bridge. Mirrors the CommandDeps.revalidate signature so it can
 * be injected straight into execStudioCommand.
 */
export function createRevalidationCollector(): RevalidationCollector {
  const paths = new Set<string>();
  return {
    add(pathname) {
      if (isValidRevalidatePath(pathname)) paths.add(pathname);
    },
    async flush() {
      if (paths.size === 0) return { ok: true, revalidated: 0 };
      const secret = process.env.STUDIO_REVALIDATE_SECRET;
      if (!secret) {
        return {
          ok: false,
          revalidated: 0,
          error: "STUDIO_REVALIDATE_SECRET is not configured",
        };
      }
      try {
        const res = await fetch(`${revalidateBaseUrl()}/api/revalidate`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify({
            paths: [...paths].slice(0, MAX_REVALIDATE_PATHS),
          }),
        });
        if (!res.ok) {
          return { ok: false, revalidated: 0, error: `bridge responded ${res.status}` };
        }
        const data = (await res.json().catch(() => null)) as
          | { revalidated?: unknown }
          | null;
        const revalidated =
          typeof data?.revalidated === "number" && Number.isFinite(data.revalidated)
            ? data.revalidated
            : 0;
        return { ok: true, revalidated };
      } catch (error) {
        return {
          ok: false,
          revalidated: 0,
          error: error instanceof Error ? error.message : "bridge unreachable",
        };
      }
    },
  };
}
