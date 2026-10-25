import { all, one, scalar } from "./db";

/* ================================================================ dashboard */

export type CampusRollup = {
  campus_id: number;
  campus_code: string;
  campus_name: string;
  students: number;
  doctors: number;
  pharmacies: number;
  appointments: number;
  pending_condonations: number;
};

export function campusRollup() {
  return all<CampusRollup>("SELECT * FROM v_admin_campus_overview ORDER BY campus_id");
}

export function headlineStats() {
  return {
    students: scalar("SELECT COUNT(*) FROM student"),
    doctors: scalar("SELECT COUNT(*) FROM doctor"),
    appointments: scalar("SELECT COUNT(*) FROM appointment"),
    consultations: scalar("SELECT COUNT(*) FROM consultation"),
    prescriptions: scalar("SELECT COUNT(*) FROM prescription"),
    orders: scalar("SELECT COUNT(*) FROM pharmacy_order"),
    certificates: scalar("SELECT COUNT(*) FROM medical_certificate"),
    pendingCondonations: scalar("SELECT COUNT(*) FROM condonation_request WHERE status = 'PENDING'"),
    approvedCondonations: scalar("SELECT COUNT(*) FROM condonation_request WHERE status = 'APPROVED'"),
    daysCondoned: scalar("SELECT COALESCE(SUM(condoned_days), 0) FROM enrollment"),
    openAlerts: scalar("SELECT COUNT(*) FROM clinical_alert WHERE acknowledged = 0"),
    stockAlerts: scalar("SELECT COUNT(*) FROM stock_alert"),
    revenue: scalar<number>("SELECT COALESCE(SUM(total_amount), 0) FROM pharmacy_order WHERE status <> 'CANCELLED'"),
    atRisk: scalar(
      "SELECT COUNT(*) FROM v_attendance_risk WHERE risk_band = 'AT_RISK'",
    ),
  };
}

export type TriggerEvent = {
  log_id: number;
  trigger_name: string;
  table_name: string;
  event: string;
  message: string;
  at: string;
};

export function triggerFeed(limit = 40) {
  return all<TriggerEvent>(
    "SELECT * FROM trigger_log ORDER BY log_id DESC LIMIT ?",
    limit,
  );
}

export function triggerTotals() {
  return all<{ trigger_name: string; fires: number }>(
    "SELECT trigger_name, COUNT(*) AS fires FROM trigger_log GROUP BY trigger_name ORDER BY fires DESC",
  );
}

export type AttendanceRisk = {
  reg_no: string;
  student_name: string;
  enrollment_id: number;
  course_code: string;
  course_title: string;
  classes_held: number;
  classes_attended: number;
  condoned_days: number;
  attendance_pct: number;
  risk_band: string;
};

export function attendanceRisk(limit = 12) {
  return all<AttendanceRisk>(
    `SELECT * FROM v_attendance_risk
      ORDER BY CASE risk_band WHEN 'AT_RISK' THEN 0 WHEN 'BORDERLINE' THEN 1 ELSE 2 END,
               attendance_pct ASC
      LIMIT ?`,
    limit,
  );
}

export function triageMix() {
  return all<{ triage_level: string; n: number }>(
    "SELECT triage_level, COUNT(*) AS n FROM appointment GROUP BY triage_level",
  );
}

export function topSymptoms(limit = 6) {
  return all<{ name: string; body_system: string; episodes: number; avg_severity: number }>(
    `SELECT s.name, s.body_system, COUNT(*) AS episodes,
            ROUND(AVG(a.severity), 1) AS avg_severity
       FROM appointment_symptom a
       JOIN symptom s ON s.symptom_id = a.symptom_id
      GROUP BY s.symptom_id
      ORDER BY episodes DESC, avg_severity DESC
      LIMIT ?`,
    limit,
  );
}

/* ============================================================ appointments */

export type Student = {
  reg_no: string;
  name: string;
  campus_id: number;
  campus_name: string;
  dept_name: string;
  year_of_study: number;
  hostel_block: string | null;
  room_no: string | null;
};

export function students() {
  return all<Student>(
    `SELECT s.reg_no, s.name, s.campus_id, c.name AS campus_name,
            d.name AS dept_name, s.year_of_study, s.hostel_block, s.room_no
       FROM student s
       JOIN campus c ON c.campus_id = s.campus_id
       JOIN department d ON d.dept_id = s.dept_id
      ORDER BY s.reg_no`,
  );
}

