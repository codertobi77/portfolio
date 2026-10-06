import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import {
  PageHeading,
  SkillsBars,
  TimelineRail,
  localizedTimeline,
} from "./blocks";
import { asciiBox } from "@/lib/ascii";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { SiteProfile } from "@/lib/profile";

export function CvPage({
  dict,
  locale,
  profile,
}: {
  dict: Dictionary;
  locale: Locale;
  profile: SiteProfile;
}) {
  const timeline = localizedTimeline(profile, locale);

  return (
    <div className="flex flex-col gap-8">
      <ScrollReveal>
        <PageHeading title={dict.cv.title} />
      </ScrollReveal>

      <ScrollReveal>
        <TerminalWindow command={dict.cv.command}>
          <pre className="overflow-x-auto text-xs leading-relaxed text-terminal-green/90">
            {asciiBox(dict.cv.summaryTitle, dict.cv.summary)}
          </pre>
        </TerminalWindow>
      </ScrollReveal>

      <div className="grid gap-6 md:grid-cols-2">
        <ScrollReveal>
          <TerminalWindow title={dict.cv.skillsTitle}>
            <SkillsBars skills={profile.skills} />
          </TerminalWindow>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <TerminalWindow title={dict.cv.timelineTitle}>
            <TimelineRail entries={timeline} />
          </TerminalWindow>
        </ScrollReveal>
      </div>

      <ScrollReveal>
        <TerminalWindow title="lpr — print">
          <p className="mb-3 text-xs text-terminal-dim">{dict.cv.printHint}</p>
          <a
            href="/cv.pdf"
            className="inline-block border border-terminal-green/60 bg-terminal-green/10 px-4 py-2 text-sm text-terminal-green transition-colors hover:bg-terminal-green/20"
            download
          >
            <span className="prompt">{dict.cv.download}</span>
          </a>
          <p className="mt-3 text-xs text-terminal-dim">
            {dict.cv.downloadNote}
          </p>
        </TerminalWindow>
      </ScrollReveal>
    </div>
  );
}
