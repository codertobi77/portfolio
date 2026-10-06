import Link from "next/link";
import { notFound } from "next/navigation";
import { Hero } from "@/components/portfolio/Hero";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { getSiteProfile } from "@/lib/profile";
import { getSupabaseAnonClient } from "@/lib/supabase/client";

export default async function HomePage({
  params,
}: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const dict = await getDictionary();
  const profile = await getSiteProfile(getSupabaseAnonClient());

  // La home reste courte : hero + annuaire. Chaque entrée vit dans sa page.
  const entries = [
    { slug: "about", desc: dict.directory.entries.about.desc },
    { slug: "projects", desc: dict.directory.entries.projects.desc },
    { slug: "blog", desc: dict.directory.entries.blog.desc },
    { slug: "cv", desc: dict.directory.entries.cv.desc },
    { slug: "contact", desc: dict.directory.entries.contact.desc },
    { slug: "guestbook", desc: dict.directory.entries.guestbook.desc },
  ];

  return (
    <div className="flex flex-col gap-16">
      <Hero dict={dict} locale={locale} profile={profile} />

      <section aria-label={dict.directory.command}>
        <ScrollReveal>
          <h2 className="mb-6 text-2xl font-bold">
            <span className="text-terminal-dim">❯ </span>
            <span className="glow text-terminal-green">
              {dict.directory.command}
            </span>
          </h2>
        </ScrollReveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry, i) => (
            <ScrollReveal key={entry.slug} delay={i * 60}>
              <Link
                href={`/${locale}/${entry.slug}`}
                className="group block border border-border bg-card p-4 transition-colors hover:border-terminal-green/60"
              >
                <p className="text-sm">
                  <span className="text-terminal-dim">drwxr-xr-x</span>{" "}
                  <span className="text-terminal-green group-hover:glow">
                    {entry.slug}/
                  </span>
                </p>
                <p className="mt-2 text-xs text-foreground/70">{entry.desc}</p>
                <p className="mt-3 text-xs text-terminal-dim transition-colors group-hover:text-terminal-green">
                  cd {entry.slug}/ →
                </p>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </section>
    </div>
  );
}
