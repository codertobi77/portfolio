"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEveAgent } from "eve/react";
import type { EveMessage } from "eve/react";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { logoutStudio, runStudioCommand } from "@/lib/actions";
import type { Dictionary, Locale } from "@/lib/i18n";
import { completeInput } from "@/lib/studio/shell/registry";
import type { ShellLine } from "@/lib/studio/shell/types";

/**
 * The Studio shell: every admin action is a typed command.
 *
 * Server commands (projects/guestbook/contact/blog/stats/help/whoami) go
 * through the `runStudioCommand` server action; client commands
 * (clear/logout/eve/approve/deny) are handled locally. `eve <message>` sends
 * a turn to the eve agent and streams the reply inside the scrollback; the
 * save_blog_draft approval stays approvable from any of its turns (inline
 * buttons or the `approve`/`deny` commands).
 *
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

const HISTORY_KEY = "portfolio:shell:history";

const BOOT_LINES: ShellLine[] = [
  { text: "portfolio shell v1.0 — owner session", kind: "ok" },
  { text: "type 'help' for commands · 'eve <message>' to chat with the agent", kind: "dim" },
  { text: "Tab completes · ↑ recalls history · Ctrl+L clears the screen", kind: "dim" },
];

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

function Echo({ input }: { input: string }) {
  return (
    <p className="break-all text-terminal-green">
      <span className="text-terminal-dim">amidala@samari:</span>
      <span className="text-terminal-cyan">~/studio</span>
      <span className="text-terminal-dim">$ </span>
      {input}
    </p>
  );
}

function applyCompletion(input: string, replacement: string): string {
  const endsWithSpace = /\s$/.test(input);
  const parts = input.split(/\s+/).filter(Boolean);
  if (endsWithSpace || parts.length === 0) {
    return `${input}${replacement} `;
  }
  parts[parts.length - 1] = replacement;
  return `${parts.join(" ")} `;
}

export function StudioTerminal({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const router = useRouter();
  const agent = useEveAgent();
  const { data, status, send, respond } = agent;

  const [entries, setEntries] = useState<Entry[]>([
    { id: 0, kind: "boot", lines: BOOT_LINES },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const historyRef = useRef<string[]>([]);
  const histIdxRef = useRef<number | null>(null);
  const idRef = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const submit = useCallback(
    async (raw: string) => {
      const cmd = raw.trim();
      if (!cmd || busy) return;
      pushHistory(cmd);
      setInput("");
      const id = idRef.current++;
      const head = cmd.split(/\s+/)[0];

      // ---- client commands ----

      if (head === "clear") {
        setEntries([{ id, kind: "boot", lines: BOOT_LINES }]);
        return;
      }

      if (head === "eve") {
        const message = cmd.slice(3).trim();
        if (!message) {
          appendEntry({
            id,
            kind: "cmd",
            input: cmd,
            lines: [{ text: "usage: eve <message>", kind: "err" }],
          });
          return;
        }
        const startIdx = data.messages.length;
        appendEntry({ id, kind: "eve", input: cmd, startIdx });
        void send(message, {
          clientContext: {
            surface: "studio-owner",
            locale,
            instruction: `Help the owner draft/improve a blog post in ${
              locale === "fr" ? "French" : "English"
            }. When they ask to save, call save_blog_draft with locale="${locale}".`,
          },
        });
        return;
      }

      if (head === "approve" || head === "deny") {
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
          id,
          kind: "cmd",
          input: cmd,
          lines: [
            request
              ? {
                  text: head === "approve" ? "approved — agent continues" : "denied — tool call cancelled",
                  kind: head === "approve" ? "ok" : "warn",
                }
              : { text: "no pending approval", kind: "dim" },
          ],
        });
        return;
      }

      if (head === "logout") {
        appendEntry({ id, kind: "cmd", input: cmd, running: true, lines: [] });
        setBusy(true);
        await logoutStudio();
        router.refresh();
        setBusy(false);
        return;
      }

      // ---- server commands ----

      appendEntry({ id, kind: "cmd", input: cmd, running: true, lines: [] });
      setBusy(true);
      try {
        const res = await runStudioCommand(cmd, locale);
        setEntries((prev) =>
          prev.map((e) =>
            e.id === id && e.kind !== "eve" ? { ...e, running: false, lines: res.lines } : e,
          ),
        );
      } catch {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === id && e.kind !== "eve"
              ? {
                  ...e,
                  running: false,
                  lines: [{ text: "internal error — try again", kind: "err" }],
                }
              : e,
          ),
        );
      }
      setBusy(false);
    },
    [appendEntry, busy, data.messages, locale, pushHistory, respond, router, send],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void submit(input);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const completion = completeInput(input);
        if (!completion) return;
        if (completion.replace !== undefined) {
          setInput(applyCompletion(input, completion.replace));
        } else if (completion.candidates?.length) {
          appendEntry({
            id: idRef.current++,
            kind: "sys",
            lines: [{ text: completion.candidates.join("  "), kind: "dim" }],
          });
        }
        return;
      }
      if (e.ctrlKey && e.key === "l") {
        e.preventDefault();
        setEntries([{ id: idRef.current++, kind: "boot", lines: BOOT_LINES }]);
        return;
      }
      if (e.ctrlKey && e.key === "c") {
        e.preventDefault();
        setInput("");
        histIdxRef.current = null;
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
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
    [appendEntry, input, submit],
  );

  return (
    <TerminalWindow title="amidala@samari: ~/studio" className="bg-background">
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
                  <Echo input={entry.input} />
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
            void submit(input);
          }}
          className="mt-3 flex items-center gap-2 border-t border-border pt-3"
        >
          <span className="whitespace-nowrap text-sm text-terminal-green">
            <span className="text-terminal-dim">amidala@samari:</span>
            <span className="text-terminal-cyan">~/studio</span>
            <span className="text-terminal-dim">$ </span>
          </span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={busy || resuming}
            placeholder={dict.studio.terminal.placeholder}
            maxLength={2000}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            className="flex-1 bg-transparent text-sm text-terminal-green caret-terminal-green outline-none placeholder:text-terminal-dim disabled:opacity-50"
          />
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
