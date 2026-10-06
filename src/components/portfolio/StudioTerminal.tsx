"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEveAgent } from "eve/react";
import type { EveMessage } from "eve/react";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { runStudioCommand, sudoAuth } from "@/lib/actions";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { SiteProfile } from "@/lib/profile";
import { completeInput, isInteractive } from "@/lib/studio/shell/registry";
import { highlightInput } from "@/lib/studio/shell/highlight";
import { tokenize } from "@/lib/studio/shell/parse";
import type { ShellLine } from "@/lib/studio/shell/types";
import { cn } from "@/lib/utils";

/**
 * The Studio shell v2 — every admin action is a typed command.
 *
 * Input state machine:
 *   normal        → commands (public reads, sudo-prefixed mutations)
 *   sudo-password → masked passcode entry (server asked for it via
 *                   `needsPassword`); 3 attempts, Escape/Ctrl+C cancels
 *   wizard        → step-by-step prompts for `sudo projects create`,
 *                   `sudo profile edit`, `sudo profile timeline add`
 *   eve-repl      → persistent agent shell (`sudo eve`), exit/quit/Ctrl+D
 *
 * Reads run for anyone; mutations are refused server-side without sudo.
 * Command output is English on purpose (classic shell convention).
 */

interface CmdEntry {
  id: number;
  kind: "boot" | "cmd" | "sys";
  input?: string;
  running?: boolean;
  lines: ShellLine[];
}

interface EveEntry {
  id: number;
  kind: "eve";
  input: string;
  /** Index of the user message that opened this turn in agent.data.messages. */
  startIdx: number;
}

type Entry = CmdEntry | EveEntry;

type Mode = "normal" | "sudo-password" | "wizard" | "eve-repl";

interface WizardStep {
  /** Option name (without "--") the answer maps onto. */
  key: string;
  question: string;
  required?: boolean;
  /** y/n question — answer parsed to "y" | "n" | "" (skip). */
  yn?: boolean;
  /** Shown as the default (Enter keeps it — profile edit). */
  current?: string;
  pattern?: RegExp;
  patternError?: string;
}

interface WizardSpec {
  label: string;
  announce: string;
  steps: WizardStep[];
  /** Compose the full shell line from the answers — null = nothing to run. */
  compose: (answers: Record<string, string>) => string | null;
}

interface WizardState {
  spec: WizardSpec;
  idx: number;
  answers: Record<string, string>;
  entryId: number;
}

type PasswordPending =
  | { kind: "command"; command: string; entryId: number }
  | { kind: "eve"; message?: string }
  | { kind: "wizard"; spec: WizardSpec };

const HISTORY_KEY = "portfolio:shell:history";
const SUDO_MAX_ATTEMPTS = 3;

const BOOT_LINES: ShellLine[] = [
  { text: "dee@studio — portfolio shell v2.0", kind: "ok" },
  { text: "reads are public · mutations need sudo · 'sudo -l' lists your rights", kind: "dim" },
  { text: "type 'help' for commands · Tab completes · ↑ recalls history · Ctrl+L clears", kind: "dim" },
];

// ---- eve message helpers ----

function messageText(message: EveMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

function latestPendingApproval(messages: readonly EveMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    for (const part of messages[i].parts) {
      if (part.type === "dynamic-tool" && part.state === "approval-requested") {
        const request = part.toolMetadata?.eve?.inputRequest;
        if (request) return request;
      }
    }
  }
  return null;
}

function toolPartMeta(state: string | undefined): { text: string; cls: string } {
  switch (state) {
    case "output-available":
      return { text: "done", cls: "text-terminal-green" };
    case "output-denied":
      return { text: "denied", cls: "text-terminal-amber" };
    case "output-error":
      return { text: "failed", cls: "text-terminal-red" };
    case "approval-requested":
      return { text: "approval required — 'approve' / 'deny'", cls: "text-terminal-amber" };
    default:
      return { text: "running…", cls: "text-terminal-dim" };
  }
}

// ---- line rendering ----

function lineClass(kind?: ShellLine["kind"]): string {
  switch (kind) {
    case "err":
      return "text-terminal-red";
    case "ok":
      return "text-terminal-green";
    case "warn":
      return "text-terminal-amber";
    case "dim":
      return "text-terminal-dim";
    case "head":
      return "text-terminal-cyan";
    default:
      return "text-foreground/90";
  }
}

