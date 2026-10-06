import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import {
  PageHeading,
  StatsGrid,
  SkillsBars,
  TimelineRail,
  localizedTimeline,
} from "./blocks";
import { asciiBox } from "@/lib/ascii";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { SiteProfile } from "@/lib/profile";

export function AboutPage({
  dict,
  locale,
  profile,
  postsCount,
}: {
  dict: Dictionary;
  locale: Locale;
  profile: SiteProfile;
  postsCount: number;
}) {
  const timeline = localizedTimeline(profile, locale);
  const firstYear = Math.min(
    ...profile.timeline
      .map((t) => Number.parseInt(t.year, 10))
      .filter(Number.isFinite),
  );
  const years = Number.isFinite(firstYear)
    ? Math.max(0, new Date().getFullYear() - firstYear)
    : 0;

  const stats = [
    { value: profile.skills.length, label: dict.about.stats.skills },
    { value: profile.timeline.length, label: dict.about.stats.milestones },
    { value: years, label: dict.about.stats.years },
    { value: postsCount, label: dict.about.stats.posts },
  ];

  return (
    <div className="flex flex-col gap-8">
      <ScrollReveal>
        <PageHeading title={dict.about.title} />
      </ScrollReveal>

      <ScrollReveal>
        <TerminalWindow command={dict.about.command}>
          <p className="text-foreground/90">{dict.about.intro}</p>
        </TerminalWindow>
      </ScrollReveal>

      <ScrollReveal>
        <TerminalWindow title={dict.about.statsTitle}>
          <StatsGrid stats={stats} />
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
            <ul className="mb-4 space-y-1">
              {dict.about.focus.map((f) => (
                <li key={f} className="text-foreground/90">
                  <span className="text-terminal-green">▸ </span>
                  {f}
                </li>
              ))}
            </ul>
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
            <h3 className="mb-2 text-sm font-bold text-terminal-amber">
              {dict.about.methodTitle}
            </h3>
            <ol className="space-y-1">
              {dict.about.method.map((m, i) => (
                <li key={m} className="text-foreground/90">
                  <span className="text-terminal-dim">{i + 1}. </span>
                  {m}
                </li>
              ))}
            </ol>
          </TerminalWindow>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <TerminalWindow title={dict.about.skillsTitle}>
            <SkillsBars skills={profile.skills} note={dict.about.skillsNote} />
          </TerminalWindow>
        </ScrollReveal>
      </div>

      <ScrollReveal>
        <TerminalWindow command={dict.about.timelineCommand}>
          <TimelineRail entries={timeline} />
        </TerminalWindow>
      </ScrollReveal>

      <ScrollReveal>
        <pre className="overflow-x-auto border border-border bg-card p-4 text-xs leading-relaxed text-terminal-green/90">
          {asciiBox(dict.about.nowTitle, dict.about.nowText)}
        </pre>
      </ScrollReveal>
    </div>
  );
}
