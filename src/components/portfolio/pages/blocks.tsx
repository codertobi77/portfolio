import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import type { SiteProfile } from "@/lib/profile";

/**
 * Blocs partagés par les pages complètes (about, projects, cv, contact).
 * Composants serveur — les effets client (ScrollReveal) sont posés par
 * les pages appelantes.
 */

export function PageHeading({ title }: { title: string }) {
  return (
    <h1 className="text-2xl font-bold">
      <span className="text-terminal-dim">❯ </span>
      <span className="glow text-terminal-green">{title}</span>
    </h1>
  );
}

export function StatsGrid({
  stats,
  cols = 4,
}: {
  stats: { value: number; label: string }[];
  cols?: 3 | 4;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3",
        cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4",
      )}
    >
      {stats.map((s) => (
        <div key={s.label} className="border border-border p-3 text-center">
          <p className="text-2xl font-bold text-terminal-green glow">
            {s.value}
          </p>
          <p className="mt-1 text-xs text-terminal-dim">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

export function SkillsBars({
  skills,
  note,
}: {
  skills: SiteProfile["skills"];
  note?: string;
}) {
  return (
    <div>
      {note && <p className="mb-3 text-xs text-terminal-dim">{note}</p>}
      <ul className="space-y-3">
        {skills.map((skill) => (
          <li key={skill.label}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground/90">{skill.label}</span>
              <span className="text-terminal-dim">
                {"▮".repeat(skill.level)}
                <span className="text-border">
                  {"▯".repeat(5 - skill.level)}
                </span>
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full bg-terminal-green/10">
              <div
                className="h-full bg-terminal-green/70"
                style={{ width: `${(skill.level / 5) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface TimelineItem {
  year: string;
  title: string;
  org: string;
  description: string;
}

/** Timeline du profil, localisée pour la page courante. */
export function localizedTimeline(
  profile: SiteProfile,
  locale: Locale,
): TimelineItem[] {
  return profile.timeline.map((t) => ({
    year: t.year,
    title: t.title[locale],
    org: t.org[locale],
    description: t.description[locale],
  }));
}

export function TimelineRail({ entries }: { entries: TimelineItem[] }) {
  return (
    <ol className="space-y-4">
      {entries.map((item, i) => (
        <li key={i} className="border-l border-terminal-green/30 pl-4">
          <p className="text-xs text-terminal-dim">{item.year}</p>
          <p className="font-bold text-terminal-green">
            {item.title} <span className="text-terminal-dim">— {item.org}</span>
          </p>
          <p className="text-sm text-foreground/80">{item.description}</p>
        </li>
      ))}
    </ol>
  );
}
