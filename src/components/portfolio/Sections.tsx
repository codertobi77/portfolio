import Link from "next/link";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { ContactForm } from "@/components/portfolio/ContactForm";
import type { Dictionary, Locale } from "@/lib/i18n";
import profile from "@/../content/profile.json";

export function CvSection({ dict }: { dict: Dictionary }) {
  return (
    <section id="cv" className="scroll-mt-20">
      <ScrollReveal>
        <h2 className="mb-6 text-2xl font-bold">
          <span className="text-terminal-dim">❯ </span>
          <span className="glow text-terminal-green">{dict.cv.title}</span>
        </h2>
      </ScrollReveal>

      <ScrollReveal>
        <TerminalWindow command={dict.cv.command}>
          <p className="text-foreground/90">{dict.cv.placeholder}</p>
          <a
            href="/cv.pdf"
            className="mt-4 inline-block border border-terminal-green/60 bg-terminal-green/10 px-4 py-2 text-sm text-terminal-green transition-colors hover:bg-terminal-green/20"
            download
          >
            <span className="prompt">{dict.cv.download}</span>
          </a>
        </TerminalWindow>
      </ScrollReveal>
    </section>
  );
}

export function BlogTeaser({
  dict,
  locale,
  posts,
}: {
  dict: Dictionary;
  locale: Locale;
  posts: { slug: string; title: string; date: string; minutes: number }[];
}) {
  return (
    <section id="blog-link" className="scroll-mt-20">
      <ScrollReveal>
        <h2 className="mb-6 text-2xl font-bold">
          <span className="text-terminal-dim">❯ </span>
          <span className="glow text-terminal-green">{dict.blog.title}</span>
        </h2>
      </ScrollReveal>

      <ScrollReveal>
        <TerminalWindow command={dict.blog.command}>
          {posts.length === 0 ? (
            <p className="text-terminal-amber">{dict.blog.empty}</p>
          ) : (
            <ul className="space-y-2">
              {posts.map((post) => (
                <li key={post.slug} className="flex flex-wrap items-baseline gap-x-3">
                  <span className="text-terminal-dim">{post.date}</span>
                  <Link
                    href={`/${locale}/blog/${post.slug}`}
                    className="text-terminal-green underline-offset-4 hover:underline"
                  >
                    {post.title}
                  </Link>
                  <span className="text-xs text-terminal-dim">
                    ({post.minutes} {dict.blog.minutes})
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/${locale}/blog`}
            className="mt-4 inline-block text-sm text-terminal-dim hover:text-terminal-green"
          >
            <span className="prompt">{dict.blog.title} →</span>
          </Link>
        </TerminalWindow>
      </ScrollReveal>
    </section>
  );
}

export function ContactSection({ dict }: { dict: Dictionary }) {
  return (
    <section id="contact" className="scroll-mt-20">
      <ScrollReveal>
        <h2 className="mb-6 text-2xl font-bold">
          <span className="text-terminal-dim">❯ </span>
          <span className="glow text-terminal-green">{dict.contact.title}</span>
        </h2>
      </ScrollReveal>

      <ScrollReveal>
        <TerminalWindow command={dict.contact.command} className="mb-6">
          <p className="text-foreground/90">{dict.contact.subtitle}</p>
          <p className="mt-3 text-sm text-terminal-dim">
            {dict.contact.emailDirect}{" "}
            <a
              href={`mailto:${profile.email}`}
              className="text-terminal-green underline underline-offset-4"
            >
              {profile.email}
            </a>
          </p>
          <ul className="mt-3 flex flex-wrap gap-4 text-sm">
            {profile.socials.map((s) => (
              <li key={s.label}>
                <a
                  href={s.url}
                  className="text-terminal-dim hover:text-terminal-green"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <span className="text-terminal-green">▸ </span>
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </TerminalWindow>
      </ScrollReveal>

      {/* Formulaire interactif (re-rendu au submit) : fade seul, pas de
          découpe du texte. */}
      <ScrollReveal mode="fade">
        <TerminalWindow title="sendmail — nouveau message">
          <ContactForm dict={dict} />
        </TerminalWindow>
      </ScrollReveal>
    </section>
  );
}
