import { GitBranch, ShieldCheck, Zap } from "lucide-react";
import { Card, Chip, Page, SectionHead, Table, Td, Th } from "@/components/ui";
import { introspect } from "@/lib/db/introspect";
import { triggerTotals } from "@/lib/queries";
import { Disclosure } from "@/components/disclosure";

export const dynamic = "force-dynamic";

/** What each trigger is for, in the language of the project objectives. */
const PURPOSE: Record<string, { title: string; why: string; objective?: string }> = {
  trg_slot_conflict_guard: {
    title: "Slot-conflict guard",
    why: "Refuses an appointment whose (doctor, date, time) is already taken. The guarantee lives in the database, so it holds no matter which client writes.",
    objective: "O3",
  },
  trg_slot_mark_booked: {
    title: "Slot state machine",
    why: "Flips the weak entity `slot` to BOOKED the instant an appointment references it — the two can never disagree.",
    objective: "O3",
  },
  trg_slot_release: {
    title: "Slot release on cancellation",
    why: "Returns the slot to the open pool when an appointment is cancelled.",
    objective: "O3",
  },
  trg_drug_interaction_alert: {
    title: "Drug-interaction safety alert",
    why: "On every new prescription line, cross-references the recursive drug_interaction relation against the other drugs already on that prescription and raises a clinical_alert.",
    objective: "O3",
  },
  trg_stock_availability_guard: {
    title: "Stock availability guard",
    why: "Aborts an order line that exceeds on-hand inventory, so stock can never go negative.",
    objective: "O3",
  },
  trg_stock_deduct: {
    title: "Automatic stock deduction",
    why: "Deducts dispensed quantity from pharmacy inventory and rolls the line total up onto the order — no application code computes the total.",
    objective: "O3",
  },
  trg_low_stock_alert: {
    title: "Low-stock reorder alert",
    why: "Raises a stock_alert the moment a deduction takes a drug to or below its reorder level.",
    objective: "O3",
  },
  trg_auto_condonation_on_verify: {
    title: "Auto-condonation fan-out",
    why: "The core contribution: verifying a medical certificate generates one condonation request per enrolled course, each routed to that course's faculty, with the day count derived from the certificate's validity period.",
    objective: "O4",
  },
  trg_auto_condonation_on_insert: {
    title: "Auto-condonation on issue",
    why: "Same fan-out for certificates created already in a VERIFIED state.",
    objective: "O4",
  },
  trg_condonation_attendance_writeback: {
    title: "Attendance write-back",
    why: "A faculty approval credits the student's attendance ledger and stamps the decision time — closing the health → academics loop.",
    objective: "O4",
  },
  trg_condonation_reject_stamp: {
    title: "Rejection timestamp",
    why: "Stamps decided_at when a request is rejected, keeping the audit trail complete.",
    objective: "O4",
  },
  trg_sensitive_consultation_audit: {
    title: "Confidentiality audit",
    why: "Every consultation flagged sensitive (mental or sexual health) writes an access_audit row on insert — confidentiality enforced at the DB layer, not the UI.",
  },
  trg_prescription_dispensed: {
    title: "Prescription lifecycle",
    why: "Marks a prescription DISPENSED once its delivery order completes.",
  },
};

const VIEW_PURPOSE: Record<string, { role: string; hides: string; tone: "brand" | "info" | "warn" | "violet" | "neutral" }> = {
  v_student_health_record: {
    role: "STUDENT",
    hides: "Scoped to the student's own appointments and consultations.",
    tone: "brand",
  },
  v_doctor_queue: {
    role: "DOCTOR",
    hides: "Full clinical context for the doctor's own queue, ordered by triage.",
    tone: "info",
  },
  v_pharmacist_fulfilment: {
    role: "PHARMACIST",
    hides: "Delivery address and line count only — no diagnosis, no clinical notes.",
    tone: "warn",
  },
  v_faculty_condonation_inbox: {
    role: "FACULTY",
    hides: "Certificate validity and reason only — the diagnosis is never projected.",
    tone: "violet",
  },
  v_admin_campus_overview: {
    role: "ADMIN",
    hides: "Aggregate counts per campus; no row-level clinical data at all.",
    tone: "neutral",
  },
  v_attendance_risk: {
    role: "ADMIN / FACULTY",
    hides: "Derived attendance bands against VIT's 75% rule.",
    tone: "neutral",
  },
};