export type DoctorRow = {
  doctor_id: number;
  name: string;
  doctor_type: string;
  campus_id: number;
  campus_name: string;
  years_experience: number;
  consult_fee: number;
  specializations: string;
  subclass_detail: string;
  open_slots: number;
};

export function doctors(campusId?: number) {
  return all<DoctorRow>(
    `SELECT d.doctor_id, d.name, d.doctor_type, d.campus_id, c.name AS campus_name,
            d.years_experience, d.consult_fee,
            (SELECT GROUP_CONCAT(sp.name, ' · ')
               FROM doctor_specialization ds
               JOIN specialization sp ON sp.spec_id = ds.spec_id
              WHERE ds.doctor_id = d.doctor_id) AS specializations,
            COALESCE(
              (SELECT 'OPD ' || opd_room || ' · walk-in ' || walk_in_hours FROM gp_doctor WHERE doctor_id = d.doctor_id),
              (SELECT board_certification || ' · ' || COALESCE(tertiary_hospital, 'campus only') FROM specialist_doctor WHERE doctor_id = d.doctor_id),
              (SELECT therapy_modality || ' · ' || confidentiality_tier || ' confidentiality' FROM counselor WHERE doctor_id = d.doctor_id),
              ''
            ) AS subclass_detail,
            (SELECT COUNT(*) FROM slot s WHERE s.doctor_id = d.doctor_id AND s.status = 'OPEN') AS open_slots
       FROM doctor d
       JOIN campus c ON c.campus_id = d.campus_id
      ${campusId ? "WHERE d.campus_id = ?" : ""}
      ORDER BY d.doctor_type, d.name`,
    ...(campusId ? [campusId] : []),
  );
}

export type SlotRow = { doctor_id: number; slot_date: string; slot_time: string; mode: string; status: string };

export function openSlots(doctorId: number) {
  return all<SlotRow>(
    "SELECT * FROM slot WHERE doctor_id = ? ORDER BY slot_date, slot_time",
    doctorId,
  );
}

export function symptoms() {
  return all<{ symptom_id: number; name: string; body_system: string; default_triage: string }>(
    "SELECT * FROM symptom ORDER BY body_system, name",
  );
}

export type QueueRow = {
  appointment_id: number;
  doctor_name: string;
  doctor_type: string;
  slot_date: string;
  slot_time: string;
  mode: string;
  triage_level: string;
  status: string;
  reg_no: string;
  student_name: string;
  chief_complaint: string;
};

export function doctorQueue(limit = 25) {
  return all<QueueRow>(
    `SELECT * FROM v_doctor_queue
      ORDER BY slot_date DESC, slot_time DESC
      LIMIT ?`,
    limit,
  );
}

/* ================================================================ pharmacy */

export type CatalogRow = {
  drug_id: number;
  name: string;
  generic_name: string;
  form: string;
  strength: string;
  schedule_class: string;
  unit_price: number;
  requires_rx: number;
  qty_on_hand: number;
  reorder_level: number;
  expiry_date: string;
  interactions: number;
};

export function catalog(pharmacyId: number) {
  return all<CatalogRow>(
    `SELECT d.drug_id, d.name, d.generic_name, d.form, d.strength, d.schedule_class,
            d.unit_price, d.requires_rx,
            i.qty_on_hand, i.reorder_level, i.expiry_date,
            (SELECT COUNT(*) FROM drug_interaction di WHERE di.drug_id = d.drug_id) AS interactions
       FROM inventory i
       JOIN drug d ON d.drug_id = i.drug_id
      WHERE i.pharmacy_id = ?
      ORDER BY d.requires_rx, d.name`,
    pharmacyId,
  );
}

export function pharmacies() {
  return all<{ pharmacy_id: number; name: string; location: string; campus_id: number; campus_name: string }>(
    `SELECT p.pharmacy_id, p.name, p.location, p.campus_id, c.name AS campus_name
       FROM pharmacy p JOIN campus c ON c.campus_id = p.campus_id
      ORDER BY p.pharmacy_id`,
  );
}

export type OrderRow = {
  order_id: number;
  order_status: string;
  order_type: string;
  payment_mode: string;
  total_amount: number;
  placed_at: string;
  pharmacy_name: string;
  student_name: string;
  reg_no: string;
  hostel_block: string;
  room_no: string;
  line_count: number;
};

export function orders(limit = 20) {
  return all<OrderRow>(
    "SELECT * FROM v_pharmacist_fulfilment ORDER BY order_id DESC LIMIT ?",
    limit,
  );
}

