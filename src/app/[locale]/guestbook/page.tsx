import { notFound } from "next/navigation";
import { Guestbook } from "@/components/portfolio/Guestbook";
import { getDictionary, hasLocale } from "@/lib/i18n";

export default async function GuestbookPage({
  params,
}: PageProps<"/[locale]/guestbook">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const dict = await getDictionary();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">
          <span className="text-terminal-dim">❯ </span>
          <span className="glow text-terminal-green">
            {dict.guestbook.title}
          </span>
        </h1>
        <p className="mt-2 text-sm text-terminal-dim">
          {dict.guestbook.subtitle}
        </p>
      </div>
      <Guestbook dict={dict} />
    </div>
  );
}
