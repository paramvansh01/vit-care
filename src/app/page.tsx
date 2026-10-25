import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  FileWarning,
  GitBranch,
  Layers3,
  Network,
  Pill,
  ScrollText,
  ShieldCheck,
  Split,
  Stethoscope,
  UserRound,
  Database,
  Video,
} from "lucide-react";
import { Card, Chip, Page, SectionHead } from "@/components/ui";
import { headlineStats } from "@/lib/queries";
import { introspect } from "@/lib/db/introspect";

export const dynamic = "force-dynamic";

const SEGMENTS = [
  {
    href: "/student",
    icon: UserRound,
    kicker: "Segment 1 · the patient",
    title: "Student Portal",
    swatch: "bg-blue-50 text-blue-700",
    desc: "A student types their own details — including the proctor and HOD their medical leave must reach — then books, consults, and orders.",
    points: [
      "Create a profile by hand, nothing picked from a list",
      "Book a slot the database refuses to double-book",
      "Join the video consultation; receive prescriptions in a cart",
      "Confirm the order for delivery and download leave letters",
    ],
    cta: "Open the portal",
  },
  {
    href: "/doctor",
    icon: Stethoscope,
    kicker: "Segment 2 · the administrator",
    title: "Doctor Console",
    swatch: "bg-brand-wash text-brand-deep",
    desc: "The clinician manages the triage-ordered queue, runs the call, prescribes into the student's cart, and decides on medical leave.",
    points: [
      "Triage-sorted queue of every booking that arrives",
      "Video room, clinical notes and sealed-record handling",
      "Prescribe — the lines land in the student's cart by trigger",
      "Recommend leave and generate the VIT letterhead document",
    ],
    cta: "Open the console",
  },
  {
    href: "/database",
    icon: Database,
    kicker: "Segment 3 · the engine",
    title: "How the Database Works",
    swatch: "bg-violet-50 text-violet-700",
    desc: "The part that actually does the work: seventeen triggers, six RBAC views and a 3NF schema that enforces every rule shown above.",
    points: [
      "Every trigger, grouped by the journey step it guards",
      "Live trigger_log stream as you drive the other segments",
      "The medical-leave register view, end to end",
      "ER diagram, schema explorer, normalization and SQL console",
    ],
    cta: "See the engine",
  },
];