function Line({ line }: { line: ShellLine }) {
  return <p className={`${lineClass(line.kind)} whitespace-pre-wrap break-words`}>{line.text}</p>;
}

/** Colored segments for one input line (highlight.ts drives the colors). */
function Highlighted({ text }: { text: string }) {
  if (!text) return null;
  const segments = highlightInput(text);
  return (
    <>
      {segments.map((s, i) => (
        <span key={i} className={s.cls}>
          {s.text}
        </span>
      ))}
    </>
  );
}

function DeePrompt() {
  return (
    <>
      <span className="text-terminal-dim">dee@studio:</span>
      <span className="text-terminal-cyan">~/studio</span>
      <span className="text-terminal-dim">$ </span>
    </>
  );
}

function EvePrompt() {
  return (
    <>
      <span className="text-terminal-dim">eve@studio:~ </span>
      <span className="text-terminal-amber">❯ </span>
    </>
  );
}

function Echo({ input }: { input: string }) {
  return (
    <p className="break-all text-foreground/90">
      <DeePrompt />
      <Highlighted text={input} />
    </p>
  );
}

function EveEcho({ input }: { input: string }) {
  return (
    <p className="break-all text-foreground/90">
      <EvePrompt />
      {input}
    </p>
  );
}

// ---- input helpers ----

function applyCompletion(input: string, replacement: string): string {
  const endsWithSpace = /\s$/.test(input);
  const parts = input.split(/\s+/).filter(Boolean);
  if (endsWithSpace || parts.length === 0) {
    return `${input}${replacement} `;
  }
  parts[parts.length - 1] = replacement;
  return `${parts.join(" ")} `;
}

/** Double-quote a value for the shell (the tokenizer has no escapes). */
function shellQuote(value: string): string {
  return `"${value.replace(/"/g, "”")}"`;
}

// ---- wizards ----

function projectsCreateSpec(): WizardSpec {
  return {
    label: "projects create",
    announce: "projects create — interactive mode (Enter skips optional fields, Ctrl+C aborts)",
    steps: [
      { key: "title", question: "title (fr)", required: true },
      { key: "description", question: "description (fr)", required: true },
      { key: "title-en", question: "title-en" },
      { key: "description-en", question: "description-en" },
      { key: "tags", question: "tags (comma-separated)" },
      { key: "url", question: "url" },
      { key: "repo-url", question: "repo-url" },
      { key: "featured", question: "featured", yn: true },
      { key: "published", question: "published", yn: true },
    ],
    compose: (a) => {
      const parts: string[] = ["projects", "create"];
      const quoted: Array<[string, string]> = [
        ["title", a.title ?? ""],
        ["description", a.description ?? ""],
        ["title-en", a["title-en"] ?? ""],
        ["description-en", a["description-en"] ?? ""],
      ];
      for (const [key, v] of quoted) if (v) parts.push(`--${key}`, shellQuote(v));
      if (a.tags) parts.push("--tags", a.tags.replace(/\s*,\s*/g, ","));
      if (a.url) parts.push("--url", shellQuote(a.url));
      if (a["repo-url"]) parts.push("--repo-url", shellQuote(a["repo-url"]));
      if (a.featured === "y") parts.push("--featured");
      if (a.published === "y") parts.push("--published");
      return `sudo ${parts.join(" ")}`;
    },
  };
}

function profileEditSpec(profile: SiteProfile): WizardSpec {
  const steps: WizardStep[] = [
    { key: "role-fr", question: "role (fr)", current: profile.role.fr },
    { key: "role-en", question: "role (en)", current: profile.role.en },
    { key: "alias", question: "alias", current: profile.name.alterEgo },
    { key: "location", question: "location", current: profile.location },
    { key: "email", question: "email", current: profile.email },
    { key: "status-fr", question: "status (fr)", current: profile.status.fr },
    { key: "status-en", question: "status (en)", current: profile.status.en },
  ];
  return {
    label: "profile edit",
    announce: "profile edit — Enter keeps the current value, Ctrl+C aborts",
    steps,
    compose: (a) => {
      const parts: string[] = ["profile", "edit"];
      for (const step of steps) {
        const v = a[step.key] ?? "";
        if (v && v !== step.current) parts.push(`--${step.key}`, shellQuote(v));
      }
      if (parts.length === 2) return null; // nothing changed
      return `sudo ${parts.join(" ")}`;
    },
  };
}

