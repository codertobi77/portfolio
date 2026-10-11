# Portfolio — Amidala Samari

Portfolio développeur au **thème terminal**, **bilingue français/anglais**, propulsé par Next.js 16 et un agent IA embarqué (eve + GLM 5.3).

- **Production** : <https://amidalasamari-sandy.vercel.app>
- **Dépôt** : <https://github.com/codertobi77/portfolio>

L'ensemble du site imite un interpréteur de commandes : invite `❯`, fenêtres terminales, effet CRT (scanlines + vignette), séquence de démarrage, machine à écrire et révélation en **streaming** du texte au scroll.

## Fonctionnalités

### Pages

| Route | Contenu |
|---|---|
| `/{locale}` | Accueil : hero animé (texte + portrait « imprimé ») + annuaire façon `ls` vers les pages |
| `/{locale}/about` | À-propos complet : persona, socials, skills, timeline (formes terminales) |
| `/{locale}/projects` | Projets publiés (Supabase), cartes enrichies |
| `/{locale}/blog` | Index du blog (MDX) |
| `/{locale}/blog/{slug}` | Article MDX bilingue |
| `/{locale}/cv` | CV : barres de niveau, timeline, boîtes ASCII |
| `/{locale}/contact` | Contact : formulaire + coordonnées du persona |
| `/{locale}/guestbook` | Livre d'or public, modéré (Supabase + RLS) |
| `/{locale}/studio` | Terminal **public** : lectures ouvertes, mutations via `sudo` + agent eve (REPL) ; séquence de boot au chargement |
| `/{locale}/studio/admin` | Redirection vers `/{locale}/studio` (le shell remplace l'ancien dashboard) |
| `/{locale}/cv.pdf` | CV en PDF |
| `404` | Pages 404 personnalisées (segment `[locale]` + 404 globale bilingue) |

### Effets visuels

- **CRT** : scanlines et vignette en surimpression (`globals.css`).
- **TypeWriter / BootSequence** : hero animé façon démarrage de machine.
- **PortraitPrint** (`src/components/effects/PortraitPrint.tsx`) : le portrait du hero est « imprimé » ligne par ligne au chargement (~1,5 s, scanline brillante en tête de balayage, gris + teinte phosphore) — l'`<img>` est rendue côté serveur (SEO/no-JS), `prefers-reduced-motion` → image directe.
- **MotionBackground** (`src/components/effects/MotionBackground.tsx`) : pluie de glyphes matrice subtile sur toutes les pages (`0 1 { } < > # $`, vert phosphore ~8 % d'opacité, ~24 fps, pause si onglet caché, rien sous `prefers-reduced-motion`).
- **StudioBoot** (`src/components/portfolio/StudioBoot.tsx`) : overlay de boot plein écran sur `/studio` (~2,5 s — clic/Échap pour passer, jamais rendu côté serveur, désactivé sous `prefers-reduced-motion`).
- **ScrollReveal** (`src/components/effects/ScrollReveal.tsx`) : effet de streaming appliqué à **tous** les éléments des pages — y compris le contenu statique et les données issues de Supabase. Chaque bloc visible est révélé progressivement au scroll :
  - mode `stream` : le texte est découpé caractère par caractère (`IntersectionObserver`) et se révèle en cascade façon terminal ;
  - mode `fade` : fondu + translation pour les blocs interactifs (formulaires, composants stateful) ;
  - respect de `prefers-reduced-motion` et dégradation gracieuse sans JavaScript (aucun contenu masqué).

### Agent IA (eve)

- **REPL `sudo eve`** : l'agent vit dans son propre shell (`eve@studio:~ ❯`), entré via `sudo eve` (ou `eve` si la session sudo est active) — sortie par `exit`/`quit`/Ctrl+D (`logout — back to dee@studio`). Réponse en streaming, approbation `save_blog_draft` via boutons inline ou `approve`/`deny`.
- **Outil `save_blog_draft`** : réservé au propriétaire — enregistre un brouillon d'article MDX dans `content/blog/{locale}/`. Le cookie de session sudo est vérifié **à chaque appel** : après expiration (15 min), l'outil est refusé → retaper `sudo <cmd>` pour rouvrir une session puis relancer `eve`.
- **Repli statique** : sans `NVIDIA_API_KEY` (situation actuelle en prod), le REPL eve répond via le repli statique — aucune clé n'est requise pour naviguer.
- **Modèle** : GLM 5.3 servi par **NVIDIA NIM** (endpoint OpenAI-compatible) via `@ai-sdk/openai-compatible`.
- **Surface d'outils minimale** : `defaultTools: false` — l'agent n'a ni bash, ni accès fichier libre, ni web ; uniquement les outils déclarés dans `agent/tools/` (statiques) et, pour l'owner ayant activé v2.1, les outils dynamiques `studio__*` (voir ci-dessous).
- **Authentification** : le cookie de session Studio authentifie le principal `studio-owner` auprès du canal eve (`src/lib/studio.ts`).

### Studio shell (terminal public, mutations via sudo)

`/{locale}/studio` est un **vrai terminal ouvert à tous** (sortie en anglais, convention shell) : les **lectures** (`list`/`show`/`stats`/`profile show`/`blog list`…) sont publiques ; chaque **mutation** exige le préfixe `sudo`, même avec une session valide — fidèle à un vrai shell. Sans session valide, la réponse serveur porte `needsPassword` → le terminal affiche `[sudo] password for dee:` (saisie masquée, 3 tentatives, Échap/Ctrl+C annule). La session (cookie `studio_session`, SHA-256 du passcode, httpOnly) dure **15 min** et est **rafraîchie à chaque commande sudo** (timestamp roulant) ; `sudo -k` l'invalide, `sudo -v` la valide, `sudo -l` liste les droits.

> **Conséquence assumée du modèle public** : la boîte contact, les entrées guestbook en attente, les projets non publiés et les drafts blog sont lisibles par quiconque tape les commandes de lecture.

| Commande | Action |
|---|---|
| `help [commande]` | Aide — les commandes protégées sont marquées `*` |
| `projects list [--published] [--tag <t>]` · `projects show <réf>` | Lecture publique des projets — `<réf>` = slug, id ou préfixe ≥ 8 car. |
| `sudo projects create …` | Création (`--title`, `--description`, `--title-en`, `--description-en`, `--slug`, `--tags a,b`, `--url`, `--repo-url`, `--featured`, `--published`, `--sort`) — **bare → wizard interactif** champ par champ |
| `sudo projects edit <réf> …` · `sudo projects publish/hide/delete <réf>` | Édition / publication / masquage / suppression |
| `guestbook list [--pending\|--approved]` · `guestbook show <id>` | Lecture publique du livre d'or |
| `sudo guestbook approve <id>…` · `sudo guestbook delete <id>…` | Modération (plusieurs ids d'un coup) |
| `contact list [--limit <n>]` · `contact show <id>` · `sudo contact delete <id>…` | Boîte de réception contact |
| `blog list [--locale fr\|en] [--drafts]` · `blog show <slug>` | Articles MDX (lecture seule) |
| `profile show` | Persona fusionné (public) |
| `sudo profile edit --role-fr… --alias --location --email --status-…` | Édition du persona — **bare → wizard** avec valeur courante par défaut |
| `sudo profile social add --label --url` / `delete <label>` | Liens sociaux |
| `sudo profile skill add --label --level <1-5>` / `edit` / `delete` | Compétences (barres de niveau) |
| `sudo profile timeline add --year …` / `edit <year>` / `delete <year>` | Jalons de carrière — **bare add → wizard** |
| `stats` · `whoami` · `sudo whoami` → `root` | Compteurs, principal courant |
| `sudo eve [message]` | REPL de l'agent eve (`exit`/`quit`/Ctrl+D pour sortir) |
| `sudo -k` · `sudo -v` · `sudo -l` | Invalide / valide / liste la session sudo |
| `approve` · `deny` · `clear` | Approbation en attente, écran |

Le persona est stocké dans Supabase (`site_profile`, blob jsonb) et **remplace en bloc** le repli `content/profile.json` (deep-merge, tableaux remplacés) ; toute mutation revalide `/`, `/about`, `/cv`, `/contact`.

### v2.1 — Outils agent (opt-in au boot)

L'agent eve reçoit un jeu d'outils couvrant **toutes les commandes de données du shell** — `exec.ts` reste la source unique de vérité. L'activation se choisit **au boot du Studio** : quand la séquence de démarrage se termine avec une session sudo active, l'overlay demande `[v2.1] eve studio tools: (y)es / (n)o — enter = last [<dernier choix>]`. `y`/`n` posent le cookie public `studio_agent_tools` (mirroir localStorage pour le prochain boot) ; clic/Échap garde le choix précédent ; `prefers-reduced-motion` passe l'overlay (choix précédent conservé).

| Outil | Commandes shell couvertes | Approbation |
|---|---|---|
| `studio__projects` | `projects list/show/create/edit/publish/hide/delete` | mutations → boutons approve/deny |
| `studio__guestbook` | `guestbook list/show/approve/delete` | approve/delete → approbation |
| `studio__contact` | `contact list/show/delete` | delete → approbation |
| `studio__profile` | `profile show/edit`, `social/skill/timeline …` | toutes les mutations → approbation |
| `studio__blog` | `blog list/show` (lecture seule — l'écriture reste `save_blog_draft`) | auto (lecture) |
| `studio__stats` | `stats` | auto (lecture) |

Fonctionnement :

- **Gate serveur par tour** : le resolver dynamique `agent/tools/studio.ts` s'exécute à chaque `turn.started` et n'enregistre les outils que si l'appelant est le principal `studio-owner` **et** l'attribut `studio-tools` vaut `on` (cookie lu par `studioOwnerAuth()` à chaque requête eve). Désactivé → le modèle ne voit même pas les schémas (et les visiteurs anonymes non plus — économie de tokens).
- **Approbation** : lectures auto-approuvées (publiques dans le shell) ; chaque mutation passe par les boutons approve/deny du terminal (ou `approve`/`deny`). Le principal est re-vérifié dans `execute` — défense en profondeur, même pattern que `save_blog_draft`.
- **Exécution** : chaque outil compose un argv (guillemets doubles avec échappement `"`/`\`, tokenizer de `parse.ts` ; un token quoté n'est jamais une option) et délègue à `execStudioCommand` avec deps elevated (client service-role) — validation, gardes et chemins de revalidation v2 réutilisés à l'identique. La sortie est le texte shell anglais ; l'agent la reformule dans la langue de la conversation.
- **Pont de revalidation** : le service eve est distinct de Next → les chemins collectés pendant la commande partent dans un seul `POST /api/revalidate` (Bearer `STUDIO_REVALIDATE_SECRET`, comparaison en temps constant, liste blanche `^/(fr|en)(/(about|cv|contact|guestbook|projects))?$`, ≤ 16 chemins). Un échec du pont n'échoue jamais la commande (simple ligne `warn`).

Limites assumées : expiration sudo 15 min → les outils disparaissent comme `save_blog_draft` (revenir par `sudo` puis recharger la page) ; lecture blog via le fs du service eve (ok en dev ; en prod selon les fichiers embarqués — dégradation silencieuse « no posts ») ; le choix ne se change pas en cours de REPL (recharger la page) ; `prefers-reduced-motion` garde le dernier choix.

Terminal : prompt `dee@studio:~/studio $`, **highlighting zsh** de la saisie et de l'echo (commande connue → vert, inconnue → rouge, sous-commande/option → cyan, guillemets et `sudo` → ambre ; `highlight.ts`, overlay synchronisé sur l'input transparent), machine à états `normal | sudo-password | wizard | eve-repl`, historique **↑/↓** (persisté par onglet), complétion **Tab** (commandes, sous-commandes, options — y compris après `sudo`), **Ctrl+L** (clear), **Ctrl+C** (annule la saisie en cours), séquence de boot au chargement de la page.

Implémentation : `src/lib/studio/shell/` — `parse.ts` (tokenizer guillemets/options + séquences d'échappement `"`/`\` ; token quoté = valeur, jamais option ni sous-commande), `registry.ts` (source unique des droits `sudo` pour exec, help, `sudo -l` et complétion), `highlight.ts` (coloration isomorphe), `exec.ts` (handlers, garde `requiresSudo && !elevated`, **aucun import `next/*`, dépendances injectées**) ; l'action serveur `runStudioCommand` (`src/lib/actions.ts`) retire le préfixe `sudo`, gère `needsPassword` et la session roulante, injecte le client service-role et `revalidatePath`.

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
│   ├── tools/studio.ts      # v2.1 — resolver dynamique turn.started (gate owner + cookie)
│   └── channels/eve.ts       # Canal HTTP + auth propriétaire (cookie Studio)
├── content/
│   ├── blog/{fr,en}/         # Articles MDX (frontmatter gray-matter)
│   └── profile.json           # Persona par défaut (repli si Supabase absent/vide)
├── supabase/
│   ├── migrations/           # Schéma : projects, guestbook, contact_messages, site_profile (+RLS)
│   └── seed.sql              # Données de démonstration
├── src/
│   ├── app/
│   │   ├── [locale]/         # Pages : home (hero+annuaire), about, projects, blog, cv, contact, guestbook, studio
│   │   ├── global-not-found.tsx  # 404 globale autonome (HTML complet, bilingue)
│   │   ├── api/revalidate/route.ts  # v2.1 — pont de revalidation (Bearer secret, liste blanche)
│   │   └── globals.css       # Thème terminal + animations ScrollReveal/CRT
│   ├── components/
│   │   ├── effects/          # ScrollReveal, PortraitPrint, MotionBackground (pluie matrice)
│   │   ├── layout/           # Navbar, Footer
│   │   ├── portfolio/        # Hero, StudioTerminal v2 (machine à états), StudioBoot, pages/, SectionShell…
│   │   ├── terminal/         # TerminalWindow, TypeWriter, BootSequence
│   │   └── ui/               # shadcn/ui (button, input, textarea…)
│   ├── dictionaries/         # fr.json, en.json (contenu riche bilingue, lignes de boot)
│   └── lib/
│       ├── i18n.ts / locales.ts
│       ├── blog.ts           # Lecture + parsing MDX du blog
│       ├── profile.ts        # getSiteProfile : deep-merge profile.json + site_profile (repli silencieux)
│       ├── studio.ts         # Passcode Studio, token cookie, auth eve (sans import next/*)
│       ├── studio-session.ts  # isStudioOwner() (server-only, next/headers)
│       ├── studio/tools.ts    # v2.1 — cookie/localStorage du choix d'outils au boot
│       ├── studio/agent-tools.ts  # v2.1 — schemas zod + composeArgv + approbation + exec elevated (sans eve/* ni next/*)
│       ├── studio/revalidate-bridge.ts  # v2.1 — liste blanche + collecteur → POST /api/revalidate
│       ├── studio/shell/     # Couche shell : parse, registry (droits sudo + complétion), exec (sans next/*), highlight (zsh)
│       ├── actions.ts        # Server Actions (contact, guestbook, sudoAuth/sudoKill, runStudioCommand)
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

> **Note — mode dégradé** : sans configuration Supabase (ou DB injoignable), le site fonctionne quand même avec des projets de remplacement, le livre d'or/contact répondent « non configuré » et le persona repasse sur `content/profile.json`. Sans `NVIDIA_API_KEY`, l'agent échoue et le site retombe sur le contenu statique.

### Variables d'environnement (`.env.local`)

| Variable | Portée | Requis | Rôle |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | pour Supabase | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | pour Supabase | Clé publique (protégée par RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | serveur | pour le shell Studio | Contourne RLS — **jamais** côté client, uniquement via `src/lib/supabase/admin.ts` |
| `STUDIO_PASSCODE` | serveur | pour le Studio | Passcode du propriétaire (terminal Studio + outil `save_blog_draft`) |
| `NVIDIA_API_KEY` | serveur | pour l'agent | Clé NVIDIA NIM (endpoint OpenAI-compatible, GLM 5.3) |
| `STUDIO_REVALIDATE_SECRET` | serveur (site + agent) | pour v2.1 | Secret partagé du pont de revalidation (`POST /api/revalidate`) — sans lui, les mutations de l'agent aboutissent mais la revalidation est différée |
| `STUDIO_SITE_URL` | serveur (agent) | optionnel | URL du site vue par le service eve (défaut : `https://$VERCEL_URL`, puis `http://localhost:3000`) |

`.env.local` est gitigné — `.env.example` sert de référence versionnée.

### Scripts

| Commande | Description |
|---|---|
| `bun run dev` | Serveur de développement (Turbopack) |
| `bun run build` | Build de production |
| `bun run start` | Serve le build de production |
| `bun run lint` | ESLint |

## Base de données et sécurité

Schéma dans `supabase/migrations/` (`20260914000000_portfolio_init.sql`, `20260926184200_site_profile.sql`) — **RLS activée sur toutes les tables** :

| Table | Accès anonyme | Modération |
|---|---|---|
| `projects` | `SELECT` des lignes `published = true` uniquement | Publication via le shell Studio (service-role, `projects publish`) |
| `guestbook` | `INSERT` (toujours `approved = false`) + `SELECT` des seules entrées approuvées | Approbation/suppression via le shell (`guestbook approve` / `delete`) |
| `contact_messages` | `INSERT` uniquement — illisible publiquement | Boîte de réception via le shell (`contact list` / `show` / `delete`) |
| `site_profile` | `SELECT` (persona public — non sensible) | Écriture owner-only via le shell (`profile …`, service-role) — aucun write public |

### Modèle de sécurité

- **Clé service-role** : server-side uniquement (jamais préfixée `NEXT_PUBLIC_`, importée uniquement depuis `src/lib/supabase/admin.ts`, réservée au propriétaire Studio authentifié).
- **Modèle sudo** : les lectures du shell sont publiques ; chaque mutation exige le préfixe `sudo` **et** une session valide (15 min, rafraîchie à chaque commande élevée). La garde vit côté serveur (`exec.ts` : `requiresSudo && !elevated`) — le terminal n'est jamais une source de confiance.
- **Passcode Studio** : comparaison en temps constant sur digests SHA-256 (aucune fuite temporelle) ; le cookie `studio_session` contient le SHA-256 du passcode préfixé — jamais le secret en clair.
- **Agent** : `defaultTools: false` ; l'outil `save_blog_draft` vérifie le principal `studio-owner` — les visiteurs anonymes sont refusés.
- **Outils v2.1** : enregistrés dynamiquement par tour uniquement pour `studio-owner` + cookie d'activation ; mutations soumises à approbation, re-vérification du principal dans `execute` ; revalidation via un pont autorisé par secret (comparaison en temps constant) et restreint à une liste blanche de chemins.
- **Zod** : validation stricte des entrées (Server Actions, tool inputs, contraintes SQL sur les longueurs).

## Déploiement (Vercel + CI/CD git)

Le dépôt GitHub est **connecté au projet Vercel** (`amidala-samaris-projects/portfolio`) :

- `git push origin main` → **déploiement production** automatique ;
- pull request → **déploiement preview** automatique ;
- la branche de production est `main`.

Particularités :

1. **Build de l'agent eve** : `@vercel/connect` construit l'agent pendant le déploiement Vercel (`npm run build` en local ne le reconstruit pas). Le healthcheck de l'agent est exposé sur `/eve/v1/health`.
2. **Variables d'environnement** : à définir dans le projet Vercel (Settings → Environment Variables) — voir tableau ci-dessus, sur les scopes production **et** preview.
3. **Domaine production** : <https://amidalasamari-sandy.vercel.app>

```bash
# Déploiement manuel depuis l'CLI (dépannage uniquement — le CI/CD git est la voie normale)
vercel --prod
```

## Licence

Projet personnel — © Amidala Samari. Tous droits réservés.
