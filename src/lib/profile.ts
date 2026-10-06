import type { SupabaseClient } from "@supabase/supabase-js";
import profileDefaults from "../../content/profile.json";

/**
 * Site profile: the persona rendered across public pages (about, cv,
 * contact, hero blocks).
 *
 * Defaults live in content/profile.json (versioned seed). The Studio shell
 * `profile` commands write a merged snapshot to the Supabase `site_profile`
 * table (key = 'profile', jsonb blob); this module deep-merges the blob over
 * the defaults so any field the owner never touched keeps its seed value.
 *
 * Keep this module free of `next/*` imports — like the shell layer, it is
 * compiled outside Next for scratch tests and must stay isomorphic-safe.
 * Callers pass their own Supabase client (anon for pages, service-role for
 * the shell).
 */

export interface Localized {
  fr: string;
  en: string;
}

export interface Social {
  label: string;
  url: string;
}

export interface Skill {
  label: string;
  level: number;
}

export interface TimelineEntry {
  year: string;
  title: Localized;
  org: Localized;
  description: Localized;
}

export interface SiteProfile {
  name: { legal: string; alterEgo: string; handle: string };
  role: Localized;
  status: Localized;
  location: string;
  email: string;
  socials: Social[];
  skills: Skill[];
  timeline: TimelineEntry[];
}

export const PROFILE_KEY = "profile";

// ---- merging ----

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-merge an overrides blob over the defaults. Arrays are replaced
 * wholesale (a mutated skills/timeline list is the new list — merging
 * entry-by-entry would resurrect deleted items).
 */
export function deepMerge<T>(base: T, overrides: unknown): T {
  if (overrides === undefined) return base;
  if (Array.isArray(base) || Array.isArray(overrides)) return overrides as T;
  if (isPlainObject(base) && isPlainObject(overrides)) {
    const out: Record<string, unknown> = { ...base };
    for (const key of Object.keys(overrides)) {
      out[key] = deepMerge((base as Record<string, unknown>)[key], overrides[key]);
    }
    return out as T;
  }
  return overrides as T;
}

// ---- sanitizing (defense in depth against malformed blobs) ----

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asLocalized(value: unknown, fallback: Localized): Localized {
  if (!isPlainObject(value)) return fallback;
  return {
    fr: asString(value.fr, fallback.fr),
    en: asString(value.en, fallback.en),
  };
}

function asSocials(value: unknown, fallback: Social[]): Social[] {
  if (!Array.isArray(value)) return fallback;
  // An explicit array — even one that sanitizes down to empty — is the
  // owner's choice (all socials deleted). Falling back here would
  // resurrect the seed list on every read, contradicting the
  // wholesale-replacement merge semantics.
  return value
    .filter(isPlainObject)
    .map((v) => ({ label: asString(v.label, ""), url: asString(v.url, "") }))
    .filter((v) => v.label && v.url);
}

function asSkills(value: unknown, fallback: Skill[]): Skill[] {
  if (!Array.isArray(value)) return fallback;
  // Same as asSocials: an explicit empty array means "no skills" — keep it
  // rather than resurrecting the seed list.
  return value
    .filter(isPlainObject)
    .map((v) => ({
      label: asString(v.label, ""),
      level:
        typeof v.level === "number" && v.level >= 1 && v.level <= 5
          ? Math.round(v.level)
          : 3,
    }))
    .filter((v) => v.label);
}

function asTimeline(value: unknown, fallback: TimelineEntry[]): TimelineEntry[] {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .filter(isPlainObject)
    .map((v, i) => ({
      year: asString(v.year, fallback[i]?.year ?? `${new Date().getFullYear()}`),
      title: asLocalized(v.title, fallback[i]?.title ?? { fr: "—", en: "—" }),
      org: asLocalized(v.org, fallback[i]?.org ?? { fr: "—", en: "—" }),
      description: asLocalized(
        v.description,
        fallback[i]?.description ?? { fr: "—", en: "—" },
      ),
    }));
  return items;
}

/**
 * The sanitized seed profile (content/profile.json). Fallback for every
 * page when Supabase is unconfigured or unreachable.
 */
export const DEFAULT_PROFILE: SiteProfile = {
  name: {
    legal: profileDefaults.name.legal,
    alterEgo: profileDefaults.name.alterEgo,
    handle: profileDefaults.name.handle,
  },
  role: {
    fr: profileDefaults.role.fr,
    en: profileDefaults.role.en,
  },
  status: {
    fr: profileDefaults.status.fr,
    en: profileDefaults.status.en,
  },
  location: profileDefaults.location,
  email: profileDefaults.email,
  socials: asSocials(profileDefaults.socials, []),
  skills: asSkills(profileDefaults.skills, []),
  timeline: asTimeline(profileDefaults.timeline, []),
};

/** Sanitize a merged (defaults + overrides) blob into a safe SiteProfile. */
export function sanitizeSiteProfile(merged: unknown): SiteProfile {
  if (!isPlainObject(merged)) return DEFAULT_PROFILE;
  const d = DEFAULT_PROFILE;
  const name = isPlainObject(merged.name) ? merged.name : {};
  return {
    name: {
      legal: asString(name.legal, d.name.legal),
      alterEgo: asString(name.alterEgo, d.name.alterEgo),
      handle: asString(name.handle, d.name.handle),
    },
    role: asLocalized(merged.role, d.role),
    status: asLocalized(merged.status, d.status),
    location: asString(merged.location, d.location),
    email: asString(merged.email, d.email),
    socials: asSocials(merged.socials, d.socials),
    skills: asSkills(merged.skills, d.skills),
    timeline: asTimeline(merged.timeline, d.timeline),
  };
}

// ---- Supabase access ----

/**
 * Raw overrides blob from `site_profile` (single row, key = 'profile').
 * Returns null when the table is empty, unreachable or Supabase is not
 * configured — callers then fall back to the seed profile.
 */
export async function getProfileOverrides(
  client: SupabaseClient | null,
): Promise<Record<string, unknown> | null> {
  if (!client) return null;
  try {
    const { data, error } = await client
      .from("site_profile")
      .select("data")
      .eq("key", PROFILE_KEY)
      .maybeSingle();
    if (error || !data) return null;
    const blob = (data as { data?: unknown }).data;
    return isPlainObject(blob) ? blob : null;
  } catch {
    return null; // unreachable DB → seed profile
  }
}

/**
 * The profile to render: seed defaults overridden by the site_profile blob.
 * `client` may be null (static build / unconfigured Supabase) — the seed
 * profile is then returned unchanged.
 */
export async function getSiteProfile(
  client: SupabaseClient | null,
): Promise<SiteProfile> {
  const overrides = await getProfileOverrides(client);
  if (!overrides) return DEFAULT_PROFILE;
  return sanitizeSiteProfile(deepMerge(DEFAULT_PROFILE, overrides));
}
