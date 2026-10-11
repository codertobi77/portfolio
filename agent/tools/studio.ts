import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";
import {
  blogInputSchema,
  composeBlogArgv,
  composeContactArgv,
  composeGuestbookArgv,
  composeProfileArgv,
  composeProjectsArgv,
  composeStatsArgv,
  contactInputSchema,
  executeStudioTool,
  guestbookInputSchema,
  MUTATING_ACTIONS,
  profileInputSchema,
  projectsInputSchema,
  statsInputSchema,
  studioApproval,
  studioToolLabel,
  studioToolsEnabled,
} from "@/lib/studio/agent-tools";

/**
 * v2.1 — the Studio toolset, registered dynamically per turn.
 *
 * The resolver runs at `turn.started` with the auth of the most recent
 * request, so the gate is live: the tools exist only when the caller is the
 * studio owner (valid sudo session cookie — studioOwnerAuth revalidates it
 * on every request) AND the owner enabled v2.1 at boot (cookie → auth
 * attribute `studio-tools`). Everyone else — including the owner before
 * opting in — never sees the tools, not even their schemas.
 *
 * Tool names: a dynamic Record names its entries by their BARE key (the
 * file slug is only used for single-tool resolvers — see eve's
 * dynamic-tool-lifecycle qualifyDynamicToolNames), so the keys below
 * namespace themselves: studio__projects, studio__guestbook, studio__contact,
 * studio__profile, studio__blog, studio__stats. All logic (argv composition,
 * the elevated exec, approvals, the revalidation bridge) lives in the
 * eve-free module src/lib/studio/agent-tools.ts so it stays scratch-testable.
 */

const toolOutputSchema = z.object({ ok: z.boolean(), output: z.string() });

const OUTPUT_NOTE =
  "Tool output is English shell text — rephrase it for the user in their language. Mutating actions require the owner's approval before they run.";

function studioTools() {
  return {
    "studio__projects": defineTool({
      description:
        `Manage the portfolio's projects (Supabase). Actions: list (optional published/tag filters), ` +
        `show (ref = slug, id or id prefix), create, edit, publish, hide, delete. ` +
        `Creating requires title and description; edit takes a ref plus the fields to change. ${OUTPUT_NOTE}`,
      inputSchema: projectsInputSchema,
      outputSchema: toolOutputSchema,
      label: studioToolLabel("projects"),
      approval: studioApproval(MUTATING_ACTIONS.projects),
      execute(input, ctx) {
        return executeStudioTool(ctx, input.locale, composeProjectsArgv(input));
      },
    }),

    "studio__guestbook": defineTool({
      description:
        `Moderate the public guestbook. Actions: list (filter pending or approved entries), show (one entry ` +
        `by id or id prefix), approve, delete (multiple ids at once). ${OUTPUT_NOTE}`,
      inputSchema: guestbookInputSchema,
      outputSchema: toolOutputSchema,
      label: studioToolLabel("guestbook"),
      approval: studioApproval(MUTATING_ACTIONS.guestbook),
      execute(input, ctx) {
        return executeStudioTool(ctx, input.locale, composeGuestbookArgv(input));
      },
    }),

    "studio__contact": defineTool({
      description:
        `Read the contact inbox. Actions: list (newest first, optional limit), show (one message by id or ` +
        `id prefix), delete (messages, multiple ids at once). ${OUTPUT_NOTE}`,
      inputSchema: contactInputSchema,
      outputSchema: toolOutputSchema,
      label: studioToolLabel("contact"),
      approval: studioApproval(MUTATING_ACTIONS.contact),
      execute(input, ctx) {
        return executeStudioTool(ctx, input.locale, composeContactArgv(input));
      },
    }),

    "studio__profile": defineTool({
      description:
        `Read and edit the site persona rendered on the public pages. Actions: show, edit (role/alias/` +
        `location/email/status — provide only the fields to change), social_add, social_delete, skill_add, ` +
        `skill_edit, skill_delete, timeline_add, timeline_edit, timeline_delete. Profile fields are bilingual ` +
        `where relevant (role, status, timeline titles/organisations/descriptions). ${OUTPUT_NOTE}`,
      inputSchema: profileInputSchema,
      outputSchema: toolOutputSchema,
      label: studioToolLabel("profile"),
      approval: studioApproval(MUTATING_ACTIONS.profile),
      execute(input, ctx) {
        return executeStudioTool(ctx, input.locale, composeProfileArgv(input));
      },
    }),

    "studio__blog": defineTool({
      description:
        `Inspect the blog (read-only). Actions: list (posts for a locale, drafts included), show (one post's ` +
        `frontmatter). Saving drafts stays save_blog_draft's job. ${OUTPUT_NOTE}`,
      inputSchema: blogInputSchema,
      outputSchema: toolOutputSchema,
      label: studioToolLabel("blog"),
      approval: studioApproval(MUTATING_ACTIONS.blog),
      execute(input, ctx) {
        return executeStudioTool(ctx, input.locale, composeBlogArgv(input));
      },
    }),

    "studio__stats": defineTool({
      description: `Portfolio counters: projects (total/published), guestbook (pending/approved), contact messages and blog posts per locale. ${OUTPUT_NOTE}`,
      inputSchema: statsInputSchema,
      outputSchema: toolOutputSchema,
      label: studioToolLabel("stats"),
      approval: studioApproval(MUTATING_ACTIONS.stats),
      execute(input, ctx) {
        return executeStudioTool(ctx, input.locale, composeStatsArgv());
      },
    }),
  };
}

export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) =>
      studioToolsEnabled(ctx.session.auth) ? studioTools() : null,
  },
});
