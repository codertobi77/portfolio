import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import type { Dictionary } from "@/lib/i18n";
import type { Project } from "@/lib/supabase/projects";

export function Projects({
  dict,
  projects,
}: {
  dict: Dictionary;
  projects: Project[];
}) {
  return (
    <section id="projects" className="scroll-mt-20">
      <h2 className="mb-6 text-2xl font-bold">
        <span className="text-terminal-dim">❯ </span>
        <span className="glow text-terminal-green">{dict.projects.title}</span>
      </h2>

      <p className="mb-6 text-sm text-terminal-dim">
        {dict.projects.subtitle}{" "}
        <span className="text-terminal-cyan">[{dict.projects.source}]</span>
      </p>

      {projects.length === 0 ? (
        <TerminalWindow command={dict.projects.command}>
          <p className="text-terminal-amber">{dict.projects.empty}</p>
        </TerminalWindow>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {projects.map((project) => (
            <TerminalWindow
              key={project.id}
              title={`~/projects/${project.slug}`}
            >
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
          ))}
        </div>
      )}
    </section>
  );
}
