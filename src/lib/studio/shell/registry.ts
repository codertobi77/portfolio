/**
 * Command registry for the Studio shell — plain data, isomorphic.
 * Powers `help` output, Tab completion, boolean-flag resolution,
 * sudo protection checks and zsh-style input highlighting.
 *
 * Security model (see exec.ts + actions.ts):
 *   - read-only commands run for anyone (guests included)
 *   - `sudo: true` commands require the `sudo` prefix AND a valid
 *     elevated session; exec.ts refuses them otherwise
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
  /** Requires `sudo <command> …` — enforced by exec.ts. */
  sudo?: true;
  /**
   * The terminal runs an interactive wizard for this subcommand when
   * required fields are missing (e.g. bare `projects create`).
   */
  interactive?: true;
}

export interface CommandSpec {
  name: string;
  description: string;
  /** Positional summary for commands without subcommands. */
  args?: string;
  subs?: SubSpec[];
  /** Requires sudo elevation even without subcommands (eve). */
  sudo?: true;
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

const PROFILE_EDIT_FIELDS: OptionSpec[] = [
  { name: "role-fr", arg: "<r>", description: "role (fr)" },
  { name: "role-en", arg: "<r>", description: "role (en)" },
  { name: "alias", arg: "<a>", description: "creative alias" },
  { name: "location", arg: "<l>", description: "location" },
  { name: "email", arg: "<e>", description: "contact email" },
  { name: "status-fr", arg: "<s>", description: "availability status (fr)" },
  { name: "status-en", arg: "<s>", description: "availability status (en)" },
];

const PROFILE_TIMELINE_FIELDS: OptionSpec[] = [
  { name: "year", arg: "<y>", description: "milestone year" },
  { name: "title-fr", arg: "<t>", description: "title (fr)" },
  { name: "title-en", arg: "<t>", description: "title (en)" },
  { name: "org-fr", arg: "<o>", description: "organisation (fr)" },
  { name: "org-en", arg: "<o>", description: "organisation (en)" },
  { name: "desc-fr", arg: "<d>", description: "description (fr)" },
  { name: "desc-en", arg: "<d>", description: "description (en)" },
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
        args: "[--title <t> --description <d>] [options]",
        options: PROJECT_FIELDS,
        description: "create a project (wizard when fields are missing)",
        sudo: true,
        interactive: true,
      },
      {
        name: "edit",
        args: "<ref> --<field> <value>…",
        options: PROJECT_FIELDS,
        description: "update fields of a project",
        sudo: true,
      },
      { name: "publish", args: "<ref>", description: "set published = true", sudo: true },
      { name: "hide", args: "<ref>", description: "set published = false", sudo: true },
      { name: "delete", args: "<ref>", description: "delete a project", sudo: true },
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
      { name: "approve", args: "<id>…", description: "approve entries", sudo: true },
      { name: "delete", args: "<id>…", description: "delete entries", sudo: true },
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
      { name: "delete", args: "<id>…", description: "delete messages", sudo: true },
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
  {
    name: "profile",
    description: "read/edit the site persona (role, contact, socials, skills, timeline)",
    subs: [
      { name: "show", description: "display the merged site profile" },
      {
        name: "edit",
        args: "[--<field> <value>…]",
        options: PROFILE_EDIT_FIELDS,
        description: "edit persona fields (wizard when run bare)",
        sudo: true,
        interactive: true,
      },
      {
        name: "social",
        args: "add --label <l> --url <u> | delete <label>",
        options: [
          { name: "label", arg: "<l>", description: "social link label" },
          { name: "url", arg: "<u>", description: "social link URL" },
        ],
        description: "add or delete a social link",
        sudo: true,
      },
      {
        name: "skill",
        args: "add --label <l> --level <n> | edit <label> --level <n> | delete <label>",
        options: [
          { name: "label", arg: "<l>", description: "skill label" },
          { name: "level", arg: "<1-5>", description: "skill level (1–5)" },
        ],
        description: "add, edit or delete a skill",
        sudo: true,
      },
      {
        name: "timeline",
        args: "add --year <y> … | edit <year> … | delete <year>",
        options: PROFILE_TIMELINE_FIELDS,
        description: "add, edit or delete a timeline milestone (wizard for add)",
        sudo: true,
        interactive: true,
      },
    ],
  },
  { name: "stats", description: "counts across projects, guestbook, contact, blog" },
  { name: "whoami", description: "print the current principal" },
  {
    name: "eve",
    args: "[message]",
    description: "enter the eve agent shell (REPL — exit with exit/quit/Ctrl+D)",
    sudo: true,
    client: true,
  },
  {
    name: "sudo",
    args: "[-k|-v|-l] [command]",
    description: "run a command elevated (-k kill session, -v validate, -l list rights)",
    client: true,
  },
  { name: "approve", description: "approve the agent's pending tool call", client: true },
  { name: "deny", description: "deny the agent's pending tool call", client: true },
  { name: "clear", description: "clear the screen", client: true },
];

