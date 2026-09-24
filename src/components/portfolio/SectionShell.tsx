"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEveAgent } from "eve/react";
import type { Dictionary } from "@/lib/i18n";

type Generated = { text: string; source: "static" | "generating" | "ai" | "failed" };

/**
 * Generative UI section wrapper.
 *
 * - Renders static children first (SEO, LCP, works without any AI).
 * - When the section scrolls into view (once per session per section),
 *   sends a single eve turn asking the agent to regenerate the section
 *   content from the provided data. On success, the AI text replaces the
 *   static body. On failure/absence of the agent, nothing changes.
 */
export function SectionShell({
  sectionId,
  prompt,
  context,
  dict,
  children,
  className,
}: {
  sectionId: string;
  prompt: string;
  context: Record<string, unknown>;
  dict: Dictionary;
  children: ReactNode;
  className?: string;
}) {
  const { send, data, status } = useEveAgent();
  const ref = useRef<HTMLDivElement>(null);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const triggeredRef = useRef(false);
  const messages = data.messages ?? [];

  // Trigger one generation per section per session.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const key = `portfolio:ai:${sectionId}`;
    let fired = false;
    try {
      fired = sessionStorage.getItem(key) === "done";
    } catch {
      fired = false;
    }
    if (fired) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || triggeredRef.current) return;
        triggeredRef.current = true;
        try {
          sessionStorage.setItem(key, "done");
        } catch {
          /* private mode: still only fire once thanks to triggeredRef */
        }
        setGenerated({ text: "", source: "generating" });
        // clientContext rides along as ephemeral per-turn context (object
        // JSON-serialized into a user-role context message).
        send(prompt, {
          clientContext: { kind: "section", sectionId, ...context },
        });
      },
      { rootMargin: "0px 0px -20% 0px", threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sectionId, prompt, send, context]);

  // Watch the conversation for this section's result.
  useEffect(() => {
    if (!generated || generated.source !== "generating") return;

    if (status === "error") {
      setGenerated({ text: "", source: "failed" });
      return;
    }
    if (status !== "ready") return; // still submitted/streaming

    // Last assistant message's text parts are our generated content.
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    const text = (lastAssistant?.parts ?? [])
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n")
      .trim();

    if (text) {
      setGenerated({ text, source: "ai" });
    } else if (lastAssistant?.metadata?.status === "failed") {
      setGenerated({ text: "", source: "failed" });
    }
  }, [messages, status, generated]);

  if (!generated) return <div ref={ref} className={className}>{children}</div>;

  return (
    <div ref={ref} className={className}>
      {generated.source === "generating" && (
        <p className="mb-3 text-xs text-terminal-cyan">
          <span className="animate-pulse">▚▞</span> {dict.ai.sectionGenerating}
        </p>
      )}
      {generated.source === "ai" ? (
        <>
          <p className="mb-3 text-xs text-terminal-dim">
            <span className="text-terminal-green">✦</span> {dict.ai.sectionGenerated}
          </p>
          <div className="whitespace-pre-wrap">{generated.text}</div>
        </>
      ) : (
        children
      )}
      {generated.source === "failed" && (
        <p className="mb-3 text-xs text-terminal-dim">{dict.ai.sectionFailed}</p>
      )}
    </div>
  );
}
