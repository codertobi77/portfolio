import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";

export function Footer({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: string;
}) {
  return (
    <footer className="border-t border-border py-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 text-xs text-terminal-dim sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="text-terminal-green">❯</span> {dict.footer.built}
        </p>
        <p className="flex items-center gap-4">
          <span>
            © {new Date().getFullYear()} Amidala Samari — {dict.footer.rights}
          </span>
          <Link
            href={`/${locale}/guestbook`}
            className="hover:text-terminal-green"
          >
            {dict.guestbook.title}
          </Link>
          <Link
            href={`/${locale}/studio`}
            className="hover:text-terminal-green"
          >
            {dict.studio.title}
          </Link>
        </p>
      </div>
    </footer>
  );
}
