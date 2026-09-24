import { notFound } from "next/navigation";
import { hasLocale, type Locale } from "@/lib/i18n";
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

  const dict = (await getDictionary()) as Record<string, unknown>;
  const owner = await isStudioOwner();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            <span className="text-terminal-dim">❯ </span>
            <span className="glow text-terminal-green">
              {(dict as { studio?: { title?: string } }).studio?.title ?? "studio"}
            </span>
          </h1>
          <p className="mt-2 text-sm text-terminal-dim">
            {(dict as { studio?: { subtitle?: string } }).studio?.subtitle ??
              "Writing assistant."}
          </p>
        </div>
        {owner ? (
          <StudioLogout
            dict={dict as { studio: { logout: string } }}
          />
        ) : (
          <StudioLogin
            dict={dict as { studio: { passcode: string; passcodePlaceholder: string; login: string } }}
          />
        )}
      </header>

      {owner ? (
        <StudioChat
          dict={dict as { studio: Record<string, string> }}
          locale={locale as Locale}
          owner
        />
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-terminal-dim">
          <p className="mb-3">
            {(dict as { studio?: { subtitle?: string } }).studio?.subtitle ??
              "Drafting help only."}
          </p>
          <p>
            Sign in with your Studio passcode to unlock the owner tools
            (including <code className="text-terminal-green">save_blog_draft</code>).
          </p>
        </div>
      )}
    </div>
  );
}
