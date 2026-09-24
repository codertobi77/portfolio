/**
 * Locale constants shared by the proxy (middleware), pages and utilities.
 * Deliberately free of any `next/*` import so it can be used everywhere
 * (the proxy cannot import next/root-params or next/navigation).
 */
export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

export const hasLocale = (locale: string): locale is Locale =>
  locales.includes(locale as Locale);
