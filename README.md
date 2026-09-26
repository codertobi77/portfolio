# Portfolio — Amidala Samari

Portfolio développeur au **thème terminal**, **bilingue français/anglais**, propulsé par Next.js 16 et un agent IA embarqué (eve + GLM 5.3).

- **Production** : <https://portfolio-three-lovat-gph5nh2l2s.vercel.app>
- **Dépôt** : <https://github.com/codertobi77/portfolio>

L'ensemble du site imite un interpréteur de commandes : invite `❯`, fenêtres terminales, effet CRT (scanlines + vignette), séquence de démarrage, machine à écrire et révélation en **streaming** du texte au scroll.

## Fonctionnalités

### Pages

| Route | Contenu |
|---|---|
| `/{locale}` | Accueil : hero animé, à-propos, projets (Supabase), articles, CV, contact |
| `/{locale}/blog` | Index du blog (MDX) |
| `/{locale}/blog/{slug}` | Article MDX bilingue |
| `/{locale}/guestbook` | Livre d'or public, modéré (Supabase + RLS) |
| `/{locale}/studio` | Terminal d'administration : CRUD du portfolio en commandes shell + agent eve (passcode propriétaire) |
| `/{locale}/studio/admin` | Redirection vers `/{locale}/studio` (le shell remplace l'ancien dashboard) |
| `/{locale}/cv.pdf` | CV en PDF |
| `404` | Pages 404 personnalisées (segment `[locale]` + 404 globale bilingue) |

### Effets visuels

- **CRT** : scanlines et vignette en surimpression (`globals.css`).
- **TypeWriter / BootSequence** : hero animé façon démarrage de machine.
- **ScrollReveal** (`src/components/effects/ScrollReveal.tsx`) : effet de streaming appliqué à **tous** les éléments des pages — y compris le contenu statique et les données issues de Supabase. Chaque bloc visible est révélé progressivement au scroll :
  - mode `stream` : le texte est découpé caractère par caractère (`IntersectionObserver`) et se révèle en cascade façon terminal ;
  - mode `fade` : fondu + translation pour les blocs interactifs (formulaires, composants stateful) ;
  - respect de `prefers-reduced-motion` et dégradation gracieuse sans JavaScript (aucun contenu masqué).

### Agent IA (eve)

- **Commande `eve <message>`** : conversation avec l'agent depuis le terminal du Studio (`/{locale}/studio`, session propriétaire) — réponse en streaming, approbation `save_blog_draft` via boutons inline ou `approve`/`deny`.
- **Outil `save_blog_draft`** : réservé au propriétaire connecté — enregistre un brouillon d'article MDX dans `content/blog/{locale}/`.
- **Modèle** : GLM 5.3 servi par **NVIDIA NIM** (endpoint OpenAI-compatible) via `@ai-sdk/openai-compatible`.
- **Surface d'outils minimale** : `defaultTools: false` — l'agent n'a ni bash, ni accès fichier libre, ni web ; uniquement les outils déclarés dans `agent/tools/`.
- **Authentification** : le cookie de session Studio authentifie le principal `studio-owner` auprès du canal eve (`src/lib/studio.ts`).

### Studio shell (terminal d'admin)

`/{locale}/studio` est un **vrai terminal** : après le passcode, tout le CRUD du portfolio se fait en commandes (sortie en anglais, convention shell). L'ancien dashboard `/studio/admin` redirige vers le shell.

| Commande | Action |
|---|---|
| `projects list [--published] [--tag <t>]` · `projects show <réf>` | Liste / détail des projets |
| `projects create --title <t> --description <d> [options]` | Création (`--title-en`, `--description-en`, `--slug`, `--tags a,b`, `--url`, `--repo-url`, `--featured`, `--published`, `--sort`) |
| `projects edit <réf> --<champ> <v>…` · `publish` · `hide` · `delete <réf>` | Édition / publication / masquage / suppression — `<réf>` = slug, id ou préfixe ≥ 8 car. |
| `guestbook list [--pending\|--approved]` · `guestbook show <id>` | Modération du livre d'or (défaut : en attente) |
| `guestbook approve <id>…` · `guestbook delete <id>…` | Approuve / supprime (plusieurs ids d'un coup) |
| `contact list [--limit <n>]` · `contact show <id>` · `contact delete <id>…` | Boîte de réception contact |
| `blog list [--locale fr\|en] [--drafts]` · `blog show <slug>` | Articles MDX (lecture seule) |
| `stats` · `whoami` · `help [commande]` | Compteurs, session, aide |
| `eve <message>` | Chat avec l'agent eve (streaming + approbation `save_blog_draft`) |
| `approve` · `deny` · `clear` · `logout` | Approbation en attente, écran, fin de session |

Historique **↑/↓** (persisté par onglet), complétion **Tab** (commandes, sous-commandes, options), **Ctrl+L** (clear), **Ctrl+C** (vide la ligne). Implémentation : `src/lib/studio/shell/` — `parse.ts` (tokenizer guillemets/options), `registry.ts` (specs pour help + complétion), `exec.ts` (handlers, **aucun import `next/*`, dépendances injectées**) ; l'action serveur `runStudioCommand` (`src/lib/actions.ts`) applique la garde `isStudioOwner`, injecte le client service-role et `revalidatePath`.

### Internationalisation

- Locales `fr` (défaut) et `en`, dictionnaires JSON (`src/dictionaries/`), middleware de négociation et redirection des chemins non préfixés.
- Contenu MDX dupliqué par locale (`content/blog/fr/`, `content/blog/en/`), champs `*_en` dans Supabase pour les projets.

## Stack technique

- **Next.js 16** (App Router, Turbopack, Server Components, Server Actions) + **React 19** + **TypeScript**
- **Tailwind CSS v4**, composants **shadcn/ui** (Radix)
- **Supabase** : Postgres avec **Row Level Security** sur toutes les tables
- **eve** : framework d'agent IA, construit et déployé sur Vercel via `@vercel/connect`
- **AI SDK** (`ai` + `@ai-sdk/openai-compatible`) : connexion au modèle GLM 5.3 (NVIDIA NIM)
- **next-mdx-remote** + **gray-matter** : articles de blog MDX avec frontmatter
- **Vercel** : hébergement + CI/CD déclenché par git

## Architecture

```
├── agent/                    # Agent eve
│   ├── agent.ts              # defineAgent : modèle GLM 5.3 (NIM), contexte 1M tokens
│   ├── instructions.md       # Prompt système de l'agent
│   ├── tools/save_blog_draft.ts  # Outil owner-only : brouillon MDX
│   └── channels/eve.ts       # Canal HTTP + auth propriétaire (cookie Studio)
├── content/
│   ├── blog/{fr,en}/         # Articles MDX (frontmatter gray-matter)
│   └── profile.json
├── supabase/
│   ├── migrations/           # Schéma initial : projects, guestbook, contact_messages (+RLS)
│   └── seed.sql              # Données de démonstration
├── src/
│   ├── app/
│   │   ├── [locale]/         # Toutes les pages (home, blog, guestbook, studio)
│   │   ├── global-not-found.tsx  # 404 globale autonome (HTML complet, bilingue)
│   │   └── globals.css       # Thème terminal + animations ScrollReveal/CRT
│   ├── components/
│   │   ├── effects/          # ScrollReveal (IntersectionObserver + splitting texte)
│   │   ├── layout/           # Navbar, Footer
│   │   ├── portfolio/        # Hero, About, Projects, Guestbook, StudioTerminal, SectionShell…
│   │   ├── terminal/         # TerminalWindow et primitives du thème
│   │   └── ui/               # shadcn/ui (button, input, textarea…)
│   ├── dictionaries/         # fr.json, en.json
│   └── lib/
│       ├── i18n.ts / locales.ts
│       ├── blog.ts           # Lecture + parsing MDX du blog
│       ├── studio.ts         # Passcode Studio, token cookie, auth eve (sans import next/*)
│       ├── studio-session.ts  # isStudioOwner() (server-only, next/headers)
│       ├── studio/shell/     # Couche shell : parse, registry (complétion Tab), exec (sans next/*)
│       ├── actions.ts        # Server Actions (contact, guestbook, login, runStudioCommand)
│       └── supabase/         # Client anon (public) + admin (service-role, server-only)
```

## Installation locale

### Prérequis

- **Node.js 24** et **Bun** (gestionnaire de paquets de référence — `npm` fonctionne aussi)
- Un compte **Supabase** (ou l'CLI Supabase local)
- Une clé **NVIDIA NIM** pour l'agent ([build.nvidia.com](https://build.nvidia.com/settings))

### Étapes

```bash
# 1. Cloner et installer
git clone https://github.com/codertobi77/portfolio.git
cd portfolio
bun install        # ou : npm install

# 2. Variables d'environnement
cp .env.example .env.local
# → renseigner les clés (voir tableau ci-dessous)

# 3. Base de données Supabase
#    - créer un projet sur https://supabase.com/dashboard
#    - appliquer la migration puis le seed :
supabase db push                                     # schéma + RLS (supabase/migrations/)
psql "$SUPABASE_DB_URL" -f supabase/seed.sql         # données de démo
#    (ou coller le contenu des deux fichiers dans l'éditeur SQL du dashboard)

# 4. Démarrer
bun run dev         # ou : npm run dev → http://localhost:3000
```

> **Note — mode dégradé** : sans configuration Supabase, le site fonctionne quand même avec des projets de remplacement et le livre d'or/contact répondent « non configuré ». Sans `NVIDIA_API_KEY`, l'agent échoue et le site retombe sur le contenu statique.

### Variables d'environnement (`.env.local`)

| Variable | Portée | Requis | Rôle |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | pour Supabase | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | pour Supabase | Clé publique (protégée par RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | serveur | pour le shell Studio | Contourne RLS — **jamais** côté client, uniquement via `src/lib/supabase/admin.ts` |
| `STUDIO_PASSCODE` | serveur | pour le Studio | Passcode du propriétaire (terminal Studio + outil `save_blog_draft`) |
| `NVIDIA_API_KEY` | serveur | pour l'agent | Clé NVIDIA NIM (endpoint OpenAI-compatible, GLM 5.3) |

`.env.local` est gitigné — `.env.example` sert de référence versionnée.

### Scripts

| Commande | Description |
|---|---|
| `bun run dev` | Serveur de développement (Turbopack) |
| `bun run build` | Build de production |
| `bun run start` | Serve le build de production |
| `bun run lint` | ESLint |

## Base de données et sécurité

Schéma dans `supabase/migrations/20260914000000_portfolio_init.sql` — **RLS activée sur toutes les tables** :

| Table | Accès anonyme | Modération |
|---|---|---|
| `projects` | `SELECT` des lignes `published = true` uniquement | Publication via le shell Studio (service-role, `projects publish`) |
| `guestbook` | `INSERT` (toujours `approved = false`) + `SELECT` des seules entrées approuvées | Approbation/suppression via le shell (`guestbook approve` / `delete`) |
| `contact_messages` | `INSERT` uniquement — illisible publiquement | Boîte de réception via le shell (`contact list` / `show` / `delete`) |

### Modèle de sécurité

- **Clé service-role** : server-side uniquement (jamais préfixée `NEXT_PUBLIC_`, importée uniquement depuis `src/lib/supabase/admin.ts`, réservée au propriétaire Studio authentifié).
- **Passcode Studio** : comparaison en temps constant sur digests SHA-256 (aucune fuite temporelle) ; le cookie `studio_session` contient le SHA-256 du passcode préfixé — jamais le secret en clair.
- **Agent** : `defaultTools: false` ; l'outil `save_blog_draft` vérifie le principal `studio-owner` — les visiteurs anonymes sont refusés.
- **Zod** : validation stricte des entrées (Server Actions, tool inputs, contraintes SQL sur les longueurs).

## Déploiement (Vercel + CI/CD git)

Le dépôt GitHub est **connecté au projet Vercel** (`amidala-samaris-projects/portfolio`) :

- `git push origin main` → **déploiement production** automatique ;
- pull request → **déploiement preview** automatique ;
- la branche de production est `main`.

Particularités :

1. **Build de l'agent eve** : `@vercel/connect` construit l'agent pendant le déploiement Vercel (`npm run build` en local ne le reconstruit pas). Le healthcheck de l'agent est exposé sur `/eve/v1/health`.
2. **Variables d'environnement** : à définir dans le projet Vercel (Settings → Environment Variables) — voir tableau ci-dessus, sur les scopes production **et** preview.
3. **Domaine production** : <https://portfolio-three-lovat-gph5nh2l2s.vercel.app>

```bash
# Déploiement manuel depuis l'CLI (dépannage uniquement — le CI/CD git est la voie normale)
vercel --prod
```

## Licence

Projet personnel — © Amidala Samari. Tous droits réservés.
