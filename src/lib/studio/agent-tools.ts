import { z } from "zod";
import { STUDIO_OWNER } from "./principal";
import { STUDIO_TOOLS_ATTRIBUTE } from "./tools";
import { execStudioCommand } from "./shell/exec";
import { createRevalidationCollector } from "./revalidate-bridge";
import { getSupabaseAdminClient } from "../supabase/admin";
import type { ShellLine } from "./shell/types";

/**
 * v2.1 — the Studio toolset for the eve agent.
 *
 * Every tool composes a Studio shell argv and delegates to execStudioCommand,
 * the single source of truth for validation, the elevated-vs-guest guard and
 * revalidation paths. The tools run elevated: they are only registered for
 * the studio-owner principal with the v2.1 boot toggle enabled (see
 * agent/tools/studio.ts), and execute() re-checks the principal — the same
 * defense-in-depth as save_blog_draft.
 *
 * NOTE: keep this module free of `next/*` AND `eve/*` imports — it is pulled
 * into the eve authored-module bundle (via agent/tools/studio.ts, which owns
 * the defineTool wrappers) and compiled outside Next for scratch tests.
 * Use relative imports only (the scratch tsc compile has no `@/` alias).
 */

// ---- shared pieces ----

const localeSchema = z.enum(["fr", "en"]).default("fr");
const refSchema = z.string().trim().min(1).max(200);
const idSchema = z.string().trim().min(8).max(64);
const idsSchema = z.array(idSchema).min(1).max(20);

/**
 * Double-quote a value for the shell, escaping `\\` and `"` (the tokenizer
 * resolves them inside quotes). A quoted token is never an option, so the
 * composed value survives even when it starts with `--`.
 */
export function shellQuoteValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function optionArg(parts: string[], name: string, value: string | undefined): void {
  if (value) parts.push(`--${name}`, shellQuoteValue(value));
}

function numberArg(parts: string[], name: string, value: number | undefined): void {
  if (value !== undefined) parts.push(`--${name}`, String(value));
}

function boolFlag(parts: string[], name: string, value: boolean | undefined): void {
  if (value) parts.push(`--${name}`);
}

// ---- projects ----

const projectFieldSchemas = {
  title: z.string().trim().min(1).max(200).optional(),
  titleEn: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  descriptionEn: z.string().trim().min(1).max(2000).optional(),
  slug: z.string().trim().min(1).max(80).optional(),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(40)
        .refine((t) => !t.includes(","), {
          message: "must not contain commas — they separate the tag list",
        }),
    )
    .max(8)
    .optional(),
  url: z.string().trim().min(1).max(300).optional(),
  repoUrl: z.string().trim().min(1).max(300).optional(),
  featured: z.boolean().optional(),
  published: z.boolean().optional(),
  sort: z.number().int().min(0).max(9999).optional(),
};

export const projectsInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    locale: localeSchema,
    published: z.boolean().optional(),
    tag: z.string().trim().min(1).max(40).optional(),
  }),
  z.object({ action: z.literal("show"), locale: localeSchema, ref: refSchema }),
  z.object({
    action: z.literal("create"),
    locale: localeSchema,
    ...projectFieldSchemas,
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(2000),
  }),
  z.object({
    action: z.literal("edit"),
    locale: localeSchema,
    ref: refSchema,
    ...projectFieldSchemas,
  }),
  z.object({ action: z.literal("publish"), locale: localeSchema, ref: refSchema }),
  z.object({ action: z.literal("hide"), locale: localeSchema, ref: refSchema }),
  z.object({ action: z.literal("delete"), locale: localeSchema, ref: refSchema }),
]);

export type ProjectsInput = z.infer<typeof projectsInputSchema>;

export function composeProjectsArgv(input: ProjectsInput): string {
  const parts: string[] = ["projects"];
  switch (input.action) {
    case "list":
      parts.push("list");
      boolFlag(parts, "published", input.published);
      optionArg(parts, "tag", input.tag);
      break;
    case "show":
    case "publish":
    case "hide":
    case "delete":
      parts.push(input.action, shellQuoteValue(input.ref));
      break;
    case "create":
    case "edit":
      parts.push(input.action);
      if (input.action === "edit") parts.push(shellQuoteValue(input.ref));
      optionArg(parts, "title", input.title);
      optionArg(parts, "title-en", input.titleEn);
      optionArg(parts, "description", input.description);
      optionArg(parts, "description-en", input.descriptionEn);
      if (input.tags !== undefined) {
        parts.push("--tags", shellQuoteValue(input.tags.join(",")));
      }
      optionArg(parts, "url", input.url);
      optionArg(parts, "repo-url", input.repoUrl);
      boolFlag(parts, "featured", input.featured);
      boolFlag(parts, "published", input.published);
      numberArg(parts, "sort", input.sort);
      optionArg(parts, "slug", input.slug);
      break;
  }
  return parts.join(" ");
}

