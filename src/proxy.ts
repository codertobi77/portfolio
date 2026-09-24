import { NextResponse, type NextRequest } from "next/server";
import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { defaultLocale, locales } from "@/lib/i18n";

function getLocale(request: NextRequest): string {
  const headers = {
    "accept-language":
      request.headers.get("accept-language") ?? undefined,
  };
  const languages = new Negotiator({ headers }).languages();
  return match(languages, [...locales], defaultLocale);
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
