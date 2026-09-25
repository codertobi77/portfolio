import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import profile from "@/../content/profile.json";
import type { Dictionary, Locale } from "@/lib/i18n";

export function About({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const skills = profile.skills;
  const timeline = profile.timeline.map((t) => ({
    year: t.year,
    title: t.title[locale],
    org: t.org[locale],
    description: t.description[locale],
  }));

  return (
    <section id="about" className="scroll-mt-20">
      <ScrollReveal>
        <h2 className="mb-6 text-2xl font-bold">
          <span className="text-terminal-dim">❯ </span>
          <span className="glow text-terminal-green">{dict.about.title}</span>
        </h2>
      </ScrollReveal>

      <ScrollReveal>
        <TerminalWindow command={dict.about.command} className="mb-6">
          <p className="text-foreground/90">{dict.about.intro}</p>
        </TerminalWindow>
      </ScrollReveal>

      <div className="grid gap-6 md:grid-cols-2">
        <ScrollReveal>
          <TerminalWindow title="identity — whoami">
            <h3 className="mb-2 text-sm font-bold text-terminal-amber">
              {dict.about.identity}
            </h3>
            <p className="mb-4 text-foreground/90">{dict.about.identityText}</p>
            <h3 className="mb-2 text-sm font-bold text-terminal-amber">
              {dict.about.focusTitle}
            </h3>
            <ul className="space-y-1">
              {dict.about.focus.map((f) => (
                <li key={f} className="text-foreground/90">
                  <span className="text-terminal-green">▸ </span>
                  {f}
                </li>
              ))}
            </ul>
          </TerminalWindow>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <TerminalWindow title="skills — htop">
            <h3 className="mb-2 text-sm font-bold text-terminal-amber">
              {dict.about.valuesTitle}
            </h3>
            <ul className="mb-4 space-y-1">
              {dict.about.values.map((v) => (
                <li key={v} className="text-foreground/90">
                  <span className="text-terminal-green">▸ </span>
                  {v}
                </li>
              ))}
            </ul>
            <h3 className="mb-3 text-sm font-bold text-terminal-amber">
              stack
            </h3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
              {skills.map((s) => (
                <li key={s.label} className="text-xs text-foreground/90">
                  <div className="flex items-center justify-between">
                    <span>{s.label}</span>
                    <span className="text-terminal-dim">
                      {"▮".repeat(s.level)}
                      <span className="text-border">
                        {"▯".repeat(5 - s.level)}
                      </span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </TerminalWindow>
        </ScrollReveal>
      </div>

      {/* Timeline */}
      <ScrollReveal>
        <TerminalWindow command="history | tail -10" className="mt-6">
          <ol className="space-y-4">
            {timeline.map((item, i) => (
              <li key={i} className="border-l border-terminal-green/30 pl-4">
                <p className="text-xs text-terminal-dim">{item.year}</p>
                <p className="font-bold text-terminal-green">
                  {item.title} <span className="text-terminal-dim">— {item.org}</span>
                </p>
                <p className="text-sm text-foreground/80">{item.description}</p>
              </li>
            ))}
          </ol>
        </TerminalWindow>
      </ScrollReveal>
    </section>
  );
}