// ---- guestbook ----

export const guestbookInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    locale: localeSchema,
    filter: z.enum(["pending", "approved"]).default("pending"),
  }),
  z.object({ action: z.literal("show"), locale: localeSchema, id: idSchema }),
  z.object({ action: z.literal("approve"), locale: localeSchema, ids: idsSchema }),
  z.object({ action: z.literal("delete"), locale: localeSchema, ids: idsSchema }),
]);

export type GuestbookInput = z.infer<typeof guestbookInputSchema>;

export function composeGuestbookArgv(input: GuestbookInput): string {
  const parts: string[] = ["guestbook"];
  switch (input.action) {
    case "list":
      parts.push("list", `--${input.filter}`);
      break;
    case "show":
      parts.push("show", shellQuoteValue(input.id));
      break;
    case "approve":
    case "delete":
      parts.push(input.action, ...input.ids.map(shellQuoteValue));
      break;
  }
  return parts.join(" ");
}

// ---- contact ----

export const contactInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    locale: localeSchema,
    limit: z.number().int().min(1).max(100).optional(),
  }),
  z.object({ action: z.literal("show"), locale: localeSchema, id: idSchema }),
  z.object({ action: z.literal("delete"), locale: localeSchema, ids: idsSchema }),
]);

export type ContactInput = z.infer<typeof contactInputSchema>;

export function composeContactArgv(input: ContactInput): string {
  const parts: string[] = ["contact"];
  switch (input.action) {
    case "list":
      parts.push("list");
      numberArg(parts, "limit", input.limit);
      break;
    case "show":
      parts.push("show", shellQuoteValue(input.id));
      break;
    case "delete":
      parts.push("delete", ...input.ids.map(shellQuoteValue));
      break;
  }
  return parts.join(" ");
}

// ---- profile ----

const profileEditFieldSchemas = {
  roleFr: z.string().trim().min(1).max(120).optional(),
  roleEn: z.string().trim().min(1).max(120).optional(),
  alias: z.string().trim().min(1).max(80).optional(),
  location: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().min(3).max(200).optional(),
  statusFr: z.string().trim().min(1).max(120).optional(),
  statusEn: z.string().trim().min(1).max(120).optional(),
};

const labelSchema = z.string().trim().min(1).max(80);
const yearSchema = z.string().trim().regex(/^\d{4}$/, "expected a 4-digit year");

const timelineFieldSchemas = {
  titleFr: z.string().trim().min(1).max(160).optional(),
  titleEn: z.string().trim().min(1).max(160).optional(),
  orgFr: z.string().trim().min(1).max(160).optional(),
  orgEn: z.string().trim().min(1).max(160).optional(),
  descFr: z.string().trim().min(1).max(600).optional(),
  descEn: z.string().trim().min(1).max(600).optional(),
};

export const profileInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("show"), locale: localeSchema }),
  z.object({
    action: z.literal("edit"),
    locale: localeSchema,
    ...profileEditFieldSchemas,
  }),
  z.object({
    action: z.literal("social_add"),
    locale: localeSchema,
    label: labelSchema,
    url: z.string().trim().min(1).max(300),
  }),
  z.object({
    action: z.literal("social_delete"),
    locale: localeSchema,
    label: labelSchema,
  }),
  z.object({
    action: z.literal("skill_add"),
    locale: localeSchema,
    label: labelSchema,
    level: z.number().int().min(1).max(5),
  }),
  z.object({
    action: z.literal("skill_edit"),
    locale: localeSchema,
    label: labelSchema,
    level: z.number().int().min(1).max(5),
  }),
  z.object({
    action: z.literal("skill_delete"),
    locale: localeSchema,
    label: labelSchema,
  }),
  z.object({
    action: z.literal("timeline_add"),
    locale: localeSchema,
    year: yearSchema,
    ...timelineFieldSchemas,
    titleFr: z.string().trim().min(1).max(160),
  }),
  z.object({
    action: z.literal("timeline_edit"),
    locale: localeSchema,
    year: yearSchema,
    newYear: yearSchema.optional(),
    ...timelineFieldSchemas,
  }),
  z.object({
    action: z.literal("timeline_delete"),
    locale: localeSchema,
    year: yearSchema,
  }),
]);

