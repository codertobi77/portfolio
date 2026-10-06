import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionShell } from "@/components/portfolio/SectionShell";
import { AboutPage } from "@/components/portfolio/pages/AboutPage";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { getSiteProfile } from "@/lib/profile";
import { getSupabaseAnonClient } from "@/lib/supabase/client";
import { getBlogPosts } from "@/lib/blog";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const dict = await getDictionary();
  return { title: `${dict.about.title} — ${dict.site.title}` };
}

export default async function AboutRoute({
  params,
}: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const dict = await getDictionary();
  const profile = await getSiteProfile(getSupabaseAnonClient());
  const posts = getBlogPosts(locale);

  const prompt = `Regenerate the "about" page content of the portfolio in ${
    locale === "fr" ? "French" : "English"
  }. Improve wording only; keep all names, facts and links. Data: ${JSON.stringify({
    intro: dict.about.intro,
    identity: dict.about.identityText,
    focus: dict.about.focus,
    values: dict.about.values,
    method: dict.about.method,
  }).slice(0, 4000)}`;

  return (
    <SectionShell
      sectionId="about"
      dict={dict}
      prompt={prompt}
      context={{ locale, section: "about" }}
    >
      <AboutPage
        dict={dict}
        locale={locale}
        profile={profile}
        postsCount={posts.length}
      />
    </SectionShell>
  );
}
