/**
 * Client-safe constants + helpers for the v2.1 agent-tools boot toggle.
 *
 * The owner chooses at Studio boot (StudioBoot overlay) whether the eve
 * agent gets the Studio toolset. The choice is stored twice:
 *  - localStorage — the "last choice" shown as the default at the next boot;
 *  - a plain (non-httpOnly) cookie — read by studioOwnerAuth() on every eve
 *    request and exposed as the `studio-tools` auth attribute, which the
 *    dynamic tool resolver gates on.
 *
 * No imports at all (isomorphic): used by src/lib/studio.ts (server), and by
 * the StudioBoot/StudioTerminal client components.
 */

export const STUDIO_TOOLS_COOKIE = "studio_agent_tools";
export const STUDIO_TOOLS_ON = "on";
/** Name of the auth attribute the dynamic tool resolver checks. */
export const STUDIO_TOOLS_ATTRIBUTE = "studio-tools";
/** localStorage key holding the last boot choice ("on" | "off"). */
export const STUDIO_TOOLS_CHOICE_KEY = "portfolio:studio:agent-tools";

/**
 * Window event fired by writeStudioToolsChoice — lets components that are
 * already mounted (the Studio terminal, which sits under the boot overlay)
 * follow a boot answer live instead of waiting for the next page load.
 */
export const STUDIO_TOOLS_EVENT = "studio-agent-tools";

export type StudioToolsChoice = "on" | "off";

/** Last boot choice from localStorage — null when never chosen (defaults to off). */
export function readStudioToolsChoice(): StudioToolsChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STUDIO_TOOLS_CHOICE_KEY);
    return value === "on" || value === "off" ? value : null;
  } catch {
    return null;
  }
}

/** Persist the boot choice (localStorage mirror + cookie for the eve channel). */
export function writeStudioToolsChoice(choice: StudioToolsChoice): void {
  try {
    window.localStorage.setItem(STUDIO_TOOLS_CHOICE_KEY, choice);
  } catch {
    // localStorage unavailable — the cookie below still carries the choice
  }
  try {
    document.cookie = `${STUDIO_TOOLS_COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // cookie writes blocked — tools stay in their previous state
  }
  try {
    window.dispatchEvent(new Event(STUDIO_TOOLS_EVENT));
  } catch {
    // dispatch blocked — the next page load still re-reads the cookie
  }
}

/** Current cookie state (client side) — drives the eve instruction text. */
export function studioToolsCookieOn(): boolean {
  if (typeof document === "undefined") return false;
  const prefix = `${STUDIO_TOOLS_COOKIE}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix) && trimmed.slice(prefix.length) === STUDIO_TOOLS_ON) {
      return true;
    }
  }
  return false;
}
