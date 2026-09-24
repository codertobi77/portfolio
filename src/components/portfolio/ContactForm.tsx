"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitContact } from "@/lib/actions";
import type { Dictionary } from "@/lib/i18n";

type State = { ok: boolean; error?: string };

export function ContactForm({ dict }: { dict: Dictionary }) {
  const [state, action, pending] = useActionState<State, FormData>(
    async (prev, formData) => submitContact(formData),
    { ok: false },
  );

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">{dict.contact.name}</Label>
          <Input
            id="name"
            name="name"
            required
            maxLength={100}
            placeholder={dict.contact.namePlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{dict.contact.email}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            maxLength={200}
            placeholder={dict.contact.emailPlaceholder}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">{dict.contact.subject}</Label>
        <Input
          id="subject"
          name="subject"
          maxLength={200}
          placeholder={dict.contact.subjectPlaceholder}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">{dict.contact.message}</Label>
        <Textarea
          id="message"
          name="message"
          required
          minLength={1}
          maxLength={5000}
          rows={6}
          placeholder={dict.contact.messagePlaceholder}
        />
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="border border-terminal-green/60 bg-terminal-green/10 text-terminal-green hover:bg-terminal-green/20"
      >
        <span className="prompt">
          {pending ? dict.contact.sending : dict.contact.submit}
        </span>
      </Button>

      {state.ok && (
        <p className="text-sm text-terminal-green" role="status">
          {dict.contact.success}
        </p>
      )}
      {state.error && (
        <p className="text-sm text-terminal-red" role="alert">
          {dict.contact.error}
        </p>
      )}
    </form>
  );
}
