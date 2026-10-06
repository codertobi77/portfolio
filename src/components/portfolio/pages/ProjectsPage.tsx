import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { PageHeading, StatsGrid } from "./blocks";
import type { Dictionary } from "@/lib/i18n";
import type { Project } from "@/lib/supabase/projects";

export function ProjectsPage({
  dict,
  projects,
}: {
  dict: Dictionary;
  projects: Project[];
}) {
  const tags = new Set(projects.flatMap((p) => p.tags));
  const stats = [
    { value: projects.length, label: dict.projects.stats.published },
    {
      value: projects.filter((p) => p.featured).length,
      label: dict.projects.stats.featured,
    },
    { value: tags.size, label: dict.projects.stats.tags },
  ];

  return (
    <div className="flex flex-col gap-8">
      <ScrollReveal>
        <PageHeading title={dict.projects.title} />
        <p className="mt-2 text-sm text-terminal-dim">
          {dict.projects.subtitle}{" "}
          <span className="text-terminal-cyan">[{dict.projects.source}]</span>
        </p>
      </ScrollReveal>

      <ScrollReveal>
        <TerminalWindow title={dict.projects.statsTitle}>
          <StatsGrid stats={stats} cols={3} />
        </TerminalWindow>
      </ScrollReveal>

      <ScrollReveal>
        <TerminalWindow title={dict.projects.processTitle}>
          <ol className="space-y-1">
            {dict.projects.process.map((step, i) => (
              <li key={step} className="text-foreground/90">
                <span className="text-terminal-dim">{i + 1}. </span>
                {step}
              </li>
            ))}
          </ol>
        </TerminalWindow>
      </ScrollReveal>

      {projects.length === 0 ? (
        <ScrollReveal>
          <TerminalWindow command={dict.projects.command}>
            <p className="text-terminal-amber">{dict.projects.empty}</p>
          </TerminalWindow>
        </ScrollReveal>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {projects.map((project, i) => (
            <ScrollReveal key={project.id} delay={(i % 2) * 110}>
              <TerminalWindow title={`~/projects/${project.slug}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-terminal-green">
                    {project.title}
                  </h3>
                  {project.featured && (
                    <Badge
                      variant="outline"
                      className="border-terminal-amber/50 text-terminal-amber"
                    >
                      {dict.projects.featured}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 mb-3 text-sm text-foreground/80">
                  {project.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="border-terminal-cyan/40 text-xs text-terminal-cyan"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                {(project.url || project.repo_url) && (
                  <div className="mt-4 flex gap-4 text-xs">
                    {project.url && (
                      <Link
                        href={project.url}
                        className="text-terminal-green underline underline-offset-4 hover:glow"
                      >
                        {dict.projects.viewProject} →
                      </Link>
                    )}
                    {project.repo_url && (
                      <Link
                        href={project.repo_url}
                        className="text-terminal-dim underline underline-offset-4 hover:text-terminal-green"
                      >
                        {dict.projects.viewCode} →
                      </Link>
                    )}
                  </div>
                )}
              </TerminalWindow>
            </ScrollReveal>
          ))}
        </div>
      )}
    </div>
  );
}