export type ProfileInput = z.infer<typeof profileInputSchema>;

export function composeProfileArgv(input: ProfileInput): string {
  const parts: string[] = ["profile"];
  switch (input.action) {
    case "show":
      parts.push("show");
      break;
    case "edit":
      parts.push("edit");
      optionArg(parts, "role-fr", input.roleFr);
      optionArg(parts, "role-en", input.roleEn);
      optionArg(parts, "alias", input.alias);
      optionArg(parts, "location", input.location);
      optionArg(parts, "email", input.email);
      optionArg(parts, "status-fr", input.statusFr);
      optionArg(parts, "status-en", input.statusEn);
      break;
    case "social_add":
      parts.push("social", "add");
      optionArg(parts, "label", input.label);
      optionArg(parts, "url", input.url);
      break;
    case "social_delete":
      parts.push("social", "delete", shellQuoteValue(input.label));
      break;
    case "skill_add":
      parts.push("skill", "add");
      optionArg(parts, "label", input.label);
      numberArg(parts, "level", input.level);
      break;
    case "skill_edit":
      parts.push("skill", "edit", shellQuoteValue(input.label));
      numberArg(parts, "level", input.level);
      break;
    case "skill_delete":
      parts.push("skill", "delete", shellQuoteValue(input.label));
      break;
    case "timeline_add":
    case "timeline_edit": {
      const target = input.action === "timeline_add" ? "add" : "edit";
      parts.push("timeline", target);
      if (input.action === "timeline_edit") parts.push(shellQuoteValue(input.year));
      optionArg(parts, "year", input.action === "timeline_add" ? input.year : input.newYear);
      optionArg(parts, "title-fr", input.titleFr);
      optionArg(parts, "title-en", input.titleEn);
      optionArg(parts, "org-fr", input.orgFr);
      optionArg(parts, "org-en", input.orgEn);
      optionArg(parts, "desc-fr", input.descFr);
      optionArg(parts, "desc-en", input.descEn);
      break;
    }
    case "timeline_delete":
      parts.push("timeline", "delete", shellQuoteValue(input.year));
      break;
  }
  return parts.join(" ");
}

// ---- blog (read-only; drafts stay save_blog_draft's job) ----

export const blogInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    locale: localeSchema,
    drafts: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("show"),
    locale: localeSchema,
    slug: z.string().trim().min(1).max(120),
  }),
]);

export type BlogInput = z.infer<typeof blogInputSchema>;

export function composeBlogArgv(input: BlogInput): string {
  const parts: string[] = ["blog"];
  switch (input.action) {
    case "list":
      parts.push("list");
      boolFlag(parts, "drafts", input.drafts);
      break;
    case "show":
      parts.push("show", shellQuoteValue(input.slug));
      break;
  }
  return parts.join(" ");
}

// ---- stats ----

export const statsInputSchema = z.object({ locale: localeSchema });

export type StatsInput = z.infer<typeof statsInputSchema>;

/** The stats argv is constant — the tool input only carries the locale. */
export function composeStatsArgv(): string {
  return "stats";
}

// ---- approval / authorization ----

/** Actions that mutate data — each one requires explicit user approval. */
export const MUTATING_ACTIONS: Record<string, ReadonlySet<string>> = {
  projects: new Set(["create", "edit", "publish", "hide", "delete"]),
  guestbook: new Set(["approve", "delete"]),
  contact: new Set(["delete"]),
  profile: new Set([
    "edit",
    "social_add",
    "social_delete",
    "skill_add",
    "skill_edit",
    "skill_delete",
    "timeline_add",
    "timeline_edit",
    "timeline_delete",
  ]),
  blog: new Set<string>(),
  stats: new Set<string>(),
};

export type StudioApprovalDecision =
  | "user-approval"
  | { readonly type: "approved"; readonly reason?: string }
  | { readonly type: "denied"; readonly reason: string };

/**
 * Structural slice of eve's ApprovalContext — keeps this module eve-free
 * while staying assignable to `approval` on the authored tool definitions.
 */
export interface StudioApprovalContextLike {
  readonly session: {
    readonly auth: { readonly current: { readonly principalId: string } | null };
  };
  /**
   * unknown on purpose: eve types this as the tool's parsed input, and the
   * stats input ({ locale }) shares no property with an { action } shape —
   * the weak-type check would reject the slice for that tool. studioApproval
   * narrows it locally.
   */
  readonly toolInput?: unknown;
}

