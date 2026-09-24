import { locale as getRootLocale } from "next/root-params";
import { notFound } from "next/navigation";
import { hasLocale } from "@/lib/locales";

// Re-exported for convenience — import from @/lib/locales in middleware.
export { defaultLocale, hasLocale, locales } from "@/lib/locales";
export type { Locale } from "@/lib/locales";

const dictionaries = {
  fr: () => import("@/dictionaries/fr.json").then((m) => m.default),
  en: () => import("@/dictionaries/en.json").then((m) => m.default),
};

export const getDictionary = async () => {
  const locale = await getRootLocale();
  if (!hasLocale(locale)) notFound();
  return dictionaries[locale]() as Promise<Dictionary>;
};

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)["fr"]>>;
