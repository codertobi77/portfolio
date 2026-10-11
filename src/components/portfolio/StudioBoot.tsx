"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  readStudioToolsChoice,
  writeStudioToolsChoice,
  type StudioToolsChoice,
} from "@/lib/studio/tools";

interface StudioBootProps {
  /** Boot log lines (dict.studio.boot.lines — fr/en dictionaries). */
  lines: readonly string[];
  /** `[sudo] session: active` — shown only when the server render found a
   *  valid sudo session (dict.studio.boot.session). */
  sessionLine?: string;
  /** v2.1 opt-in strings (dict.studio.boot.tools): the eve studio tools
   *  choice offered at the end of the boot — to everyone; the server gate
   *  (owner + cookie) alone decides whether the tools are real. */
  tools: {
    ask: string;
    lastOn: string;
    lastOff: string;
    on: string;
    off: string;
    /** Ready line replacing the last dict line when the choice is "on". */
    readyOn: string;
  };
}

const LINE_DELAY_MS = 500; // per-line reveal → ~5 s for the full sequence
const HOLD_MS = 900; // pause once the last line is up
const FADE_MS = 500; // fade-out before unmount

type Phase = "idle" | "playing" | "choice" | "leaving" | "done";

/**
 * Full-screen boot overlay for /studio: the fake boot log plays line by
 * line over the page. Click or Escape skips, `prefers-reduced-motion`
 * disables it entirely — and it never renders on the server, so
 * no-JavaScript visitors (and crawlers) see the page directly.
 *
 * v2.1: the boot ends with the eve-studio-tools opt-in, offered to every
 * visitor — y/n picks, Enter reuses the last choice (mirrored in
 * localStorage, stored as the non-httpOnly `studio_agent_tools` cookie
 * read by studioOwnerAuth()). The server gate (owner principal + cookie)
 * alone decides whether the tools are actually registered; with the
 * choice "on", the boot log's last line reads `tools.readyOn` (v2.1).
 * Click/Escape keeps the previous choice; reduced-motion skips the prompt
 * entirely and also keeps the previous choice (reload without reduced
 * motion to change it).
 *
 * Sits below the CRT overlays (scanlines z-50 / vignette z-49) so the
 * boot log is watched through the same phosphor filter as the rest.
 */
export function StudioBoot({ lines, sessionLine, tools }: StudioBootProps) {
  // Last boot choice, read at the first client render (SSR: null — the
  // overlay renders nothing before mount, so there is no hydration
  // mismatch). Drives the v2.1 ready line and the `enter = last` hint.
  const [lastChoice] = useState<StudioToolsChoice | null>(() =>
    readStudioToolsChoice(),
  );
  // With the tools armed, the log announces v2.1 instead of v2.0.
  const baseLines =
    lastChoice === "on" && lines.length > 0
      ? [...lines.slice(0, -1), tools.readyOn]
      : [...lines];
  const all = sessionLine ? [...baseLines, sessionLine] : baseLines;

  const [visible, setVisible] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [choiceLine, setChoiceLine] = useState<string | null>(null);
  const timersRef = useRef<number[]>([]);

  const finish = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    setVisible(all.length);
    setPhase("leaving");
  }, [all.length]);

  const applyChoice = useCallback(
    (choice: StudioToolsChoice) => {
      writeStudioToolsChoice(choice);
      setChoiceLine(choice === "on" ? tools.on : tools.off);
      finish();
    },
    [finish, tools.off, tools.on],
  );

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reduced motion: skip the overlay (and the tools prompt) for good — the last choice stays
      setPhase("done");
      return;
    }
    setPhase("playing");
    for (let i = 1; i <= all.length; i += 1) {
      timersRef.current.push(window.setTimeout(() => setVisible(i), 120 + i * LINE_DELAY_MS));
    }
    timersRef.current.push(
      window.setTimeout(
        () => {
          setVisible(all.length);
          // v2.1: the opt-in is offered at every boot — the server gate
          // (owner + cookie) alone decides whether the tools are real.
          setPhase("choice");
        },
        120 + all.length * LINE_DELAY_MS + HOLD_MS,
      ),
    );
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, [all.length, sessionLine]);

  // Escape skips the log (in the choice phase it keeps the last choice).
  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, finish]);

  // The v2.1 choice: y/n pick, Enter reuses the last choice (off when none).
  useEffect(() => {
    if (phase !== "choice") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        finish();
        return;
      }
      if (e.key === "Enter") {
        applyChoice(lastChoice ?? "off");
        return;
      }
      if (/^y(es)?$/i.test(e.key)) {
        applyChoice("on");
        return;
      }
      if (/^no?$/i.test(e.key)) {
        applyChoice("off");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, finish, applyChoice, lastChoice]);

  // Unmount after the fade-out.
  useEffect(() => {
    if (phase !== "leaving") return;
    const t = window.setTimeout(() => setPhase("done"), FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "idle" || phase === "done") return null;

  return (
    <div
      role="presentation"
      aria-hidden
      onClick={finish}
      className={cn(
        "fixed inset-0 z-[45] flex cursor-pointer items-center justify-center bg-background transition-opacity duration-300",
        phase === "leaving" && "pointer-events-none opacity-0",
      )}
    >
      <div className="w-full max-w-md px-6 text-sm leading-relaxed">
        {all.slice(0, visible).map((line, i) => (
          <p
            key={i}
            className={line.startsWith("[sudo]") ? "text-terminal-amber" : "text-terminal-green/90"}
          >
            {line}
          </p>
        ))}
        {choiceLine !== null ? (
          <p className="text-terminal-cyan">{choiceLine}</p>
        ) : phase === "choice" ? (
          <p className="text-terminal-cyan">
            {tools.ask}
            {lastChoice === "on" ? ` ${tools.lastOn}` : ""}
            {lastChoice === "off" ? ` ${tools.lastOff}` : ""}
          </p>
        ) : null}
        {(visible < all.length || phase === "choice") && choiceLine === null && (
          <p className="cursor-blink text-terminal-green/90" aria-hidden />
        )}
      </div>
    </div>
  );
}
