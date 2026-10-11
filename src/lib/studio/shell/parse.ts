/**
 * Tokenizer + parser for the Studio shell. Isomorphic — no server deps.
 *
 * Grammar:  command [subcommand] [positionals…] [--flag | --key value | --key=value]
 * Values may be quoted with "…" or '…' — quotes group. Inside quotes, `\"` /
 * `\'` escape the matching quote and `\\` escapes a backslash; any other
 * backslash stays literal (Windows paths and LaTeX survive verbatim).
 *
 * A token that OPENS with a quote is a plain value: it is never an option or
 * flag, so a value starting with `--` (a ref, a label, free text…) is passed
 * by quoting it. A subcommand is always a bare word — `--`-prefixed tokens
 * never land in the sub slot (see commandAndSub).
 */

export interface ParsedCommand {
  command: string;
  sub?: string;
  positionals: string[];
  options: Record<string, string | true>;
}

export class ShellParseError extends Error {}

export interface Token {
  /** Token text with escapes resolved. */
  text: string;
  /** True when the token opened with a quote — a plain value, never an option. */
  quoted: boolean;
}

export function tokenizeDetailed(input: string): Token[] {
  const tokens: Token[] = [];
  let current = "";
  let hasToken = false;
  let quoted = false;
  let quote: '"' | "'" | null = null;

  let i = 0;
  while (i < input.length) {
    const ch = input[i] as string;
    if (quote) {
      if (ch === "\\") {
        const next = input[i + 1];
        if (next === quote || next === "\\") {
          // \q / \\ inside quotes → the literal char
          current += next;
          i += 2;
          continue;
        }
        current += ch; // a lone backslash stays literal
        i += 1;
        continue;
      }
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      if (!hasToken) quoted = true; // the token opens with a quote → a value
      quote = ch;
      hasToken = true; // a quote always opens a (possibly empty) token
      i += 1;
      continue;
    }
    if (/\s/.test(ch)) {
      if (hasToken || current) tokens.push({ text: current, quoted });
      current = "";
      hasToken = false;
      quoted = false;
      i += 1;
      continue;
    }
    current += ch;
    hasToken = true;
    i += 1;
  }

  if (quote) throw new ShellParseError("parse error: unclosed quote");
  if (hasToken || current) tokens.push({ text: current, quoted });
  return tokens;
}

/** Tokens as plain texts — for exec.ts' peek and the browser terminal. */
export function tokenize(input: string): string[] {
  return tokenizeDetailed(input).map((t) => t.text);
}

/**
 * Command + subcommand from raw token texts. The sub is tokens[1] unless it
 * looks like an option (`--…`): an option is never a subcommand, so
 * `projects --published` parses as `projects` + an option instead of an
 * "unknown subcommand: projects --published".
 */
export function commandAndSub(tokens: readonly string[]): {
  command: string;
  sub: string | undefined;
} {
  const command = tokens[0] ?? "";
  const second = tokens[1];
  const sub = second !== undefined && !second.startsWith("--") ? second : undefined;
  return { command, sub };
}

/**
 * Parse a command line. `boolFlags` lists option names (without "--") that are
 * boolean flags for the command being parsed — everything else expects a value
 * (either `--key value` or `--key=value`).
 */
export function parseCommand(
  input: string,
  boolFlags: ReadonlySet<string> = new Set(),
): ParsedCommand {
  const tokens = tokenizeDetailed(input);
  if (tokens.length === 0) {
    throw new ShellParseError("parse error: empty command");
  }

  const { command, sub } = commandAndSub(tokens.map((t) => t.text));
  // When tokens[1] was skipped (an option), it stays in the option loop.
  const rest = sub !== undefined ? tokens.slice(2) : tokens.slice(1);
  const positionals: string[] = [];
  const options: Record<string, string | true> = {};
  let expecting: string | null = null;

  for (const token of rest) {
    if (expecting !== null) {
      if (!token.quoted && token.text.startsWith("--")) {
        throw new ShellParseError(`parse error: missing value for --${expecting}`);
      }
      options[expecting] = token.text;
      expecting = null;
      continue;
    }
    if (!token.quoted && token.text.startsWith("--")) {
      const body = token.text.slice(2);
      if (!body) throw new ShellParseError("parse error: lone '--'");
      const eq = body.indexOf("=");
      if (eq !== -1) {
        const key = body.slice(0, eq);
        if (!key) throw new ShellParseError(`parse error: bad option ${token.text}`);
        options[key] = body.slice(eq + 1);
      } else if (boolFlags.has(body)) {
        options[body] = true;
      } else {
        expecting = body;
      }
      continue;
    }
    positionals.push(token.text);
  }

  if (expecting !== null) {
    throw new ShellParseError(`parse error: missing value for --${expecting}`);
  }

  return { command, sub, positionals, options };
}
