import { SqlConsole } from "@/components/sql-console";
import { tableList } from "@/lib/queries";
import { introspect } from "@/lib/db/introspect";

export const dynamic = "force-dynamic";

const PRESETS: { label: string; blurb: string; sql: string }[] = [
  {
    label: "EER specialization rollup",
    blurb: "LEFT JOINs the doctor superclass onto all three subclass tables.",
    sql: `SELECT d.doctor_id, d.name, d.doctor_type,
       g.opd_room, g.walk_in_hours,
       s.board_certification, s.tertiary_hospital,
       c.therapy_modality, c.confidentiality_tier
  FROM doctor d
  LEFT JOIN gp_doctor         g ON g.doctor_id = d.doctor_id
  LEFT JOIN specialist_doctor s ON s.doctor_id = d.doctor_id
  LEFT JOIN counselor         c ON c.doctor_id = d.doctor_id
 ORDER BY d.doctor_type, d.name`,
  },
  {
    label: "Recursive drug interactions",
    blurb: "A self-join on drug through the recursive drug_interaction relation.",
    sql: `SELECT d1.name AS drug, d2.name AS interacts_with,
       di.severity, di.description
  FROM drug_interaction di
  JOIN drug d1 ON d1.drug_id = di.drug_id
  JOIN drug d2 ON d2.drug_id = di.interacts_with
 WHERE di.drug_id < di.interacts_with
 ORDER BY CASE di.severity
            WHEN 'SEVERE' THEN 0 WHEN 'MODERATE' THEN 1 ELSE 2 END`,
  },
  {
    label: "Faculty reporting chain (recursive CTE)",
    blurb: "Walks faculty.reports_to — the self-referencing relationship.",
    sql: `WITH RECURSIVE chain(faculty_id, name, designation, level, path) AS (
  SELECT faculty_id, name, designation, 0, name
    FROM faculty WHERE reports_to IS NULL
  UNION ALL
  SELECT f.faculty_id, f.name, f.designation, c.level + 1,
         c.path || ' → ' || f.name
    FROM faculty f JOIN chain c ON f.reports_to = c.faculty_id
)
SELECT level, designation, name, path FROM chain ORDER BY path`,
  },
  {
    label: "Students below the 75% rule",
    blurb: "Aggregate over the attendance ledger with a derived risk band.",
    sql: `SELECT s.reg_no, s.name, e.course_code,
       e.classes_attended || '/' || e.classes_held AS attendance,
       ROUND(100.0 * e.classes_attended / e.classes_held, 1) AS pct,
       e.condoned_days
  FROM enrollment e
  JOIN student s ON s.reg_no = e.reg_no
 WHERE 100.0 * e.classes_attended / e.classes_held < 75
 ORDER BY pct ASC`,
  },
  {
    label: "Certificate → condonation trace",
    blurb: "The full health→academics chain in one join.",
    sql: `SELECT mc.certificate_id, s.name AS student, mc.valid_from, mc.valid_to,
       mc.status AS certificate_status,
       cr.request_id, c.course_code, f.name AS faculty,
       cr.days_requested, cr.status AS request_status
  FROM medical_certificate mc
  JOIN student s ON s.reg_no = mc.reg_no
  LEFT JOIN condonation_request cr ON cr.certificate_id = mc.certificate_id
  LEFT JOIN enrollment e ON e.enrollment_id = cr.enrollment_id
  LEFT JOIN course c ON c.course_code = e.course_code
  LEFT JOIN faculty f ON f.faculty_id = cr.faculty_id
 ORDER BY mc.certificate_id, cr.request_id`,
  },
  {
    label: "Weak entity: prescription lines",
    blurb: "prescription_item keyed by owner + partial key line_no.",
    sql: `SELECT p.prescription_id, pi.line_no, d.name AS drug,
       pi.dosage, pi.frequency, pi.duration_days, pi.quantity,
       ROUND(d.unit_price * pi.quantity, 2) AS line_value
  FROM prescription p
  JOIN prescription_item pi ON pi.prescription_id = p.prescription_id
  JOIN drug d ON d.drug_id = pi.drug_id
 ORDER BY p.prescription_id, pi.line_no`,
  },
  {
    label: "Pharmacy revenue by campus",
    blurb: "GROUP BY with aggregate functions across four campuses.",
    sql: `SELECT cm.name AS campus,
       COUNT(DISTINCT o.order_id) AS orders,
       SUM(oi.quantity)           AS units,
       ROUND(SUM(oi.line_total), 2) AS revenue,
       ROUND(AVG(o.total_amount), 2) AS avg_order
  FROM pharmacy_order o
  JOIN pharmacy   p  ON p.pharmacy_id = o.pharmacy_id
  JOIN campus     cm ON cm.campus_id = p.campus_id
  JOIN order_item oi ON oi.order_id = o.order_id
 GROUP BY cm.campus_id
 ORDER BY revenue DESC`,
  },
  {
    label: "RBAC: what a pharmacist can see",
    blurb: "Query the pharmacist view — note there is no diagnosis column to select.",
    sql: `SELECT * FROM v_pharmacist_fulfilment ORDER BY order_id DESC`,
  },
  {
    label: "Sealed consultations (audit)",
    blurb: "Sensitive records and the audit rows a trigger wrote for them.",
    sql: `SELECT c.consultation_id, d.name AS counselor, c.is_sensitive,
       a.action, a.row_ref, a.at
  FROM consultation c
  JOIN doctor d ON d.doctor_id = c.doctor_id
  LEFT JOIN access_audit a
         ON a.row_ref = 'consultation_id=' || c.consultation_id
 WHERE c.is_sensitive = 1`,
  },
  {
    label: "Every trigger that has fired",
    blurb: "The database's own event log, grouped.",
    sql: `SELECT trigger_name, table_name, event, COUNT(*) AS fires,
       MAX(at) AS last_fired
  FROM trigger_log
 GROUP BY trigger_name
 ORDER BY fires DESC`,
  },
];

export default function SqlPage() {
  const tables = tableList();
  const model = introspect();
  return (
    <SqlConsole
      presets={PRESETS}
      tables={tables}
      views={model.views.map((v) => v.name)}
      columns={Object.fromEntries(model.tables.map((t) => [t.name, t.columns.map((c) => c.name)]))}
    />
  );
}
