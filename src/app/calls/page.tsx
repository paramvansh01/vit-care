import Link from "next/link";
import { Page } from "@/components/ui";
import { CallButton, JoinByCode, NewRoomButton } from "@/components/call-controls";
import { requireUser } from "@/lib/auth";
import { callsFor, expireRinging } from "@/lib/calls";
import { directory } from "@/lib/care";
import { lanUrls } from "@/lib/network";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-brand text-white",
  RINGING: "bg-brand-tint text-brand-deep",
  OPEN: "border border-dashed border-line-strong text-ink-soft",
  ENDED: "bg-sunk text-ink-soft",
  MISSED: "bg-danger-wash text-danger",
  DECLINED: "bg-danger-wash text-danger",
};

export default async function CallsPage() {
  const me = await requireUser(undefined, "/calls");
  expireRinging();
  const people = directory().filter((p) => p.user_id !== me.user_id);
  const history = callsFor(me.user_id);
  const urls = lanUrls();

  return (
    <Page wide>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* ----------------------------------------------------- directory */}
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[22px] leading-tight">People</h2>
              <p className="mt-0.5 text-[12.5px] text-ink-soft">
                Everyone with an account. Calling someone rings their browser on whatever page they have open.
              </p>
            </div>
            <span className="label text-ink-mute">
              {people.filter((p) => p.online).length} online · {people.length} total
            </span>
          </div>

          {!people.length ? (
            <div className="px-5 py-10 text-center text-[13px] text-ink-mute">
              No one else has an account yet. Ask the other person to open VIT-Care and sign up, or{" "}
              <Link href="/doctors" className="text-brand-deep underline underline-offset-2">
                add a doctor
              </Link>
              .
            </div>
          ) : (
            <ul>
              {people.map((p) => (
                <li
                  key={p.user_id}
                  className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-0"
                >
                  <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-wash font-serif text-[15px] font-semibold text-brand-deep">
                    {initials(p.display_name)}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface ${
                        p.online ? "bg-brand" : "bg-line-strong"
                      }`}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{p.display_name}</p>
                    <p className="truncate text-[12px] text-ink-soft">
                      {p.detail ?? p.role.toLowerCase()}
                      {p.campus_name ? ` · ${p.campus_name}` : ""}
                    </p>
                  </div>
                  <span className={`label hidden sm:inline ${p.online ? "text-brand-deep" : "text-ink-mute"}`}>
                    {p.online ? "Online" : p.last_seen ? `Seen ${p.last_seen.slice(5, 16)} UTC` : "Never signed in"}
                  </span>
                  <CallButton userId={p.user_id} name={p.display_name} online={Boolean(p.online)} compact />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------------------------------------------------- rooms + lan */}
        <aside className="space-y-4">
          <div className="panel-dashed space-y-3 p-4">
            <p className="eyebrow">Room code</p>
            <p className="text-[12.5px] leading-relaxed text-ink-soft">
              Open a room and read its code out — whoever types it in joins you. Or enter a code you were given.
            </p>
            <NewRoomButton />
            <JoinByCode />
          </div>

          <div className="rounded-md bg-brand p-4 text-white">
            <p className="label text-white/80">Same Wi-Fi</p>
            {urls.length ? (
              <>
                <p className="mt-2 text-[12.5px] text-white/90">The other device opens:</p>
                {urls.map((u) => (
                  <p key={u} className="mono mt-1 break-all rounded bg-white/15 px-2 py-1 text-[12.5px]">
                    {u}
                  </p>
                ))}
                {!urls[0].startsWith("https") && (
                  <p className="mt-2 text-[12px] text-white/80">
                    Browsers only allow the camera over HTTPS. Restart with <span className="mono">npm run lan</span>.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-[12.5px] text-white/90">Not connected to a network.</p>
            )}
          </div>

          <div className="card overflow-hidden">
            <p className="eyebrow border-b border-line px-4 py-2.5">Your calls</p>
            {!history.length ? (
              <p className="px-4 py-5 text-[12.5px] text-ink-mute">No calls yet.</p>
            ) : (
              <ul>
                {history.map((c) => {
                  const outgoing = c.caller_id === me.user_id;
                  const other = outgoing ? c.callee_name : c.caller_name;
                  return (
                    <li key={c.call_id} className="border-b border-line last:border-0">
                      <Link
                        href={`/call/${c.room_code}`}
                        className="flex items-center gap-2 px-4 py-2.5 transition hover:bg-sunk"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px]">
                            {outgoing ? "→ " : "← "}
                            {other ?? "Open room"}
                          </p>
                          <p className="mono text-[11px] text-ink-mute">
                            {c.room_code} · {c.created_at.slice(5, 16)} UTC
                          </p>
                        </div>
                        <span className={`chip ${STATUS_TONE[c.status] ?? ""}`}>{c.status}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </Page>
  );
}

function initials(name: string) {
  return name
    .replace(/^(Dr\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}
