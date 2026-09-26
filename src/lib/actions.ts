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
import type { StudioCommandResult } from "@/lib/studio/shell/types";

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

// ---- Studio shell (service-role, owner only) ----

const adminLocaleSchema = z.enum(["fr", "en"]);

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

export async function loginStudio(formData: FormData) {
  const passcode = String(formData.get("passcode") ?? "");
  if (!studioPasscodeConfigured() || !isValidPasscode(passcode)) {
    return { ok: false as const };
  }

  const store = await cookies();
  store.set(STUDIO_COOKIE, studioToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return { ok: true as const };
}

export async function logoutStudio() {
  const store = await cookies();
  store.delete(STUDIO_COOKIE);
}

/**
 * Runs one Studio shell command (projects / guestbook / contact / blog /
 * stats / help / whoami) with the service-role client. Ownership is
 * re-checked on every call; exec.ts owns parsing, validation and output.
 */
export async function runStudioCommand(
  input: string,
  locale: string,
): Promise<StudioCommandResult> {
  const loc = adminLocaleSchema.safeParse(locale);
  if (!loc.success || !(await isStudioOwner())) {
    return {
      ok: false,
      lines: [{ text: "permission denied: studio session required", kind: "err" }],
    };
  }

  const parsed = z.string().trim().min(1).max(2000).safeParse(input);
  if (!parsed.success) {
    return { ok: false, lines: [{ text: "empty command", kind: "err" }] };
  }

  const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
  return execStudioCommand(parsed.data, {
    supabase: getSupabaseAdminClient(),
    locale: loc.data,
    revalidate: (pathname) => revalidatePath(pathname),
  });
}
