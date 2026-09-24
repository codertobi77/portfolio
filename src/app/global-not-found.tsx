import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

/**
 * Global 404 for unmatched URLs (bypasses app rendering and the [locale]
 * root layout — hence the self-contained HTML document). Invalid locales
 * land here too, so the content is statically bilingual (fr first,
 * default locale).
 */

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function GlobalNotFound() {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full items-center justify-center bg-background font-mono text-foreground">
        <div className="crt-scanlines" aria-hidden />
        <div className="crt-vignette" aria-hidden />
        <main className="relative z-10 mx-4 max-w-xl border border-border bg-card p-6">
          <p className="text-xs text-terminal-dim">amidala@samari:~$ cd /404</p>
          <h1 className="glow mt-2 text-2xl font-bold text-terminal-green">
            404 — commande introuvable
          </h1>
          <p className="mt-3 text-foreground/90">
            La page demandée n’existe pas.
          </p>
          <p className="mt-1 text-sm text-terminal-dim">
            The requested page does not exist.
          </p>
          <p className="mt-2 text-xs text-terminal-red">bash: page not found</p>
          <Link
            href="/fr"
            className="prompt mt-6 inline-block border border-terminal-green/60 bg-terminal-green/10 px-4 py-2 text-sm text-terminal-green transition-colors hover:bg-terminal-green/20"
          >
            retour à l’accueil / back home
          </Link>
        </main>
      </body>
    </html>
  );
}
