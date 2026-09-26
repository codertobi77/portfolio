/**
 * Command registry for the Studio shell — plain data, isomorphic.
 * Powers `help` output, Tab completion and boolean-flag resolution.
 */

export interface OptionSpec {
  /** Option name without "--". */
  name: string;
  /** Boolean flag: takes no value. */
  flag?: boolean;
  /** Value placeholder shown in help, e.g. "<title>". */
  arg?: string;
  description: string;
}

export interface SubSpec {
  name: string;
  /** Positional/option summary, e.g. "<ref>…". */
  args?: string;
  options?: OptionSpec[];
  description: string;
}

export interface CommandSpec {
  name: string;
  description: string;
  /** Positional summary for commands without subcommands. */
  args?: string;
  subs?: SubSpec[];
  /** Handled in the browser (never sent to the server). */
  client?: true;
}

const PROJECT_FIELDS: OptionSpec[] = [
  { name: "title", arg: "<t>", description: "title (fr)" },
  { name: "title-en", arg: "<t>", description: "title (en)" },
  { name: "description", arg: "<d>", description: "description (fr)" },
  { name: "description-en", arg: "<d>", description: "description (en)" },
  { name: "slug", arg: "<s>", description: "slug (defaults to slugified title)" },
  { name: "tags", arg: "<a,b>", description: "comma-separated tags (max 8)" },
  { name: "url", arg: "<u>", description: "live URL" },
  { name: "repo-url", arg: "<u>", description: "source repository URL" },
  { name: "featured", flag: true, description: "mark as featured" },
  { name: "published", flag: true, description: "publish immediately" },
  { name: "sort", arg: "<n>", description: "sort order (0–9999)" },
];

export const SHELL_COMMANDS: CommandSpec[] = [
  {
    name: "help",
    args: "[command]",
    description: "list commands, or details for one command",
  },
  {
    name: "projects",
    description: "manage portfolio projects",
    subs: [
      {
        name: "list",
        args: "[--published] [--tag <tag>]",
        options: [
          { name: "published", flag: true, description: "only published projects" },
          { name: "tag", arg: "<tag>", description: "filter by tag" },
        ],
        description: "list projects",
      },
      { name: "show", args: "<ref>", description: "show one project (slug, id or id prefix)" },
      {
        name: "create",
        args: "--title <t> --description <d> [options]",
        options: PROJECT_FIELDS,
        description: "create a project",
      },
      {
        name: "edit",
        args: "<ref> --<field> <value>…",
        options: PROJECT_FIELDS,
        description: "update fields of a project",
      },
      { name: "publish", args: "<ref>", description: "set published = true" },
      { name: "hide", args: "<ref>", description: "set published = false" },
      { name: "delete", args: "<ref>", description: "delete a project" },
    ],
  },
  {
    name: "guestbook",
    description: "moderate guestbook entries",
    subs: [
      {
        name: "list",
        args: "[--pending|--approved]",
        options: [
          { name: "pending", flag: true, description: "pending entries (default)" },
          { name: "approved", flag: true, description: "approved entries" },
        ],
        description: "list entries (default: pending)",
      },
      { name: "show", args: "<id>", description: "show one entry" },
      { name: "approve", args: "<id>…", description: "approve entries" },
      { name: "delete", args: "<id>…", description: "delete entries" },
    ],
  },
  {
    name: "contact",
    description: "read the contact inbox",
    subs: [
      {
        name: "list",
        args: "[--limit <n>]",
        options: [{ name: "limit", arg: "<n>", description: "max results (default 20, max 100)" }],
        description: "list messages (newest first)",
      },
      { name: "show", args: "<id>", description: "show one message" },
      { name: "delete", args: "<id>…", description: "delete messages" },
    ],
  },
  {
    name: "blog",
    description: "inspect blog posts (read-only — drafts are the agent's job)",
    subs: [
      {
        name: "list",
        args: "[--locale fr|en] [--drafts]",
        options: [
          { name: "locale", arg: "<fr|en>", description: "content locale (default: page locale)" },
          { name: "drafts", flag: true, description: "only drafts" },
        ],
        description: "list posts (drafts included)",
      },
      {
        name: "show",
        args: "<slug> [--locale fr|en]",
        options: [
          { name: "locale", arg: "<fr|en>", description: "content locale (default: page locale)" },
        ],
        description: "show one post (frontmatter)",
      },
    ],
  },
  { name: "stats", description: "counts across projects, guestbook, contact, blog" },
  { name: "whoami", description: "print the current principal" },
  {
    name: "eve",
    args: "<message>",
    description: "chat with the eve agent (drafting, save_blog_draft)",
    client: true,
  },
  { name: "approve", description: "approve the agent's pending tool call", client: true },
  { name: "deny", description: "deny the agent's pending tool call", client: true },
  { name: "clear", description: "clear the screen", client: true },
  { name: "logout", description: "end the studio session", client: true },
];