export default function TriggersPage() {
  const model = introspect();
  const fires = new Map(triggerTotals().map((t) => [t.trigger_name, t.fires]));

  const byObjective = model.triggers.reduce<Record<string, typeof model.triggers>>((acc, t) => {
    const key = PURPOSE[t.name]?.objective ?? "Support";
    acc[key] = [...(acc[key] ?? []), t];
    return acc;
  }, {});

  return (
    <Page>
      <section className="py-6">
        <SectionHead
          eyebrow="Procedural logic"
          title={`${model.triggers.length} triggers running inside the database`}
          desc="These are not application-layer checks. They are compiled into the schema, so every write — from this UI, from the SQL console, or from any future client — passes through them."
          right={
            <div className="flex gap-2">
              <Chip tone="ok">{[...fires.values()].reduce((a, b) => a + b, 0)} total fires</Chip>
            </div>
          }
        />

        {Object.entries(byObjective)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([objective, triggers]) => (
            <div key={objective} className="mb-6">
              <p className="eyebrow mb-2 flex items-center gap-2">
                <Zap size={11} className="text-brand" />
                {objective === "O3"
                  ? "Objective O3 — trigger automation"
                  : objective === "O4"
                    ? "Objective O4 — auto-condonation pipeline"
                    : "Supporting integrity & audit"}
              </p>
              <div className="space-y-2">
                {triggers.map((t) => {
                  const meta = PURPOSE[t.name];
                  const count = fires.get(t.name) ?? 0;
                  return (
                    <Card key={t.name} className="overflow-hidden">
                      <Disclosure
                        summary={
                          <div className="flex w-full flex-wrap items-center gap-2.5 px-4 py-3 text-left">
                            <GitBranch size={14} className="shrink-0 text-violet-600" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13.5px] font-semibold tracking-tight">
                                {meta?.title ?? t.name}
                              </p>
                              <p className="mono text-[10.5px] text-ink-mute">
                                {t.name} · on {t.table}
                              </p>
                            </div>
                            {count > 0 ? (
                              <Chip tone="ok">{count} fired</Chip>
                            ) : (
                              <Chip tone="neutral">idle</Chip>
                            )}
                          </div>
                        }
                      >
                        <div className="border-t border-line px-4 py-3">
                          {meta && (
                            <p className="mb-3 max-w-3xl text-[12.5px] leading-relaxed text-ink-soft">
                              {meta.why}
                            </p>
                          )}
                          <pre className="mono overflow-x-auto rounded-lg border border-line bg-[#fcfcfb] p-3 text-[11px] leading-[1.7] text-ink-soft">
                            {t.ddl}
                          </pre>
                        </div>
                      </Disclosure>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
      </section>

      {/* -------------------------------------------------------- views */}
      <section className="pb-12 pt-4">
        <SectionHead
          eyebrow="Role-based access control"
          title={`${model.views.length} views, one per role boundary`}
          desc="Confidentiality is modelled as projection. A pharmacist querying the fulfilment view physically cannot see a diagnosis, because the column is not in the view."
        />

        <Card className="mb-4 overflow-hidden">
          <Table>
            <thead>
              <tr>
                <Th>View</Th>
                <Th>Role</Th>
                <Th>What it deliberately exposes / withholds</Th>
              </tr>
            </thead>
            <tbody>
              {model.views.map((v) => {
                const meta = VIEW_PURPOSE[v.name];
                return (
                  <tr key={v.name} className="hover:bg-sunk/60">
                    <Td className="mono font-medium">{v.name}</Td>
                    <Td>
                      <Chip tone={meta?.tone ?? "neutral"}>
                        <ShieldCheck size={10} />
                        {meta?.role ?? "—"}
                      </Chip>
                    </Td>
                    <Td className="text-ink-soft">{meta?.hides ?? "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>

        <div className="space-y-2">
          {model.views.map((v) => (
            <Card key={v.name} className="overflow-hidden">
              <Disclosure
                summary={
                  <div className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left">
                    <ShieldCheck size={13} className="shrink-0 text-brand" />
                    <span className="mono text-[12.5px] font-medium">{v.name}</span>
                    <span className="ml-auto text-[10.5px] text-ink-mute">CREATE VIEW</span>
                  </div>
                }
              >
                <pre className="mono overflow-x-auto border-t border-line bg-[#fcfcfb] p-3.5 text-[11px] leading-[1.7] text-ink-soft">
                  {v.ddl}
                </pre>
              </Disclosure>
            </Card>
          ))}
        </div>
      </section>
    </Page>
  );
}
