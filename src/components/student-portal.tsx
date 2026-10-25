"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  FileText,
  Inbox,
  Loader2,
  Minus,
  Package,
  Pill,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
  Trash2,
  Truck,
  UserRound,
  Video,
} from "lucide-react";
import {
  addToCart,
  bookVisit,
  checkout,
  markAllRead,
  removeCartLine,
  saveProfile,
  setCartQty,
} from "@/app/care-actions";
import type { ActionResult } from "@/app/actions";
import type {
  CareAppointment,
  CartLine,
  LeaveDoc,
  Notice,
  StoreDrug,
  StudentOrder,
  StudentProfile,
} from "@/lib/care";
import { Card, Chip, Empty, SectionHead, Table, Td, Th, type Tone } from "@/components/ui";
import { VideoConsole } from "@/components/video-console";
import { LeaveLetter } from "@/components/leave-letter";
import { Field, Feedback, Segmented, money, whenLabel } from "@/components/care-ui";

type Tab = "profile" | "book" | "care" | "pharmacy" | "documents" | "inbox";

const TRIAGE_TONE: Record<string, Tone> = { RED: "danger", AMBER: "warn", GREEN: "ok" };
const ORDER_TONE: Record<string, Tone> = {
  PLACED: "info",
  PACKED: "violet",
  OUT_FOR_DELIVERY: "orange",
  DELIVERED: "ok",
  CANCELLED: "danger",
};

