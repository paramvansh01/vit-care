import Link from "next/link";
import {
  ArrowRight,
  Database,
  GitBranch,
  Layers3,
  Network,
  ShieldCheck,
  Table2,
  Terminal,
  Workflow,
} from "lucide-react";
import { Card, Chip, Empty, Page, SectionHead, SqlBlock, Stat, Table, Td, Th } from "@/components/ui";
import { TriggerFeed } from "@/components/trigger-feed";
import { headlineStats, tableList, triggerFeed, triggerTotals } from "@/lib/queries";
import { all, scalar } from "@/lib/db";

export const dynamic = "force-dynamic";

/** The seventeen triggers, grouped by the journey step each one guards. */
const TRIGGERS = [
  {
    step: "Booking",
    tone: "info" as const,
    rows: [
      ["trg_slot_conflict_guard", "BEFORE INSERT · appointment", "Aborts a second booking of the same doctor slot."],
      ["trg_slot_mark_booked", "AFTER INSERT · appointment", "Flips the weak-entity slot to BOOKED."],
      ["trg_slot_release", "AFTER UPDATE · appointment", "Returns the slot to the pool on cancellation."],
      ["trg_notify_appointment", "AFTER INSERT · appointment", "Writes the student's confirmation notice."],
    ],
  },
  {
    step: "Prescribing",
    tone: "violet" as const,
    rows: [
      ["trg_drug_interaction_alert", "AFTER INSERT · prescription_item", "Cross-references the recursive drug_interaction relation."],
      ["trg_prescription_to_cart", "AFTER INSERT · prescription_item", "Resolves the owning student and fills their cart."],
      ["trg_notify_prescription", "AFTER INSERT · prescription_item", "Keeps exactly one accurate notice per prescription."],
      ["trg_cart_clear_on_dispense", "AFTER UPDATE · prescription", "Retires dispensed lines from the cart."],
    ],
  },
  {
    step: "Pharmacy",
    tone: "orange" as const,
    rows: [
      ["trg_stock_availability_guard", "BEFORE INSERT · order_item", "Refuses a line that exceeds on-hand stock."],
      ["trg_stock_deduct", "AFTER INSERT · order_item", "Deducts inventory and rolls the order total up."],
      ["trg_low_stock_alert", "AFTER UPDATE · inventory", "Raises a reorder alert at the threshold."],
      ["trg_notify_order_status", "AFTER UPDATE · pharmacy_order", "Tells the student where the delivery is."],
      ["trg_prescription_dispensed", "AFTER UPDATE · pharmacy_order", "Marks the prescription DISPENSED on delivery."],
    ],
  },
  {
    step: "Medical leave",
    tone: "brand" as const,
    rows: [
      ["trg_leave_document_fanout", "AFTER INSERT · leave_document", "Delivers the letter to student, proctor and HOD."],
      ["trg_auto_condonation_on_insert", "AFTER INSERT · medical_certificate", "Fans condonation out across every enrolment."],
      ["trg_auto_condonation_on_verify", "AFTER UPDATE · medical_certificate", "Same fan-out when a draft is later verified."],
      ["trg_condonation_attendance_writeback", "AFTER UPDATE · condonation_request", "Credits attendance on faculty approval."],
    ],
  },
] as const;

const EXPLORE = [
  {
    href: "/er-diagram",
    icon: Network,
    title: "ER Diagram",
    desc: "Introspected live from sqlite_master and PRAGMA — drag, focus and trace every relationship.",
    badge: "live",
  },
  {
    href: "/schema",
    icon: Table2,
    title: "Schema Explorer",
    desc: "Every table, key, index and row in the 29-relation schema.",
  },
  {
    href: "/triggers",
    icon: GitBranch,
    title: "Triggers & Views",
    desc: "The procedural logic and the role-based access views, with their source.",
  },
  {
    href: "/normalization",
    icon: Layers3,
    title: "Normalization",
    desc: "1NF → 2NF → 3NF proven on the real relations, not toy examples.",
  },
  {
    href: "/sql",
    icon: Terminal,
    title: "SQL Console",
    desc: "Run read-only queries against the live database and read the query plan.",
  },
  {
    href: "/lab",
    icon: Workflow,
    title: "Trigger Lab",
    desc: "Fire each trigger deliberately and watch the database react.",
  },
];