export function findCommand(name: string): CommandSpec | undefined {
  return SHELL_COMMANDS.find((c) => c.name === name);
}

/** Boolean flag names for a command (+subcommand) — feeds the parser. */
export function boolFlagsFor(command: string, sub?: string): Set<string> {
  const spec = findCommand(command);
  if (!spec) return new Set();
  const flags = new Set<string>();
  for (const opt of spec.subs?.find((s) => s.name === sub)?.options ?? []) {
    if (opt.flag) flags.add(opt.name);
  }
  return flags;
}

/** One-line usage string, e.g. "usage: projects create --title <t> …". */
export function usageLine(command: string, sub?: string): string | null {
  const spec = findCommand(command);
  if (!spec) return null;
  if (!sub) {
    if (spec.subs) return `usage: ${spec.name} <subcommand> [options]`;
    return `usage: ${spec.name} ${spec.args ?? ""}`.replace(/\s+$/, "");
  }
  const subSpec = spec.subs?.find((s) => s.name === sub);
  if (!subSpec) return null;
  return `usage: ${spec.name} ${subSpec.name} ${subSpec.args ?? ""}`.replace(/\s+$/, "");
}

const padCmd = (name: string, width: number) => name + " ".repeat(Math.max(1, width - name.length));

/** Plain-text help tree — rendered as terminal lines by exec.ts. */
export function helpLines(command?: string): string[] {
  if (!command) {
    const lines = ["portfolio shell — owner commands", ""];
    for (const c of SHELL_COMMANDS) {
      lines.push(`  ${padCmd(c.name, 11)}${c.description}`);
    }
    lines.push("");
    lines.push("type 'help <command>' for details · Tab completes · ↑ recalls history");
    return lines;
  }

  const spec = findCommand(command);
  if (!spec) return [];
  const lines = [`${spec.name} — ${spec.description}`];
  const usage = usageLine(spec.name);
  if (usage) lines.push(usage);
  lines.push("");

  for (const s of spec.subs ?? []) {
    lines.push(`  ${padCmd(s.name, 10)}${s.description}`);
  }
  for (const s of spec.subs ?? []) {
    if (!s.options?.length) continue;
    lines.push("");
    lines.push(`options — ${spec.name} ${s.name}:`);
    for (const o of s.options) {
      const label = o.flag ? `--${o.name}` : `--${o.name} ${o.arg ?? "<value>"}`;
      lines.push(`  ${padCmd(label, 22)}${o.description}`);
    }
  }
  if (!spec.subs) {
    lines.push("");
    lines.push(`  ${padCmd(spec.name, 11)}${spec.description}`);
  }
  return lines;
}

// ---- Tab completion ----

export interface Completion {
  /** Replacement for the token being completed (longest common prefix or unique hit). */
  replace?: string;
  /** All candidates — displayed by the terminal when ambiguous. */
  candidates?: string[];
}

function longestCommonPrefix(values: string[]): string {
  if (values.length === 0) return "";
  let prefix = values[0];
  for (const v of values) {
    while (!v.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}

function matchPool(pool: string[], partial: string): Completion | null {
  const hits = pool.filter((p) => p.startsWith(partial));
  if (hits.length === 0) return null;
  if (hits.length === 1) return { replace: hits[0] };
  const lcp = longestCommonPrefix(hits);
  if (lcp.length > partial.length) return { replace: lcp };
  return { candidates: hits };
}

/** Best-effort completion of the token being typed (quotes are not expanded). */
export function completeInput(input: string): Completion | null {
  const endsWithSpace = /\s$/.test(input);
  const parts = input.split(/\s+/).filter(Boolean);
  const completing = endsWithSpace ? "" : (parts.pop() ?? "");
  const head = parts;

  if (head.length === 0) {
    return matchPool(
      SHELL_COMMANDS.map((c) => c.name),
      completing,
    );
  }

  const spec = findCommand(head[0]);
  if (!spec) return null;

  if (head.length === 1) {
    if (spec.subs) {
      return matchPool(
        spec.subs.map((s) => s.name),
        completing,
      );
    }
    return null;
  }

  const sub = spec.subs?.find((s) => s.name === head[1]);
  const options = sub?.options ?? [];
  if (completing.startsWith("--")) {
    return matchPool(
      options.map((o) => `--${o.name}`),
      completing,
    );
  }
  if (completing === "") {
    if (options.length === 0) return null;
    return { candidates: options.map((o) => `--${o.name}`) };
  }
  return null;
}
