"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Dictionary, Locale } from "@/lib/i18n";

interface NavbarProps {
  dict: Dictionary;
  locale: Locale;
  otherLocale: Locale;
}

export function Navbar({ dict, locale, otherLocale }: NavbarProps) {
  const pathname = usePathname() || `/${locale}`;

  // Single-page scroll: about/projects/contact are anchors on the home page.
  const links = [
    { href: `/${locale}`, label: dict.nav.home, exact: true },
    { href: `/${locale}#about`, label: dict.nav.about, exact: false },
    { href: `/${locale}#projects`, label: dict.nav.projects, exact: false },
    { href: `/${locale}#blog-link`, label: dict.nav.blog, exact: false },
    { href: `/${locale}#contact`, label: dict.nav.contact, exact: false },
    { href: `/${locale}#cv`, label: dict.nav.cv, exact: false },
  ];

  const isActive = (href: string, exact: boolean) => {
    const [path, hash] = href.split("#");
    if (hash) return false; // hash links are not "active pages"
    return exact ? pathname === path : pathname.startsWith(path);
  };

  // Same page in the other locale: replace the first path segment
  const segments = pathname.split("/");
  segments[1] = otherLocale;
  const switchHref = segments.join("/") || `/${otherLocale}`;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link
          href={`/${locale}`}
          className="text-sm font-bold text-terminal-green glow"
        >
          amidala@samari<span className="text-terminal-dim">:~$</span>
        </Link>

        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  "text-terminal-dim transition-colors hover:text-terminal-green",
                  "before:mr-1 before:text-terminal-green before:content-['./']",
                  isActive(link.href, link.exact) &&
                    "text-terminal-green glow underline underline-offset-4",
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href={switchHref}
          className="ml-auto border border-border px-2 py-0.5 text-xs text-terminal-dim transition-colors hover:border-terminal-green hover:text-terminal-green"
          aria-label={dict.nav.languageSwitch}
        >
          [{locale === "fr" ? "en" : "fr"}] {dict.nav.languageSwitch}
        </Link>
      </nav>
    </header>
  );
}
