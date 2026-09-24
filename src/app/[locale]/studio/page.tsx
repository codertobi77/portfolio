import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { isStudioOwner } from "@/lib/studio";
import { StudioLogin, StudioLogout } from "@/components/portfolio/StudioLogin";
import { StudioChat } from "@/components/portfolio/StudioChat";
import { getDictionary } from "@/lib/i18n";

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
        {owner ? (
          <div className="flex items-center gap-4">
            <Link
              href={`/${locale}/studio/admin`}
              className="text-xs text-terminal-dim underline-offset-4 hover:text-terminal-green hover:underline"
            >
              {dict.studio.admin.link} →
            </Link>
            <StudioLogout dict={dict} />
          </div>
        ) : (
          <StudioLogin dict={dict} />
        )}
      </header>

      {owner ? (
        <StudioChat dict={dict} locale={locale as Locale} owner />
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-terminal-dim">
          <p className="mb-3">{dict.studio.subtitle}</p>
          <p>
            Sign in with your Studio passcode to unlock the owner tools
            (including <code className="text-terminal-green">save_blog_draft</code>).
          </p>
        </div>
      )}
    </div>
  );
}
