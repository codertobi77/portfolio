import { notFound } from "next/navigation";
import { Hero } from "@/components/portfolio/Hero";
import { About } from "@/components/portfolio/About";
import { Projects } from "@/components/portfolio/Projects";
import {
  BlogTeaser,
  ContactSection,
  CvSection,
} from "@/components/portfolio/Sections";
import { SectionShell } from "@/components/portfolio/SectionShell";
import { getDictionary, hasLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getPublishedProjects } from "@/lib/supabase/projects";
import { getBlogPosts } from "@/lib/blog";

export default async function HomePage({
  params,
}: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const dict = (await getDictionary()) as Dictionary;
  const [projects, posts] = await Promise.all([
    getPublishedProjects(locale),
    getBlogPosts(locale, 3),
  ]);

  const sectionPrompt = (section: string, data: unknown) =>
    `Regenerate the "${section}" section content of the portfolio in ${
      locale === "fr" ? "French" : "English"
    }. Improve wording only; keep all names, facts and links. Data: ${JSON.stringify(
      data,
    ).slice(0, 4000)}`;

  return (
    <div className="flex flex-col gap-20">
      <Hero dict={dict} />

      <SectionShell
        sectionId="about"
        dict={dict}
        prompt={sectionPrompt("about", {
          intro: dict.about.intro,
          identity: dict.about.identityText,
          focus: dict.about.focus,
          values: dict.about.values,
        })}
        context={{ locale, section: "about" }}
      >
        <About dict={dict} locale={locale as Locale} />
      </SectionShell>

      <SectionShell
        sectionId="projects"
        dict={dict}
        prompt={sectionPrompt("projects", {
          subtitle: dict.projects.subtitle,
          projects: projects.map((p) => ({
            title: p.title,
            description: p.description,
            tags: p.tags,
          })),
        })}
        context={{ locale, section: "projects" }}
      >
        <Projects dict={dict} projects={projects} />
      </SectionShell>

      <SectionShell
        sectionId="blog"
        dict={dict}
        prompt={sectionPrompt("blog", {
          subtitle: dict.blog.subtitle,
          posts: posts.map((p) => ({ title: p.title, excerpt: p.excerpt })),
        })}
        context={{ locale, section: "blog" }}
      >
        <BlogTeaser dict={dict} locale={locale as Locale} posts={posts} />
      </SectionShell>

      <CvSection dict={dict} />
      <ContactSection dict={dict} />
    </div>
  );
}
