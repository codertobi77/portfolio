"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface StudioBootProps {
  /** Boot log lines (dict.studio.boot.lines — fr/en dictionaries). */
  lines: readonly string[];
  /** `[sudo] session: active` — shown only when the server render found a
   *  valid sudo session (dict.studio.boot.session). */
  sessionLine?: string;
}

const LINE_DELAY_MS = 330; // per-line reveal → ~2.5 s for the full sequence
const HOLD_MS = 400; // pause once the last line is up
const FADE_MS = 350; // fade-out before unmount

/**
 * Full-screen boot overlay for /studio: the fake boot log plays line by
 * line over the page. Click or Escape skips, `prefers-reduced-motion`
 * disables it entirely — and it never renders on the server, so
 * no-JavaScript visitors (and crawlers) see the page directly.
 *
 * Sits below the CRT overlays (scanlines z-50 / vignette z-49) so the
 * boot log is watched through the same phosphor filter as the rest.
 */
export function StudioBoot({ lines, sessionLine }: StudioBootProps) {
  const all = sessionLine ? [...lines, sessionLine] : [...lines];

  const [visible, setVisible] = useState(0);
  const [phase, setPhase] = useState<"idle" | "playing" | "leaving" | "done">("idle");
  const timersRef = useRef<number[]>([]);

  const finish = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    setVisible(all.length);
    setPhase("leaving");
  }, [all.length]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reduced motion: skip the overlay for good (never rendered on the server)
      setPhase("done");
      return;
    }
    setPhase("playing");
    for (let i = 1; i <= all.length; i += 1) {
      timersRef.current.push(window.setTimeout(() => setVisible(i), 120 + i * LINE_DELAY_MS));
    }
    timersRef.current.push(
      window.setTimeout(finish, 120 + all.length * LINE_DELAY_MS + HOLD_MS),
    );
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, [finish, all.length]);

  // Escape skips the sequence.
  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, finish]);

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
        {visible < all.length && (
          <p className="cursor-blink text-terminal-green/90" aria-hidden />
        )}
      </div>
    </div>
  );
}
