import { NextResponse, type NextRequest } from "next/server";
import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
// Import from @/lib/locales (not @/lib/i18n): the proxy cannot pull
// next/root-params, which i18n depends on.
import { defaultLocale, locales } from "@/lib/locales";

function getLocale(request: NextRequest): string {
  const headers = {
    "accept-language":
      request.headers.get("accept-language") ?? undefined,
  };
  // Negotiator yields ["*"] when the header is missing or wildcard-only;
  // Intl.getCanonicalLocales (used by the matcher) throws RangeError on "*".
  const languages = new Negotiator({ headers })
    .languages()
    .filter((lang) => lang && lang !== "*");
  if (languages.length === 0) return defaultLocale;
  try {
    return match(languages, [...locales], defaultLocale);
  } catch {
    // Malformed tags (e.g. "fr-!!") also make Intl throw — never 500 here.
    return defaultLocale;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );
  if (pathnameHasLocale) return;

  // Skip internal paths and files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/eve") ||
    pathname.includes(".") ||
    pathname.startsWith("/api")
  ) {
    return;
  }

  const locale = getLocale(request);
  request.nextUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: ["/((?!_next|eve|api|.*\\..*).*)"],
};
