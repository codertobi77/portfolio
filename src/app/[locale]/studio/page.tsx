import { notFound } from "next/navigation";
import {
  getDictionary,
  hasLocale,
  type Dictionary,
  type Locale,
} from "@/lib/i18n";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { isStudioOwner } from "@/lib/studio-session";
import { StudioLogin, StudioLogout } from "@/components/portfolio/StudioLogin";
import { StudioTerminal } from "@/components/portfolio/StudioTerminal";

/**
 * Studio : terminal d'administration du portfolio. Non-owner → passcode ;
 * owner → shell interactif (CRUD complet en commandes + agent eve).
 */
export default async function StudioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const dict = (await getDictionary()) as Dictionary;
  const owner = await isStudioOwner();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
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
        {owner ? <StudioLogout dict={dict} /> : <StudioLogin dict={dict} />}
      </header>

      {owner ? (
        <ScrollReveal mode="fade">
          <StudioTerminal dict={dict} locale={locale as Locale} />
        </ScrollReveal>
      ) : (
        <ScrollReveal>
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-terminal-dim">
            <p>{dict.studio.infoCard}</p>
          </div>
        </ScrollReveal>
      )}
    </div>
  );
}
