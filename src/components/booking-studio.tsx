"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Lock,
  Stethoscope,
  UserRound,
  Video,
  Zap,
} from "lucide-react";
import { bookAppointment, cancelAppointment, type ActionResult } from "@/app/actions";
import { Card, Chip, Empty, SectionHead, Table, Td, Th } from "@/components/ui";
import { useKeptForm } from "@/components/care-ui";
import type { DoctorRow, QueueRow, SlotRow, Student } from "@/lib/queries";

const TYPE_LABEL: Record<string, string> = {
  GP: "General Practitioner",
  SPECIALIST: "Specialist",
  COUNSELOR: "Counselor",
};

const TRIAGE_TONE = { RED: "danger", AMBER: "warn", GREEN: "ok" } as const;

export function BookingStudio({
  students,
  doctors,
  slotsByDoctor,
  symptoms,
  queue,
}: {
  students: Student[];
  doctors: DoctorRow[];
  slotsByDoctor: Record<number, SlotRow[]>;
  symptoms: { symptom_id: number; name: string; body_system: string; default_triage: string }[];
  queue: QueueRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const { attach, onSubmit, onInput } = useKeptForm(result, submit);

  const [regNo, setRegNo] = useState(students[0]?.reg_no ?? "");
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [slot, setSlot] = useState<string>("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [complaint, setComplaint] = useState("");

  const student = students.find((s) => s.reg_no === regNo);

  // Doctors are campus-bound: a Vellore student books Vellore clinicians.
  const campusDoctors = useMemo(
    () => doctors.filter((d) => !student || d.campus_id === student.campus_id),
    [doctors, student],
  );

  const slots = doctorId ? (slotsByDoctor[doctorId] ?? []) : [];

  // Triage is derived from the worst symptom selected - RED beats AMBER beats GREEN.
  const triage = useMemo(() => {
    const levels = [...picked]
      .map((id) => symptoms.find((s) => s.symptom_id === id)?.default_triage)
      .filter(Boolean) as string[];
    if (levels.includes("RED")) return "RED";
    if (levels.includes("AMBER")) return "AMBER";
    return "GREEN";
  }, [picked, symptoms]);

  function submit(formData: FormData) {
    formData.set("triage_level", triage);
    startTransition(async () => {
      const res = await bookAppointment(formData);
      setResult(res);
      if (res.ok) {
        setSlot("");
        setPicked(new Set());
        setComplaint("");
        router.refresh();
      }
    });
  }

  function cancel(id: number) {
    startTransition(async () => {
      setResult(await cancelAppointment(id));
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
      {/* ------------------------------------------------------- booking */}
      <div className="min-w-0 space-y-5">
        <form ref={attach} onSubmit={onSubmit} onInput={onInput}>
          <input type="hidden" name="reg_no" value={regNo} />
          <input type="hidden" name="doctor_id" value={doctorId ?? ""} />
          <input type="hidden" name="slot" value={slot} />
          {[...picked].map((id) => (
            <input key={id} type="hidden" name="symptom_id" value={id} />
          ))}

          {/* step 1 */}
          <Card className="mb-4 p-4">
            <Step n={1} title="Who is booking?" />
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <select
                value={regNo}
                onChange={(e) => {
                  setRegNo(e.target.value);
                  setDoctorId(null);
                  setSlot("");
                }}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] outline-none transition focus:border-brand"
              >
                {students.map((s) => (
                  <option key={s.reg_no} value={s.reg_no}>
                    {s.name} · {s.reg_no} · {s.campus_name}
                  </option>
                ))}
              </select>
              {student && (
                <div className="flex items-center gap-2 rounded-lg border border-line bg-sunk px-3 py-2 text-[11.5px] text-ink-soft">
                  <UserRound size={13} className="text-ink-mute" />
                  Year {student.year_of_study} · {student.dept_name}
                  {student.hostel_block && ` · ${student.hostel_block}-${student.room_no}`}
                </div>
              )}
            </div>
          </Card>

          {/* step 2 */}
          <Card className="mb-4 p-4">
            <Step
              n={2}
              title="Pick a clinician"
              hint={`${campusDoctors.length} available at ${student?.campus_name ?? "this campus"} · the EER subclass detail is shown under each name`}
            />
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {campusDoctors.map((d) => {
                const active = doctorId === d.doctor_id;
                return (
                  <button
                    key={d.doctor_id}
                    type="button"
                    onClick={() => {
                      setDoctorId(d.doctor_id);
                      setSlot("");
                    }}
                    className={`rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-brand bg-brand-wash shadow-sm"
                        : "border-line bg-surface hover:border-line-strong hover:bg-sunk/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[12.5px] font-semibold leading-snug">{d.name}</span>
                      {d.doctor_type === "COUNSELOR" && (
                        <Lock size={11} className="mt-0.5 shrink-0 text-violet-600" />
                      )}
                    </div>
                    <p className="mt-0.5 text-[10.5px] font-medium text-brand-deep">
                      {TYPE_LABEL[d.doctor_type]}
                    </p>
                    <p className="mt-1 text-[10.5px] leading-snug text-ink-mute">
                      {d.specializations}
                    </p>
                    <p className="mt-1.5 text-[9.5px] leading-snug text-ink-mute">
                      {d.subclass_detail}
                    </p>
                    <p className="mt-2 flex items-center justify-between text-[10px]">
                      <span className="text-ink-soft">{d.years_experience} yrs experience</span>
                      <span className={d.open_slots ? "text-emerald-600" : "text-rose-500"}>
                        {d.open_slots} open
                      </span>
                    </p>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* step 3 */}
          <Card className="mb-4 p-4">
            <Step
              n={3}
              title="Choose a slot"
              hint="Booked slots are refused by trg_slot_conflict_guard — try one to see the database reject it."
            />
            {!doctorId ? (
              <Empty>Pick a clinician first.</Empty>
            ) : slots.length === 0 ? (
              <Empty>This clinician has no published slots.</Empty>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {slots.map((s) => {
                  const key = `${s.slot_date}|${s.slot_time}`;
                  const taken = s.status !== "OPEN";
                  const active = slot === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSlot(key)}
                      title={taken ? "Already booked — selecting this will be rejected by the trigger" : ""}
                      className={`rounded-lg border px-2.5 py-1.5 text-[11px] transition ${
                        active
                          ? "border-brand bg-brand-deep text-white"
                          : taken
                            ? "border-rose-200 bg-rose-50 text-rose-500 line-through"
                            : "border-line bg-surface text-ink-soft hover:border-brand hover:bg-brand-wash"
                      }`}
                    >
                      <span className="mono">
                        {s.slot_date.slice(5)} · {s.slot_time}
                      </span>
                      <span className="ml-1.5 text-[9px] opacity-70">{s.mode === "VIDEO" ? "▶" : "◉"}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <label className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
                <input type="radio" name="mode" value="VIDEO" defaultChecked className="accent-teal-600" />
                <Video size={12} /> Video
              </label>
              <label className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
                <input type="radio" name="mode" value="IN_PERSON" className="accent-teal-600" />
                <Stethoscope size={12} /> In person
              </label>
            </div>
          </Card>

          {/* step 4 */}
          <Card className="mb-4 p-4">
            <Step
              n={4}
              title="Triage"
              hint="Each symptom you pick becomes a row in appointment_symptom; triage level is derived from the worst one."
            />
            <div className="mb-3 flex flex-wrap gap-1.5">
              {symptoms.map((s) => {
                const on = picked.has(s.symptom_id);
                return (
                  <button
                    key={s.symptom_id}
                    type="button"
                    onClick={() =>
                      setPicked((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.symptom_id)) next.delete(s.symptom_id);
                        else next.add(s.symptom_id);
                        return next;
                      })
                    }
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                      on
                        ? s.default_triage === "RED"
                          ? "border-rose-300 bg-rose-50 text-rose-700"
                          : s.default_triage === "AMBER"
                            ? "border-amber-300 bg-amber-50 text-amber-700"
                            : "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-line text-ink-soft hover:bg-sunk"
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>

            {picked.size > 0 && (
              <div className="mb-3 space-y-2 rounded-lg border border-line bg-sunk/50 p-3">
                {[...picked].map((id) => {
                  const s = symptoms.find((x) => x.symptom_id === id)!;
                  return (
                    <label key={id} className="flex items-center gap-3 text-[11.5px]">
                      <span className="w-32 shrink-0 text-ink-soft">{s.name}</span>
                      <input
                        type="range"
                        name={`severity_${id}`}
                        min={1}
                        max={10}
                        defaultValue={5}
                        className="flex-1 accent-teal-600"
                      />
                      <span className="mono w-10 shrink-0 text-right text-[10px] text-ink-mute">
                        /10
                      </span>
                    </label>
                  );
                })}
                <label className="flex items-center gap-3 text-[11.5px]">
                  <span className="w-32 shrink-0 text-ink-soft">Duration (days)</span>
                  <input
                    type="number"
                    name="duration_days"
                    min={1}
                    max={60}
                    defaultValue={2}
                    className="w-20 rounded border border-line bg-surface px-2 py-1 text-[11px] outline-none focus:border-brand"
                  />
                </label>
              </div>
            )}

            <textarea
              name="chief_complaint"
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              rows={2}
              placeholder="Chief complaint in the student's words…"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] outline-none transition placeholder:text-ink-mute focus:border-brand"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Chip tone={TRIAGE_TONE[triage as keyof typeof TRIAGE_TONE]}>
                triage: {triage}
              </Chip>
              <button
                type="submit"
                disabled={pending || !doctorId || !slot || !complaint.trim()}
                className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand-deep px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CalendarClock size={13} />
                {pending ? "Writing to database…" : "Confirm booking"}
              </button>
            </div>
          </Card>
        </form>

        {result && <ResultPanel result={result} />}

        {/* ------------------------------------------------------ queue */}
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <p className="eyebrow">v_doctor_queue</p>
            <h3 className="text-[14px] font-semibold tracking-tight">Booked consultations</h3>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Student</Th>
                <Th>Doctor</Th>
                <Th>Slot</Th>
                <Th className="text-right">Triage</Th>
                <Th className="text-right">Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {queue.map((q) => (
                <tr key={q.appointment_id} className="hover:bg-sunk/60">
                  <Td className="mono text-[11px] text-ink-mute">{q.appointment_id}</Td>
                  <Td className="font-medium">{q.student_name}</Td>
                  <Td className="text-ink-soft">{q.doctor_name}</Td>
                  <Td className="mono text-[11px] text-ink-soft">
                    {q.slot_date} {q.slot_time}
                  </Td>
                  <Td className="text-right">
                    <Chip tone={TRIAGE_TONE[q.triage_level as keyof typeof TRIAGE_TONE]}>
                      {q.triage_level}
                    </Chip>
                  </Td>
                  <Td className="text-right">
                    <Chip
                      tone={
                        q.status === "COMPLETED" ? "ok" : q.status === "CANCELLED" ? "neutral" : "info"
                      }
                    >
                      {q.status}
                    </Chip>
                  </Td>
                  <Td className="text-right">
                    {q.status === "BOOKED" && (
                      <button
                        onClick={() => cancel(q.appointment_id)}
                        disabled={pending}
                        className="rounded border border-line px-2 py-0.5 text-[10.5px] text-ink-soft transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      {/* -------------------------------------------------------- aside */}
      <aside className="space-y-4">
        <Card className="p-4">
          <SectionHead eyebrow="What the database enforces" title="Triggers on this page" />
          <TriggerNote
            name="trg_slot_conflict_guard"
            event="BEFORE INSERT ON appointment"
            body="Raises ABORT when the (doctor, date, time) is already taken. Booking a struck-through slot demonstrates it — the insert never happens."
          />
          <TriggerNote
            name="trg_slot_mark_booked"
            event="AFTER INSERT ON appointment"
            body="Flips the weak entity slot to BOOKED so the two records can never disagree."
          />
          <TriggerNote
            name="trg_slot_release"
            event="AFTER UPDATE ON appointment"
            body="Cancelling returns the slot to the OPEN pool automatically."
          />
        </Card>

        <Card className="p-4">
          <SectionHead eyebrow="Schema" title="Weak entity in play" />
          <p className="text-[12px] leading-relaxed text-ink-soft">
            <span className="mono text-[11px]">slot</span> has no key of its own. It is identified by
            its owning <span className="mono text-[11px]">doctor</span> plus the partial key{" "}
            <span className="mono text-[11px]">(slot_date, slot_time)</span>, and{" "}
            <span className="mono text-[11px]">appointment</span> references all three columns as one
            composite foreign key.
          </p>
          <pre className="mono mt-2.5 overflow-x-auto rounded-lg border border-line bg-[#fcfcfb] p-2.5 text-[10px] leading-[1.7] text-ink-soft">
{`FOREIGN KEY (doctor_id, slot_date, slot_time)
  REFERENCES slot(doctor_id, slot_date, slot_time)
  ON DELETE CASCADE`}
          </pre>
        </Card>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------- fragments */

function Step({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      <span className="mono grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-deep text-[10px] font-bold text-white">
        {n}
      </span>
      <div className="min-w-0">
        <h3 className="text-[13.5px] font-semibold tracking-tight">{title}</h3>
        {hint && <p className="mt-0.5 text-[11.5px] leading-snug text-ink-mute">{hint}</p>}
      </div>
    </div>
  );
}

function TriggerNote({ name, event, body }: { name: string; event: string; body: string }) {
  return (
    <div className="mb-3 border-l-2 border-violet-300 pl-3 last:mb-0">
      <p className="mono text-[10.5px] font-semibold text-violet-700">{name}</p>
      <p className="mono text-[9.5px] text-ink-mute">{event}</p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

export function ResultPanel({ result }: { result: ActionResult }) {
  return (
    <Card
      className={`fade overflow-hidden ${result.ok ? "border-emerald-200" : "border-rose-200"}`}
    >
      <div
        className={`flex items-start gap-2.5 px-4 py-3 ${result.ok ? "bg-emerald-50/70" : "bg-rose-50/70"}`}
      >
        {result.ok ? (
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
        ) : (
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-600" />
        )}
        <div className="min-w-0">
          <p
            className={`text-[13px] font-semibold leading-snug ${result.ok ? "text-emerald-900" : "text-rose-900"}`}
          >
            {result.message}
          </p>
          {!result.ok && (
            <p className="mt-0.5 text-[11.5px] text-rose-700">
              Raised by the database, not by application code.
            </p>
          )}
        </div>
      </div>

      {result.detail && result.detail.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <p className="eyebrow mb-2 flex items-center gap-1.5">
            <Zap size={11} className="text-violet-600" /> Triggers that fired
          </p>
          <ul className="space-y-1">
            {result.detail.map((d, i) => (
              <li key={i} className="mono text-[10.5px] leading-relaxed text-ink-soft">
                <span className="text-violet-600">▸</span> {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.sql && (
        <div className="border-t border-line">
          <p className="eyebrow px-4 pt-2.5">Statement issued</p>
          <pre className="mono overflow-x-auto px-4 pb-3 pt-1.5 text-[10.5px] leading-[1.7] text-ink-soft">
            {result.sql}
          </pre>
        </div>
      )}
    </Card>
  );
}
