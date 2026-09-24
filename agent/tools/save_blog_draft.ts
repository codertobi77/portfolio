import fs from "node:fs";
import path from "node:path";
import { defineTool } from "eve/tools";
import { z } from "zod";

const STUDIO_OWNER = "studio-owner";

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "draft"
  );
}

export default defineTool({
  description:
    "Save an approved blog post draft as a draft MDX file in the site's blog content (content/blog/<locale>/). Studio owner only.",
  inputSchema: z.object({
    locale: z.enum(["fr", "en"]),
    title: z.string().min(1).max(200),
    excerpt: z.string().max(500).optional(),
    tags: z.array(z.string().min(1).max(40)).max(8).default([]),
    markdown: z.string().min(1).max(50000),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    path: z.string().optional(),
    error: z.string().optional(),
  }),
  label: {
    start: ({ title, locale }) => `Save draft "${title}" (${locale})`,
    complete: (_input, output) =>
      output.ok ? `Draft saved: ${output.path}` : "Draft not saved",
  },
  // Only the Studio owner may save; anonymous visitors get a denied call
  // (no approval prompt leaked to the public) and the draft stays in chat.
  approval: ({ session }) => {
    const current = session.auth.current;
    if (!current || current.principalId !== STUDIO_OWNER) {
      return {
        type: "denied",
        reason:
          "Saving blog drafts is reserved for the portfolio owner (Studio). Provide the draft as text instead.",
      };
    }
    return "user-approval";
  },
  async execute({ locale, title, excerpt, tags, markdown }, ctx) {
    const current = ctx.session.auth.current;
    if (!current || current.principalId !== STUDIO_OWNER) {
      return { ok: false, error: "unauthorized" };
    }

    try {
      const dir = path.join(process.cwd(), "content", "blog", locale);
      const base = slugify(title);
      await fs.promises.mkdir(dir, { recursive: true });

      let file = path.join(dir, `${base}.mdx`);
      for (let n = 2; fs.existsSync(file); n += 1) {
        file = path.join(dir, `${base}-${n}.mdx`);
      }

      const frontmatter = [
        "---",
        `title: ${JSON.stringify(title)}`,
        `date: ${new Date().toISOString().slice(0, 10)}`,
        ...(excerpt ? [`excerpt: ${JSON.stringify(excerpt)}`] : []),
        ...(tags.length > 0
          ? [`tags: [${tags.map((t) => JSON.stringify(t)).join(", ")}]`]
          : []),
        "draft: true",
        "---",
      ].join("\n");

      await fs.promises.writeFile(
        file,
        `${frontmatter}\n\n${markdown.trim()}\n`,
        "utf8",
      );

      return { ok: true, path: path.relative(process.cwd(), file) };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not write the draft file.",
      };
    }
  },
});
