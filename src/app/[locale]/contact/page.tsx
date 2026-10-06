import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactPage } from "@/components/portfolio/pages/ContactPage";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { getSiteProfile } from "@/lib/profile";
import { getSupabaseAnonClient } from "@/lib/supabase/client";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const dict = await getDictionary();
  return { title: `${dict.contact.title} — ${dict.site.title}` };
}

export default async function ContactRoute({
  params,
}: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const dict = await getDictionary();
  const profile = await getSiteProfile(getSupabaseAnonClient());

  return <ContactPage dict={dict} locale={locale} profile={profile} />;
}
