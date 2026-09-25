import Link from "next/link";
import { locale as getRootLocale } from "next/root-params";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { getDictionary } from "@/lib/i18n";

/**
 * 404 for `notFound()` thrown inside the [locale] segment (unknown blog
 * slug, unknown nested route, …). Renders within the locale layout.
 * Unmatched URLs and invalid locales are handled by global-not-found.tsx.
 */
export default async function NotFound() {
  const locale = await getRootLocale();
  const dict = await getDictionary();

  return (
    <div className="mx-auto max-w-xl py-16">
      <ScrollReveal>
        <TerminalWindow command="cd /404">
          <h1 className="text-2xl font-bold text-terminal-green glow">
            {dict.notFound.title}
          </h1>
          <p className="mt-3 whitespace-pre-line text-foreground/90">
            {dict.notFound.body}
          </p>
          <Link
            href={`/${locale}`}
            className="mt-6 inline-block border border-terminal-green/60 bg-terminal-green/10 px-4 py-2 text-sm text-terminal-green transition-colors hover:bg-terminal-green/20"
          >
            <span className="prompt">{dict.notFound.back}</span>
          </Link>
        </TerminalWindow>
      </ScrollReveal>
    </div>
  );
}