export default function Home() {
  const stats = headlineStats();
  const model = introspect();

  return (
    <div>
      {/* ------------------------------------------------------------ hero */}
      <section className="grain relative overflow-hidden border-b border-line bg-surface">
        <div className="hairline-grid absolute inset-0 opacity-45" />
        <div className="relative mx-auto max-w-[1240px] px-5 py-16 sm:px-7 sm:py-20">
          <div className="rise max-w-3xl">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <Chip tone="brand">CSE2003 · Database Management Systems</Chip>
              <Chip tone="neutral">Review 1 · 27 July 2026</Chip>
            </div>

            <h1 className="text-[40px] font-semibold leading-[1.08] tracking-[-0.025em] sm:text-[54px]">
              From symptom to solution,
              <br />
              <span className="text-brand-deep">on one normalized schema.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-[15.5px] leading-relaxed text-ink-soft">
              VIT-Care models the entire student healthcare journey as a single 3NF relational
              database — symptom-based triage, video consultation, e-prescription, pharmacy stock
              management, and the automatic conversion of a validated medical certificate into a
              faculty-routed attendance condonation request.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <Link
                href="/student"
                className="group flex items-center gap-2 rounded-xl bg-brand-deep px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-brand"
              >
                <UserRound size={16} />
                Enter as a student
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/doctor"
                className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-[13.5px] font-medium text-ink-soft shadow-sm transition hover:border-line-strong hover:text-ink"
              >
                <Stethoscope size={15} />
                Enter as the doctor
              </Link>
              <Link
                href="/database"
                className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-[13.5px] font-medium text-ink-soft shadow-sm transition hover:border-line-strong hover:text-ink"
              >
                <Database size={15} />
                See how the database works
              </Link>
            </div>

            <dl className="mt-10 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
              <HeroStat n={model.stats.tables} label="normalized relations" />
              <HeroStat n={model.stats.relationships} label="foreign keys" />
              <HeroStat n={model.stats.triggers} label="active triggers" />
              <HeroStat n={model.stats.views} label="RBAC views" />
            </dl>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- three segments */}
      <section className="mx-auto max-w-[1240px] px-5 py-12 sm:px-7">
        <SectionHead
          eyebrow="Three segments"
          title="One journey, seen from all three sides"
          desc="The same rows, the same triggers — presented as the student sees them, as the doctor administers them, and as the database actually executes them."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {SEGMENTS.map((seg, i) => {
            const Icon = seg.icon;
            return (
              <Link
                key={seg.href}
                href={seg.href}
                className="card card-lift group flex flex-col p-5 no-underline rise"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${seg.swatch}`}>
                    <Icon size={18} />
                  </span>
                  <div>
                    <p className="eyebrow">{seg.kicker}</p>
                    <p className="text-[15px] font-semibold tracking-tight">{seg.title}</p>
                  </div>
                </div>
                <p className="text-[12.5px] leading-relaxed text-ink-soft">{seg.desc}</p>
                <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                  {seg.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2 text-[11.5px] text-ink-soft">
                      <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-brand" />
                      {pt}
                    </li>
                  ))}
                </ul>
                <span className="mt-3.5 flex items-center gap-1 text-[12px] font-semibold text-brand-deep">
                  {seg.cta}
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>


      <Page>
        {/* -------------------------------------------------------- problem */}
        <section className="py-10">
          <SectionHead
            eyebrow="The problem"
            title="Three systems that never speak to each other"
            desc="Campus health centres run on in-person visits, paper prescriptions and manually stamped certificates — with zero digital link between a student's illness and its academic consequence."
          />
          <div className="grid gap-3 md:grid-cols-3">
            <ProblemCard
              icon={<ScrollText size={17} />}
              title="Paper everywhere"
              body="Students carry stacks of manually stamped certificates between the health centre, faculty offices and the attendance office — with no digital trail at any step."
            />
            <ProblemCard
              icon={<Split size={17} />}
              title="Health → academics is broken"
              body="Nothing connects a medical absence to VIT's 75% attendance rule. Students risk detention despite a valid illness, because the entire process is manual."
            />
            <ProblemCard
              icon={<FileWarning size={17} />}
              title="Fragmented silos"
              body="Consultation records, prescriptions, pharmacy inventory and attendance live in four disconnected systems across four campuses."
            />
          </div>
        </section>

        {/* ------------------------------------------------------- pipeline */}
        <section className="py-10">
          <SectionHead
            eyebrow="How it works"
            title="One pipeline, five stages, zero paper"
            desc="Each stage is a write to the database. Stages 3 and 5 are not application code at all — they are triggers that fire inside SQLite."
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                icon: <CalendarClock size={16} />,
                step: "01",
                title: "Book appointment",
                body: "Student picks campus, specialization and slot. A BEFORE INSERT trigger refuses double-booked slots.",
                tone: "info" as const,
              },
              {
                icon: <Video size={16} />,
                step: "02",
                title: "Video consult",
                body: "Doctor runs the teleconsult and records diagnosis. Sensitive records are sealed at the DB layer.",
                tone: "brand" as const,
              },
              {
                icon: <Pill size={16} />,
                step: "03",
                title: "e-Prescription",
                body: "Each Rx line is cross-referenced against the recursive drug-interaction table and alerts are raised automatically.",
                tone: "orange" as const,
              },
              {
                icon: <Pill size={16} />,
                step: "04",
                title: "Medicine delivery",
                body: "Order lines deduct pharmacy stock through a trigger and roll up the order total; hostel delivery, cash on delivery.",
                tone: "warn" as const,
              },
              {
                icon: <ScrollText size={16} />,
                step: "05",
                title: "Attendance condoned",
                body: "Verifying a certificate fans out one condonation request per enrolled course, routed to that course's faculty.",
                tone: "violet" as const,
              },
            ].map((s) => (
              <Card key={s.step} lift className="flex flex-col p-4">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-sunk text-ink-soft">
                    {s.icon}
                  </span>
                  <span className="mono text-[10.5px] text-ink-mute">{s.step}</span>
                </div>
                <h3 className="text-[13.5px] font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">{s.body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------- DB concepts */}
        <section className="py-10">
          <SectionHead
            eyebrow="Core database concepts"
            title="What this schema actually demonstrates"
            desc="Every concept below is implemented in the running database — not described in a slide. Follow the link on each card to see it live."
          />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <ConceptCard
              href="/er-diagram"
              icon={<Split size={16} />}
              title="EER specialization"
              body="doctor is the superclass; gp_doctor, specialist_doctor and counselor are disjoint, total subclasses sharing the superclass primary key."
              tag="3 subclasses"
            />
            <ConceptCard
              href="/er-diagram"
              icon={<Network size={16} />}
              title="Weak entities"
              body="slot is existence-dependent on doctor with partial key (slot_date, slot_time); prescription_item and order_item follow the same pattern."
              tag="identifying relationships"
            />
            <ConceptCard
              href="/pharmacy"
              icon={<GitBranch size={16} />}
              title="Recursive relationship"
              body="drug_interaction relates drug to itself, giving the database a symmetric cross-reference it can check on every prescription line."
              tag="drug ⇄ drug"
            />
            <ConceptCard
              href="/normalization"
              icon={<Layers3 size={16} />}
              title="1NF → 2NF → 3NF"
              body="Each decomposition is shown against the real relations in this database, with the functional dependency that forced it."
              tag="proofs included"
            />
            <ConceptCard
              href="/triggers"
              icon={<GitBranch size={16} />}
              title="Triggers"
              body="Slot-conflict guard, stock deduction, drug-interaction alerts, the condonation fan-out and the attendance write-back."
              tag={`${model.stats.triggers} triggers`}
            />
            <ConceptCard
              href="/triggers"
              icon={<ShieldCheck size={16} />}
              title="Role-based access control"
              body="Five role views. The pharmacist board exposes no diagnosis; the faculty inbox exposes no clinical notes; sensitive consultations are audited on insert."
              tag={`${model.stats.views} views`}
            />
          </div>
        </section>

        {/* ------------------------------------------------------- live now */}
        <section className="py-10">
          <SectionHead
            eyebrow="Right now, in the database"
            title="Live counts"
            desc="Read directly from vitcare.db on this request."
          />
          <Card className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4">
            <LiveCell n={stats.students} label="students" />
            <LiveCell n={stats.doctors} label="doctors" />
            <LiveCell n={stats.appointments} label="appointments" />
            <LiveCell n={stats.consultations} label="consultations" />
            <LiveCell n={stats.prescriptions} label="prescriptions" />
            <LiveCell n={stats.orders} label="pharmacy orders" />
            <LiveCell n={stats.pendingCondonations} label="pending condonations" />
            <LiveCell n={stats.daysCondoned} label="days condoned" />
          </Card>
        </section>

        {/* ------------------------------------------------------------ SDG */}
        <section className="pb-14 pt-6">
          <div className="grid gap-3 md:grid-cols-3">
            <SdgCard
              n="SDG 3"
              title="Good Health & Well-being"
              body="Equitable, accessible healthcare for every student regardless of campus or background."
            />
            <SdgCard
              n="SDG 4"
              title="Quality Education"
              body="Protecting academic standing through legitimate, automated condonation — keeping students in class."
            />
            <SdgCard
              n="SDG 9"
              title="Industry, Innovation & Infrastructure"
              body="A deployable DBMS aligned with India's Digital Health Mission, scalable to national university networks."
            />
          </div>
          <blockquote className="mt-6 rounded-2xl border border-line bg-brand-wash/60 px-6 py-5 text-[14.5px] italic leading-relaxed text-brand-deep">
            “VIT-Care is not just a DBMS project — it is the foundation of a nationally deployable
            campus digital health ecosystem.”
          </blockquote>
        </section>
      </Page>
    </div>
  );
}

/* ------------------------------------------------------------- fragments */

function HeroStat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <dt className="text-[28px] font-semibold leading-none tracking-tight tabular-nums">{n}</dt>
      <dd className="mt-1.5 text-[11.5px] leading-snug text-ink-mute">{label}</dd>
    </div>
  );
}

function ProblemCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Card lift className="p-5">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-rose-50 text-rose-600">{icon}</span>
      <h3 className="mt-3 text-[14px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{body}</p>
    </Card>
  );
}

function ConceptCard({
  href,
  icon,
  title,
  body,
  tag,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  tag: string;
}) {
  return (
    <Link href={href} className="group">
      <Card lift className="h-full p-5">
        <div className="flex items-center justify-between">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-wash text-brand-deep">
            {icon}
          </span>
          <ArrowRight
            size={14}
            className="text-ink-mute transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
          />
        </div>
        <h3 className="mt-3 text-[14px] font-semibold tracking-tight">{title}</h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{body}</p>
        <p className="mono mt-3 text-[10.5px] text-ink-mute">{tag}</p>
      </Card>
    </Link>
  );
}

function LiveCell({ n, label }: { n: number; label: string }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[24px] font-semibold leading-none tracking-tight tabular-nums">{n}</p>
      <p className="mt-1.5 text-[11px] text-ink-mute">{label}</p>
    </div>
  );
}

function SdgCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <Card className="p-5">
      <p className="eyebrow text-brand">{n}</p>
      <h3 className="mt-1.5 text-[14px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{body}</p>
    </Card>
  );
}