export default function DatabasePage() {
  const stats = headlineStats();
  const tables = tableList();
  const totals = triggerTotals();
  const feed = triggerFeed(24);

  const triggerCount = scalar<number>(
    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger'",
  );
  const viewCount = scalar<number>("SELECT COUNT(*) FROM sqlite_master WHERE type = 'view'");
  const tableCount = scalar<number>(
    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  const indexCount = scalar<number>(
    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex%'",
  );
  const fires = scalar<number>("SELECT COUNT(*) FROM trigger_log");

  // What the care loop has actually produced, straight from the relations.
  const loop = {
    cart: scalar<number>("SELECT COUNT(*) FROM cart_item"),
    notices: scalar<number>("SELECT COUNT(*) FROM notification"),
    letters: scalar<number>("SELECT COUNT(*) FROM leave_document"),
    deliveries: scalar<number>("SELECT COUNT(*) FROM document_recipient"),
  };

  const register = all<{
    ref_no: string;
    student_name: string;
    days_granted: number;
    proctor_name: string | null;
    hod_name: string | null;
    recipients: number;
  }>("SELECT * FROM v_medical_leave_register ORDER BY document_id DESC LIMIT 6");

  return (
    <Page wide>
      <div className="space-y-6">
        {/* ------------------------------------------------------------ hero */}
        <Card className="grain overflow-hidden">
          <div className="px-6 py-7">
            <p className="eyebrow mb-1.5">Segment 3 · How the database works</p>
            <h2 className="max-w-3xl text-[25px] font-semibold leading-tight tracking-tight">
              The two segments you just used are thin. This is where the work happens.
            </h2>
            <p className="mt-2.5 max-w-3xl text-[13.5px] leading-relaxed text-ink-soft">
              Booking a slot, pushing a prescription into a cart, notifying a student, generating a
              leave letter and copying it to a proctor and an HOD — none of that is application code.
              Each one is a SQL trigger compiled into the schema, so the rule holds however the row
              arrives: through the UI, through the console, or through a raw{" "}
              <span className="mono">INSERT</span>.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Stat label="Relations" value={tableCount} tone="info" icon={<Table2 size={14} />} />
              <Stat label="Triggers" value={triggerCount} tone="brand" icon={<GitBranch size={14} />} />
              <Stat label="RBAC views" value={viewCount} tone="violet" icon={<ShieldCheck size={14} />} />
              <Stat label="Indexes" value={indexCount} tone="neutral" icon={<Database size={14} />} />
              <Stat
                label="Trigger fires logged"
                value={fires}
                tone="orange"
                hint="every one recorded in trigger_log"
              />
            </div>
          </div>
        </Card>

        {/* ------------------------------------------------- the care loop */}
        <Card className="p-6">
          <SectionHead
            eyebrow="The care loop"
            title="One consultation, five tables, zero application logic"
            desc="This is the chain the other two segments drive. Follow it from the doctor's click to the proctor's inbox."
          />

          <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
            <ol className="space-y-2.5">
              {[
                {
                  n: 1,
                  t: "The doctor writes a prescription line",
                  d: "One INSERT into prescription_item.",
                },
                {
                  n: 2,
                  t: "The database finds the patient",
                  d: "trg_prescription_to_cart walks prescription → consultation → appointment to resolve reg_no, then upserts the cart.",
                },
                {
                  n: 3,
                  t: "The student is notified",
                  d: "trg_notify_prescription replaces the unread notice so the count can never drift from the cart.",
                },
                {
                  n: 4,
                  t: "Leave is recommended",
                  d: "One INSERT into leave_document; trg_leave_document_fanout writes a document_recipient row for the student, the proctor and the HOD.",
                },
                {
                  n: 5,
                  t: "Attendance is repaired",
                  d: "The VERIFIED certificate makes trg_auto_condonation fan a request out to every enrolled course, and approval credits attendance.",
                },
              ].map((s) => (
                <li key={s.n} className="flex gap-3 rounded-xl border border-line p-3.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-wash text-[11px] font-semibold text-brand-deep">
                    {s.n}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold">{s.t}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-soft">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="space-y-3">
              <SqlBlock
                code={`-- the whole fan-out, in the schema rather than the app
CREATE TRIGGER trg_leave_document_fanout
AFTER INSERT ON leave_document
FOR EACH ROW
BEGIN
  INSERT OR IGNORE INTO document_recipient
    (document_id, recipient_role, recipient_name, recipient_email)
  SELECT NEW.document_id, 'PROCTOR', s.proctor_name, s.proctor_email
    FROM student s
   WHERE s.reg_no = NEW.reg_no
     AND s.proctor_name IS NOT NULL;
  -- … the same for STUDENT and HOD, then the notification
END;`}
              />
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Cart lines held" value={loop.cart} tone="orange" />
                <Stat label="Notifications raised" value={loop.notices} tone="info" />
                <Stat label="Leave letters" value={loop.letters} tone="brand" />
                <Stat label="Letter deliveries" value={loop.deliveries} tone="violet" />
              </div>
            </div>
          </div>
        </Card>

        {/* -------------------------------------------------- trigger catalogue */}
        <Card className="p-6">
          <SectionHead
            eyebrow="Catalogue"
            title={`All ${triggerCount} triggers, by the step they guard`}
            desc="Fire counts come from trigger_log, so they reflect what this running database has actually done."
          />
          <div className="space-y-5">
            {TRIGGERS.map((group) => (
              <div key={group.step}>
                <div className="mb-2 flex items-center gap-2">
                  <Chip tone={group.tone}>{group.step}</Chip>
                  <span className="h-px flex-1 bg-[var(--line)]" />
                </div>
                <Table>
                  <thead>
                    <tr>
                      <Th>Trigger</Th>
                      <Th>Event</Th>
                      <Th>What it guarantees</Th>
                      <Th className="text-right">Fires</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map(([name, event, what]) => (
                      <tr key={name} className="hover:bg-sunk/60">
                        <Td className="mono whitespace-nowrap text-[11.5px] text-brand-deep">{name}</Td>
                        <Td className="mono whitespace-nowrap text-[11px] text-ink-mute">{event}</Td>
                        <Td className="text-ink-soft">{what}</Td>
                        <Td className="mono text-right">
                          {totals.find((t) => t.trigger_name === name)?.fires ?? 0}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ))}
          </div>
        </Card>

        {/* ---------------------------------------------------- live + register */}
        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          <Card className="p-6">
            <SectionHead
              eyebrow="Live"
              title="trigger_log, streaming"
              desc="Drive the student or doctor segment in another tab and watch rows land here."
            />
            <TriggerFeed initial={feed} />
          </Card>

          <Card className="p-6">
            <SectionHead
              eyebrow="v_medical_leave_register"
              title="The leave register"
              desc="A view joining the letter, the clinician who signed it and the people it reached."
            />
            {!register.length ? (
              <Empty>
                No leave has been granted yet. Issue one from the doctor console and this view fills in.
              </Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Ref. no</Th>
                    <Th>Student</Th>
                    <Th className="text-right">Days</Th>
                    <Th>Copied to</Th>
                  </tr>
                </thead>
                <tbody>
                  {register.map((r) => (
                    <tr key={r.ref_no} className="hover:bg-sunk/60">
                      <Td className="mono whitespace-nowrap text-[11px]">{r.ref_no}</Td>
                      <Td>{r.student_name}</Td>
                      <Td className="mono text-right">{r.days_granted}</Td>
                      <Td className="text-[11.5px] text-ink-soft">
                        {[r.proctor_name, r.hod_name].filter(Boolean).join(" · ") || "—"}
                        <span className="ml-1.5 text-ink-mute">({r.recipients})</span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Students" value={stats.students} />
              <Stat label="Appointments" value={stats.appointments} />
              <Stat label="Prescriptions" value={stats.prescriptions} />
              <Stat label="Days condoned" value={stats.daysCondoned} tone="brand" />
            </div>
          </Card>
        </div>

        {/* ------------------------------------------------------------ explore */}
        <Card className="p-6">
          <SectionHead
            eyebrow="Go deeper"
            title="Explore the schema itself"
            desc={`All ${tables.length} relations and views are introspected live — nothing on these pages is hand-drawn.`}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EXPLORE.map((e) => {
              const Icon = e.icon;
              return (
                <Link
                  key={e.href}
                  href={e.href}
                  className="card card-lift group flex flex-col p-4 no-underline"
                >
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-wash text-brand-deep">
                      <Icon size={15} />
                    </span>
                    <span className="text-[13px] font-semibold">{e.title}</span>
                    {e.badge && (
                      <span className="ml-auto flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-brand">
                        <span className="live-dot h-1.5 w-1.5 rounded-full bg-brand" />
                        {e.badge}
                      </span>
                    )}
                  </div>
                  <p className="flex-1 text-[11.5px] leading-relaxed text-ink-soft">{e.desc}</p>
                  <span className="mt-2.5 flex items-center gap-1 text-[11.5px] font-medium text-brand-deep">
                    Open
                    <ArrowRight
                      size={12}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </Page>
  );
}