function timelineAddSpec(): WizardSpec {
  return {
    label: "profile timeline add",
    announce: "profile timeline add — Enter skips optional fields, Ctrl+C aborts",
    steps: [
      { key: "year", question: "year", required: true, pattern: /^\d{4}$/, patternError: "expected a 4-digit year" },
      { key: "title-fr", question: "title (fr)", required: true },
      { key: "title-en", question: "title-en" },
      { key: "org-fr", question: "org (fr)" },
      { key: "org-en", question: "org (en)" },
      { key: "desc-fr", question: "description (fr)" },
      { key: "desc-en", question: "description (en)" },
    ],
    compose: (a) => {
      const parts: string[] = ["profile", "timeline", "add", "--year", a.year ?? ""];
      for (const key of ["title-fr", "title-en", "org-fr", "org-en", "desc-fr", "desc-en"]) {
        if (a[key]) parts.push(`--${key}`, shellQuote(a[key]));
      }
      return `sudo ${parts.join(" ")}`;
    },
  };
}

function buildWizardSpec(command: string, sub: string | undefined, profile: SiteProfile): WizardSpec | null {
  if (command === "projects" && sub === "create") return projectsCreateSpec();
  if (command === "profile" && sub === "edit") return profileEditSpec(profile);
  if (command === "profile" && sub === "timeline") return timelineAddSpec();
  return null;
}

// ---- component ----

