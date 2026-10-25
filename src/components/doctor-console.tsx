"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileSignature,
  FileText,
  Loader2,
  Lock,
  Pill,
  Plus,
  Search,
  Send,
  Stethoscope,
  UserRound,
  Video,
  X,
} from "lucide-react";
import {
  grantLeave,
  openConsultation,
  prescribe,
  saveConsultation,
} from "@/app/care-actions";
import type { ActionResult } from "@/app/actions";
import type { CareAppointment, LeaveDoc, StoreDrug, StudentProfile } from "@/lib/care";
import { Card, Chip, Empty, SectionHead, Stat, type Tone } from "@/components/ui";
import { VideoConsole } from "@/components/video-console";
import { LeaveLetter } from "@/components/leave-letter";
import { Field, Feedback, Segmented, money, whenLabel } from "@/components/care-ui";

const TRIAGE_TONE: Record<string, Tone> = { RED: "danger", AMBER: "warn", GREEN: "ok" };

type RxDraft = {
  drugId: number;
  name: string;
  strength: string;
  requiresRx: number;
  price: number;
  dosage: string;
  frequency: string;
  durationDays: number;
  quantity: number;
};

export function DoctorConsole({
  doctor,
  roster,
  stats,
  board,
  drugs,
  patients,
  leaveDocs,
  recipientsByDoc,
}: {
  doctor: { doctor_id: number; name: string; doctor_type: string; campus_name: string } | null;
  roster: { doctor_id: number; name: string; doctor_type: string; booked: number; campus_name: string }[];
  stats: { waiting: number; seen: number; urgent: number; leaves: number };
  board: CareAppointment[];
  drugs: StoreDrug[];
  patients: Record<string, StudentProfile>;
  leaveDocs: LeaveDoc[];
  recipientsByDoc: Record<
    number,
    { recipient_role: string; recipient_name: string; recipient_email: string | null }[]
  >;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<number | null>(null);
  const [filter, setFilter] = useState("BOOKED");

  const filtered = board.filter((a) => (filter === "ALL" ? true : a.status === filter));
  const active = board.find((a) => a.appointment_id === openId) ?? null;

  function switchDoctor(id: string) {
    router.push(`/doctor?id=${id}`);
  }

  if (!doctor) return <Empty>No clinicians are registered.</Empty>;

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------- header */}
      <Card className="overflow-hidden">
        <div className="grain flex flex-wrap items-center gap-4 px-5 py-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-deep text-white">
            <Stethoscope size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Doctor Console · Administrator</p>
            <h2 className="truncate text-[18px] font-semibold tracking-tight">{doctor.name}</h2>
            <p className="truncate text-[12px] text-ink-soft">
              {doctor.doctor_type === "GP"
                ? "General Practitioner"
                : doctor.doctor_type === "SPECIALIST"
                  ? "Consultant Specialist"
                  : "Counselling Psychologist"}{" "}
              · {doctor.campus_name}
            </p>
          </div>
          <label className="flex items-center gap-2 text-[11.5px] text-ink-mute">
            Signed in as
            <select
              value={doctor.doctor_id}
              onChange={(e) => switchDoctor(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink"
            >
              {roster.map((d) => (
                <option key={d.doctor_id} value={d.doctor_id}>
                  {d.name} · {d.booked} waiting
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="In the queue" value={stats.waiting} tone="info" icon={<CalendarClock size={14} />} />
        <Stat label="Urgent (red)" value={stats.urgent} tone="danger" icon={<AlertTriangle size={14} />} />
        <Stat label="Consultations closed" value={stats.seen} tone="ok" icon={<CheckCircle2 size={14} />} />
        <Stat label="Leave letters issued" value={stats.leaves} tone="violet" icon={<FileText size={14} />} />
      </div>

      {/* -------------------------------------------------------------- queue */}
      <Card className="p-5">
        <SectionHead
          eyebrow="Appointments"
          title="Your queue"
          desc="Sorted the way the triage view orders it — urgent first, then by slot. Every row here arrived from a student booking form."
          right={
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: "BOOKED", label: "Waiting" },
                { value: "COMPLETED", label: "Seen" },
                { value: "ALL", label: "All" },
              ]}
            />
          }
        />

        {!filtered.length ? (
          <Empty>Nothing in this view.</Empty>
        ) : (
          <div className="space-y-2">
            {filtered.map((a) => {
              const open = openId === a.appointment_id;
              return (
                <div
                  key={a.appointment_id}
                  className={[
                    "rounded-xl border transition",
                    open ? "border-brand bg-brand-wash/30" : "border-line hover:border-line-strong",
                  ].join(" ")}
                >
                  <button
                    onClick={() => setOpenId(open ? null : a.appointment_id)}
                    className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
                  >
                    <span
                      className={`h-8 w-1 shrink-0 rounded-full ${
                        a.triage_level === "RED"
                          ? "bg-rose-500"
                          : a.triage_level === "AMBER"
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                    />
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sunk text-[11px] font-semibold text-ink-soft">
                      {a.student_name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((p) => p[0])
                        .join("")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">
                        {a.student_name}{" "}
                        <span className="mono text-[11px] font-normal text-ink-mute">{a.reg_no}</span>
                      </p>
                      <p className="truncate text-[11.5px] text-ink-soft">{a.chief_complaint}</p>
                    </div>
                    <span className="hidden text-[11.5px] text-ink-mute sm:block">
                      {whenLabel(a.slot_date)} · {a.slot_time}
                    </span>
                    {a.mode === "VIDEO" && <Video size={13} className="shrink-0 text-ink-mute" />}
                    <Chip tone={TRIAGE_TONE[a.triage_level]}>{a.triage_level}</Chip>
                    <Chip tone={a.status === "COMPLETED" ? "ok" : "info"}>{a.status}</Chip>
                    {a.rx_lines > 0 && <Chip tone="violet">Rx · {a.rx_lines}</Chip>}
                    {a.document_id && <Chip tone="brand">Leave issued</Chip>}
                  </button>

                  {open && (
                    <div className="border-t border-line px-4 py-4 fade">
                      <ConsultationPanel
                        appointment={a}
                        patient={patients[a.reg_no]}
                        drugs={drugs}
                        leaveDoc={leaveDocs.find((d) => d.document_id === a.document_id) ?? null}
                        recipients={a.document_id ? (recipientsByDoc[a.document_id] ?? []) : []}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {!active && (
        <p className="text-center text-[12px] text-ink-mute">
          Open a patient above to start the consultation, prescribe, or recommend medical leave.
        </p>
      )}
    </div>
  );
}

/* ====================================================== consultation panel */

function ConsultationPanel({
  appointment,
  patient,
  drugs,
  leaveDoc,
  recipients,
}: {
  appointment: CareAppointment;
  patient?: StudentProfile;
  drugs: StoreDrug[];
  leaveDoc: LeaveDoc | null;
  recipients: { recipient_role: string; recipient_name: string; recipient_email: string | null }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [section, setSection] = useState<"notes" | "video" | "rx" | "leave">("notes");

  const consultationId = appointment.consultation_id;

  function act(fn: () => Promise<ActionResult>) {
    start(async () => {
      const res = await fn();
      setResult(res);
      router.refresh();
    });
  }

  if (!consultationId) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong bg-sunk/50 p-6 text-center">
        <p className="text-[13px] font-medium">This consultation has not been opened yet.</p>
        <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-relaxed text-ink-mute">
          Opening it writes the <span className="mono">consultation</span> row and mints the video room
          code the student will join.
        </p>
        <button
          onClick={() => act(() => openConsultation(appointment.appointment_id))}
          disabled={pending}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-brand-deep disabled:opacity-60"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
          Start consultation
        </button>
        <Feedback result={result} />
      </div>
    );
  }

  const SECTIONS = [
    { id: "notes" as const, label: "Clinical notes", icon: ClipboardList },
    { id: "video" as const, label: "Video call", icon: Video },
    { id: "rx" as const, label: "Prescribe", icon: Pill },
    { id: "leave" as const, label: "Medical leave", icon: FileSignature },
  ];

  return (
    <div className="space-y-4">
      {/* patient strip */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 rounded-xl border border-line bg-surface px-4 py-3 text-[11.5px]">
        <Bit k="Reg. no" v={appointment.reg_no} mono />
        <Bit k="Year" v={String(appointment.year_of_study)} />
        <Bit k="Blood group" v={appointment.blood_group ?? "—"} />
        <Bit k="Hostel" v={`${appointment.hostel_block ?? "—"} ${appointment.room_no ?? ""}`} />
        <Bit k="Symptoms" v={appointment.symptoms ?? "none recorded"} />
        <Bit k="Consultation" v={`#${consultationId}`} mono />
        {patient?.proctor_name && <Bit k="Proctor" v={patient.proctor_name} />}
        {patient?.hod_name && <Bit k="HOD" v={patient.hod_name} />}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const on = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={[
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] transition",
                on
                  ? "bg-brand text-white"
                  : "border border-line bg-surface text-ink-soft hover:bg-sunk",
              ].join(" ")}
            >
              <Icon size={13} />
              {s.label}
            </button>
          );
        })}
      </div>

      {section === "notes" && (
        <NotesSection consultationId={consultationId} appointment={appointment} onResult={setResult} />
      )}
      {section === "video" && (
        <VideoConsole
          room={appointment.video_room_code ?? `VITC-${String(appointment.appointment_id).padStart(4, "0")}`}
          role="DOCTOR"
          counterpart={appointment.student_name}
          subtitle={`${appointment.student_name} · ${appointment.reg_no} · appointment #${appointment.appointment_id}`}
        />
      )}
      {section === "rx" && (
        <PrescribeSection consultationId={consultationId} drugs={drugs} onResult={setResult} />
      )}
      {section === "leave" && (
        <LeaveSection
          consultationId={consultationId}
          appointment={appointment}
          patient={patient}
          leaveDoc={leaveDoc}
          recipients={recipients}
          onResult={setResult}
        />
      )}

      <Feedback result={result} />
    </div>
  );
}

/* ------------------------------------------------------------------- notes */

function NotesSection({
  consultationId,
  appointment,
  onResult,
}: {
  consultationId: number;
  appointment: CareAppointment;
  onResult: (r: ActionResult) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [diagnosis, setDiagnosis] = useState(
    appointment.diagnosis === "Consultation in progress" ? "" : (appointment.diagnosis ?? ""),
  );
  const [notes, setNotes] = useState("");
  const [sensitive, setSensitive] = useState(false);

  function save(complete: boolean) {
    start(async () => {
      const res = await saveConsultation({
        consultationId,
        diagnosis,
        notes,
        isSensitive: sensitive,
        complete,
      });
      onResult(res);
      router.refresh();
    });
  }

  return (
    <Card className="p-4">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Diagnosis" required>
          <input
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="Acute viral pharyngitis"
            className="inp"
          />
        </Field>
        <Field label="Confidentiality">
          <label className="flex h-[38px] cursor-pointer items-center gap-2 text-[12px] text-ink-soft">
            <input
              type="checkbox"
              checked={sensitive}
              onChange={(e) => setSensitive(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--brand)]"
            />
            <Lock size={12} />
            Mark as a sealed record
          </label>
        </Field>
      </div>
      <Field label="Clinical notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Examination findings, vitals, plan…"
          className="inp mt-1 resize-y"
        />
      </Field>

      <div className="mt-3.5 flex flex-wrap gap-2">
        <button
          onClick={() => save(false)}
          disabled={pending || !diagnosis.trim()}
          className="flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-[12px] font-medium text-ink-soft transition hover:bg-sunk disabled:opacity-50"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <ClipboardList size={13} />}
          Save notes
        </button>
        <button
          onClick={() => save(true)}
          disabled={pending || !diagnosis.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-brand-deep disabled:opacity-50"
        >
          <CheckCircle2 size={13} />
          Save and close consultation
        </button>
      </div>
      <p className="mt-2 text-[11px] text-ink-mute">
        A sealed record is audited by <span className="mono">trg_sensitive_consultation_audit</span> and
        masked from every role but the student and the treating clinician.
      </p>
    </Card>
  );
}

/* --------------------------------------------------------------- prescribe */

function PrescribeSection({
  consultationId,
  drugs,
  onResult,
}: {
  consultationId: number;
  drugs: StoreDrug[];
  onResult: (r: ActionResult) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [lines, setLines] = useState<RxDraft[]>([]);
  const [advice, setAdvice] = useState("");
  const [query, setQuery] = useState("");

  const matches = query
    ? drugs
        .filter(
          (d) =>
            d.name.toLowerCase().includes(query.toLowerCase()) ||
            d.generic_name.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 6)
    : [];

  function add(drug: StoreDrug) {
    if (lines.some((l) => l.drugId === drug.drug_id)) return;
    setLines((prev) => [
      ...prev,
      {
        drugId: drug.drug_id,
        name: drug.name,
        strength: drug.strength,
        requiresRx: drug.requires_rx,
        price: drug.unit_price,
        dosage: "1 tablet",
        frequency: "BD after food",
        durationDays: 3,
        quantity: 6,
      },
    ]);
    setQuery("");
  }

  function patch(drugId: number, change: Partial<RxDraft>) {
    setLines((prev) => prev.map((l) => (l.drugId === drugId ? { ...l, ...change } : l)));
  }

  function issue() {
    start(async () => {
      const res = await prescribe({
        consultationId,
        advice,
        items: lines.map((l) => ({
          drugId: l.drugId,
          dosage: l.dosage,
          frequency: l.frequency,
          durationDays: l.durationDays,
          quantity: l.quantity,
        })),
      });
      onResult(res);
      if (res.ok) {
        setLines([]);
        setAdvice("");
      }
      router.refresh();
    });
  }

  const total = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  return (
    <Card className="p-4">
      <SectionHead
        eyebrow="e-Prescription"
        title="Write the prescription"
        desc="Every line you issue is pushed straight into the student's cart by a trigger, and they are notified in the same statement."
      />

      <div className="relative">
        <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
          <Search size={14} className="text-ink-mute" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the formulary — Dolo, Azithral, Pantoprazole…"
            className="flex-1 bg-transparent text-[12.5px] outline-none"
          />
        </label>
        {matches.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
            {matches.map((d) => (
              <li key={d.drug_id}>
                <button
                  onClick={() => add(d)}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-sunk"
                >
                  <Pill size={13} className="shrink-0 text-brand" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium">{d.name}</span>
                    <span className="block truncate text-[11px] text-ink-mute">
                      {d.generic_name} · {d.strength} · {money(d.unit_price)}
                    </span>
                  </span>
                  {d.requires_rx === 1 && <Chip tone="violet">Rx only</Chip>}
                  <Plus size={13} className="shrink-0 text-ink-mute" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lines.length > 0 && (
        <ul className="mt-3.5 space-y-2.5">
          {lines.map((l) => (
            <li key={l.drugId} className="rounded-xl border border-line p-3">
              <div className="mb-2.5 flex items-center gap-2">
                <span className="text-[12.5px] font-semibold">{l.name}</span>
                <span className="text-[11px] text-ink-mute">{l.strength}</span>
                {l.requiresRx === 1 && <Chip tone="violet">Rx only</Chip>}
                <button
                  onClick={() => setLines((prev) => prev.filter((x) => x.drugId !== l.drugId))}
                  className="ml-auto text-ink-mute transition hover:text-danger"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-4">
                <Field label="Dosage">
                  <input
                    value={l.dosage}
                    onChange={(e) => patch(l.drugId, { dosage: e.target.value })}
                    className="inp"
                  />
                </Field>
                <Field label="Frequency">
                  <input
                    value={l.frequency}
                    onChange={(e) => patch(l.drugId, { frequency: e.target.value })}
                    className="inp"
                  />
                </Field>
                <Field label="Duration (days)">
                  <input
                    type="number"
                    min={1}
                    value={l.durationDays}
                    onChange={(e) => patch(l.drugId, { durationDays: Number(e.target.value) })}
                    className="inp"
                  />
                </Field>
                <Field label="Quantity">
                  <input
                    type="number"
                    min={1}
                    value={l.quantity}
                    onChange={(e) => patch(l.drugId, { quantity: Number(e.target.value) })}
                    className="inp"
                  />
                </Field>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3.5">
        <Field label="Advice to the student">
          <textarea
            value={advice}
            onChange={(e) => setAdvice(e.target.value)}
            rows={2}
            placeholder="Plenty of fluids, steam inhalation twice a day, review if fever persists beyond 3 days."
            className="inp resize-y"
          />
        </Field>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        <button
          onClick={issue}
          disabled={pending || !lines.length}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Issue prescription &amp; push to cart
        </button>
        {lines.length > 0 && (
          <span className="text-[11.5px] text-ink-mute">
            {lines.length} line(s) · about <span className="mono">{money(total)}</span> for the student
          </span>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------ medical leave */

function LeaveSection({
  consultationId,
  appointment,
  patient,
  leaveDoc,
  recipients,
  onResult,
}: {
  consultationId: number;
  appointment: CareAppointment;
  patient?: StudentProfile;
  leaveDoc: LeaveDoc | null;
  recipients: { recipient_role: string; recipient_name: string; recipient_email: string | null }[];
  onResult: (r: ActionResult) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [recommend, setRecommend] = useState<"NO" | "YES">("NO");
  const [days, setDays] = useState(3);
  const [reason, setReason] = useState(appointment.diagnosis ?? "");
  const [note, setNote] = useState(appointment.diagnosis ?? "");
  const [advice, setAdvice] = useState("");
  const [fit, setFit] = useState("");

  if (leaveDoc) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
          <CheckCircle2 size={15} className="text-emerald-700" />
          <p className="text-[12.5px] font-medium text-emerald-800">
            Leave letter <span className="mono">{leaveDoc.ref_no}</span> was issued for{" "}
            {leaveDoc.days_granted} day(s) and delivered to {recipients.length} recipient(s).
          </p>
        </div>
        <LeaveLetter doc={leaveDoc} recipients={recipients} />
      </div>
    );
  }

  function issue() {
    start(async () => {
      const res = await grantLeave({
        consultationId,
        days,
        reason,
        diagnosisNote: note,
        advice,
        fitToResume: fit,
      });
      onResult(res);
      router.refresh();
    });
  }

  const missingChain = !patient?.proctor_name || !patient?.hod_name;

  return (
    <Card className="p-4">
      <SectionHead
        eyebrow="Attendance condonation"
        title="Do you recommend medical leave?"
        desc="Saying yes generates a letter on the VIT letterhead, delivers it to the student, their proctor and their HOD, and raises a condonation request against every course they are enrolled in."
      />

      <Segmented
        value={recommend}
        onChange={(v) => setRecommend(v as "NO" | "YES")}
        options={[
          { value: "NO", label: "No leave needed" },
          { value: "YES", label: "Yes, recommend leave" },
        ]}
      />

      {recommend === "YES" && (
        <div className="mt-4 space-y-3.5 fade">
          {missingChain && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11.5px] text-amber-800">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              This student has not filled in their{" "}
              {!patient?.proctor_name ? "proctor" : ""}
              {!patient?.proctor_name && !patient?.hod_name ? " and " : ""}
              {!patient?.hod_name ? "HOD" : ""} details, so the letter will only reach the people on
              file. Ask them to complete their profile.
            </p>
          )}

          <div className="grid gap-3.5 sm:grid-cols-3">
            <Field label="Days of leave" hint="you decide the duration" required>
              <input
                type="number"
                min={1}
                max={30}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="inp"
              />
            </Field>
            <Field label="Reason recorded on the certificate" required>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Acute viral fever with dehydration"
                className="inp"
              />
            </Field>
            <Field label="Diagnosis as it should read in the letter">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Acute viral pharyngitis"
                className="inp"
              />
            </Field>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Medical advice (printed in the letter)">
              <textarea
                value={advice}
                onChange={(e) => setAdvice(e.target.value)}
                rows={2}
                placeholder="Complete bed rest, oral fluids, antipyretics as prescribed."
                className="inp resize-y"
              />
            </Field>
            <Field label="Fitness statement">
              <textarea
                value={fit}
                onChange={(e) => setFit(e.target.value)}
                rows={2}
                placeholder="The student is expected to be fit to resume academic duties from the following day."
                className="inp resize-y"
              />
            </Field>
          </div>

          <div className="rounded-xl border border-line bg-sunk/50 px-4 py-3">
            <p className="eyebrow mb-1.5">The letter will be delivered to</p>
            <div className="flex flex-wrap gap-2">
              <Chip tone="brand">
                <UserRound size={11} /> {appointment.student_name} (student)
              </Chip>
              {patient?.proctor_name && (
                <Chip tone="violet">
                  <UserRound size={11} /> {patient.proctor_name} (proctor)
                </Chip>
              )}
              {patient?.hod_name && (
                <Chip tone="violet">
                  <UserRound size={11} /> {patient.hod_name} (HOD)
                </Chip>
              )}
            </div>
          </div>

          <button
            onClick={issue}
            disabled={pending || !reason.trim() || days < 1}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <FileSignature size={14} />}
            Generate and send the leave letter
          </button>
        </div>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------------- atoms */

function Bit({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-ink-mute">{k}:</span>
      <span className={mono ? "mono text-ink" : "text-ink"}>{v}</span>
    </span>
  );
}
