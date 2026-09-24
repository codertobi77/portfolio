import { notFound } from "next/navigation";
import { getBlogPost } from "@/lib/blog";
import { getDictionary, type Dictionary, type Locale } from "@/lib/i18n";
import { MDXRemote, serialize } from "next-mdx-remote";

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) notFound();

  const post = await getBlogPost(locale, slug);
  if (!post) notFound();

  const dict = (await getDictionary()) as Dictionary;

  const source = [
    "---",
    `title: ${JSON.stringify(post.title)}`,
    `date: ${post.date}`,
    ...(post.excerpt ? [`excerpt: ${JSON.stringify(post.excerpt)}`] : []),
    ...(post.tags.length > 0
      ? [`tags: [${post.tags.map((t) => JSON.stringify(t)).join(", ")}]`]
      : []),
    ...(post.draft ? ["draft: true"] : []),
    "---",
    "",
    post.content,
  ].join("\n");

  const { compiledSource, frontmatter } = await serialize(source);

  return (
    <section id="blog-post-{slug}" className="scroll-mt-24 max-w-xl mx-auto prose">
      <h1 className="text-2xl font-bold mb-4">
        <span className="text-terminal-dim">❯ </span>
        <span className="glow text-terminal-green">
          {(frontmatter as { title?: string }).title ?? post.title}
        </span>
      </h1>
      <p className="mb-4 text-terminal-amber">
        <span className="text-xs text-terminal-dim">
          {(frontmatter as { date?: string }).date ?? post.date}
        </span>
        {post.minutes} {dict.blog.minutes} read
      </p>

      {(frontmatter as { draft?: boolean }).draft && (
        <p className="mb-4 text-xs text-terminal-amber">
          {dict.blog.draftBadge} — {dict.studio.draftSaved}
        </p>
      )}

      <MDXRemote
        compiledSource={compiledSource}
        frontmatter={frontmatter as Record<string, unknown>}
        components={{
          code: (props: any) => (
            <code className="text-xs text-terminal-cyan rounded-sm px-1 py-0.5"
              {...props}
            />
          ),
          pre: (props: any) => (
            <pre className="rounded-sm p-4 text-xs text-terminal-dim"
              {...props}
            />
          ),
        }}
      />
    </section>
  );
}
