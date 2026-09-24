"use client";

import { useRef, useEffect, useState } from "react";
import { useEveAgent } from "eve/react";
import type { EveMessage } from "eve/react";
import type { Dictionary, Locale } from "@/lib/i18n";

function messageText(message: EveMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

/**
 * Professional studio: a chat with the portfolio eve agent. The agent answers
 * in the page language and can propose saving a blog draft; approving the
 * save_blog_draft tool call writes content/blog/<locale>/<slug>.mdx.
 */
export function StudioChat({
  dict,
  locale,
  owner,
}: {
  dict: Dictionary;
  locale: Locale;
  owner: boolean;
}) {
  const agent = useEveAgent();
  const { data, status, send, respond } = agent;
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const busy = status === "submitted" || status === "streaming";
  const resuming = status === "resuming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data.messages.length, status]);

  // Pending HITL requests (save_blog_draft approvals) across all messages.
  const pending = data.messages.flatMap((m) =>
    m.parts.flatMap((p) => {
      if (p.type !== "dynamic-tool" || p.state !== "approval-requested")
        return [];
      const request = p.toolMetadata?.eve?.inputRequest;
      return request ? [{ request, prompt: request.prompt }] : [];
    }),
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = input.trim();
    if (!message || resuming) return;
    setInput("");
    void send(message, {
      clientContext: {
        surface: owner ? "studio-owner" : "studio-demo",
        locale,
        instruction: owner
          ? `Help the owner draft/improve a blog post in ${locale === "fr" ? "French" : "English"}. When they ask to save, call save_blog_draft with locale="${locale}".`
          : `Answer in ${locale === "fr" ? "French" : "English"}. Drafting help only; do NOT call save_blog_draft (reserved for the owner).`,
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="max-h-[32rem] min-h-64 overflow-y-auto border border-border bg-background p-3 text-sm">
        {data.messages.length === 0 && (
          <p className="text-terminal-dim">{dict.studio.hint}</p>
        )}
        {data.messages.map((m) => (
          <div key={m.id} className="mb-4">
            <p className="mb-1 text-xs uppercase tracking-wider text-terminal-dim">
              {m.role === "user" ? dict.studio.you : dict.studio.agentName}
              {m.metadata?.status === "streaming" && (
                <span className="animate-pulse text-terminal-cyan"> ▎</span>
              )}
            </p>
            <div className="whitespace-pre-wrap text-foreground/90">
              {messageText(m)}
            </div>
            {m.parts
              .filter((p) => p.type === "dynamic-tool")
              .map((p, i) =>
                p.type === "dynamic-tool" ? (
                  <p
                    key={`${p.toolCallId}-${i}`}
                    className="mt-2 text-xs text-terminal-amber"
                  >
                    {dict.studio[
                      p.state === "output-available"
                        ? "toolDone"
                        : p.state === "output-denied"
                          ? "toolDenied"
                          : p.state === "output-error"
                            ? "toolFailed"
                            : "toolRunning"
                    ].replace("{name}", p.toolName)}
                  </p>
                ) : null,
              )}
          </div>
        ))}
        {pending.map(({ request }) => (
          <div
            key={request.requestId}
            className="mb-4 border border-terminal-green/40 bg-terminal-green/5 p-3"
          >
            <p className="mb-2 text-xs text-terminal-green">✦ {request.prompt}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  void respond([
                    { requestId: request.requestId, optionId: "approve" },
                  ])
                }
                className="border border-terminal-green/60 px-3 py-1 text-xs text-terminal-green hover:bg-terminal-green/10"
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
                className="border border-border px-3 py-1 text-xs text-terminal-dim hover:border-terminal-red/60 hover:text-terminal-red"
              >
                {dict.studio.cancel}
              </button>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={resuming}
          placeholder={dict.studio.placeholder}
          className="flex-1 border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-terminal-dim focus:border-terminal-green"
          maxLength={4000}
        />
        <button
          type="submit"
          disabled={resuming || !input.trim()}
          className="border border-terminal-green/60 bg-terminal-green/10 px-4 py-2 text-sm text-terminal-green hover:bg-terminal-green/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? dict.studio.generating : dict.studio.send}
        </button>
      </form>
      {status === "error" && (
        <p className="text-xs text-terminal-red" role="alert">
          {dict.studio.error}
        </p>
      )}
    </div>
  );
}
