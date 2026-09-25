import Link from "next/link";
import { notFound } from "next/navigation";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { getBlogPosts } from "@/lib/blog";
import { getDictionary, hasLocale, type Dictionary } from "@/lib/i18n";

export default async function BlogIndexPage({
  params,
}: PageProps<"/[locale]/blog">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const dict = (await getDictionary()) as Dictionary;
  // Drafts are hidden here (getBlogPosts default); they stay reachable by
  // direct URL for owner preview.
  const posts = getBlogPosts(locale);

  return (
    <div className="flex flex-col gap-8">
      <ScrollReveal>
        <div>
          <h1 className="text-2xl font-bold">
            <span className="text-terminal-dim">❯ </span>
            <span className="glow text-terminal-green">{dict.blog.title}</span>
          </h1>
          <p className="mt-2 text-sm text-terminal-dim">{dict.blog.subtitle}</p>
        </div>
      </ScrollReveal>

      <ScrollReveal>
        <TerminalWindow command={dict.blog.command}>
          {posts.length === 0 ? (
            <p className="text-terminal-amber">{dict.blog.empty}</p>
          ) : (
            <ul className="space-y-2">
              {posts.map((post) => (
                <li
                  key={post.slug}
                  className="flex flex-wrap items-baseline gap-x-3"
                >
                  <span className="text-terminal-dim">{post.date}</span>
                  <Link
                    href={`/${locale}/blog/${post.slug}`}
                    className="text-terminal-green underline-offset-4 hover:underline"
                  >
                    {post.title}
                  </Link>
                  {post.tags.length > 0 && (
                    <span className="text-xs text-terminal-cyan">
                      [{post.tags.join(", ")}]
                    </span>
                  )}
                  <span className="text-xs text-terminal-dim">
                    ({post.minutes} {dict.blog.minutes})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TerminalWindow>
      </ScrollReveal>
    </div>
  );
}
