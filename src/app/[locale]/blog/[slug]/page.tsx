import Link from "next/link";
import { notFound } from "next/navigation";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { getBlogPost } from "@/lib/blog";
import { getDictionary, hasLocale, type Dictionary } from "@/lib/i18n";
import { compileMDX } from "next-mdx-remote/rsc";
import type { ComponentProps } from "react";

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) notFound();

  const post = getBlogPost(locale, slug);
  if (!post) notFound();

  const dict = (await getDictionary()) as Dictionary;

  // Frontmatter was already parsed by gray-matter in lib/blog — compile the
  // body only.
  const { content } = await compileMDX({
    source: post.content,
    components: {
      code: (props: ComponentProps<"code">) => (
        <code
          className="rounded-sm px-1 py-0.5 text-xs text-terminal-cyan"
          {...props}
        />
      ),
      pre: (props: ComponentProps<"pre">) => (
        <pre
          className="rounded-sm p-4 text-xs text-terminal-dim"
          {...props}
        />
      ),
    },
  });

  return (
    <section id={`blog-post-${slug}`} className="prose mx-auto max-w-xl scroll-mt-24">
      <ScrollReveal>
        <div>
          <h1 className="mb-4 text-2xl font-bold">
            <span className="text-terminal-dim">❯ </span>
            <span className="glow text-terminal-green">{post.title}</span>
          </h1>
          <p className="mb-4 text-terminal-amber">
            <span className="text-xs text-terminal-dim">{post.date}</span>
            {" — "}
            {post.minutes} {dict.blog.minutes}
          </p>

          {post.draft && (
            <p className="mb-4 text-xs text-terminal-amber">
              [{dict.blog.draftBadge}]
            </p>
          )}
        </div>
      </ScrollReveal>

      {/* Corps MDX : rendu serveur statique, streaming au scroll. */}
      <ScrollReveal>{content}</ScrollReveal>

      <ScrollReveal>
        <Link
          href={`/${locale}/blog`}
          className="mt-8 inline-block text-sm text-terminal-dim hover:text-terminal-green"
        >
          <span className="prompt">{dict.blog.backToBlog} →</span>
        </Link>
      </ScrollReveal>
    </section>
  );
}
