/**
 * Studio identity constants — the owner session cookie and principal id.
 *
 * Leaf module (zero imports): lets the v2.1 agent tools
 * (src/lib/studio/agent-tools.ts) share the owner principal id without
 * pulling in src/lib/studio.ts, whose `eve/channels/auth` type import would
 * break the agent tools' documented no-eve/no-next invariant (and the
 * scratch CJS compile). src/lib/studio.ts re-exports these unchanged for its
 * existing consumers.
 */

export const STUDIO_COOKIE = "studio_session";
export const STUDIO_OWNER = "studio-owner";
