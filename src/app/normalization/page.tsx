import { ArrowDown, CheckCircle2, XCircle } from "lucide-react";
import { Card, Chip, Page, SectionHead, SqlBlock, Table, Td, Th } from "@/components/ui";

export const dynamic = "force-dynamic";

/* ========================================================================= */

const UNNORMALIZED = `student_visit (
  reg_no, student_name, hostel_block, room_no,
  campus_code, campus_city,
  doctor_name, doctor_type, doctor_specializations,   -- "General Medicine, ENT"
  slot_date, slot_time,
  symptoms,                                           -- "Fever, Headache"
  diagnosis,
  drugs_prescribed,                                   -- "Dolo 650 x9, Cetirizine x3"
  certificate_from, certificate_to,
  courses_affected                                    -- "CSE2003, CSE2001, MAT2002"
)`;

export default function NormalizationPage() {
  return (
    <Page>
      <section className="py-7">
        <SectionHead
          eyebrow="Objective O1"
          title="1NF → 2NF → 3NF, on this schema"
          desc="The starting point is the single flat record a paper health-centre form actually captures. Each normal form below removes one specific anomaly, and the resulting relations are the ones running in this database."
        />

        {/* ------------------------------------------------------- UNF */}
        <Card className="mb-3 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line bg-rose-50/50 px-4 py-2.5">
            <XCircle size={14} className="text-rose-600" />
            <p className="text-[13px] font-semibold tracking-tight">Unnormalized form (UNF)</p>
            <Chip tone="danger" className="ml-auto">
              repeating groups
            </Chip>
          </div>
          <div className="p-4">
            <SqlBlock code={UNNORMALIZED} />
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
              One row per visit, with multi-valued attributes stuffed into single columns. You cannot
              ask &ldquo;which students had a fever&rdquo; without string matching, and deleting a
              student&rsquo;s only visit destroys the record that their hostel room ever existed.
            </p>
          </div>
        </Card>

        <Arrow label="Remove repeating groups · atomic values only" />

        {/* ------------------------------------------------------- 1NF */}
        <Stage
          nf="1NF"
          tone="warn"
          title="First Normal Form"
          rule="Every attribute holds a single atomic value; there are no repeating groups; every row is uniquely identifiable."
          violations={[
            {
              bad: "symptoms = 'Fever, Headache'",
              fix: "appointment_symptom(appointment_id, symptom_id, severity, duration_days)",
              note: "A multi-valued attribute becomes its own relation — and gains per-symptom severity, which the flat form could never hold.",
            },
            {
              bad: "doctor_specializations = 'General Medicine, ENT'",
              fix: "doctor_specialization(doctor_id, spec_id, certified_on, is_primary)",
              note: "The M:N between doctors and specializations, with the certification date as a relationship attribute.",
            },
            {
              bad: "drugs_prescribed = 'Dolo 650 x9, Cetirizine x3'",
              fix: "prescription_item(prescription_id, line_no, drug_id, dosage, frequency, duration_days, quantity)",
              note: "Each prescribed drug becomes one line — a weak entity identified by its parent prescription plus the partial key line_no.",
            },
            {
              bad: "courses_affected = 'CSE2003, CSE2001, MAT2002'",
              fix: "condonation_request(certificate_id, enrollment_id, faculty_id, days_requested, …)",
              note: "One request row per affected enrollment, which is exactly what the auto-condonation trigger generates.",
            },
          ]}
          result={`appointment(appointment_id, reg_no, doctor_id, slot_date, slot_time, ...)
appointment_symptom(appointment_id, symptom_id, severity, duration_days)
doctor_specialization(doctor_id, spec_id, certified_on, is_primary)
prescription_item(prescription_id, line_no, drug_id, ...)`}
        />

        <Arrow label="Remove partial dependencies on a composite key" />

        {/* ------------------------------------------------------- 2NF */}
        <Stage
          nf="2NF"
          tone="info"
          title="Second Normal Form"
          rule="In 1NF, and every non-key attribute is fully functionally dependent on the whole primary key — no attribute depends on only part of a composite key."
          violations={[
            {
              bad: "prescription_item(prescription_id, line_no, drug_id, drug_name, unit_price, quantity)",
              fix: "prescription_item(prescription_id, line_no, drug_id, quantity)  +  drug(drug_id, name, unit_price, …)",
              note: "FD: drug_id → drug_name, unit_price. Those attributes depend on drug_id alone, not on the full key (prescription_id, line_no). Updating a drug's price would otherwise mean rewriting every prescription line that ever used it.",
            },
            {
              bad: "inventory(pharmacy_id, drug_id, qty_on_hand, pharmacy_name, pharmacy_location)",
              fix: "inventory(pharmacy_id, drug_id, batch_no, qty_on_hand, reorder_level, expiry_date)  +  pharmacy(pharmacy_id, name, location, …)",
              note: "FD: pharmacy_id → pharmacy_name, location. A partial dependency on half of the composite key (pharmacy_id, drug_id).",
            },
            {
              bad: "appointment_symptom(appointment_id, symptom_id, severity, symptom_name, body_system)",
              fix: "appointment_symptom(appointment_id, symptom_id, severity, duration_days)  +  symptom(symptom_id, name, body_system, default_triage)",
              note: "FD: symptom_id → name, body_system. Only severity and duration genuinely depend on the pair.",
            },
          ]}
          result={`prescription_item(prescription_id, line_no, drug_id, dosage, frequency, duration_days, quantity)
drug(drug_id, name, generic_name, form, strength, schedule_class, unit_price, requires_rx)
inventory(pharmacy_id, drug_id, batch_no, qty_on_hand, reorder_level, expiry_date)
pharmacy(pharmacy_id, campus_id, name, location, phone, opens_at, closes_at)`}
        />

        <Arrow label="Remove transitive dependencies on non-key attributes" />

        {/* ------------------------------------------------------- 3NF */}
        <Stage
          nf="3NF"
          tone="ok"
          title="Third Normal Form"
          rule="In 2NF, and no non-key attribute is transitively dependent on the primary key — every non-key attribute depends on the key, the whole key, and nothing but the key."
          violations={[
            {
              bad: "student(reg_no, name, dept_id, dept_name, campus_id, campus_name, campus_city)",
              fix: "student(reg_no, dept_id, campus_id, …)  +  department(dept_id, campus_id, code, name)  +  campus(campus_id, code, name, city, state)",
              note: "Transitive chain: reg_no → dept_id → dept_name, and reg_no → campus_id → campus_city. Renaming a campus would otherwise require touching every student row on it.",
            },
            {
              bad: "pharmacy_order(order_id, reg_no, hostel_block, room_no, contact_phone, …)",
              fix: "pharmacy_order(order_id, reg_no, pharmacy_id, address_id, …)  +  delivery_address(address_id, reg_no, hostel_block, room_no, contact_phone, is_default)",
              note: "Transitive: order_id → reg_no → hostel_block. Separating the address also lets a student keep several delivery addresses.",
            },
            {
              bad: "condonation_request(request_id, certificate_id, valid_from, valid_to, reg_no, course_code, faculty_name)",
              fix: "condonation_request(request_id, certificate_id, enrollment_id, faculty_id, days_requested, status)",
              note: "Transitive: request_id → certificate_id → valid_from/valid_to, and request_id → enrollment_id → course_code. The request stores only keys and its own decision state.",
            },
            {
              bad: "consultation(consultation_id, appointment_id, doctor_id, doctor_name, doctor_type, diagnosis)",
              fix: "consultation(consultation_id, appointment_id, doctor_id, diagnosis, …)  +  doctor(doctor_id, name, doctor_type, …)",
              note: "Transitive: consultation_id → doctor_id → doctor_name, doctor_type.",
            },
          ]}
          result={`campus(campus_id, code, name, city, state, established)
department(dept_id, campus_id, code, name)
student(reg_no, dept_id, campus_id, name, email, phone, dob, gender, …)
delivery_address(address_id, reg_no, campus_id, label, hostel_block, room_no, contact_phone, is_default)
condonation_request(request_id, certificate_id, enrollment_id, faculty_id, days_requested, status, …)
consultation(consultation_id, appointment_id, doctor_id, started_at, diagnosis, is_sensitive, …)`}
        />

        {/* --------------------------------------------------- summary */}
        <Card className="mt-6 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line bg-emerald-50/50 px-4 py-2.5">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <p className="text-[13px] font-semibold tracking-tight">
              What each normal form bought us
            </p>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Form</Th>
                <Th>Anomaly removed</Th>
                <Th>Concrete consequence in VIT-Care</Th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-sunk/60">
                <Td>
                  <Chip tone="warn">1NF</Chip>
                </Td>
                <Td className="text-ink-soft">Repeating groups, non-atomic values</Td>
                <Td className="text-ink-soft">
                  &ldquo;Which students presented with fever this week?&rdquo; becomes a join, not a
                  substring scan. Per-symptom severity becomes representable at all.
                </Td>
              </tr>
              <tr className="hover:bg-sunk/60">
                <Td>
                  <Chip tone="info">2NF</Chip>
                </Td>
                <Td className="text-ink-soft">Update anomaly from partial dependency</Td>
                <Td className="text-ink-soft">
                  A drug price change is one UPDATE on <span className="mono text-[11px]">drug</span>,
                  not a rewrite of every historical prescription line.
                </Td>
              </tr>
              <tr className="hover:bg-sunk/60">
                <Td>
                  <Chip tone="ok">3NF</Chip>
                </Td>
                <Td className="text-ink-soft">
                  Insertion &amp; deletion anomalies from transitive dependency
                </Td>
                <Td className="text-ink-soft">
                  A new campus can be inserted before it has any students; deleting the last student
                  in a department does not erase the department.
                </Td>
              </tr>
            </tbody>
          </Table>
        </Card>

        <Card className="mt-4 p-4">
          <p className="eyebrow mb-2">A note on BCNF</p>
          <p className="max-w-3xl text-[12.5px] leading-relaxed text-ink-soft">
            Every relation in this schema is additionally in BCNF: in each one, the only determinants
            are candidate keys. The associative relations (
            <span className="mono text-[11px]">doctor_specialization</span>,{" "}
            <span className="mono text-[11px]">appointment_symptom</span>,{" "}
            <span className="mono text-[11px]">inventory</span>,{" "}
            <span className="mono text-[11px]">drug_interaction</span>) carry only attributes that
            depend on their full composite key, and the weak entities (
            <span className="mono text-[11px]">slot</span>,{" "}
            <span className="mono text-[11px]">prescription_item</span>,{" "}
            <span className="mono text-[11px]">order_item</span>) are keyed by owner + partial key
            with no other determinant present.
          </p>
        </Card>
      </section>
    </Page>
  );
}

