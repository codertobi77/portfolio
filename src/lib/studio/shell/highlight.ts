import { findCommand } from "./registry";

/**
 * zsh-style live highlighting for the Studio shell input line.
 *
 * Isomorphic: no DOM, no server deps — returns colored segments whose
 * concatenation is EXACTLY the input string (whitespace and quotes
 * preserved), so the terminal can render them in an overlay behind the
 * input (transparent text) and in command echoes.
 *
 * Coloring rules (fast-syntax-highlighting flavor):
 *   - known command → green, unknown command → red
 *   - `sudo` prefix → amber; the command after sudo is checked too
 *   - known subcommand → cyan, unknown → red (prefix matches count)
 *   - known option → cyan, unknown → red; `--k=v` colors the key only
 *   - quoted strings → amber; everything else inherits the base color
 */

export interface HlSegment {
  text: string;
  cls: string;
}

// "" inherits the container color (the input's base foreground).
const CLS = {
  base: "",
  cmdOk: "text-terminal-green",
  cmdErr: "text-terminal-red",
  sudo: "text-terminal-amber",
  subOk: "text-terminal-cyan",
  subErr: "text-terminal-red",
  optOk: "text-terminal-cyan",
  optErr: "text-terminal-red",
  str: "text-terminal-amber",
} as const;

interface Chunk {
  text: string;
  kind: "ws" | "bare" | "str";
}

/** Lex preserving every character: ws runs, bare runs, quoted spans. */
function lex(input: string): Chunk[] {
  const chunks: Chunk[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      let end = i + 1;
      while (end < input.length && /\s/.test(input[end])) end += 1;
      chunks.push({ text: input.slice(i, end), kind: "ws" });
      i = end;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const close = input.indexOf(ch, i + 1);
      const end = close === -1 ? input.length : close + 1;
      chunks.push({ text: input.slice(i, end), kind: "str" });
      i = end;
      continue;
    }
    let end = i + 1;
    while (
      end < input.length &&
      !/\s/.test(input[end]) &&
      input[end] !== '"' &&
      input[end] !== "'"
    ) {
      end += 1;
    }
    chunks.push({ text: input.slice(i, end), kind: "bare" });
    i = end;
  }
  return chunks;
}

function optionClass(name: string, command: string, sub?: string): string {
  const spec = findCommand(command);
  const options = spec?.subs?.find((s) => s.name === sub)?.options ?? [];
  return options.some((o) => `--${o.name}` === name) ? CLS.optOk : CLS.optErr;
}

/** Classify one bare token fragment — may split `--key=value` in three. */
function classifyBare(text: string, idx: number, words: string[]): HlSegment[] {
  const sudoPrefix = idx === 0 ? text === "sudo" : words[0] === "sudo";
  const cmdIdx = sudoPrefix ? 1 : 0;

  if (idx === 0) {
    return [{ text, cls: text === "sudo" ? CLS.sudo : findCommand(text) ? CLS.cmdOk : CLS.cmdErr }];
  }
  if (idx === cmdIdx) {
    return [{ text, cls: findCommand(text) ? CLS.cmdOk : CLS.cmdErr }];
  }

  const command = words[cmdIdx] ?? "";
  const spec = findCommand(command);

  // Subcommand position (only for commands that actually have subs).
  if (idx === cmdIdx + 1 && spec?.subs) {
    const known = spec.subs.some((s) => s.name === text || s.name.startsWith(text));
    return [{ text, cls: known ? CLS.subOk : CLS.subErr }];
  }

  // Option token: validate the key, keep `=value` in the base color.
  if (text.startsWith("--")) {
    const eq = text.indexOf("=");
    if (eq <= 2) {
      // "--", "--=v" (parse error) — flag the whole token
      return [{ text, cls: CLS.optErr }];
    }
    const key = text.slice(0, eq);
    const sub = spec?.subs ? words[cmdIdx + 1] : undefined;
    return [
      { text: key, cls: optionClass(key, command, sub) },
      { text: text.slice(eq), cls: CLS.base },
    ];
  }

  return [{ text, cls: CLS.base }];
}

/** Highlight a shell input line into colored segments. */
export function highlightInput(input: string): HlSegment[] {
  const out: HlSegment[] = [];
  const push = (segment: HlSegment) => {
    if (!segment.text) return;
    const last = out[out.length - 1];
    if (last && last.cls === segment.cls) {
      last.text += segment.text;
    } else {
      out.push({ ...segment });
    }
  };

  const words: string[] = []; // completed tokens (since last whitespace)
  let current = ""; // token being typed (raw text, quotes included)

  for (const chunk of lex(input)) {
    if (chunk.kind === "ws") {
      if (current) {
        words.push(current);
        current = "";
      }
      push({ text: chunk.text, cls: CLS.base });
      continue;
    }
    if (chunk.kind === "str") {
      push({ text: chunk.text, cls: CLS.str });
      current += chunk.text;
      continue;
    }

    // bare chunk: index of the token it belongs to = words.length,
    // whether it opens a new token or continues the one being typed
    for (const seg of classifyBare(chunk.text, words.length, words)) push(seg);
    current += chunk.text;
  }

  return out;
}
