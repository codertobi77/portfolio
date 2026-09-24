import { locale as getRootLocale } from "next/root-params";
import { notFound } from "next/navigation";

export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

const dictionaries = {
  fr: () => import("@/dictionaries/fr.json").then((m) => m.default),
  en: () => import("@/dictionaries/en.json").then((m) => m.default),
};

export const hasLocale = (locale: string): locale is Locale =>
  locales.includes(locale as Locale);

export const getDictionary = async () => {
  const locale = await getRootLocale();
  if (!hasLocale(locale)) notFound();
  return dictionaries[locale]() as Promise<Dictionary>;
};

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)["fr"]>>;
