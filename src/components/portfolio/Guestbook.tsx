"use client";

import { useEffect, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { submitGuestbook } from "@/lib/actions";
import type { Dictionary } from "@/lib/i18n";

export interface GuestbookEntry {
  id: string;
  name: string;
  message: string;
  created_at: string;
}

type State = { ok: boolean; error?: string };

export function Guestbook({ dict }: { dict: Dictionary }) {
  const [state, action, pending] = useActionState<State, FormData>(
    async (prev, formData) => submitGuestbook(formData),
    { ok: false },
  );

  // Load approved entries after mount (anon SELECT, RLS-approved only)
  const [entries, setEntries] = useState<GuestbookEntry[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { getSupabaseAnonClient } = await import("@/lib/supabase/client");
      const client = getSupabaseAnonClient();
      if (!client) {
        if (!cancelled) setEntries([]);
        return;
      }
      const { data } = await client
        .from("guestbook")
        .select("id, name, message, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!cancelled) setEntries(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Formulaire interactif : fade seul, pas de découpe du texte. */}
      <ScrollReveal mode="fade">
        <TerminalWindow title={dict.guestbook.command}>
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gb-name">{dict.guestbook.name}</Label>
              <Input
                id="gb-name"
                name="name"
                required
                maxLength={40}
                placeholder={dict.guestbook.namePlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gb-message">{dict.guestbook.message}</Label>
              <Textarea
                id="gb-message"
                name="message"
                required
                maxLength={500}
                rows={4}
                placeholder={dict.guestbook.messagePlaceholder}
              />
            </div>
            <Button
              type="submit"
              disabled={pending}
              className="border border-terminal-green/60 bg-terminal-green/10 text-terminal-green hover:bg-terminal-green/20"
            >
              <span className="prompt">
                {pending ? dict.guestbook.sending : dict.guestbook.submit}
              </span>
            </Button>
            {state.ok && (
              <p className="text-sm text-terminal-green" role="status">
                {dict.guestbook.thanks}
              </p>
            )}
            {state.error && (
              <p className="text-sm text-terminal-red" role="alert">
                {dict.guestbook.error}
              </p>
            )}
          </form>
        </TerminalWindow>
      </ScrollReveal>

      <ScrollReveal mode="fade" delay={120}>
        <TerminalWindow title="tail -f ~/guestbook.log">
          {entries === null ? (
            <p className="text-terminal-dim">{dict.guestbook.loading}</p>
          ) : entries.length === 0 ? (
            <p className="text-terminal-dim">—</p>
          ) : (
            <ul className="space-y-3">
              {/* Entrées Supabase chargées après montage : fade-in à
                  l'insertion (animation CSS .gb-entry). */}
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="gb-entry border-l border-terminal-green/30 pl-3"
                >
                  <p className="text-xs text-terminal-dim">
                    [{new Date(entry.created_at).toLocaleString()}]{" "}
                    <span className="text-terminal-amber">{entry.name}</span>
                  </p>
                  <p className="text-sm text-foreground/90">{entry.message}</p>
                </li>
              ))}
            </ul>
          )}
        </TerminalWindow>
      </ScrollReveal>
    </div>
  );
}
