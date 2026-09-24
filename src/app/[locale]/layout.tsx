import type { Metadata } from "next";
import { Geist_Mono, Geist } from "next/font/google";
import { notFound } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { hasLocale, locales, type Dictionary } from "@/lib/i18n";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

async function loadDict(locale: string): Promise<Dictionary> {
  if (!hasLocale(locale)) notFound();
  return import(`@/dictionaries/${locale}.json`).then((m) => m.default);
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const dict = await loadDict(locale);
  return {
    title: dict.site.title,
    description: dict.site.description,
  };
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const dict = await loadDict(locale);
  const otherLocale = locale === "fr" ? "en" : "fr";

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* CRT overlays */}
        <div className="crt-scanlines" aria-hidden />
        <div className="crt-vignette" aria-hidden />

        <Navbar dict={dict} locale={locale} otherLocale={otherLocale} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
          {children}
        </main>
        <Footer dict={dict} locale={locale} />
        <Toaster />
      </body>
    </html>
  );
}
