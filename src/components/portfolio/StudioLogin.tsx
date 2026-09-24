"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginStudio } from "@/lib/actions";
import type { Dictionary } from "@/lib/i18n";

type State = { ok: boolean };

export function StudioLogin({ dict }: { dict: Dictionary }) {
  const [, action, pending] = useActionState<State, FormData>(
    async (_, formData) => await loginStudio(formData),
    { ok: false },
  );
  void state;

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="studio-passcode">{dict.studio.passcode}</Label>
        <Input
          id="studio-passcode"
          name="passcode"
          type="password"
          required
          maxLength={200}
          placeholder={dict.studio.passcodePlaceholder}
          autoComplete="current-password"
        />
      </div>
      <Button
        type="submit"
        disabled={pending}
        className="border border-terminal-green/60 bg-terminal-green/10 text-terminal-green hover:bg-terminal-green/20"
      >
        <span className="prompt">{dict.studio.login}</span>
      </Button>
    </form>
  );
}

export function StudioLogout({ dict }: { dict: Dictionary }) {
  return (
    <form action={async () => {
      "use server";
      await import("@/lib/actions").then((m) => m.logoutStudio());
    }}>
      <button
        type="submit"
        className="text-xs text-terminal-dim underline-offset-4 hover:text-terminal-red hover:underline"
      >
        {dict.studio.logout}
      </button>
    </form>
  );
}
