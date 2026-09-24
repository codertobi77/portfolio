import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
  draft: boolean;
  content: string;
  minutes: number;
}

const CONTENT_DIR = path.join(process.cwd(), "content", "blog");

function minutesOf(markdown: string): number {
  const words = markdown.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Blog posts for a locale, newest first.
 * MDX files live in content/blog/<locale>/<slug>.mdx (frontmatter + body).
 */
export function getBlogPosts(locale: string, limit?: number): BlogPost[] {
  const dir = path.join(CONTENT_DIR, locale);
  if (!fs.existsSync(dir)) return [];

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mdx"))
    .sort()
    .reverse();

  const posts = files
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const { data, content } = matter(raw);
      const slug = file.replace(/\.mdx$/, "");
      return {
        slug,
        title: (data.title as string) ?? slug,
        date: (data.date as string) ?? "",
        excerpt: (data.excerpt as string) ?? "",
        tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
        draft: Boolean(data.draft),
        content,
        minutes: minutesOf(content),
      } satisfies BlogPost;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return limit ? posts.slice(0, limit) : posts;
}

export function getBlogPost(locale: string, slug: string): BlogPost | null {
  const posts = getBlogPosts(locale);
  return posts.find((p) => p.slug === slug) ?? null;
}
