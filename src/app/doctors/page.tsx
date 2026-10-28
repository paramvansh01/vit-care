import Link from "next/link";
import { Page } from "@/components/ui";
import { CallButton } from "@/components/call-controls";
import { AddDoctorPanel } from "@/components/add-doctor-panel";
import { currentUser } from "@/lib/auth";
import { campuses, doctorCards, specialisations } from "@/lib/care";

export const dynamic = "force-dynamic";

const TYPE: Record<string, string> = {
  GP: "General practitioner",
  SPECIALIST: "Specialist",
  COUNSELOR: "Counsellor",
};

export default async function DoctorsPage() {
  const me = await currentUser();
  const cards = doctorCards();

  return (
    <Page wide>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[26px] leading-tight">Doctors</h2>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            {cards.length
              ? `${cards.length} registered · ${cards.filter((c) => c.online).length} online now`
              : "No doctors are registered yet."}
          </p>
        </div>
        <AddDoctorPanel campuses={campuses()} specs={specialisations()} />
      </div>

      {!cards.length ? (
        <div className="panel-dashed px-6 py-12 text-center text-[13px] text-ink-soft">
          Add the first doctor with the button above — or have the doctor register on their own device from the
          sign-in page.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((d) => {
            const isMe = me?.role === "DOCTOR" && me.linked_ref === String(d.doctor_id);
            return (
              <article key={d.doctor_id} className="card flex flex-col">
                <div className="flex items-start gap-3 px-4 pb-3 pt-4">
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-md bg-brand-wash font-serif text-[16px] font-semibold text-brand-deep">
                    {d.name
                      .replace(/^Dr\.?\s+/i, "")
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join("")}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface ${
                        d.online ? "bg-brand" : "bg-line-strong"
                      }`}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-serif text-[18px] font-semibold leading-tight">{d.name}</h3>
                    <p className="truncate text-[12.5px] text-ink-soft">
                      {TYPE[d.doctor_type]} · {d.campus_name}
                    </p>
                  </div>
                  <span className={`label ${d.online ? "text-brand-deep" : "text-ink-mute"}`}>
                    {d.online ? "Online" : "Offline"}
                  </span>
                </div>

                <dl className="mono grid grid-cols-3 border-y border-line text-[11.5px]">
                  <Cell k="Experience" v={`${d.years_experience} yr`} />
                  <Cell k="Open slots" v={String(d.open_slots)} />
                  <Cell k="Seen" v={String(d.seen)} />
                </dl>

                <div className="flex-1 px-4 py-3 text-[12.5px] text-ink-soft">
                  {d.specialisations ?? "No specialisation recorded"}
                  <p className="mono mt-1 text-[11px] text-ink-mute">
                    {d.reg_council_no} · {d.consult_fee ? `₹${d.consult_fee}` : "no fee"}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-line bg-toolbar px-4 py-2.5">
                  {isMe ? (
                    <span className="label text-ink-mute">This is you</span>
                  ) : (
                    <>
                      {me?.role === "STUDENT" && (
                        <Link
                          href="/student"
                          className="label rounded border border-line-strong px-3 py-1.5 text-ink-soft transition hover:bg-surface"
                        >
                          Book
                        </Link>
                      )}
                      {me && d.user_id ? (
                        <CallButton userId={d.user_id} name={d.name} online={Boolean(d.online)} compact />
                      ) : !me ? (
                        <Link href="/?next=/doctors" className="label text-brand-deep">
                          Sign in to call
                        </Link>
                      ) : (
                        <span className="label text-ink-mute">No login</span>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Page>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-r border-line px-4 py-2 last:border-0">
      <dt className="eyebrow text-[10px]">{k}</dt>
      <dd className="mt-0.5 text-ink">{v}</dd>
    </div>
  );
}
