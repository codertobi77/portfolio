"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  STUDIO_COOKIE,
  isStudioOwner,
  isValidPasscode,
  studioPasscodeConfigured,
  studioToken,
} from "@/lib/studio";

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

// ---- Studio admin (service-role, owner only) ----

const idSchema = z.uuid();
const adminLocaleSchema = z.enum(["fr", "en"]);

/** Service-role client, only for authenticated Studio owners. */
async function adminSupabase() {
  if (!(await isStudioOwner())) return null;
  const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
  return getSupabaseAdminClient();
}

function revalidateAdmin(locale: string) {
  revalidatePath(`/${locale}/studio/admin`);
  revalidatePath(`/${locale}/guestbook`);
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

export async function approveGuestbookEntry(formData: FormData): Promise<void> {
  const client = await adminSupabase();
  if (!client) return;

  const id = idSchema.safeParse(formData.get("id"));
  const locale = adminLocaleSchema.safeParse(formData.get("locale"));
  if (!id.success || !locale.success) return;

  const { error } = await client
    .from("guestbook")
    .update({ approved: true })
    .eq("id", id.data);
  if (error) return;

  revalidateAdmin(locale.data);
}

export async function deleteGuestbookEntry(formData: FormData): Promise<void> {
  const client = await adminSupabase();
  if (!client) return;

  const id = idSchema.safeParse(formData.get("id"));
  const locale = adminLocaleSchema.safeParse(formData.get("locale"));
  if (!id.success || !locale.success) return;

  const { error } = await client
    .from("guestbook")
    .delete()
    .eq("id", id.data);
  if (error) return;

  revalidateAdmin(locale.data);
}

export async function deleteContactMessage(formData: FormData): Promise<void> {
  const client = await adminSupabase();
  if (!client) return;

  const id = idSchema.safeParse(formData.get("id"));
  const locale = adminLocaleSchema.safeParse(formData.get("locale"));
  if (!id.success || !locale.success) return;

  const { error } = await client
    .from("contact_messages")
    .delete()
    .eq("id", id.data);
  if (error) return;

  revalidatePath(`/${locale.data}/studio/admin`);
}
