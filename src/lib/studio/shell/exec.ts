import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getBlogPost, getBlogPosts } from "../../blog";
import { ShellParseError, parseCommand, tokenize, type ParsedCommand } from "./parse";
import { boolFlagsFor, findCommand, helpLines, usageLine } from "./registry";
import type { CommandDeps, ShellLine, StudioCommandResult } from "./types";

/**
 * Server-side execution of Studio shell commands.
 *
 * NOTE: keep this module free of `next/*` imports (same rule as lib/studio.ts):
 * everything Next-specific — the owner guard, revalidatePath, the service-role
 * client — is injected by the server action as CommandDeps. This also makes the
 * handlers runnable outside Next against a real Supabase project (scratch tests).
 *
 * Output is English by design (classic shell convention), regardless of locale.
 */

// ---- shared helpers ----

type Lines = ShellLine[];

const out = (text: string): ShellLine => ({ text });
const ok = (text: string): ShellLine => ({ text, kind: "ok" });
const err = (text: string): ShellLine => ({ text, kind: "err" });
const dim = (text: string): ShellLine => ({ text, kind: "dim" });
const warn = (text: string): ShellLine => ({ text, kind: "warn" });
const head = (text: string): ShellLine => ({ text, kind: "head" });

const success = (lines: Lines): StudioCommandResult => ({ ok: true, lines });
const failure = (lines: Lines): StudioCommandResult => ({ ok: false, lines });

const ID_PREFIX_MIN = 8;
const shortId = (id: string) => id.slice(0, 8);

function pad(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text + " ".repeat(width - text.length);
}

function trunc(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "draft"
  );
}