export function findCommand(name: string): CommandSpec | undefined {
  return SHELL_COMMANDS.find((c) => c.name === name);
}

/** Does (command, sub) require sudo elevation? Single source of truth. */
export function requiresSudo(command: string, sub?: string): boolean {
  const spec = findCommand(command);
  if (!spec) return false;
  if (spec.subs) return spec.subs.find((s) => s.name === sub)?.sudo === true;
  return spec.sudo === true;
}

/** Subcommand requiring an interactive wizard when fields are missing. */
export function isInteractive(command: string, sub?: string): boolean {
  const spec = findCommand(command);
  if (!spec) return false;
  if (spec.subs) return spec.subs.find((s) => s.name === sub)?.interactive === true;
  return false;
}

/** Every sudo-protected command path, e.g. ["projects create", …] — for `sudo -l`. */
export function sudoCommands(): string[] {
  const paths: string[] = [];
  for (const c of SHELL_COMMANDS) {
    if (c.subs) {
      for (const s of c.subs) {
        if (s.sudo) paths.push(`${c.name} ${s.name}`);
      }
    } else if (c.sudo) {
      paths.push(c.name);
    }
  }
  return paths;
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
    const lines = [
      "portfolio shell v2.0 — reads are public, * commands need sudo",
      "",
    ];
    for (const c of SHELL_COMMANDS) {
      const sudoMark = !c.subs && c.sudo ? "*" : " ";
      lines.push(` ${sudoMark}${padCmd(c.name, 11)}${c.description}`);
    }
    lines.push("");
    lines.push("sudo <command> elevates · 'sudo -k' ends the session · Tab completes · ↑ recalls history");
    return lines;
  }

  const spec = findCommand(command);
  if (!spec) return [];
  const lines = [`${spec.name} — ${spec.description}`];
  const usage = usageLine(spec.name);
  if (usage) lines.push(usage);
  lines.push("");

  for (const s of spec.subs ?? []) {
    lines.push(` ${s.sudo ? "*" : " "}${padCmd(s.name, 10)}${s.description}`);
  }
  for (const s of spec.subs ?? []) {
    if (!s.options?.length) continue;
    lines.push("");
    lines.push(`options — ${spec.name} ${s.name}${s.sudo ? " (sudo)" : ""}:`);
    for (const o of s.options) {
      const label = o.flag ? `--${o.name}` : `--${o.name} ${o.arg ?? "<value>"}`;
      lines.push(`  ${padCmd(label, 22)}${o.description}`);
    }
  }
  if (!spec.subs) {
    lines.push("");
    lines.push(spec.sudo ? "  requires sudo elevation" : "  public command");
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

  // `sudo <command> …` completes commands after the prefix too.
  const effectiveHead = head[0] === "sudo" ? head.slice(1) : head;
  if (effectiveHead.length === 0) {
    return matchPool(
      SHELL_COMMANDS.map((c) => c.name),
      completing,
    );
  }

  const spec = findCommand(effectiveHead[0]);
  if (!spec) return null;

  if (effectiveHead.length === 1) {
    if (spec.subs) {
      return matchPool(
        spec.subs.map((s) => s.name),
        completing,
      );
    }
    return null;
  }

  const sub = spec.subs?.find((s) => s.name === effectiveHead[1]);
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
