import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared types for the Studio shell (owner terminal).
 *
 * This module is imported by both sides:
 *  - client (StudioTerminal: rendering ShellLine[], Tab completion)
 *  - server (actions.ts + exec.ts)
 * Keep it dependency-free except for type-only imports.
 */

export type ShellLineKind = "out" | "err" | "dim" | "ok" | "warn" | "head";

export interface ShellLine {
  text: string;
  kind?: ShellLineKind; // default "out"
}

export interface StudioCommandResult {
  ok: boolean;
  lines: ShellLine[];
}

/**
 * Server-side dependencies injected into exec.ts after the owner guard.
 * exec.ts itself stays free of next/* imports (same rule as lib/studio.ts —
 * pulled into the eve authored-module bundle); everything Next-specific
 * (cookie guard, revalidatePath, service-role client) lives in the action.
 * Injection also makes the handlers testable outside Next.
 */
export interface CommandDeps {
  /** Service-role client (RLS bypass, owner-guarded) — null when unconfigured. */
  supabase: SupabaseClient | null;
  locale: "fr" | "en";
  /** revalidatePath() wrapper — mutations refresh affected public pages. */
  revalidate: (pathname: string) => void;
}