export function StudioTerminal({
  dict,
  locale,
  profile,
}: {
  dict: Dictionary;
  locale: Locale;
  profile: SiteProfile;
}) {
  const router = useRouter();
  const agent = useEveAgent();
  const { data, status, send, respond } = agent;

  const [entries, setEntries] = useState<Entry[]>([
    { id: 0, kind: "boot", lines: BOOT_LINES },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("normal");
  const [pending, setPending] = useState<PasswordPending | null>(null);
  const [sudoAttempts, setSudoAttempts] = useState(0);
  const [wizard, setWizard] = useState<WizardState | null>(null);

  const historyRef = useRef<string[]>([]);
  const histIdxRef = useRef<number | null>(null);
  const idRef = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  const agentStreaming = status === "submitted" || status === "streaming";
  const resuming = status === "resuming";

  // Restore command history (per tab session, like a real shell).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(HISTORY_KEY);
      if (raw) historyRef.current = JSON.parse(raw).slice(-100);
    } catch {
      // ignore corrupted history
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries, data.messages.length, status]);

  const pushHistory = useCallback((cmd: string) => {
    const h = historyRef.current;
    if (h[h.length - 1] !== cmd) h.push(cmd);
    if (h.length > 100) h.shift();
    histIdxRef.current = null;
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(h));
    } catch {
      // sessionStorage unavailable — history stays in memory
    }
  }, []);

  const appendEntry = useCallback((entry: Entry) => {
    setEntries((prev) => [...prev, entry]);
  }, []);

  /** Grow a wizard entry's lines in place (questions/answers log). */
  const appendWizardLines = useCallback((entryId: number, lines: ShellLine[]) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId && e.kind !== "eve" ? { ...e, lines: [...e.lines, ...lines] } : e,
      ),
    );
  }, []);

  const appendSys = useCallback((lines: ShellLine[]) => {
    appendEntry({ id: idRef.current++, kind: "sys", lines });
  }, [appendEntry]);

  const clearEntries = useCallback(() => {
    setEntries([{ id: idRef.current++, kind: "boot", lines: BOOT_LINES }]);
  }, []);

  /** Attach a server result to an entry (echo stays, spinner goes). */
  const settleEntry = useCallback((id: number, lines: ShellLine[]) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id && e.kind !== "eve" ? { ...e, running: false, lines } : e)),
    );
  }, []);

  // ---- eve turns ----

  const sendEveTurn = useCallback(
    (message: string) => {
      const startIdx = data.messages.length;
      appendEntry({ id: idRef.current++, kind: "eve", input: message, startIdx });
      void send(message, {
        clientContext: {
          surface: "studio-owner",
          locale,
          instruction: `Help the owner draft/improve a blog post in ${
            locale === "fr" ? "French" : "English"
          }. When they ask to save, call save_blog_draft with locale="${locale}".`,
        },
      });
    },
    [appendEntry, data.messages.length, locale, send],
  );

  const exitEve = useCallback(() => {
    setMode("normal");
    appendSys([{ text: "logout — back to dee@studio", kind: "ok" }]);
  }, [appendSys]);

  const enterEveNow = useCallback(
    (message?: string) => {
      setMode("eve-repl");
      setInput("");
      appendSys([{ text: "eve shell — 'exit', 'quit' or Ctrl+D to leave", kind: "dim" }]);
      if (message) sendEveTurn(message);
    },
    [appendSys, sendEveTurn],
  );

  // ---- wizards ----

  const startWizardNow = useCallback(
    (spec: WizardSpec) => {
      const entryId = idRef.current++;
      appendEntry({ id: entryId, kind: "sys", lines: [{ text: spec.announce, kind: "dim" }] });
      setWizard({ spec, idx: 0, answers: {}, entryId });
      setMode("wizard");
      setInput("");
    },
    [appendEntry],
  );

  // ---- elevation (`sudo -v` is silent on success, like the real flag) ----

  const ensureElevated = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    let elevated = false;
    try {
      const res = await runStudioCommand("sudo -v", locale);
      elevated = !res.needsPassword;
    } catch {
      elevated = false;
    }
    setBusy(false);
    return elevated;
  }, [locale]);

  const requestEve = useCallback(
    async (message?: string) => {
      if (await ensureElevated()) {
        enterEveNow(message);
        return;
      }
      setPending({ kind: "eve", message });
      setSudoAttempts(0);
      setMode("sudo-password");
      setInput("");
    },
    [ensureElevated, enterEveNow],
  );

  const requestWizard = useCallback(
    async (spec: WizardSpec) => {
      if (await ensureElevated()) {
        startWizardNow(spec);
        return;
      }
      setPending({ kind: "wizard", spec });
      setSudoAttempts(0);
      setMode("sudo-password");
      setInput("");
    },
    [ensureElevated, startWizardNow],
  );

  // ---- server command ----

  const execute = useCallback(
    async (cmd: string, existingId?: number) => {
      const id = existingId ?? idRef.current++;
      if (existingId === undefined) {
        appendEntry({ id, kind: "cmd", input: cmd, running: true, lines: [] });
      }
      setBusy(true);
      try {
        const res = await runStudioCommand(cmd, locale);
        if (res.needsPassword) {
          settleEntry(id, []);
          setPending({ kind: "command", command: cmd, entryId: id });
          setSudoAttempts(0);
          setMode("sudo-password");
          setInput("");
        } else {
          settleEntry(id, res.lines);
          // Profile mutations change the wizard defaults — refresh the page
          // data (the server action already revalidated the public pages).
          if (res.ok && /^sudo\s+profile\b/.test(cmd)) router.refresh();
        }
      } catch {
        settleEntry(id, [{ text: "internal error — try again", kind: "err" }]);
      }
      setBusy(false);
    },
    [appendEntry, locale, router, settleEntry],
  );

  // ---- sudo password mode ----

  const submitPassword = useCallback(async () => {
    const passcode = input;
    if (!passcode || busy) return;
    setBusy(true);
    const res = await sudoAuth(passcode);
    setBusy(false);
    setInput("");
    if (res.ok) {
      setMode("normal");
      const p = pending;
      setPending(null);
      if (!p) return;
      if (p.kind === "command") {
        void execute(p.command, p.entryId);
      } else if (p.kind === "eve") {
        enterEveNow(p.message);
      } else {
        startWizardNow(p.spec);
      }
      return;
    }
    const attempts = sudoAttempts + 1;
    setSudoAttempts(attempts);
    if (attempts >= SUDO_MAX_ATTEMPTS) {
      appendSys([{ text: `sudo: ${SUDO_MAX_ATTEMPTS} incorrect password attempts`, kind: "err" }]);
      setPending(null);
      setMode("normal");
    } else {
      appendSys([{ text: "Sorry, try again.", kind: "err" }]);
    }
  }, [
    appendSys,
    busy,
    enterEveNow,
    execute,
    input,
    pending,
    startWizardNow,
    sudoAttempts,
  ]);

  // ---- wizard mode ----

  const submitWizardStep = useCallback(() => {
    if (!wizard || busy) return;
    const step = wizard.spec.steps[wizard.idx];
    const value = input.trim();

    if (step.pattern && value && !step.pattern.test(value)) {
      appendWizardLines(wizard.entryId, [{ text: step.patternError ?? "invalid value", kind: "err" }]);
      setInput("");
      return;
    }
    if (step.yn && value && !/^(y|yes|n|no)$/i.test(value)) {
      appendWizardLines(wizard.entryId, [{ text: "answer y or n", kind: "err" }]);
      setInput("");
      return;
    }
    if (step.required && !value) {
      appendWizardLines(wizard.entryId, [{ text: `${step.question} is required`, kind: "err" }]);
      return;
    }

    const answer = step.yn
      ? value
        ? value.toLowerCase().startsWith("y")
          ? "y"
          : "n"
        : ""
      : value;
    const display =
      answer === ""
        ? step.current !== undefined
          ? "(unchanged)"
          : "(skipped)"
        : answer;
    appendWizardLines(wizard.entryId, [{ text: `${step.question}: ${display}` }]);

    const answers = { ...wizard.answers, [step.key]: answer };
    setInput("");
    const nextIdx = wizard.idx + 1;
    if (nextIdx < wizard.spec.steps.length) {
      setWizard({ ...wizard, idx: nextIdx, answers });
      return;
    }
    setWizard(null);
    setMode("normal");
    const composed = wizard.spec.compose(answers);
    if (composed) {
      void execute(composed);
    } else {
      appendSys([{ text: "nothing changed", kind: "dim" }]);
    }
  }, [appendSys, appendWizardLines, busy, execute, input, wizard]);

  // ---- local HITL ----

  const handleApproveDeny = useCallback(
    (head: "approve" | "deny") => {
      const request = latestPendingApproval(data.messages);
      if (request) {
        void respond([
          {
            requestId: request.requestId,
            optionId: head === "approve" ? "approve" : "cancel",
          },
        ]);
      }
      appendEntry({
        id: idRef.current++,
        kind: "cmd",
        input: head,
        lines: [
          request
            ? {
                text: head === "approve" ? "approved — agent continues" : "denied — tool call cancelled",
                kind: head === "approve" ? "ok" : "warn",
              }
            : { text: "no pending approval", kind: "dim" },
        ],
      });
    },
    [appendEntry, data.messages, respond],
  );

  // ---- abort (Ctrl+C / Escape in password & wizard modes) ----

  const abortCurrent = useCallback(() => {
    appendSys([{ text: "^C", kind: "err" }]);
    setPending(null);
    setWizard(null);
    setSudoAttempts(0);
    setMode("normal");
    setInput("");
  }, [appendSys]);

  // ---- dispatchers ----

  const submitReplLine = useCallback(
    (line: string) => {
      if (!line) return;
      pushHistory(line);
      setInput("");
      if (line === "exit" || line === "quit") {
        exitEve();
        return;
      }
      if (line === "approve" || line === "deny") {
        handleApproveDeny(line);
        return;
      }
      if (line === "clear") {
        clearEntries();
        return;
      }
      sendEveTurn(line);
    },
    [clearEntries, exitEve, handleApproveDeny, pushHistory, sendEveTurn],
  );

  const submit = useCallback(
    async (raw: string) => {
      const cmd = raw.trim();
      if (!cmd || busy) return;

      if (mode === "eve-repl") {
        submitReplLine(cmd);
        return;
      }
      // sudo-password and wizard modes are handled by their own submit paths.
      if (mode !== "normal") return;

      pushHistory(cmd);
      setInput("");

      let tokens: string[] | null = null;
      try {
        tokens = tokenize(cmd);
      } catch {
        tokens = null; // let the server produce the parse error
      }

      // ---- client commands ----

      const head = tokens?.[0];

      if (head === "clear") {
        clearEntries();
        return;
      }

      if (head === "approve" || head === "deny") {
        handleApproveDeny(head);
        return;
      }

      if (head === "logout") {
        appendSys([{ text: "logout: use 'sudo -k' to end the sudo session", kind: "dim" }]);
        return;
      }

      // eve REPL — entered via `sudo eve` (or bare `eve`, which elevates the
      // same way; the registry keeps eve sudo-protected).
      if (head === "eve") {
        void requestEve(cmd.slice(3).trim() || undefined);
        return;
      }
      if (head === "sudo" && tokens?.[1] === "eve") {
        void requestEve(cmd.replace(/^\s*sudo\s+eve\s*/, "").trim() || undefined);
        return;
      }

      // Interactive wizards — only for the bare interactive subcommands
      // (`sudo projects create`, `sudo profile edit`, `sudo profile timeline add`
      // with no options); anything else goes to the server.
      if (head === "sudo" && tokens) {
        const inner = tokens.slice(1);
        const [innerHead, innerSub] = inner;
        if (innerHead && isInteractive(innerHead, innerSub)) {
          const rest = inner.slice(2);
          const bare =
            innerHead === "profile" && innerSub === "timeline"
              ? rest.length === 1 && rest[0] === "add"
              : rest.length === 0;
          if (bare) {
            const spec = buildWizardSpec(innerHead, innerSub, profile);
            if (spec) {
              void requestWizard(spec);
              return;
            }
          }
        }
      }

      // ---- server commands ----
      await execute(cmd);
    },
    [
      appendSys,
      busy,
      clearEntries,
      execute,
      handleApproveDeny,
      mode,
      profile,
      pushHistory,
      requestEve,
      requestWizard,
      submitReplLine,
    ],
  );

  const handleSubmit = useCallback(() => {
    if (mode === "sudo-password") {
      void submitPassword();
      return;
    }
    if (mode === "wizard") {
      submitWizardStep();
      return;
    }
    void submit(input);
  }, [input, mode, submit, submitPassword, submitWizardStep]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab" && mode === "normal") {
        e.preventDefault();
        const completion = completeInput(input);
        if (!completion) return;
        if (completion.replace !== undefined) {
          setInput(applyCompletion(input, completion.replace));
        } else if (completion.candidates?.length) {
          appendSys([{ text: completion.candidates.join("  "), kind: "dim" }]);
        }
        return;
      }
      if (e.ctrlKey && (e.key === "l" || e.key === "L")) {
        if (mode === "normal" || mode === "eve-repl") {
          e.preventDefault();
          clearEntries();
        }
        return;
      }
      if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        if (mode === "sudo-password" || mode === "wizard") {
          abortCurrent();
        } else {
          setInput("");
          histIdxRef.current = null;
        }
        return;
      }
      if (e.key === "Escape" && mode === "sudo-password") {
        e.preventDefault();
        abortCurrent();
        return;
      }
      // Ctrl+D on an empty line — EOF, like a real REPL.
      if (e.ctrlKey && (e.key === "d" || e.key === "D") && mode === "eve-repl") {
        if (!input) {
          e.preventDefault();
          exitEve();
        }
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (mode !== "normal" && mode !== "eve-repl") return;
        const h = historyRef.current;
        if (h.length === 0) return;
        e.preventDefault();
        if (e.key === "ArrowUp") {
          const next = histIdxRef.current === null ? h.length - 1 : Math.max(0, histIdxRef.current - 1);
          histIdxRef.current = next;
          setInput(h[next]);
        } else {
          if (histIdxRef.current === null) return;
          const next = histIdxRef.current + 1;
          if (next >= h.length) {
            histIdxRef.current = null;
            setInput("");
          } else {
            histIdxRef.current = next;
            setInput(h[next]);
          }
        }
      }
    },
    [abortCurrent, appendSys, clearEntries, exitEve, input, mode],
  );

  const wizardStep = wizard ? wizard.spec.steps[wizard.idx] : undefined;

  const placeholder = (() => {
    if (mode === "normal") return dict.studio.terminal.placeholder;
    if (mode === "eve-repl") return "message… ('exit' to leave)";
    if (mode === "sudo-password") return "";
    if (!wizardStep) return "";
    if (wizardStep.current) return wizardStep.current;
    if (wizardStep.required) return "required";
    if (wizardStep.yn) return "y or n — Enter skips";
    return "optional — Enter skips";
  })();

  return (
    <TerminalWindow title="dee@studio: ~/studio" className="bg-background">
      <div className="flex flex-col">
        {/* Scrollback */}
        <div className="max-h-[60vh] min-h-72 overflow-y-auto pr-2">
          {entries.map((entry, idx) => {
            if (entry.kind === "eve") {
              // Turn window: this entry's messages, up to the next eve turn.
              let end = data.messages.length;
              for (let i = idx + 1; i < entries.length; i += 1) {
                if (entries[i].kind === "eve") {
                  end = (entries[i] as EveEntry).startIdx;
                  break;
                }
              }
              const turn = data.messages.slice(entry.startIdx, end);
              const isLastEve = !entries.slice(idx + 1).some((e) => e.kind === "eve");
              const streaming = agentStreaming && isLastEve;
              const assistantMsgs = turn.filter((m) => m.role === "assistant");

              return (
                <div key={entry.id} className="mb-4">
                  <EveEcho input={entry.input} />
                  {assistantMsgs.length === 0 && (
                    <p className="text-terminal-dim">
                      eve<span className="animate-pulse"> ▎</span>
                    </p>
                  )}
                  {assistantMsgs.map((m, i) => {
                    const isLast = i === assistantMsgs.length - 1;
                    const text = messageText(m);
                    return (
                      <div key={m.id}>
                        {(text || streaming) && (
                          <div className="whitespace-pre-wrap break-words text-foreground/90">
                            <span className="text-xs uppercase tracking-wider text-terminal-dim">
                              eve{" "}
                            </span>
                            {text}
                            {isLast && streaming && (
                              <span className="animate-pulse text-terminal-cyan">▎</span>
                            )}
                          </div>
                        )}
                        {m.parts.map((p, j) =>
                          p.type === "dynamic-tool" ? (
                            <div key={`${p.toolCallId}-${j}`} className="mt-1">
                              <p className={`text-xs ${toolPartMeta(p.state).cls}`}>
                                [tool] {p.toolName}: {toolPartMeta(p.state).text}
                              </p>
                              {p.state === "approval-requested" &&
                                p.toolMetadata?.eve?.inputRequest &&
                                (() => {
                                  const request = p.toolMetadata.eve.inputRequest;
                                  return (
                                    <div className="mt-1 flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void respond([
                                            { requestId: request.requestId, optionId: "approve" },
                                          ])
                                        }
                                        className="border border-terminal-green/60 bg-terminal-green/10 px-2 py-0.5 text-xs text-terminal-green hover:bg-terminal-green/20"
                                      >
                                        {dict.studio.approve}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void respond([
                                            { requestId: request.requestId, optionId: "cancel" },
                                          ])
                                        }
                                        className="border border-border px-2 py-0.5 text-xs text-terminal-dim hover:border-terminal-red/60 hover:text-terminal-red"
                                      >
                                        {dict.studio.cancel}
                                      </button>
                                    </div>
                                  );
                                })()}
                            </div>
                          ) : null,
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            }

            return (
              <div key={entry.id} className="mb-3">
                {entry.kind === "cmd" && <Echo input={entry.input ?? ""} />}
                {entry.running ? (
                  <p className="text-terminal-dim">
                    <span className="animate-pulse">▎</span>
                  </p>
                ) : (
                  entry.lines.map((line, i) => <Line key={i} line={line} />)
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input line */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="mt-3 flex items-center gap-2 border-t border-border pt-3"
        >
          {mode === "normal" && (
            <span className="whitespace-nowrap text-sm">
              <DeePrompt />
            </span>
          )}
          {mode === "eve-repl" && (
            <span className="whitespace-nowrap text-sm">
              <EvePrompt />
            </span>
          )}
          {mode === "sudo-password" && (
            <span className="whitespace-nowrap text-sm text-terminal-dim">
              [sudo] password for dee:{" "}
            </span>
          )}
          {mode === "wizard" && wizardStep && (
            <span className="whitespace-nowrap text-sm text-terminal-cyan">
              {wizardStep.question}
              {wizardStep.yn ? " [y/n]" : ""}:{" "}
            </span>
          )}

          <div className="relative min-w-0 flex-1">
            {/* Colored mirror of the input (zsh-style highlighting) or the
                masked asterisks of a sudo password — the input itself is
                transparent so both stay pixel-aligned. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre text-sm text-foreground/90"
            >
              {mode === "normal" && <Highlighted text={input} />}
              {mode === "sudo-password" && "*".repeat(input.length)}
            </div>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={busy || resuming}
              placeholder={placeholder}
              maxLength={mode === "sudo-password" ? 200 : 2000}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              className={cn(
                "relative w-full bg-transparent text-sm outline-none",
                "placeholder:text-terminal-dim disabled:opacity-50",
                mode === "normal" || mode === "sudo-password"
                  ? "caret-terminal-green text-transparent"
                  : "caret-terminal-green text-terminal-green",
              )}
            />
          </div>
        </form>
        {status === "error" && (
          <p className="mt-2 text-xs text-terminal-red" role="alert">
            agent error — try again
          </p>
        )}
      </div>
    </TerminalWindow>
  );
}
