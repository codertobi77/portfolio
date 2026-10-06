import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CvPage } from "@/components/portfolio/pages/CvPage";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { getSiteProfile } from "@/lib/profile";
import { getSupabaseAnonClient } from "@/lib/supabase/client";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/cv">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const dict = await getDictionary();
  return { title: `${dict.cv.title} — ${dict.site.title}` };
}

export default async function CvRoute({
  params,
}: PageProps<"/[locale]/cv">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const dict = await getDictionary();
  const profile = await getSiteProfile(getSupabaseAnonClient());

  return <CvPage dict={dict} locale={locale} profile={profile} />;
}