/* ------------------------------------------------------------- fragments */

function Arrow({ label }: { label: string }) {
  return (
    <div className="my-2 flex items-center gap-2.5 pl-4">
      <ArrowDown size={14} className="shrink-0 text-ink-mute" />
      <span className="text-[11.5px] text-ink-mute">{label}</span>
    </div>
  );
}

function Stage({
  nf,
  tone,
  title,
  rule,
  violations,
  result,
}: {
  nf: string;
  tone: "warn" | "info" | "ok";
  title: string;
  rule: string;
  violations: { bad: string; fix: string; note: string }[];
  result: string;
}) {
  return (
    <Card className="mb-3 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <Chip tone={tone}>{nf}</Chip>
        <p className="text-[13px] font-semibold tracking-tight">{title}</p>
      </div>
      <div className="p-4">
        <p className="mb-4 max-w-3xl rounded-lg border border-line bg-sunk/60 px-3 py-2 text-[12.5px] leading-relaxed text-ink-soft">
          <strong className="font-semibold text-ink">Rule.</strong> {rule}
        </p>

        <div className="space-y-3">
          {violations.map((v, i) => (
            <div key={i} className="rounded-lg border border-line">
              <div className="flex items-start gap-2 border-b border-line bg-rose-50/40 px-3 py-2">
                <XCircle size={12} className="mt-0.5 shrink-0 text-rose-500" />
                <code className="mono min-w-0 flex-1 text-[11px] leading-relaxed text-rose-900">
                  {v.bad}
                </code>
              </div>
              <div className="flex items-start gap-2 px-3 py-2">
                <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-600" />
                <code className="mono min-w-0 flex-1 text-[11px] leading-relaxed text-emerald-900">
                  {v.fix}
                </code>
              </div>
              <p className="border-t border-line bg-sunk/40 px-3 py-2 text-[11.5px] leading-relaxed text-ink-soft">
                {v.note}
              </p>
            </div>
          ))}
        </div>

        <p className="eyebrow mb-1.5 mt-4">Relations after this step</p>
        <SqlBlock code={result} />
      </div>
    </Card>
  );
}