/**
 * Shared approval policy: non-owners are denied without a prompt (no tool
 * surface leaked to the public), mutations need the owner's approval (the
 * terminal renders approve/deny), reads are auto-approved — they are public
 * in the shell anyway.
 */
export function studioApproval(mutating: ReadonlySet<string>) {
  return (ctx: StudioApprovalContextLike): StudioApprovalDecision => {
    const current = ctx.session.auth.current;
    if (!current || current.principalId !== STUDIO_OWNER) {
      return {
        type: "denied",
        reason: "Studio tools are reserved for the portfolio owner.",
      };
    }
    const input = ctx.toolInput as { readonly action?: unknown } | undefined;
    const action = typeof input?.action === "string" ? input.action : "";
    if (mutating.has(action)) return "user-approval";
    return { type: "approved" };
  };
}

/**
 * Structural slice of eve's SessionAuth — the dynamic tool resolver passes its
 * `ctx.session.auth` here (see agent/tools/studio.ts).
 */
export interface StudioAuthLike {
  readonly current: {
    readonly principalId: string;
    readonly attributes?: Readonly<Record<string, string | readonly string[]>>;
  } | null;
}

/**
 * The v2.1 registration gate: the caller must be the studio owner (a valid
 * sudo session cookie — studioOwnerAuth revalidates it on every request)
 * AND must have enabled the tools at boot (cookie → `studio-tools` attr).
 */
export function studioToolsEnabled(auth: StudioAuthLike | null | undefined): boolean {
  const current = auth?.current;
  if (!current || current.principalId !== STUDIO_OWNER) return false;
  return current.attributes?.[STUDIO_TOOLS_ATTRIBUTE] === "on";
}

// ---- execution ----

export interface StudioToolOutput {
  ok: boolean;
  /** English shell output — the model translates it for the user. */
  output: string;
}

/** Structural slice of eve's ToolContext for the owner re-check. */
export interface StudioToolContextLike {
  readonly session: {
    readonly auth: { readonly current: { readonly principalId: string } | null };
  };
}

/**
 * Runs one composed Studio argv elevated, with the revalidation bridge wired
 * into CommandDeps.revalidate. The principal is re-checked here (defense in
 * depth — registration is already gated by the dynamic resolver).
 */
export async function executeStudioTool(
  ctx: StudioToolContextLike,
  locale: "fr" | "en",
  argv: string,
): Promise<StudioToolOutput> {
  const current = ctx.session.auth.current;
  if (!current || current.principalId !== STUDIO_OWNER) {
    return {
      ok: false,
      output: "unauthorized — studio tools are reserved for the portfolio owner",
    };
  }

  const collector = createRevalidationCollector();
  const result = await execStudioCommand(argv, {
    supabase: getSupabaseAdminClient(),
    locale,
    revalidate: (pathname) => collector.add(pathname),
    elevated: true,
  });

  const flush = await collector.flush();
  const lines: ShellLine[] = [...result.lines];
  if (flush.revalidated > 0) {
    lines.push({
      text: `revalidated ${flush.revalidated} page${flush.revalidated === 1 ? "" : "s"}`,
      kind: "dim",
    });
  } else if (!flush.ok) {
    lines.push({
      text: `revalidation deferred — ${flush.error ?? "bridge unavailable"}`,
      kind: "warn",
    });
  }

  return { ok: result.ok, output: lines.map((l) => l.text).join("\n") };
}

// ---- labels ----

/** Extract a short target for the "start" label (ref, label, year, ids…). */
function labelTarget(input: unknown): string {
  const i = input as {
    action?: string;
    ref?: string;
    id?: string;
    label?: string;
    year?: string;
    slug?: string;
    title?: string;
    ids?: string[];
  };
  if (i.ref) return i.ref;
  if (i.label) return i.label;
  if (i.year) return i.year;
  if (i.slug) return i.slug;
  if (i.title) return i.title;
  if (i.id) return i.id;
  if (i.ids) return i.ids.length === 1 ? i.ids[0] : `${i.ids.length} ids`;
  return "";
}

/**
 * Shared label factory: `start` reads like a shell line ("studio projects
 * publish my-slug"), `complete` reports the tool outcome.
 */
export function studioToolLabel(resource: string) {
  return {
    start: (input: unknown): string => {
      const i = input as { action?: string };
      const head = i.action ? `studio ${resource} ${i.action}` : `studio ${resource}`;
      const target = labelTarget(input);
      return target ? `${head} ${target}` : head;
    },
    complete: (_input: unknown, output: unknown): string => {
      return (output as { ok?: boolean } | undefined)?.ok ? "done" : "failed";
    },
  };
}
