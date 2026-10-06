import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionShell } from "@/components/portfolio/SectionShell";
import { ProjectsPage } from "@/components/portfolio/pages/ProjectsPage";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { getPublishedProjects } from "@/lib/supabase/projects";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const dict = await getDictionary();
  return { title: `${dict.projects.title} — ${dict.site.title}` };
}

export default async function ProjectsRoute({
  params,
}: PageProps<"/[locale]/projects">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const dict = await getDictionary();
  const projects = await getPublishedProjects(locale);

  const prompt = `Regenerate the "projects" page content of the portfolio in ${
    locale === "fr" ? "French" : "English"
  }. Improve wording only; keep all names, facts and links. Data: ${JSON.stringify({
    subtitle: dict.projects.subtitle,
    process: dict.projects.process,
    projects: projects.map((p) => ({
      title: p.title,
      description: p.description,
      tags: p.tags,
    })),
  }).slice(0, 4000)}`;

  return (
    <SectionShell
      sectionId="projects"
      dict={dict}
      prompt={prompt}
      context={{ locale, section: "projects" }}
    >
      <ProjectsPage dict={dict} projects={projects} />
    </SectionShell>
  );
}
