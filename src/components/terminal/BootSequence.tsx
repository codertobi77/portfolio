"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface BootSequenceProps {
  lines: string[];
  lineDelay?: number; // ms between lines
  className?: string;
  onDone?: () => void;
}

/**
 * Displays boot lines one by one, like a terminal boot log.
 * All lines visible on server render (SEO), then replays on mount.
 */
export function BootSequence({
  lines,
  lineDelay = 500,
  className,
  onDone,
}: BootSequenceProps) {
  const [visibleCount, setVisibleCount] = useState(lines.length);

  useEffect(() => {
    let current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only replay of the boot log: full text is server-rendered for SEO, then reset on mount
    setVisibleCount(0);
    const interval = setInterval(() => {
      current += 1;
      setVisibleCount(current);
      if (current >= lines.length) {
        clearInterval(interval);
        onDone?.();
      }
    }, lineDelay);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineDelay]);

  return (
    <div className={cn("space-y-1", className)} suppressHydrationWarning>
      {lines.slice(0, visibleCount).map((line, i) => (
        <p key={i} className="text-terminal-green/90">
          {line.startsWith("amidala@samari") ? (
            <>
              <span className="text-terminal-dim">amidala@samari</span>
              <span className="text-terminal-dim">:</span>
              <span className="text-terminal-cyan">~</span>
              <span className="text-terminal-dim">$ </span>
              {line.replace(/^amidala@samari:~\$\s*/, "")}
            </>
          ) : (
            line
          )}
        </p>
      ))}
      {visibleCount < lines.length && (
        <p className="text-terminal-green/90 cursor-blink" aria-hidden />
      )}
    </div>
  );
}
