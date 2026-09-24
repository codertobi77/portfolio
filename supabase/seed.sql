-- Seed des projets publiés (mini-CMS Supabase) — premier jet, à relire.
-- À appliquer après la migration initiale, via `supabase db query`
-- ou l'éditeur SQL du dashboard. Idempotent : on conflict (slug) do update.

insert into public.projects
  (slug, title, title_en, description, description_en, tags, url, repo_url, featured, published, sort_order)
values
  (
    'agent-orchestrator',
    'Multi-Agent Orchestrator',
    'Multi-Agent Orchestrator',
    'Orchestration d''agents IA : routage d''outils, mémoire de session et garde-fous.',
    'AI agent orchestration: tool routing, session memory and guardrails.',
    array['TypeScript', 'Agents', 'LLM'],
    null, null, true, true, 1
  ),
  (
    'rag-pipeline',
    'RAG Pipeline',
    'RAG Pipeline',
    'Pipeline RAG : ingestion, chunking, embeddings et recherche hybride pgvector.',
    'RAG pipeline: ingestion, chunking, embeddings and pgvector hybrid search.',
    array['Python', 'pgvector', 'RAG'],
    null, null, false, true, 2
  ),
  (
    'evals-suite',
    'Agent Evals Suite',
    'Agent Evals Suite',
    'Suite d''évaluation d''agents : scénarios, scoring et détection de régressions.',
    'Agent evaluation suite: scenarios, scoring and regression detection.',
    array['TypeScript', 'Evals'],
    null, null, false, true, 3
  )
on conflict (slug) do update set
  title = excluded.title,
  title_en = excluded.title_en,
  description = excluded.description,
  description_en = excluded.description_en,
  tags = excluded.tags,
  url = excluded.url,
  repo_url = excluded.repo_url,
  featured = excluded.featured,
  published = excluded.published,
  sort_order = excluded.sort_order;