export function StudentPortal({
  profile,
  roster,
  doctors,
  slotsByDoctor,
  symptoms,
  appointments,
  cart,
  store,
  orders,
  notices,
  docs,
  recipientsByDoc,
  campusList,
  deptList,
  pharmacy,
}: {
  profile: StudentProfile | null;
  roster: { reg_no: string; name: string }[];
  doctors: {
    doctor_id: number;
    name: string;
    doctor_type: string;
    campus_id: number;
    years_experience: number;
  }[];
  slotsByDoctor: Record<number, { slot_date: string; slot_time: string; mode: string }[]>;
  symptoms: { symptom_id: number; name: string; body_system: string; default_triage: string }[];
  appointments: CareAppointment[];
  cart: CartLine[];
  store: StoreDrug[];
  orders: StudentOrder[];
  notices: Notice[];
  docs: LeaveDoc[];
  recipientsByDoc: Record<
    number,
    { recipient_role: string; recipient_name: string; recipient_email: string | null }[]
  >;
  campusList: { campus_id: number; code: string; name: string }[];
  deptList: { dept_id: number; campus_id: number; code: string; name: string }[];
  pharmacy: { name: string; location: string } | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(profile ? "care" : "profile");

  const unread = notices.filter((n) => !n.is_read).length;
  const rxCount = cart.filter((c) => c.source === "RX").length;

  function switchStudent(reg: string) {
    router.push(reg ? `/student?reg=${encodeURIComponent(reg)}` : "/student");
  }

  const TABS: { id: Tab; label: string; icon: typeof UserRound; badge?: number }[] = [
    { id: "profile", label: "My Profile", icon: UserRound },
    { id: "book", label: "Book a Consultation", icon: CalendarClock },
    { id: "care", label: "My Care", icon: Stethoscope },
    { id: "pharmacy", label: "Cart & Pharmacy", icon: ShoppingCart, badge: cart.length },
    { id: "documents", label: "Medical Leave", icon: FileText, badge: docs.length },
    { id: "inbox", label: "Notifications", icon: Bell, badge: unread },
  ];

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------- header */}
      <Card className="overflow-hidden">
        <div className="grain flex flex-wrap items-center gap-4 border-b border-line px-5 py-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-deep text-[15px] font-semibold text-white">
            {profile ? initials(profile.name) : <UserRound size={19} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Student Portal</p>
            <h2 className="truncate text-[18px] font-semibold tracking-tight">
              {profile ? profile.name : "No profile loaded"}
            </h2>
            <p className="truncate text-[12px] text-ink-soft">
              {profile
                ? `${profile.reg_no} · Year ${profile.year_of_study} · ${profile.dept_code} · ${profile.campus_name}`
                : "Create your profile below, or load an existing registration number."}
            </p>
          </div>

          <label className="flex items-center gap-2 text-[11.5px] text-ink-mute">
            Switch student
            <select
              value={profile?.reg_no ?? ""}
              onChange={(e) => switchStudent(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink"
            >
              <option value="">— new profile —</option>
              {roster.map((s) => (
                <option key={s.reg_no} value={s.reg_no}>
                  {s.reg_no} · {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* tabs */}
        <div className="flex gap-1 overflow-x-auto px-3 py-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={[
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] transition",
                  active
                    ? "bg-brand-wash font-semibold text-brand-deep"
                    : "text-ink-soft hover:bg-sunk hover:text-ink",
                ].join(" ")}
              >
                <Icon size={14} strokeWidth={active ? 2.3 : 1.9} />
                {t.label}
                {t.badge ? (
                  <span
                    className={`ml-0.5 rounded-full px-1.5 text-[10px] font-semibold ${
                      active ? "bg-brand text-white" : "bg-sunk text-ink-mute"
                    }`}
                  >
                    {t.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </Card>

      {!profile && tab !== "profile" && (
        <Empty>Load or create a profile first — every other tab is keyed to your registration number.</Empty>
      )}

      {tab === "profile" && (
        <ProfileTab profile={profile} campusList={campusList} deptList={deptList} />
      )}
      {tab === "book" && profile && (
        <BookTab profile={profile} doctors={doctors} slotsByDoctor={slotsByDoctor} symptoms={symptoms} />
      )}
      {tab === "care" && profile && <CareTab appointments={appointments} />}
      {tab === "pharmacy" && profile && (
        <PharmacyTab
          regNo={profile.reg_no}
          cart={cart}
          store={store}
          orders={orders}
          pharmacy={pharmacy}
          rxCount={rxCount}
        />
      )}
      {tab === "documents" && profile && (
        <DocumentsTab docs={docs} recipientsByDoc={recipientsByDoc} />
      )}
      {tab === "inbox" && profile && <InboxTab regNo={profile.reg_no} notices={notices} />}
    </div>
  );
}

/* ==================================================================== profile */

function ProfileTab({
  profile,
  campusList,
  deptList,
}: {
  profile: StudentProfile | null;
  campusList: { campus_id: number; code: string; name: string }[];
  deptList: { dept_id: number; campus_id: number; code: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  function submit(formData: FormData) {
    start(async () => {
      const res = await saveProfile(formData);
      setResult(res);
      if (res.ok) {
        const reg = String(formData.get("reg_no") ?? "").toUpperCase();
        router.push(`/student?reg=${encodeURIComponent(reg)}`);
        router.refresh();
      }
    });
  }

  return (
    <form action={submit} className="space-y-5">
      <Card className="p-5">
        <SectionHead
          eyebrow="Step 1"
          title="Personal details"
          desc="Type your own details — nothing here is picked from a list of existing students. These fields become one row in the student relation."
        />
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Registration number" hint="e.g. 25BCE2256" required>
            <input
              name="reg_no"
              defaultValue={profile?.reg_no ?? ""}
              placeholder="25BCE2256"
              className="inp mono uppercase"
              required
            />
          </Field>
          <Field label="Full name" required>
            <input
              name="name"
              defaultValue={profile?.name ?? ""}
              placeholder="Param Vansh Singh"
              className="inp"
              required
            />
          </Field>
          <Field label="VIT email" required>
            <input
              type="email"
              name="email"
              defaultValue={profile?.email ?? ""}
              placeholder="name.year@vitstudent.ac.in"
              className="inp"
              required
            />
          </Field>
          <Field label="Phone" hint="10 digits" required>
            <input
              name="phone"
              defaultValue={profile?.phone ?? ""}
              placeholder="9812345601"
              inputMode="numeric"
              className="inp"
              required
            />
          </Field>
          <Field label="Date of birth" required>
            <input type="date" name="dob" defaultValue={profile?.dob ?? ""} className="inp" required />
          </Field>
          <Field label="Gender">
            <Segmented
              name="gender"
              defaultValue={profile?.gender ?? "M"}
              options={[
                { value: "M", label: "Male" },
                { value: "F", label: "Female" },
                { value: "O", label: "Other" },
              ]}
            />
          </Field>
          <Field label="Blood group">
            <input
              name="blood_group"
              defaultValue={profile?.blood_group ?? ""}
              placeholder="B+"
              className="inp"
            />
          </Field>
          <Field label="Year of study" required>
            <input
              type="number"
              name="year_of_study"
              min={1}
              max={5}
              defaultValue={profile?.year_of_study ?? 1}
              className="inp"
              required
            />
          </Field>
          <Field label="Campus" hint="type or pick a VIT campus" required>
            <input
              name="campus"
              list="campus-options"
              defaultValue={profile?.campus_name ?? ""}
              placeholder="VIT Vellore"
              className="inp"
              required
            />
            <datalist id="campus-options">
              {campusList.map((c) => (
                <option key={c.campus_id} value={c.name}>
                  {c.code}
                </option>
              ))}
            </datalist>
          </Field>
          <Field label="School / department" hint="typed freely; resolved against your campus" required>
            <input
              name="department"
              list="dept-options"
              defaultValue={profile?.dept_name ?? ""}
              placeholder="School of Computer Science and Engineering"
              className="inp"
              required
            />
            <datalist id="dept-options">
              {deptList.map((d) => (
                <option key={d.dept_id} value={d.name}>
                  {d.code}
                </option>
              ))}
            </datalist>
          </Field>
          <Field label="Hostel block">
            <input
              name="hostel_block"
              defaultValue={profile?.hostel_block ?? ""}
              placeholder="M-Block"
              className="inp"
            />
          </Field>
          <Field label="Room number">
            <input name="room_no" defaultValue={profile?.room_no ?? ""} placeholder="412" className="inp" />
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <SectionHead
          eyebrow="Step 2 · the escalation chain"
          title="Your proctor and Head of Department"
          desc="Fill these in now. If a doctor ever recommends medical leave, the generated letter is delivered to exactly these two people by a database trigger — you never have to forward it yourself."
        />
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Proctor's name">
            <input
              name="proctor_name"
              defaultValue={profile?.proctor_name ?? ""}
              placeholder="Dr. Anitha Rajan"
              className="inp"
            />
          </Field>
          <Field label="Proctor's email">
            <input
              type="email"
              name="proctor_email"
              defaultValue={profile?.proctor_email ?? ""}
              placeholder="anitha.rajan@vit.ac.in"
              className="inp"
            />
          </Field>
          <Field label="Proctor's phone">
            <input
              name="proctor_phone"
              defaultValue={profile?.proctor_phone ?? ""}
              placeholder="9840011001"
              className="inp"
            />
          </Field>
          <Field label="HOD's name">
            <input
              name="hod_name"
              defaultValue={profile?.hod_name ?? ""}
              placeholder="Dr. Ramesh Kumar"
              className="inp"
            />
          </Field>
          <Field label="HOD's email">
            <input
              type="email"
              name="hod_email"
              defaultValue={profile?.hod_email ?? ""}
              placeholder="ramesh.kumar@vit.ac.in"
              className="inp"
            />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-deep disabled:opacity-60"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            {profile ? "Save profile" : "Create my profile"}
          </button>
          <p className="text-[11.5px] text-ink-mute">
            Writes one row to <span className="mono">student</span> and keeps your default{" "}
            <span className="mono">delivery_address</span> in step.
          </p>
        </div>

        <Feedback result={result} />
      </Card>
    </form>
  );
}

/* ======================================================================= book */

function BookTab({
  profile,
  doctors,
  slotsByDoctor,
  symptoms,
}: {
  profile: StudentProfile;
  doctors: {
    doctor_id: number;
    name: string;
    doctor_type: string;
    campus_id: number;
    years_experience: number;
  }[];
  slotsByDoctor: Record<number, { slot_date: string; slot_time: string; mode: string }[]>;
  symptoms: { symptom_id: number; name: string; body_system: string; default_triage: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [slot, setSlot] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [complaint, setComplaint] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const campusDoctors = doctors.filter((d) => d.campus_id === profile.campus_id);
  const slots = doctorId ? (slotsByDoctor[doctorId] ?? []) : [];

  const triage = useMemo(() => {
    const levels = [...picked]
      .map((id) => symptoms.find((s) => s.symptom_id === id)?.default_triage)
      .filter(Boolean) as string[];
    if (levels.includes("RED")) return "RED";
    if (levels.includes("AMBER")) return "AMBER";
    return "GREEN";
  }, [picked, symptoms]);

  const chosen = slots.find((s) => `${s.slot_date}|${s.slot_time}` === slot);

  function submit(formData: FormData) {
    formData.set("reg_no", profile.reg_no);
    formData.set("triage_level", triage);
    // doctorId and slot live in component state, so they are written onto the
    // payload here rather than relying on a rendered field.
    formData.set("doctor_id", String(doctorId ?? ""));
    formData.set("slot", slot);
    if (chosen) formData.set("mode", chosen.mode);
    start(async () => {
      const res = await bookVisit(formData);
      setResult(res);
      if (res.ok) {
        setSlot("");
        setPicked(new Set());
        setComplaint("");
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  return (
    <form ref={formRef} action={submit} className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
      <div className="space-y-5">
        <Card className="p-5">
          <SectionHead
            eyebrow="Step 1"
            title="Choose a clinician"
            desc={`Doctors serving ${profile.campus_name}. A slot you pick is locked by a trigger the instant the appointment lands, so nobody can double-book it.`}
          />
          <div className="grid gap-2.5 sm:grid-cols-2">
            {campusDoctors.map((d) => {
              const active = doctorId === d.doctor_id;
              const open = (slotsByDoctor[d.doctor_id] ?? []).length;
              return (
                <button
                  key={d.doctor_id}
                  type="button"
                  onClick={() => {
                    setDoctorId(d.doctor_id);
                    setSlot("");
                  }}
                  className={[
                    "rounded-xl border p-3.5 text-left transition",
                    active
                      ? "border-brand bg-brand-wash shadow-sm"
                      : "border-line bg-surface hover:border-line-strong hover:bg-sunk",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-semibold">{d.name}</span>
                    {active && <CheckCircle2 size={15} className="shrink-0 text-brand" />}
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-ink-soft">
                    {d.doctor_type === "GP"
                      ? "General Practitioner"
                      : d.doctor_type === "SPECIALIST"
                        ? "Specialist"
                        : "Counsellor"}{" "}
                    · {d.years_experience} yrs
                  </p>
                  <p className="mt-1.5 text-[11px] text-ink-mute">{open} open slot(s)</p>
                </button>
              );
            })}
          </div>
          {!campusDoctors.length && <Empty>No clinicians are registered for your campus yet.</Empty>}
        </Card>

        {doctorId && (
          <Card className="p-5 fade">
            <SectionHead eyebrow="Step 2" title="Pick a slot" />
            <div className="flex flex-wrap gap-2">
              {slots.slice(0, 44).map((s) => {
                const key = `${s.slot_date}|${s.slot_time}`;
                const active = slot === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSlot(key)}
                    className={[
                      "rounded-lg border px-2.5 py-1.5 text-[11.5px] transition",
                      active
                        ? "border-brand bg-brand text-white"
                        : "border-line bg-surface text-ink-soft hover:border-line-strong hover:bg-sunk",
                    ].join(" ")}
                  >
                    <span className="mono">{whenLabel(s.slot_date)}</span> · {s.slot_time}
                    {s.mode === "IN_PERSON" && <span className="ml-1 opacity-70">·in-person</span>}
                  </button>
                );
              })}
            </div>
            {!slots.length && <Empty>This doctor has no open slots left.</Empty>}
            <input type="hidden" name="slot" value={slot} />
          </Card>
        )}

        <Card className="p-5">
          <SectionHead
            eyebrow="Step 3"
            title="Describe what is wrong"
            desc="Write it in your own words. Selecting symptoms sets the triage level the doctor's queue is sorted by."
          />
          <Field label="Chief complaint" required>
            <textarea
              name="chief_complaint"
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              rows={3}
              placeholder="Fever since two nights with body ache and a sore throat…"
              className="inp resize-y"
              required
            />
          </Field>

          <p className="eyebrow mt-4 mb-2">Symptoms</p>
          <div className="flex flex-wrap gap-2">
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
                  className={[
                    "rounded-full border px-3 py-1.5 text-[11.5px] transition",
                    on
                      ? "border-brand bg-brand-wash font-semibold text-brand-deep"
                      : "border-line bg-surface text-ink-soft hover:bg-sunk",
                  ].join(" ")}
                >
                  {s.name}
                  {on && <input type="hidden" name="symptom_id" value={s.symptom_id} />}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
            <Field label="How many days has this lasted?">
              <input type="number" name="duration_days" min={1} defaultValue={1} className="inp" />
            </Field>
            <Field label="Assessed triage">
              <div className="flex h-[38px] items-center">
                <Chip tone={TRIAGE_TONE[triage]}>
                  {triage === "RED" ? "Urgent" : triage === "AMBER" ? "Priority" : "Routine"} · {triage}
                </Chip>
              </div>
            </Field>
          </div>
        </Card>
      </div>

      {/* summary rail */}
      <div className="space-y-4">
        <Card className="sticky top-20 p-5">
          <SectionHead eyebrow="Confirm" title="Your appointment" />
          <dl className="space-y-2 text-[12.5px]">
            <Row k="Patient" v={`${profile.name} · ${profile.reg_no}`} />
            <Row
              k="Doctor"
              v={doctorId ? (campusDoctors.find((d) => d.doctor_id === doctorId)?.name ?? "—") : "Not chosen"}
            />
            <Row k="When" v={chosen ? `${whenLabel(chosen.slot_date)} at ${chosen.slot_time}` : "Not chosen"} />
            <Row
              k="Mode"
              v={
                chosen ? (
                  <span className="inline-flex items-center gap-1">
                    {chosen.mode === "VIDEO" ? <Video size={12} /> : <Stethoscope size={12} />}
                    {chosen.mode === "VIDEO" ? "Video consultation" : "In person"}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <Row k="Triage" v={<Chip tone={TRIAGE_TONE[triage]}>{triage}</Chip>} />
          </dl>

          <button
            type="submit"
            disabled={pending || !doctorId || !slot || complaint.trim().length < 8}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
            Confirm booking
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">
            On booking, <span className="mono">trg_slot_mark_booked</span> locks the slot and{" "}
            <span className="mono">trg_notify_appointment</span> writes your confirmation — both inside
            the database.
          </p>

          <Feedback result={result} />
        </Card>
      </div>
    </form>
  );
}

/* ======================================================================= care */

function CareTab({ appointments }: { appointments: CareAppointment[] }) {
  const [openId, setOpenId] = useState<number | null>(
    appointments.find((a) => a.status === "BOOKED" && a.mode === "VIDEO")?.appointment_id ?? null,
  );

  if (!appointments.length) {
    return <Empty>You have no appointments yet. Book one from the previous tab.</Empty>;
  }

  return (
    <div className="space-y-4">
      <SectionHead
        eyebrow="My Care"
        title="Appointments and consultations"
        desc="Join the video room for any booked video consultation — the doctor sees the same room code."
      />
      {appointments.map((a) => {
        const open = openId === a.appointment_id;
        return (
          <Card key={a.appointment_id} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
              <span className="mono text-[11px] text-ink-mute">#{a.appointment_id}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold">{a.doctor_name}</p>
                <p className="truncate text-[11.5px] text-ink-soft">
                  {whenLabel(a.slot_date)} at {a.slot_time} · {a.chief_complaint}
                </p>
              </div>
              <Chip tone={TRIAGE_TONE[a.triage_level]}>{a.triage_level}</Chip>
              <Chip tone={a.status === "COMPLETED" ? "ok" : a.status === "BOOKED" ? "info" : "neutral"}>
                {a.status}
              </Chip>
              {a.mode === "VIDEO" && a.status !== "CANCELLED" && (
                <button
                  onClick={() => setOpenId(open ? null : a.appointment_id)}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[11.5px] font-semibold text-white transition hover:bg-brand-deep"
                >
                  <Video size={12} />
                  {open ? "Close room" : "Join video call"}
                </button>
              )}
            </div>

            {a.diagnosis && a.diagnosis !== "Consultation in progress" && (
              <div className="border-b border-line bg-sunk/50 px-5 py-3 text-[12px]">
                <span className="eyebrow">Diagnosis</span>
                <p className="mt-1 text-ink-soft">{a.diagnosis}</p>
                {a.rx_lines > 0 && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-brand-deep">
                    <Pill size={12} />
                    {a.rx_lines} medicine(s) prescribed — check your cart.
                  </p>
                )}
              </div>
            )}

            {open && a.mode === "VIDEO" && (
              <div className="p-4">
                <VideoConsole
                  room={a.video_room_code ?? `VITC-${String(a.appointment_id).padStart(4, "0")}`}
                  role="STUDENT"
                  counterpart={a.doctor_name}
                  subtitle={`Appointment #${a.appointment_id} · ${whenLabel(a.slot_date)} ${a.slot_time}`}
                />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* =================================================================== pharmacy */

function PharmacyTab({
  regNo,
  cart,
  store,
  orders,
  pharmacy,
  rxCount,
}: {
  regNo: string;
  cart: CartLine[];
  store: StoreDrug[];
  orders: StudentOrder[];
  pharmacy: { name: string; location: string } | null;
  rxCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [payment, setPayment] = useState("COD");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set(cart.map((c) => c.cart_item_id)));

  const filtered = store.filter(
    (d) =>
      !query ||
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      d.generic_name.toLowerCase().includes(query.toLowerCase()),
  );

  const chosenLines = cart.filter((c) => selected.has(c.cart_item_id));
  const total = chosenLines.reduce((sum, c) => sum + c.line_total, 0);

  function act(fn: () => Promise<ActionResult>) {
    start(async () => {
      const res = await fn();
      setResult(res);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
      <div className="space-y-5">
        {/* --------------------------------------------------------- the cart */}
        <Card className="p-5">
          <SectionHead
            eyebrow="Your cart"
            title="Medicines waiting to be ordered"
            desc={
              rxCount
                ? `${rxCount} line(s) were put here by your doctor. Prescription lines are locked — they came from a trigger, not from you.`
                : "Prescribed medicines land here automatically the moment a doctor writes them."
            }
            right={<Chip tone="brand">{cart.length} line(s)</Chip>}
          />

          {!cart.length ? (
            <Empty>Your cart is empty. Add over-the-counter items below, or wait for a prescription.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th className="w-8" />
                  <Th>Medicine</Th>
                  <Th>Source</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Total</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {cart.map((line) => (
                  <tr key={line.cart_item_id} className="hover:bg-sunk/60">
                    <Td>
                      <input
                        type="checkbox"
                        checked={selected.has(line.cart_item_id)}
                        onChange={(e) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(line.cart_item_id);
                            else next.delete(line.cart_item_id);
                            return next;
                          })
                        }
                        className="h-3.5 w-3.5 accent-[var(--brand)]"
                      />
                    </Td>
                    <Td>
                      <p className="font-medium">{line.drug_name}</p>
                      <p className="text-[11px] text-ink-mute">
                        {line.generic_name} · {line.strength} · {line.form.toLowerCase()}
                      </p>
                      {line.dosage && (
                        <p className="mt-0.5 text-[11px] text-brand-deep">
                          {line.dosage} · {line.frequency}
                        </p>
                      )}
                    </Td>
                    <Td>
                      {line.source === "RX" ? (
                        <Chip tone="violet">Rx #{line.prescription_id}</Chip>
                      ) : (
                        <Chip tone="neutral">Self</Chip>
                      )}
                    </Td>
                    <Td className="text-right">
                      <span className="inline-flex items-center gap-1">
                        <button
                          onClick={() => act(() => setCartQty(line.cart_item_id, line.quantity - 1))}
                          disabled={pending}
                          className="grid h-6 w-6 place-items-center rounded border border-line text-ink-soft hover:bg-sunk"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="mono w-7 text-center">{line.quantity}</span>
                        <button
                          onClick={() => act(() => setCartQty(line.cart_item_id, line.quantity + 1))}
                          disabled={pending}
                          className="grid h-6 w-6 place-items-center rounded border border-line text-ink-soft hover:bg-sunk"
                        >
                          <Plus size={11} />
                        </button>
                      </span>
                    </Td>
                    <Td className="mono text-right">{money(line.line_total)}</Td>
                    <Td>
                      {line.source === "SELF" && (
                        <button
                          onClick={() => act(() => removeCartLine(line.cart_item_id))}
                          disabled={pending}
                          className="text-ink-mute transition hover:text-danger"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {/* --------------------------------------------------------- the store */}
        <Card className="p-5">
          <SectionHead
            eyebrow="Order more"
            title="Over-the-counter counter"
            desc="Anything that needs a prescription is deliberately absent — only a doctor can put those in your cart."
            right={
              <label className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5">
                <Search size={13} className="text-ink-mute" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search medicines"
                  className="w-36 bg-transparent text-[12px] outline-none"
                />
              </label>
            }
          />
          <div className="grid gap-2.5 sm:grid-cols-2">
            {filtered.slice(0, 24).map((d) => (
              <div
                key={d.drug_id}
                className="flex items-center gap-3 rounded-xl border border-line p-3 transition hover:border-line-strong hover:bg-sunk/50"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-wash text-brand-deep">
                  <Pill size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium">{d.name}</p>
                  <p className="truncate text-[11px] text-ink-mute">
                    {d.strength} · {money(d.unit_price)} · {d.qty_on_hand} in stock
                  </p>
                </div>
                <button
                  onClick={() => act(() => addToCart(regNo, d.drug_id, 1))}
                  disabled={pending || d.qty_on_hand < 1}
                  className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] font-medium text-brand-deep transition hover:bg-brand-wash disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
          {!filtered.length && <Empty>Nothing matches &ldquo;{query}&rdquo;.</Empty>}
        </Card>
      </div>

      {/* ------------------------------------------------------------ checkout */}
      <div className="space-y-4">
        <Card className="sticky top-20 p-5">
          <SectionHead eyebrow="Checkout" title="Place your order" />
          {pharmacy && (
            <p className="mb-3 text-[11.5px] text-ink-soft">
              Fulfilled by <strong>{pharmacy.name}</strong> · {pharmacy.location}
            </p>
          )}
          <dl className="space-y-2 text-[12.5px]">
            <Row k="Lines selected" v={`${chosenLines.length} of ${cart.length}`} />
            <Row k="Order value" v={<span className="mono">{money(total)}</span>} />
            <Row k="Delivery" v="To your hostel room" />
          </dl>

          <p className="eyebrow mt-4 mb-1.5">Payment</p>
          <Segmented
            value={payment}
            onChange={setPayment}
            options={[
              { value: "COD", label: "Cash" },
              { value: "UPI", label: "UPI" },
              { value: "CARD", label: "Card" },
            ]}
          />

          <button
            onClick={() =>
              act(() =>
                checkout({ regNo, paymentMode: payment, cartItemIds: [...selected] }),
              )
            }
            disabled={pending || !chosenLines.length}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
            Confirm and place order
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">
            A stock guard refuses any line that exceeds on-hand inventory, then{" "}
            <span className="mono">trg_stock_deduct</span> deducts stock and rolls the total up.
          </p>

          <Feedback result={result} />
        </Card>

        <Card className="p-5">
          <SectionHead eyebrow="History" title="Your orders" />
          {!orders.length ? (
            <Empty>No orders yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {orders.slice(0, 8).map((o) => (
                <li
                  key={o.order_id}
                  className="flex items-center gap-3 rounded-xl border border-line p-3"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sunk text-ink-soft">
                    <Package size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium">
                      Order #{o.order_id} · <span className="mono">{money(o.total_amount)}</span>
                    </p>
                    <p className="truncate text-[11px] text-ink-mute">
                      {o.lines} item(s) · {o.pharmacy_name} · {o.placed_at.slice(0, 16)}
                    </p>
                  </div>
                  <Chip tone={ORDER_TONE[o.status] ?? "neutral"}>{o.status.replace(/_/g, " ")}</Chip>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ================================================================= documents */

function DocumentsTab({
  docs,
  recipientsByDoc,
}: {
  docs: LeaveDoc[];
  recipientsByDoc: Record<
    number,
    { recipient_role: string; recipient_name: string; recipient_email: string | null }[]
  >;
}) {
  const [openId, setOpenId] = useState<number | null>(docs[0]?.document_id ?? null);

  if (!docs.length) {
    return (
      <Empty>
        No medical leave has been recommended for you. If a doctor grants leave during a consultation,
        the letter appears here — and reaches your proctor and HOD at the same moment.
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHead
        eyebrow="Medical leave"
        title="Letters issued to you"
        desc="Each letter was generated on a VIT letterhead by the Health Centre and delivered to you, your proctor and your HOD by a single database trigger."
      />
      <div className="no-print-body space-y-3">
        {docs.map((d) => {
          const open = openId === d.document_id;
          const recipients = recipientsByDoc[d.document_id] ?? [];
          return (
            <Card key={d.document_id}>
              <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-700">
                  <FileText size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="mono truncate text-[12.5px] font-semibold">{d.ref_no}</p>
                  <p className="truncate text-[11.5px] text-ink-soft">
                    {d.days_granted} day(s) · {d.valid_from} → {d.valid_to} · {d.diagnosis_note}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {recipients.map((r) => (
                    <Chip key={r.recipient_role} tone={r.recipient_role === "STUDENT" ? "brand" : "violet"}>
                      {r.recipient_role === "STUDENT" ? "You" : title(r.recipient_role)}
                    </Chip>
                  ))}
                </div>
                <button
                  onClick={() => setOpenId(open ? null : d.document_id)}
                  className="rounded-lg border border-line px-3 py-1.5 text-[11.5px] font-medium text-ink-soft transition hover:bg-sunk"
                >
                  {open ? "Hide letter" : "Open letter"}
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {openId && (
        <div className="fade">
          <LeaveLetter
            doc={docs.find((d) => d.document_id === openId)!}
            recipients={recipientsByDoc[openId] ?? []}
          />
        </div>
      )}
    </div>
  );
}

/* ===================================================================== inbox */

const NOTICE_ICON: Record<string, typeof Bell> = {
  APPOINTMENT: CalendarClock,
  PRESCRIPTION: Pill,
  ORDER: Package,
  LEAVE: FileText,
  ALERT: AlertTriangle,
};

const NOTICE_TONE: Record<string, Tone> = {
  APPOINTMENT: "info",
  PRESCRIPTION: "violet",
  ORDER: "orange",
  LEAVE: "brand",
  ALERT: "danger",
};

function InboxTab({ regNo, notices }: { regNo: string; notices: Notice[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = notices.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-4">
      <SectionHead
        eyebrow="Notifications"
        title="Everything the database told you"
        desc="Not one of these was written by application code — each row was raised by a trigger at the moment the fact it describes became true."
        right={
          unread > 0 ? (
            <button
              onClick={() =>
                start(async () => {
                  await markAllRead(regNo);
                  router.refresh();
                })
              }
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12px] text-ink-soft transition hover:bg-sunk"
            >
              {pending ? <Loader2 size={12} className="animate-spin" /> : <Inbox size={12} />}
              Mark all read
            </button>
          ) : undefined
        }
      />
      {!notices.length ? (
        <Empty>Nothing yet.</Empty>
      ) : (
        <Card className="divide-y divide-[var(--line)]">
          {notices.map((n) => {
            const Icon = NOTICE_ICON[n.kind] ?? Bell;
            return (
              <div
                key={n.notification_id}
                className={`flex gap-3 px-5 py-3.5 ${n.is_read ? "" : "bg-brand-wash/40"}`}
              >
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sunk text-ink-soft">
                  <Icon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12.5px] font-semibold">{n.title}</p>
                    <Chip tone={NOTICE_TONE[n.kind] ?? "neutral"}>{n.kind}</Chip>
                    {!n.is_read && <span className="live-dot h-1.5 w-1.5 rounded-full bg-brand" />}
                  </div>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{n.body}</p>
                  <p className="mt-1 text-[10.5px] text-ink-mute">{n.created_at}</p>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

/* ==================================================================== atoms */

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-0">
      <dt className="shrink-0 text-[11.5px] text-ink-mute">{k}</dt>
      <dd className="text-right text-[12px]">{v}</dd>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function title(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}
