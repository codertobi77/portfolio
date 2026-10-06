import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { ContactForm } from "@/components/portfolio/ContactForm";
import { PageHeading } from "./blocks";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { SiteProfile } from "@/lib/profile";

export function ContactPage({
  dict,
  locale,
  profile,
}: {
  dict: Dictionary;
  locale: Locale;
  profile: SiteProfile;
}) {
  const finger = [
    { key: "login", value: "dee" },
    { key: "name", value: profile.name.legal },
    { key: "role", value: profile.role[locale] },
    { key: "status", value: profile.status[locale] },
    { key: "location", value: profile.location },
    { key: "mail", value: profile.email },
  ];

  return (
    <div className="flex flex-col gap-8">
      <ScrollReveal>
        <PageHeading title={dict.contact.title} />
        <p className="mt-2 text-sm text-terminal-dim">
          {dict.contact.subtitle}
        </p>
      </ScrollReveal>

      <ScrollReveal>
        <TerminalWindow command={dict.contact.fingerCommand}>
          <dl className="space-y-1 text-sm">
            {finger.map((row) => (
              <div key={row.key} className="flex flex-wrap gap-x-2">
                <dt className="w-20 shrink-0 text-terminal-dim">
                  {row.key}:
                </dt>
                <dd className="text-foreground/90">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-terminal-dim">
            {dict.contact.emailDirect}{" "}
            <a
              href={`mailto:${profile.email}`}
              className="text-terminal-green underline underline-offset-4"
            >
              {profile.email}
            </a>
          </p>
        </TerminalWindow>
      </ScrollReveal>

      <div className="grid gap-6 md:grid-cols-2">
        <ScrollReveal>
          <TerminalWindow title={dict.contact.socialsTitle}>
            <ul className="space-y-2 text-sm">
              {profile.socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-terminal-dim hover:text-terminal-green"
                  >
                    <span className="text-terminal-green">▸ </span>
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </TerminalWindow>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <TerminalWindow title={dict.contact.responseTitle}>
            <p className="text-sm text-foreground/90">
              {dict.contact.responseText}
            </p>
          </TerminalWindow>
        </ScrollReveal>
      </div>

      {/* Formulaire interactif (re-rendu au submit) : fade seul. */}
      <ScrollReveal mode="fade">
        <TerminalWindow title="sendmail — nouveau message">
          <ContactForm dict={dict} />
        </TerminalWindow>
      </ScrollReveal>
    </div>
  );
}
