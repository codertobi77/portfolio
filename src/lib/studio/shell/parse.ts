/**
 * Tokenizer + parser for the Studio shell. Isomorphic — no server deps.
 *
 * Grammar:  command [subcommand] [positionals…] [--flag | --key value | --key=value]
 * Values may be quoted with "…" or '…' (quotes group, no escape sequences).
 */

export interface ParsedCommand {
  command: string;
  sub?: string;
  positionals: string[];
  options: Record<string, string | true>;
}

export class ShellParseError extends Error {}

export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let hasToken = false;

  for (const ch of input) {
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      hasToken = true; // a quote always opens a (possibly empty) token
      continue;
    }
    if (/\s/.test(ch)) {
      if (hasToken || current) tokens.push(current);
      current = "";
      hasToken = false;
      continue;
    }
    current += ch;
    hasToken = true;
  }

  if (quote) throw new ShellParseError("parse error: unclosed quote");
  if (hasToken || current) tokens.push(current);
  return tokens;
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
  const tokens = tokenize(input);
  if (tokens.length === 0) {
    throw new ShellParseError("parse error: empty command");
  }

  const command = tokens[0];
  const sub: string | undefined = tokens[1];
  const rest = tokens.slice(2);
  const positionals: string[] = [];
  const options: Record<string, string | true> = {};
  let expecting: string | null = null;

  for (const token of rest) {
    if (expecting !== null) {
      if (token.startsWith("--")) {
        throw new ShellParseError(`parse error: missing value for --${expecting}`);
      }
      options[expecting] = token;
      expecting = null;
      continue;
    }
    if (token.startsWith("--")) {
      const body = token.slice(2);
      if (!body) throw new ShellParseError("parse error: lone '--'");
      const eq = body.indexOf("=");
      if (eq !== -1) {
        const key = body.slice(0, eq);
        if (!key) throw new ShellParseError(`parse error: bad option ${token}`);
        options[key] = body.slice(eq + 1);
      } else if (boolFlags.has(body)) {
        options[body] = true;
      } else {
        expecting = body;
      }
      continue;
    }
    positionals.push(token);
  }

  if (expecting !== null) {
    throw new ShellParseError(`parse error: missing value for --${expecting}`);
  }

  return { command, sub, positionals, options };
}
