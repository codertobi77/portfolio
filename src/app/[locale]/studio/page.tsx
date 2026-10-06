import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { StudioBoot } from "@/components/portfolio/StudioBoot";
import { StudioTerminal } from "@/components/portfolio/StudioTerminal";
import { getSiteProfile } from "@/lib/profile";
import { getSupabaseAnonClient } from "@/lib/supabase/client";
import { isStudioOwner } from "@/lib/studio-session";

/**
 * Studio : terminal public du portfolio. Les lectures (list/show/stats…)
 * sont ouvertes à tous ; les mutations exigent le préfixe sudo (prompt
 * passcode masqué, session de 15 min rafraîchie à chaque commande élevée).
 * L'overlay de boot ne mentionne la session sudo active que si le rendu
 * serveur en trouve une ; le terminal reçoit le profil fusionné pour les
 * valeurs par défaut du wizard `profile edit`.
 */
export default async function StudioPage({
  params,
}: PageProps<"/[locale]/studio">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const [dict, sessionActive, profile] = await Promise.all([
    getDictionary(),
    isStudioOwner(),
    getSiteProfile(getSupabaseAnonClient()),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <StudioBoot
        lines={dict.studio.boot.lines}
        sessionLine={sessionActive ? dict.studio.boot.session : undefined}
      />
      <header>
        <ScrollReveal>
          <div>
            <h1 className="text-2xl font-bold">
              <span className="text-terminal-dim">❯ </span>
              <span className="glow text-terminal-green">
                {dict.studio.title}
              </span>
            </h1>
            <p className="mt-2 text-sm text-terminal-dim">
              {dict.studio.subtitle}
            </p>
          </div>
        </ScrollReveal>
      </header>

      <ScrollReveal mode="fade">
        <StudioTerminal dict={dict} locale={locale} profile={profile} />
      </ScrollReveal>
    </div>
  );
}
