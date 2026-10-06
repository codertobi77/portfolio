"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  STUDIO_COOKIE,
  isValidPasscode,
  studioPasscodeConfigured,
  studioToken,
} from "@/lib/studio";
import { isStudioOwner } from "@/lib/studio-session";
import { execStudioCommand } from "@/lib/studio/shell/exec";
import { ShellParseError, tokenize } from "@/lib/studio/shell/parse";
import { sudoCommands } from "@/lib/studio/shell/registry";
import type { ShellLine, StudioCommandResult } from "@/lib/studio/shell/types";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().max(200).optional().or(z.literal("")),
  message: z.string().trim().min(1).max(5000),
});

const guestbookSchema = z.object({
  name: z.string().trim().min(1).max(40),
  message: z.string().trim().min(1).max(500),
});

function getOutcome(error: string | null): { ok: boolean; error?: string } {
  return error ? { ok: false, error } : { ok: true };
}

// ---- Studio shell (public reads, sudo-gated mutations) ----

const adminLocaleSchema = z.enum(["fr", "en"]);

/** sudo session lifetime — refreshed on every elevated command (rolling). */
const SUDO_MAX_AGE_SECONDS = 15 * 60;

const SUDO_PROMPT: ShellLine = { text: "[sudo] password for dee:", kind: "dim" };

async function setSudoSession(): Promise<void> {
  const store = await cookies();
  store.set(STUDIO_COOKIE, studioToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SUDO_MAX_AGE_SECONDS,
  });
}

export async function submitContact(formData: FormData) {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject") ?? "",
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return getOutcome("invalid");
  }

  const { getSupabaseAnonClient } = await import("@/lib/supabase/client");
  const client = getSupabaseAnonClient();
  if (!client) return getOutcome("unconfigured");

  const { error } = await client.from("contact_messages").insert({
    name: parsed.data.name,
    email: parsed.data.email,
    subject: parsed.data.subject || null,
    message: parsed.data.message,
  });

  return getOutcome(error ? "failed" : null);
}

export async function submitGuestbook(formData: FormData) {
  const parsed = guestbookSchema.safeParse({
    name: formData.get("name"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return getOutcome("invalid");
  }

  const { getSupabaseAnonClient } = await import("@/lib/supabase/client");
  const client = getSupabaseAnonClient();
  if (!client) return getOutcome("unconfigured");

  const { error } = await client.from("guestbook").insert({
    name: parsed.data.name,
    message: parsed.data.message,
    approved: false,
  });

  return getOutcome(error ? "failed" : null);
}

/**
 * `sudo <passcode>` — validate the passcode and open a 15-minute sudo
 * session (the terminal calls this after the masked [sudo] prompt).
 */
export async function sudoAuth(passcode: string): Promise<{ ok: boolean }> {
  if (!studioPasscodeConfigured() || !isValidPasscode(passcode)) {
    return { ok: false };
  }
  await setSudoSession();
  return { ok: true };
}

/** `sudo -k` — invalidate the sudo timestamp (idempotent, no session needed). */
export async function sudoKill(): Promise<{ ok: true }> {
  const store = await cookies();
  store.delete(STUDIO_COOKIE);
  return { ok: true };
}

/**
 * Runs one Studio shell command for anyone: reads are public, mutations
 * need the `sudo` prefix AND a valid session. Without a session a sudo
 * command returns `needsPassword` — the terminal prompts for the
 * passcode (masked, 3 attempts), authenticates via sudoAuth, then
 * retries the original line. exec.ts owns parsing, validation, output
 * and the elevated-vs-guest guard.
 */
export async function runStudioCommand(
  input: string,
  locale: string,
): Promise<StudioCommandResult> {
  const loc = adminLocaleSchema.safeParse(locale);
  if (!loc.success) {
    return { ok: false, lines: [{ text: "unknown locale", kind: "err" }] };
  }

  const parsed = z.string().trim().min(1).max(2000).safeParse(input);
  if (!parsed.success) {
    return { ok: false, lines: [{ text: "empty command", kind: "err" }] };
  }

  let tokens: string[];
  try {
    tokens = tokenize(parsed.data);
  } catch (e) {
    return {
      ok: false,
      lines: [
        { text: e instanceof ShellParseError ? e.message : "parse error", kind: "err" },
      ],
    };
  }

  let command = parsed.data;
  let elevated = false;

  if (tokens[0] === "sudo") {
    const inner = tokens.slice(1);
    const flag = inner[0];
    if (!flag) {
      return { ok: false, lines: [{ text: "usage: sudo [-k|-v|-l] [command]", kind: "err" }] };
    }

    // `sudo -k` kills the timestamp whether or not a session exists.
    if (flag === "-k") {
      const store = await cookies();
      store.delete(STUDIO_COOKIE);
      return { ok: true, lines: [{ text: "sudo: session invalidated", kind: "ok" }] };
    }

    // Every other sudo path needs a valid session: without one the
    // terminal shows the masked prompt, authenticates, then retries.
    if (!(await isStudioOwner())) {
      return { ok: false, needsPassword: true, lines: [SUDO_PROMPT] };
    }
    await setSudoSession(); // rolling 15-minute window, like sudo's timestamp

    if (flag === "-v") {
      return {
        ok: true,
        lines: [{ text: "sudo: timestamp refreshed — valid for 15 min", kind: "ok" }],
      };
    }
    if (flag === "-l") {
      return {
        ok: true,
        lines: [
          { text: "User dee may run the following commands on studio:" },
          { text: "    (ALL) ALL", kind: "dim" },
          { text: `    ${sudoCommands().join(", ")}`, kind: "dim" },
        ],
      };
    }

    elevated = true;
    command = inner.join(" ");
  }

  const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
  return execStudioCommand(command, {
    supabase: getSupabaseAdminClient(),
    locale: loc.data,
    revalidate: (pathname) => revalidatePath(pathname),
    elevated,
  });
}