function issuesText(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`).join("; ");
}

function kv(key: string, value: string | null | undefined): ShellLine {
  return value ? out(`  ${pad(key, 14)}${value}`) : dim(`  ${pad(key, 14)}—`);
}

function requireSupabase(deps: CommandDeps): StudioCommandResult | null {
  return deps.supabase
    ? null
    : failure([err("supabase is not configured — set SUPABASE_SERVICE_ROLE_KEY")]);
}

function usage(command: string, sub?: string): StudioCommandResult {
  return failure([err(usageLine(command, sub) ?? `usage: ${command}`)]);
}

function rejectUnknownOptions(
  options: Record<string, string | true>,
  known: ReadonlySet<string>,
): StudioCommandResult | null {
  const unknown = Object.keys(options).filter((k) => !known.has(k));
  if (unknown.length === 0) return null;
  return failure([err(`unknown option: --${unknown.join(", --")}`)]);
}

function isIdLike(ref: string): boolean {
  return /^[0-9a-f-]{8,}$/i.test(ref);
}

// ---- row types ----

interface ProjectRow {
  id: string;
  slug: string;
  title: string;
  title_en: string | null;
  description: string;
  description_en: string | null;
  tags: string[];
  url: string | null;
  repo_url: string | null;
  featured: boolean;
  published: boolean;
  sort_order: number;
  created_at: string;
}

interface GuestbookRow {
  id: string;
  name: string;
  message: string;
  approved: boolean;
  created_at: string;
}

interface ContactRow {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  created_at: string;
}

// ---- zod schemas ----

const localeSchema = z.enum(["fr", "en"]);

const projectFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  "title-en": z.string().trim().max(200).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  "description-en": z.string().trim().max(2000).optional(),
  tags: z
    .string()
    .transform((s) => s.split(",").map((t) => t.trim()).filter(Boolean))
    .pipe(z.array(z.string().min(1).max(40)).max(8))
    .optional(),
  url: z.string().trim().max(300).optional(),
  "repo-url": z.string().trim().max(300).optional(),
  featured: z.boolean().optional(),
  published: z.boolean().optional(),
  sort: z.coerce.number().int().min(0).max(9999).optional(),
  slug: z.string().trim().max(80).optional(),
});

const KNOWN_PROJECT_FIELDS = new Set(Object.keys(projectFieldsSchema.shape));

type ProjectFields = z.infer<typeof projectFieldsSchema>;

function projectRow(f: ProjectFields, base: Partial<ProjectRow>): Partial<ProjectRow> {
  const row: Partial<ProjectRow> = { ...base };
  if (f.title !== undefined) row.title = f.title;
  if (f["title-en"] !== undefined) row.title_en = f["title-en"] || null;
  if (f.description !== undefined) row.description = f.description;
  if (f["description-en"] !== undefined) row.description_en = f["description-en"] || null;
  if (f.tags !== undefined) row.tags = f.tags;
  if (f.url !== undefined) row.url = f.url || null;
  if (f["repo-url"] !== undefined) row.repo_url = f["repo-url"] || null;
  if (f.featured !== undefined) row.featured = f.featured;
  if (f.published !== undefined) row.published = f.published;
  if (f.sort !== undefined) row.sort_order = f.sort;
  if (f.slug !== undefined && f.slug) row.slug = slugify(f.slug);
  return row;
}

// ---- resolution (slug | id | id prefix) ----

async function resolveProject(
  deps: CommandDeps,
  ref: string | undefined,
  sub: string,
): Promise<ProjectRow | StudioCommandResult> {
  if (!ref) return usage("projects", sub);
  const client = deps.supabase as SupabaseClient;

  // exact slug first — a slug is what the user usually types
  const bySlug = await client.from("projects").select("*").eq("slug", ref).maybeSingle();
  if (bySlug.error) return failure([err(`database error: ${bySlug.error.message}`)]);
  if (bySlug.data) return bySlug.data as ProjectRow;

  // PostgREST can't LIKE a uuid column (operator uuid ~~ unknown), so id
  // prefixes are matched client-side on a light id scan.
  if (isIdLike(ref)) {
    const needle = ref.toLowerCase();
    const scan = await client.from("projects").select("id, slug").limit(1000);
    if (scan.error) return failure([err(`database error: ${scan.error.message}`)]);
    const hits = ((scan.data ?? []) as { id: string; slug: string }[]).filter((r) =>
      r.id.toLowerCase().startsWith(needle),
    );
    if (hits.length === 1) {
      const full = await client.from("projects").select("*").eq("id", hits[0].id).maybeSingle();
      if (full.error) return failure([err(`database error: ${full.error.message}`)]);
      if (full.data) return full.data as ProjectRow;
    }
    if (hits.length > 1) {
      return failure([
        err(`ambiguous id '${ref}' — ${hits.length} matches`),
        dim(hits.map((r) => r.slug).join("  ")),
      ]);
    }
  }
  return failure([err(`project not found: ${ref}`)]);
}

const TABLE_LABEL: Record<"guestbook" | "contact_messages", string> = {
  guestbook: "entry",
  contact_messages: "message",
};

async function resolveIds(
  client: SupabaseClient,
  table: "guestbook" | "contact_messages",
  refs: string[],
): Promise<{ ids: string[]; errors: Lines }> {
  const ids: string[] = [];
  const errors: Lines = [];

  // uuid LIKE is not supported by PostgREST (operator uuid ~~ unknown):
  // scan ids once and prefix-match client-side.
  const scan = await client.from(table).select("id").limit(2000);
  if (scan.error) {
    return { ids, errors: [err(`database error: ${scan.error.message}`)] };
  }
  const known = ((scan.data ?? []) as { id: string }[]).map((r) => r.id);

  for (const ref of refs) {
    if (!isIdLike(ref)) {
      errors.push(err(`invalid id '${ref}' — expected at least ${ID_PREFIX_MIN} hex characters`));
      continue;
    }
    const needle = ref.toLowerCase();
    const hits = known.filter((id) => id.toLowerCase().startsWith(needle));
    if (hits.length === 1) {
      ids.push(hits[0]);
    } else if (hits.length === 0) {
      errors.push(err(`${TABLE_LABEL[table]} not found: ${ref}`));
    } else {
      errors.push(err(`ambiguous id '${ref}' — ${hits.length} matches`));
    }
  }
  return { ids, errors };
}

// ---- dispatcher ----

export async function execStudioCommand(
  input: string,
  deps: CommandDeps,
): Promise<StudioCommandResult> {
  let peekCommand = "";
  let peekSub: string | undefined;
  try {
    const tokens = tokenize(input);
    peekCommand = tokens[0] ?? "";
    peekSub = tokens[1];
  } catch (e) {
    return parseFailure(e);
  }

  let parsed: ParsedCommand;
  try {
    parsed = parseCommand(input, boolFlagsFor(peekCommand, peekSub));
  } catch (e) {
    return parseFailure(e);
  }

  if (findCommand(parsed.command)?.client) {
    return failure([dim(`'${parsed.command}' runs in the browser terminal`)]);
  }

  // Reject options the registry doesn't declare for this command+sub
  // (list/show/publish/hide/delete… don't validate fields themselves).
  const spec = findCommand(parsed.command);
  const subSpec = spec?.subs?.find((s) => s.name === parsed.sub);
  if (subSpec) {
    const known = new Set(subSpec.options?.map((o) => o.name) ?? []);
    const unknown = rejectUnknownOptions(parsed.options, known);
    if (unknown) return unknown;
  }

  switch (parsed.command) {
    case "help": {
      // tokens[1] always lands in `sub` (see parse.ts) — e.g. `help projects`.
      const target = parsed.sub;
      if (!target) return success(helpLines().map(out));
      if (!findCommand(target)) {
        return failure([err(`unknown command: ${target}`), dim("type 'help' to list commands")]);
      }
      return success(helpLines(target).map(out));
    }
    case "projects":
      return cmdProjects(parsed, deps);
    case "guestbook":
      return cmdGuestbook(parsed, deps);
    case "contact":
      return cmdContact(parsed, deps);
    case "blog":
      return cmdBlog(parsed, deps);
    case "stats":
      return cmdStats(deps);
    case "whoami":
      return success([out("studio-owner")]);
    default:
      return failure([
        err(`unknown command: ${parsed.command}`),
        dim("type 'help' to list commands"),
      ]);
  }
}

function parseFailure(e: unknown): StudioCommandResult {
  if (e instanceof ShellParseError) return failure([err(e.message)]);
  return failure([err("internal error — could not parse command")]);
}

// ---- projects ----

async function cmdProjects(
  parsed: ParsedCommand,
  deps: CommandDeps,
): Promise<StudioCommandResult> {
  const sub = parsed.sub;
  switch (sub) {
    case "list":
      return projectsList(parsed, deps);
    case "show":
      return projectsShow(parsed, deps);
    case "create":
      return projectsCreate(parsed, deps);
    case "edit":
      return projectsEdit(parsed, deps);
    case "publish":
      return projectsSetPublished(parsed, deps, true);
    case "hide":
      return projectsSetPublished(parsed, deps, false);
    case "delete":
      return projectsDelete(parsed, deps);
    default:
      if (!sub) return success(helpLines("projects").map(out));
      return failure([
        err(`unknown subcommand: projects ${sub}`),
        dim("type 'help projects'"),
      ]);
  }
}

async function projectsList(
  parsed: ParsedCommand,
  deps: CommandDeps,
): Promise<StudioCommandResult> {
  const guard = requireSupabase(deps);
  if (guard) return guard;
  const client = deps.supabase as SupabaseClient;

  let query = client.from("projects").select("*").order("sort_order", { ascending: true });
  if (parsed.options.published === true) query = query.eq("published", true);
  if (typeof parsed.options.tag === "string" && parsed.options.tag) {
    query = query.contains("tags", [parsed.options.tag]);
  }
  const res = await query.limit(200);
  if (res.error) return failure([err(`database error: ${res.error.message}`)]);
  const rows = (res.data ?? []) as ProjectRow[];
  if (rows.length === 0) return success([dim("no projects found")]);

  const lines: Lines = [
    head(`${pad("id", 8)}  ${pad("slug", 24)}  ${pad("title", 34)}  p  f  sort`),
  ];
  for (const r of rows) {
    lines.push(
      out(
        `${pad(shortId(r.id), 8)}  ${pad(r.slug, 24)}  ${pad(trunc(r.title, 34), 34)}  ${
          r.published ? "y" : "-"
        }  ${r.featured ? "*" : "-"}  ${String(r.sort_order).padStart(4)}`,
      ),
    );
  }
  lines.push(dim(`${rows.length} project${rows.length === 1 ? "" : "s"} found`));
  return success(lines);
}

async function projectsShow(
  parsed: ParsedCommand,
  deps: CommandDeps,
): Promise<StudioCommandResult> {
  const guard = requireSupabase(deps);
  if (guard) return guard;
  const resolved = await resolveProject(deps, parsed.positionals[0], "show");
  if (!("id" in resolved)) return resolved;
  const r = resolved;
  return success([
    head(`project ${r.slug}`),
    kv("id", r.id),
    kv("title", r.title),
    kv("title_en", r.title_en),
    kv("description", r.description),
    kv("description_en", r.description_en),
    kv("tags", r.tags.join(", ")),
    kv("url", r.url),
    kv("repo_url", r.repo_url),
    kv("published", r.published ? "yes" : "no"),
    kv("featured", r.featured ? "yes" : "no"),
    kv("sort_order", String(r.sort_order)),
    kv("created_at", fmtDate(r.created_at)),
  ]);
}

async function parseProjectFields(
  parsed: ParsedCommand,
): Promise<ProjectFields | StudioCommandResult> {
  const unknown = rejectUnknownOptions(parsed.options, KNOWN_PROJECT_FIELDS);
  if (unknown) return unknown;
  const fields = projectFieldsSchema.safeParse(parsed.options);
  if (!fields.success) {
    return failure([err(`invalid field values: ${issuesText(fields.error)}`)]);
  }
  return fields.data;
}

async function projectsCreate(
  parsed: ParsedCommand,
  deps: CommandDeps,
): Promise<StudioCommandResult> {
  const guard = requireSupabase(deps);
  if (guard) return guard;
  const client = deps.supabase as SupabaseClient;

  const fields = await parseProjectFields(parsed);
  if ("lines" in fields) return fields;
  const f = fields;
  if (!f.title) {
    return failure([err("--title is required"), dim(usageLine("projects", "create") ?? "")]);
  }
  if (!f.description) {
    return failure([err("--description is required"), dim(usageLine("projects", "create") ?? "")]);
  }

  const slug = f.slug ? slugify(f.slug) : slugify(f.title);
  const dupe = await client.from("projects").select("id").eq("slug", slug).maybeSingle();
  if (dupe.error) return failure([err(`database error: ${dupe.error.message}`)]);
  if (dupe.data) return failure([err(`slug already exists: ${slug}`)]);

  const row = projectRow(f, {
    slug,
    title: f.title,
    description: f.description,
  });
  const res = await client.from("projects").insert(row).select("id").single();
  if (res.error) return failure([err(`database error: ${res.error.message}`)]);

  deps.revalidate(`/${deps.locale}`);
  const lines: Lines = [
    ok(`created project ${slug}`),
    dim(`id ${res.data.id}`),
    dim(`publish it: projects publish ${slug}`),
  ];
  return success(lines);
}

async function projectsEdit(
  parsed: ParsedCommand,
  deps: CommandDeps,
): Promise<StudioCommandResult> {
  const guard = requireSupabase(deps);
  if (guard) return guard;
  const client = deps.supabase as SupabaseClient;

  const fields = await parseProjectFields(parsed);
  if ("lines" in fields) return fields;
  const f = fields;

  const resolved = await resolveProject(deps, parsed.positionals[0], "edit");
  if (!("id" in resolved)) return resolved;

  const hasChange = Object.values(f).some((v) => v !== undefined);
  if (!hasChange) {
    return failure([
      err("nothing to update — provide at least one --field"),
      dim(usageLine("projects", "edit") ?? ""),
    ]);
  }

  const row = projectRow(f, {});
  if (row.slug && row.slug !== resolved.slug) {
    const dupe = await client.from("projects").select("id").eq("slug", row.slug).maybeSingle();
    if (dupe.error) return failure([err(`database error: ${dupe.error.message}`)]);
    if (dupe.data) return failure([err(`slug already exists: ${row.slug}`)]);
  }

  const res = await client.from("projects").update(row).eq("id", resolved.id);
  if (res.error) return failure([err(`database error: ${res.error.message}`)]);

  deps.revalidate(`/${deps.locale}`);
  const newSlug = row.slug ?? resolved.slug;
  return success([ok(`updated project ${newSlug}`)]);
}

async function projectsSetPublished(
  parsed: ParsedCommand,
  deps: CommandDeps,
  target: boolean,
): Promise<StudioCommandResult> {
  const guard = requireSupabase(deps);
  if (guard) return guard;
  const client = deps.supabase as SupabaseClient;
  const sub = target ? "publish" : "hide";

  const resolved = await resolveProject(deps, parsed.positionals[0], sub);
  if (!("id" in resolved)) return resolved;

  if (resolved.published === target) {
    return success([dim(`already ${target ? "published" : "hidden"}: ${resolved.slug}`)]);
  }
  const res = await client.from("projects").update({ published: target }).eq("id", resolved.id);
  if (res.error) return failure([err(`database error: ${res.error.message}`)]);

  deps.revalidate(`/${deps.locale}`);
  return success([ok(`${target ? "published" : "hidden"} project ${resolved.slug}`)]);
}

async function projectsDelete(
  parsed: ParsedCommand,
  deps: CommandDeps,
): Promise<StudioCommandResult> {
  const guard = requireSupabase(deps);
  if (guard) return guard;
  const client = deps.supabase as SupabaseClient;

  const resolved = await resolveProject(deps, parsed.positionals[0], "delete");
  if (!("id" in resolved)) return resolved;

  const res = await client.from("projects").delete().eq("id", resolved.id);
  if (res.error) return failure([err(`database error: ${res.error.message}`)]);

  deps.revalidate(`/${deps.locale}`);
  return success([ok(`deleted project ${resolved.slug}`)]);
}

// ---- guestbook ----

async function cmdGuestbook(
  parsed: ParsedCommand,
  deps: CommandDeps,
): Promise<StudioCommandResult> {
  switch (parsed.sub) {
    case "list":
      return guestbookList(parsed, deps);
    case "show":
      return guestbookShow(parsed, deps);
    case "approve":
      return guestbookMutate(parsed, deps, "approve");
    case "delete":
      return guestbookMutate(parsed, deps, "delete");
    default:
      if (!parsed.sub) return success(helpLines("guestbook").map(out));
      return failure([
        err(`unknown subcommand: guestbook ${parsed.sub}`),
        dim("type 'help guestbook'"),
      ]);
  }
}

async function guestbookList(
  parsed: ParsedCommand,
  deps: CommandDeps,
): Promise<StudioCommandResult> {
  const guard = requireSupabase(deps);
  if (guard) return guard;
  const client = deps.supabase as SupabaseClient;

  const approved = parsed.options.approved === true;
  const pending = parsed.options.pending === true;
  if (approved && pending) {
    return failure([err("--pending and --approved are mutually exclusive")]);
  }

  const res = await client
    .from("guestbook")
    .select("id, name, message, created_at")
    .eq("approved", approved)
    .order("created_at", { ascending: false })
    .limit(100);
  if (res.error) return failure([err(`database error: ${res.error.message}`)]);
  const rows = (res.data ?? []) as GuestbookRow[];
  if (rows.length === 0) {
    return success([dim(`no ${approved ? "approved" : "pending"} entries`)]);
  }

  const lines: Lines = [
    head(`${pad("id", 8)}  ${pad("date", 16)}  ${pad("name", 16)}  message`),
  ];
  for (const r of rows) {
    lines.push(
      out(
        `${pad(shortId(r.id), 8)}  ${pad(fmtDate(r.created_at), 16)}  ${pad(trunc(r.name, 16), 16)}  ${trunc(r.message, 60)}`,
      ),
    );
  }
  lines.push(
    dim(`${rows.length} ${approved ? "approved" : "pending"} entr${rows.length === 1 ? "y" : "ies"}`),
  );
  return success(lines);
}

async function guestbookShow(
  parsed: ParsedCommand,
  deps: CommandDeps,
): Promise<StudioCommandResult> {
  const guard = requireSupabase(deps);
  if (guard) return guard;
  const client = deps.supabase as SupabaseClient;

  const ref = parsed.positionals[0];
  if (!ref) return usage("guestbook", "show");
  const { ids, errors } = await resolveIds(client, "guestbook", [ref]);
  if (ids.length === 0) return failure(errors);

  const res = await client
    .from("guestbook")
    .select("*")
    .eq("id", ids[0])
    .maybeSingle();
  if (res.error || !res.data) {
    return failure([err(`database error: ${res.error?.message ?? "not found"}`)]);
  }
  const r = res.data as GuestbookRow;
  return success([
    head(`guestbook ${shortId(r.id)}`),
    kv("name", r.name),
    kv("approved", r.approved ? "yes" : "no"),
    kv("created_at", fmtDate(r.created_at)),
    out(""),
    out(r.message),
  ]);
}

async function guestbookMutate(
  parsed: ParsedCommand,
  deps: CommandDeps,
  action: "approve" | "delete",
): Promise<StudioCommandResult> {
  const guard = requireSupabase(deps);
  if (guard) return guard;
  const client = deps.supabase as SupabaseClient;

  const refs = parsed.positionals;
  if (refs.length === 0) return usage("guestbook", action);
  const { ids, errors } = await resolveIds(client, "guestbook", refs);

  const lines: Lines = [...errors];
  let changed = 0;
  for (const id of ids) {
    const res =
      action === "approve"
        ? await client.from("guestbook").update({ approved: true }).eq("id", id)
        : await client.from("guestbook").delete().eq("id", id);
    if (res.error) {
      lines.push(err(`database error: ${res.error.message}`));
    } else {
      changed += 1;
      lines.push(ok(`${action === "approve" ? "approved" : "deleted"} ${shortId(id)}`));
    }
  }
  if (changed > 0) deps.revalidate(`/${deps.locale}/guestbook`);
  return { ok: changed > 0, lines };
}

// ---- contact ----

async function cmdContact(
  parsed: ParsedCommand,
  deps: CommandDeps,
): Promise<StudioCommandResult> {
  switch (parsed.sub) {
    case "list":
      return contactList(parsed, deps);
    case "show":
      return contactShow(parsed, deps);
    case "delete":
      return contactDelete(parsed, deps);
    default:
      if (!parsed.sub) return success(helpLines("contact").map(out));
      return failure([
        err(`unknown subcommand: contact ${parsed.sub}`),
        dim("type 'help contact'"),
      ]);
  }
}

async function contactList(
  parsed: ParsedCommand,
  deps: CommandDeps,
): Promise<StudioCommandResult> {
  const guard = requireSupabase(deps);
  if (guard) return guard;
  const client = deps.supabase as SupabaseClient;

  const limitRes = z.coerce.number().int().min(1).max(100).default(20).safeParse(
    parsed.options.limit ?? 20,
  );
  if (!limitRes.success) {
    return failure([err("invalid --limit: expected 1–100")]);
  }

  const res = await client
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limitRes.data);
  if (res.error) return failure([err(`database error: ${res.error.message}`)]);
  const rows = (res.data ?? []) as ContactRow[];
  if (rows.length === 0) return success([dim("no messages found")]);

  const lines: Lines = [
    head(`${pad("id", 8)}  ${pad("date", 16)}  ${pad("from", 28)}  subject`),
  ];
  for (const r of rows) {
    lines.push(
      out(
        `${pad(shortId(r.id), 8)}  ${pad(fmtDate(r.created_at), 16)}  ${pad(trunc(`${r.name} <${r.email}>`, 28), 28)}  ${trunc(r.subject ?? "(no subject)", 40)}`,
      ),
    );
  }
  lines.push(dim(`${rows.length} message${rows.length === 1 ? "" : "s"} found`));
  return success(lines);
}

async function contactShow(
  parsed: ParsedCommand,
  deps: CommandDeps,
): Promise<StudioCommandResult> {
  const guard = requireSupabase(deps);
  if (guard) return guard;
  const client = deps.supabase as SupabaseClient;

  const ref = parsed.positionals[0];
  if (!ref) return usage("contact", "show");
  const { ids, errors } = await resolveIds(client, "contact_messages", [ref]);
  if (ids.length === 0) return failure(errors);

  const res = await client
    .from("contact_messages")
    .select("*")
    .eq("id", ids[0])
    .maybeSingle();
  if (res.error || !res.data) {
    return failure([err(`database error: ${res.error?.message ?? "not found"}`)]);
  }
  const r = res.data as ContactRow;
  return success([
    head(`contact ${shortId(r.id)}`),
    kv("name", r.name),
    kv("email", r.email),
    kv("subject", r.subject),
    kv("created_at", fmtDate(r.created_at)),
    out(""),
    out(r.message),
  ]);
}

async function contactDelete(
  parsed: ParsedCommand,
  deps: CommandDeps,
): Promise<StudioCommandResult> {
  const guard = requireSupabase(deps);
  if (guard) return guard;
  const client = deps.supabase as SupabaseClient;

  const refs = parsed.positionals;
  if (refs.length === 0) return usage("contact", "delete");
  const { ids, errors } = await resolveIds(client, "contact_messages", refs);

  const lines: Lines = [...errors];
  let changed = 0;
  for (const id of ids) {
    const res = await client.from("contact_messages").delete().eq("id", id);
    if (res.error) {
      lines.push(err(`database error: ${res.error.message}`));
    } else {
      changed += 1;
      lines.push(ok(`deleted ${shortId(id)}`));
    }
  }
  return { ok: changed > 0, lines };
}

// ---- blog (read-only) ----

function localeFromOptions(
  parsed: ParsedCommand,
  deps: CommandDeps,
): "fr" | "en" | StudioCommandResult {
  if (parsed.options.locale === undefined) return deps.locale;
  const res = localeSchema.safeParse(parsed.options.locale);
  if (!res.success) return failure([err("invalid --locale: expected fr or en")]);
  return res.data;
}

async function cmdBlog(
  parsed: ParsedCommand,
  deps: CommandDeps,
): Promise<StudioCommandResult> {
  switch (parsed.sub) {
    case "list":
      return blogList(parsed, deps);
    case "show":
      return blogShow(parsed, deps);
    default:
      if (!parsed.sub) return success(helpLines("blog").map(out));
      return failure([err(`unknown subcommand: blog ${parsed.sub}`), dim("type 'help blog'")]);
  }
}

async function blogList(
  parsed: ParsedCommand,
  deps: CommandDeps,
): Promise<StudioCommandResult> {
  const locale = localeFromOptions(parsed, deps);
  if (typeof locale !== "string") return locale;

  const posts = getBlogPosts(locale, undefined, true); // owner sees drafts
  const rows = parsed.options.drafts === true ? posts.filter((p) => p.draft) : posts;
  if (rows.length === 0) return success([dim("no posts found")]);

  const lines: Lines = [head(`${pad("slug", 32)}  ${pad("date", 10)}  title`)];
  for (const p of rows) {
    lines.push(
      out(`${pad(p.slug, 32)}  ${pad(p.date, 10)}  ${p.draft ? "[draft] " : ""}${p.title}`),
    );
  }
  lines.push(dim(`${rows.length} post${rows.length === 1 ? "" : "s"} (${locale})`));
  return success(lines);
}

async function blogShow(
  parsed: ParsedCommand,
  deps: CommandDeps,
): Promise<StudioCommandResult> {
  const locale = localeFromOptions(parsed, deps);
  if (typeof locale !== "string") return locale;

  const slug = parsed.positionals[0];
  if (!slug) return usage("blog", "show");

  const post = getBlogPost(locale, slug);
  if (!post) return failure([err(`post not found: ${locale}/${slug}`)]);

  return success([
    head(`blog/${locale}/${post.slug}`),
    kv("title", post.title),
    kv("date", post.date),
    kv("tags", post.tags.join(", ")),
    kv("draft", post.draft ? "yes" : "no"),
    kv("minutes", `${post.minutes}`),
    kv("excerpt", post.excerpt),
    dim(`read: /${deps.locale}/blog/${post.slug}`),
  ]);
}

// ---- stats ----

async function cmdStats(deps: CommandDeps): Promise<StudioCommandResult> {
  const blogFr = getBlogPosts("fr", undefined, true).length;
  const blogEn = getBlogPosts("en", undefined, true).length;

  if (!deps.supabase) {
    return success([
      head("portfolio stats"),
      out(`  blog        fr ${blogFr} · en ${blogEn} posts`),
      warn("  supabase is not configured — DB stats unavailable"),
    ]);
  }
  const client = deps.supabase;
  const countOf = async (table: string, filter?: [string, unknown]): Promise<string> => {
    let query = client.from(table).select("id", { count: "exact", head: true });
    if (filter) query = query.eq(filter[0], filter[1]);
    const res = await query;
    return res.error ? "?" : String(res.count ?? 0);
  };

  const [pt, pp, gp, ga, ct] = await Promise.all([
    countOf("projects"),
    countOf("projects", ["published", true]),
    countOf("guestbook", ["approved", false]),
    countOf("guestbook", ["approved", true]),
    countOf("contact_messages"),
  ]);

  return success([
    head("portfolio stats"),
    out(`  projects    ${pt} total · ${pp} published`),
    out(`  guestbook   ${gp} pending · ${ga} approved`),
    out(`  contact     ${ct} messages`),
    out(`  blog        fr ${blogFr} · en ${blogEn} posts`),
  ]);
}
