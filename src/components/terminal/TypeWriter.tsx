"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TypeWriterProps {
  text: string;
  speed?: number; // ms per character
  startDelay?: number; // ms before starting
  className?: string;
  caret?: boolean;
  onDone?: () => void;
}

/**
 * Types out text character by character, terminal-style.
 * Renders the full text on the server for SEO, then re-types on mount.
 */
export function TypeWriter({
  text,
  speed = 30,
  startDelay = 0,
  className,
  caret = true,
  onDone,
}: TypeWriterProps) {
  const [displayed, setDisplayed] = useState(text);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const start = () => {
      setDisplayed("");
      setDone(false);
      interval = setInterval(() => {
        i += 1;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          if (interval) clearInterval(interval);
          setDone(true);
          onDone?.();
        }
      }, speed);
    };

    timeout = setTimeout(start, startDelay);
    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed, startDelay]);

  return (
    <span
      className={cn(className, !done && caret && "cursor-blink")}
      suppressHydrationWarning
    >
      {displayed}
    </span>
  );
}
