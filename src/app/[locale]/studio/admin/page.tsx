import { notFound, redirect } from "next/navigation";
import { hasLocale } from "@/lib/i18n";

/**
 * /studio/admin n'existe plus : le shell de /studio est désormais l'unique
 * interface owner. La route reste vivante (bookmarks, sitemap) en redirect.
 */
export default async function StudioAdminPage({
  params,
}: PageProps<"/[locale]/studio/admin">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  redirect(`/${locale}/studio`);
}
