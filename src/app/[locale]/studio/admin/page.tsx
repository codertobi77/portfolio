import { notFound, redirect } from "next/navigation";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import {
  approveGuestbookEntry,
  deleteContactMessage,
  deleteGuestbookEntry,
} from "@/lib/actions";
import { getDictionary, hasLocale, type Dictionary } from "@/lib/i18n";
import { isStudioOwner } from "@/lib/studio";

interface GuestbookRow {
  id: string;
  name: string;
  message: string;
  created_at: string;
}

interface ContactRow {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  created_at: string;
}

/**
 * Studio admin (owner only): guestbook moderation and contact inbox.
 * Reads go through the service-role client server-side; every mutation
 * re-checks ownership inside the server action.
 */
export default async function StudioAdminPage({
  params,
}: PageProps<"/[locale]/studio/admin">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  if (!(await isStudioOwner())) redirect(`/${locale}/studio`);

  const dict = (await getDictionary()) as Dictionary;
  const admin = dict.studio.admin;

  const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const client = getSupabaseAdminClient();

  let pending: GuestbookRow[] = [];
  let approved: GuestbookRow[] = [];
  let messages: ContactRow[] = [];

  if (client) {
    const [pendingRes, approvedRes, messagesRes] = await Promise.all([
      client
        .from("guestbook")
        .select("id, name, message, created_at")
        .eq("approved", false)
        .order("created_at", { ascending: false })
        .limit(50),
      client
        .from("guestbook")
        .select("id, name, message, created_at")
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(50),
      client
        .from("contact_messages")
        .select("id, name, email, subject, message, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    pending = (pendingRes.data as GuestbookRow[] | null) ?? [];
    approved = (approvedRes.data as GuestbookRow[] | null) ?? [];
    messages = (messagesRes.data as ContactRow[] | null) ?? [];
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">
          <span className="text-terminal-dim">❯ </span>
          <span className="glow text-terminal-green">{admin.title}</span>
        </h1>
        <p className="mt-2 text-sm text-terminal-dim">{admin.subtitle}</p>
      </div>

      {!client && (
        <p className="text-sm text-terminal-amber">{admin.unconfigured}</p>
      )}

      <TerminalWindow command={admin.command}>
        <h3 className="mb-3 text-sm font-bold text-terminal-amber">
          {admin.guestbookTitle} ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <p className="text-sm text-terminal-dim">{admin.empty}</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((entry) => (
              <li
                key={entry.id}
                className="border-l border-terminal-amber/50 pl-3"
              >
                <p className="text-xs text-terminal-dim">
                  [{new Date(entry.created_at).toLocaleString()}]{" "}
                  <span className="text-terminal-amber">{entry.name}</span>
                </p>
                <p className="text-sm text-foreground/90">{entry.message}</p>
                <div className="mt-2 flex gap-2">
                  <form action={approveGuestbookEntry}>
                    <input type="hidden" name="id" value={entry.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <button
                      type="submit"
                      className="border border-terminal-green/60 px-2 py-0.5 text-xs text-terminal-green hover:bg-terminal-green/10"
                    >
                      {admin.approve}
                    </button>
                  </form>
                  <form action={deleteGuestbookEntry}>
                    <input type="hidden" name="id" value={entry.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <button
                      type="submit"
                      className="border border-terminal-red/50 px-2 py-0.5 text-xs text-terminal-red hover:bg-terminal-red/10"
                    >
                      {admin.delete}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mb-3 mt-8 text-sm font-bold text-terminal-amber">
          {admin.guestbookApprovedTitle} ({approved.length})
        </h3>
        {approved.length === 0 ? (
          <p className="text-sm text-terminal-dim">{admin.empty}</p>
        ) : (
          <ul className="space-y-3">
            {approved.map((entry) => (
              <li
                key={entry.id}
                className="border-l border-terminal-green/30 pl-3"
              >
                <p className="text-xs text-terminal-dim">
                  [{new Date(entry.created_at).toLocaleString()}]{" "}
                  <span className="text-terminal-amber">{entry.name}</span>
                </p>
                <p className="text-sm text-foreground/90">{entry.message}</p>
                <form action={deleteGuestbookEntry} className="mt-2">
                  <input type="hidden" name="id" value={entry.id} />
                  <input type="hidden" name="locale" value={locale} />
                  <button
                    type="submit"
                    className="border border-terminal-red/50 px-2 py-0.5 text-xs text-terminal-red hover:bg-terminal-red/10"
                  >
                    {admin.delete}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </TerminalWindow>

      <TerminalWindow title="mail — inbox">
        <h3 className="mb-3 text-sm font-bold text-terminal-amber">
          {admin.contactTitle} ({messages.length})
        </h3>
        {messages.length === 0 ? (
          <p className="text-sm text-terminal-dim">{admin.empty}</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((msg) => (
              <li
                key={msg.id}
                className="border-l border-terminal-cyan/40 pl-3"
              >
                <p className="text-xs text-terminal-dim">
                  [{new Date(msg.created_at).toLocaleString()}]{" "}
                  <span className="text-terminal-amber">{msg.name}</span>{" "}
                  <a
                    href={`mailto:${msg.email}`}
                    className="text-terminal-green underline underline-offset-4"
                  >
                    {msg.email}
                  </a>
                  {msg.subject && (
                    <span className="text-terminal-cyan">
                      {" "}
                      — {msg.subject}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-foreground/90">{msg.message}</p>
                <div className="mt-2 flex gap-2">
                  <a
                    href={`mailto:${msg.email}`}
                    className="border border-terminal-green/60 px-2 py-0.5 text-xs text-terminal-green hover:bg-terminal-green/10"
                  >
                    {admin.reply}
                  </a>
                  <form action={deleteContactMessage}>
                    <input type="hidden" name="id" value={msg.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <button
                      type="submit"
                      className="border border-terminal-red/50 px-2 py-0.5 text-xs text-terminal-red hover:bg-terminal-red/10"
                    >
                      {admin.delete}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </TerminalWindow>
    </div>
  );
}