export function orderLines(orderId: number) {
  return all<{ line_no: number; name: string; quantity: number; unit_price: number; line_total: number }>(
    `SELECT oi.line_no, d.name, oi.quantity, oi.unit_price, oi.line_total
       FROM order_item oi JOIN drug d ON d.drug_id = oi.drug_id
      WHERE oi.order_id = ? ORDER BY oi.line_no`,
    orderId,
  );
}

export function addressesFor(regNo: string) {
  return all<{ address_id: number; label: string; hostel_block: string; room_no: string; contact_phone: string }>(
    "SELECT * FROM delivery_address WHERE reg_no = ? ORDER BY is_default DESC",
    regNo,
  );
}

export function lowStock() {
  return all<{ name: string; pharmacy_name: string; qty_on_hand: number; reorder_level: number; raised_at: string }>(
    `SELECT d.name, p.name AS pharmacy_name, sa.qty_on_hand, sa.reorder_level, sa.raised_at
       FROM stock_alert sa
       JOIN drug d ON d.drug_id = sa.drug_id
       JOIN pharmacy p ON p.pharmacy_id = sa.pharmacy_id
      ORDER BY sa.stock_alert_id DESC`,
  );
}

/* ================================================= interactions (recursive) */

export function interactionGraph() {
  return all<{ a: string; b: string; severity: string; description: string }>(
    `SELECT d1.name AS a, d2.name AS b, di.severity, di.description
       FROM drug_interaction di
       JOIN drug d1 ON d1.drug_id = di.drug_id
       JOIN drug d2 ON d2.drug_id = di.interacts_with
      WHERE di.drug_id < di.interacts_with
      ORDER BY CASE di.severity WHEN 'SEVERE' THEN 0 WHEN 'MODERATE' THEN 1 ELSE 2 END, d1.name`,
  );
}

export function clinicalAlerts(limit = 15) {
  return all<{
    alert_id: number;
    prescription_id: number;
    severity: string;
    message: string;
    acknowledged: number;
    raised_at: string;
  }>("SELECT * FROM clinical_alert ORDER BY alert_id DESC LIMIT ?", limit);
}

/* ============================================================= condonation */

export type CertificateRow = {
  certificate_id: number;
  reg_no: string;
  student_name: string;
  doctor_name: string;
  valid_from: string;
  valid_to: string;
  days: number;
  reason: string;
  status: string;
  issued_at: string;
  requests: number;
};

export function certificates() {
  return all<CertificateRow>(
    `SELECT mc.certificate_id, mc.reg_no, s.name AS student_name, d.name AS doctor_name,
            mc.valid_from, mc.valid_to,
            CAST(julianday(mc.valid_to) - julianday(mc.valid_from) + 1 AS INTEGER) AS days,
            mc.reason, mc.status, mc.issued_at,
            (SELECT COUNT(*) FROM condonation_request cr WHERE cr.certificate_id = mc.certificate_id) AS requests
       FROM medical_certificate mc
       JOIN student s ON s.reg_no = mc.reg_no
       JOIN doctor  d ON d.doctor_id = mc.issued_by
      ORDER BY mc.certificate_id`,
  );
}

export type CondonationRow = {
  request_id: number;
  status: string;
  days_requested: number;
  raised_at: string;
  decided_at: string | null;
  faculty_id: number;
  faculty_name: string;
  course_code: string;
  course_title: string;
  reg_no: string;
  student_name: string;
  valid_from: string;
  valid_to: string;
  reason: string;
  classes_held: number;
  classes_attended: number;
  attendance_pct: number;
};

export function condonationInbox() {
  return all<CondonationRow>(
    `SELECT * FROM v_faculty_condonation_inbox
      ORDER BY CASE status WHEN 'PENDING' THEN 0 WHEN 'APPROVED' THEN 1 ELSE 2 END,
               request_id DESC`,
  );
}

/* ============================================================ misc helpers */

export function tableList() {
  return all<{ name: string; rows: number }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).map((t) => ({
    name: t.name,
    rows: scalar<number>(`SELECT COUNT(*) FROM "${t.name}"`),
  }));
}

export function studentByReg(regNo: string) {
  return one<Student>(
    `SELECT s.reg_no, s.name, s.campus_id, c.name AS campus_name,
            d.name AS dept_name, s.year_of_study, s.hostel_block, s.room_no
       FROM student s
       JOIN campus c ON c.campus_id = s.campus_id
       JOIN department d ON d.dept_id = s.dept_id
      WHERE s.reg_no = ?`,
    regNo,
  );
}
