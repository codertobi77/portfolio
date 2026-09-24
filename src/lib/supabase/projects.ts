import { getSupabaseAnonClient } from "./client";

export interface Project {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  url: string | null;
  repo_url: string | null;
  featured: boolean;
  sort_order: number;
}

export const FALLBACK_PROJECTS: Project[] = [
  {
    id: "placeholder-1",
    slug: "agent-orchestrator",
    title: "Multi-Agent Orchestrator",
    description:
      "Placeholder — orchestration d'agents IA avec routage d'outils, mémoire de session et garde-fous. / Placeholder — AI agent orchestration with tool routing, session memory and guardrails.",
    tags: ["TypeScript", "eve", "LLM"],
    url: null,
    repo_url: null,
    featured: true,
    sort_order: 1,
  },
  {
    id: "placeholder-2",
    slug: "rag-pipeline",
    title: "RAG Pipeline",
    description:
      "Placeholder — pipeline RAG : ingestion, chunking, embeddings et recherche hybride. / Placeholder — RAG pipeline: ingestion, chunking, embeddings and hybrid search.",
    tags: ["Python", "pgvector", "RAG"],
    url: null,
    repo_url: null,
    featured: false,
    sort_order: 2,
  },
  {
    id: "placeholder-3",
    slug: "evals-suite",
    title: "Agent Evals Suite",
    description:
      "Placeholder — suite d'évaluation d'agents : scénarios, scoring et régression. / Placeholder — agent evaluation suite: scenarios, scoring and regression.",
    tags: ["TypeScript", "Evals"],
    url: null,
    repo_url: null,
    featured: false,
    sort_order: 3,
  },
];

/**
 * Published projects from the Supabase mini-CMS.
 * Falls back to static placeholder data when Supabase is unreachable
 * or not configured (RLS: only published rows are selectable by anon).
 */
export async function getPublishedProjects(locale: string): Promise<Project[]> {
  const client = getSupabaseAnonClient();
  if (!client) return FALLBACK_PROJECTS;

  try {
    const { data, error } = await client
      .from("projects")
      .select(
        "id, slug, title, title_en, description, description_en, tags, url, repo_url, featured, sort_order",
      )
      .eq("published", true)
      .order("sort_order", { ascending: true });

    if (error || !data || data.length === 0) {
      return FALLBACK_PROJECTS;
    }

    return data.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      slug: String(row.slug),
      title:
        (locale === "en" ? (row.title_en as string) : (row.title as string)) ??
        (row.title as string),
      description:
        (locale === "en"
          ? (row.description_en as string)
          : (row.description as string)) ?? (row.description as string),
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
      url: (row.url as string) ?? null,
      repo_url: (row.repo_url as string) ?? null,
      featured: Boolean(row.featured),
      sort_order: Number(row.sort_order ?? 0),
    }));
  } catch {
    return FALLBACK_PROJECTS;
  }
}
