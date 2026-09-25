"use client";

import Link from "next/link";
import { BootSequence } from "@/components/terminal/BootSequence";
import { TypeWriter } from "@/components/terminal/TypeWriter";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import type { Dictionary } from "@/lib/i18n";

export function Hero({ dict }: { dict: Dictionary }) {
  return (
    <section className="flex flex-col gap-8">
      <ScrollReveal>
        <div>
          <p className="mb-2 text-sm text-terminal-dim">{dict.hero.greeting}</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            <span className="glow text-terminal-green">
              {dict.hero.name}
            </span>
          </h1>
          <p className="mt-2 text-lg text-terminal-amber glow-amber">
            {dict.hero.aka}
          </p>
          {/* Le pitch a son propre effet TypeWriter : exclu de la découpe. */}
          <p className="mt-4 max-w-2xl text-foreground/90" data-no-stream>
            <TypeWriter text={dict.hero.pitch} speed={18} />
          </p>
          <p className="mt-4 text-xs text-terminal-dim">
            <span className="text-terminal-green">❯</span> {dict.hero.statusLine}
          </p>
        </div>
      </ScrollReveal>

      {/* La séquence de boot s'anime elle-même : fade seul, pas de découpe. */}
      <ScrollReveal mode="fade">
        <TerminalWindow title={dict.hero.bootTitle}>
          <BootSequence lines={dict.hero.bootLines} lineDelay={420} />
        </TerminalWindow>
      </ScrollReveal>

      <ScrollReveal>
        <div className="flex flex-wrap gap-3">
          <Link
            href="#projects"
            className="border border-terminal-green/60 bg-terminal-green/10 px-4 py-2 text-sm text-terminal-green transition-colors hover:bg-terminal-green/20"
          >
            <span className="prompt">{dict.hero.cta}</span>
          </Link>
          <Link
            href="#contact"
            className="border border-border px-4 py-2 text-sm text-terminal-dim transition-colors hover:border-terminal-green/60 hover:text-terminal-green"
          >
            {dict.hero.ctaSecondary}
          </Link>
        </div>
      </ScrollReveal>
    </section>
  );
}
