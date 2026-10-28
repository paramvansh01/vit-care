import { all, one, run, scalar } from "@/lib/db";

/* =========================================================== student profile */

export type StudentProfile = {
  reg_no: string;
  name: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  blood_group: string | null;
  hostel_block: string | null;
  room_no: string | null;
  year_of_study: number;
  dept_id: number;
  campus_id: number;
  dept_name: string;
  dept_code: string;
  campus_name: string;
  campus_code: string;
  proctor_name: string | null;
  proctor_email: string | null;
  proctor_phone: string | null;
  hod_name: string | null;
  hod_email: string | null;
};

export function profile(regNo: string) {
  return one<StudentProfile>(
    `SELECT s.*, d.name AS dept_name, d.code AS dept_code,
            c.name AS campus_name, c.code AS campus_code
       FROM student s
       JOIN department d ON d.dept_id = s.dept_id
       JOIN campus     c ON c.campus_id = s.campus_id
      WHERE s.reg_no = ?`,
    regNo,
  );
}

export function allProfiles() {
  return all<StudentProfile>(
    `SELECT s.*, d.name AS dept_name, d.code AS dept_code,
            c.name AS campus_name, c.code AS campus_code
       FROM student s
       JOIN department d ON d.dept_id = s.dept_id
       JOIN campus     c ON c.campus_id = s.campus_id
      ORDER BY s.reg_no`,
  );
}

export function departments() {
  return all<{ dept_id: number; campus_id: number; code: string; name: string; campus_name: string }>(
    `SELECT d.dept_id, d.campus_id, d.code, d.name, c.name AS campus_name
       FROM department d JOIN campus c ON c.campus_id = d.campus_id
      ORDER BY c.campus_id, d.code`,
  );
}

export function campuses() {
  return all<{ campus_id: number; code: string; name: string; city: string }>(
    "SELECT campus_id, code, name, city FROM campus ORDER BY campus_id",
  );
}

/* ================================================================ care items */

export type CareAppointment = {
  appointment_id: number;
  reg_no: string;
  student_name: string;
  year_of_study: number;
  hostel_block: string | null;
  room_no: string | null;
  blood_group: string | null;
  doctor_id: number;
  doctor_name: string;
  doctor_type: string;
  slot_date: string;
  slot_time: string;
  mode: string;
  triage_level: string;
  status: string;
  chief_complaint: string;
  booked_at: string;
  consultation_id: number | null;
  diagnosis: string | null;
  video_room_code: string | null;
  prescription_id: number | null;
  rx_lines: number;
  certificate_id: number | null;
  document_id: number | null;
  symptoms: string | null;
};

const APPOINTMENT_SELECT = `
  SELECT a.appointment_id, a.reg_no, s.name AS student_name, s.year_of_study,
         s.hostel_block, s.room_no, s.blood_group,
         a.doctor_id, d.name AS doctor_name, d.doctor_type,
         a.slot_date, a.slot_time, a.mode, a.triage_level, a.status,
         a.chief_complaint, a.booked_at,
         c.consultation_id, c.diagnosis, c.video_room_code,
         p.prescription_id,
         (SELECT COUNT(*) FROM prescription_item pi
           WHERE pi.prescription_id = p.prescription_id)            AS rx_lines,
         mc.certificate_id,
         ld.document_id,
         (SELECT GROUP_CONCAT(sy.name, ', ')
            FROM appointment_symptom asy JOIN symptom sy ON sy.symptom_id = asy.symptom_id
           WHERE asy.appointment_id = a.appointment_id)             AS symptoms
    FROM appointment a
    JOIN student s ON s.reg_no = a.reg_no
    JOIN doctor  d ON d.doctor_id = a.doctor_id
    LEFT JOIN consultation        c  ON c.appointment_id = a.appointment_id
    LEFT JOIN prescription        p  ON p.consultation_id = c.consultation_id
    LEFT JOIN medical_certificate mc ON mc.consultation_id = c.consultation_id
    LEFT JOIN leave_document      ld ON ld.certificate_id = mc.certificate_id
`;

export function appointmentsFor(regNo: string) {
  return all<CareAppointment>(
    `${APPOINTMENT_SELECT} WHERE a.reg_no = ?
      ORDER BY a.slot_date DESC, a.slot_time DESC`,
    regNo,
  );
}

export function doctorBoard(doctorId?: number) {
  const where = doctorId ? "WHERE a.doctor_id = ?" : "";
  const params = doctorId ? [doctorId] : [];
  return all<CareAppointment>(
    `${APPOINTMENT_SELECT} ${where}
      ORDER BY CASE a.status WHEN 'BOOKED' THEN 0 WHEN 'COMPLETED' THEN 1 ELSE 2 END,
               CASE a.triage_level WHEN 'RED' THEN 0 WHEN 'AMBER' THEN 1 ELSE 2 END,
               a.slot_date DESC, a.slot_time DESC`,
    ...params,
  );
}

export function appointment(appointmentId: number) {
  return one<CareAppointment>(`${APPOINTMENT_SELECT} WHERE a.appointment_id = ?`, appointmentId);
}

/* ======================================================================= cart */

export type CartLine = {
  cart_item_id: number;
  reg_no: string;
  source: string;
  quantity: number;
  dosage: string | null;
  frequency: string | null;
  prescription_id: number | null;
  drug_id: number;
  drug_name: string;
  generic_name: string;
  form: string;
  strength: string;
  requires_rx: number;
  unit_price: number;
  line_total: number;
};

export function cart(regNo: string) {
  return all<CartLine>(
    `SELECT * FROM v_student_cart WHERE reg_no = ?
      ORDER BY source DESC, drug_name`,
    regNo,
  );
}

export function cartTotal(regNo: string) {
  return scalar<number>("SELECT COALESCE(SUM(line_total), 0) FROM v_student_cart WHERE reg_no = ?", regNo);
}

export type StoreDrug = {
  drug_id: number;
  name: string;
  generic_name: string;
  form: string;
  strength: string;
  schedule_class: string;
  unit_price: number;
  requires_rx: number;
  qty_on_hand: number;
};

/** OTC catalogue a student can self-order, scoped to their campus pharmacy. */
export function storeFor(campusId: number) {
  return all<StoreDrug>(
    `SELECT d.drug_id, d.name, d.generic_name, d.form, d.strength,
            d.schedule_class, d.unit_price, d.requires_rx,
            COALESCE(i.qty_on_hand, 0) AS qty_on_hand
       FROM drug d
       LEFT JOIN inventory i
              ON i.drug_id = d.drug_id
             AND i.pharmacy_id = (SELECT MIN(pharmacy_id) FROM pharmacy WHERE campus_id = ?)
      WHERE d.requires_rx = 0
      ORDER BY d.name`,
    campusId,
  );
}

export function primaryPharmacy(campusId: number) {
  return one<{ pharmacy_id: number; name: string; location: string; phone: string }>(
    `SELECT pharmacy_id, name, location, phone FROM pharmacy
      WHERE campus_id = ? ORDER BY pharmacy_id LIMIT 1`,
    campusId,
  );
}

/* ===================================================================== orders */

export type StudentOrder = {
  order_id: number;
  order_type: string;
  payment_mode: string;
  status: string;
  total_amount: number;
  placed_at: string;
  pharmacy_name: string;
  hostel_block: string;
  room_no: string;
  lines: number;
};

export function ordersFor(regNo: string) {
  return all<StudentOrder>(
    `SELECT o.order_id, o.order_type, o.payment_mode, o.status, o.total_amount, o.placed_at,
            p.name AS pharmacy_name, da.hostel_block, da.room_no,
            (SELECT COUNT(*) FROM order_item oi WHERE oi.order_id = o.order_id) AS lines
       FROM pharmacy_order o
       JOIN pharmacy p          ON p.pharmacy_id = o.pharmacy_id
       JOIN delivery_address da ON da.address_id = o.address_id
      WHERE o.reg_no = ?
      ORDER BY o.order_id DESC`,
    regNo,
  );
}

export function orderLinesFor(regNo: string) {
  return all<{
    order_id: number;
    drug_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>(
    `SELECT oi.order_id, d.name AS drug_name, oi.quantity, oi.unit_price, oi.line_total
       FROM order_item oi
       JOIN drug d ON d.drug_id = oi.drug_id
       JOIN pharmacy_order o ON o.order_id = oi.order_id
      WHERE o.reg_no = ?
      ORDER BY oi.order_id DESC, oi.line_no`,
    regNo,
  );
}

/* ============================================================== notifications */

export type Notice = {
  notification_id: number;
  kind: string;
  title: string;
  body: string;
  ref_table: string | null;
  ref_id: number | null;
  is_read: number;
  created_at: string;
};

export function notifications(regNo: string, limit = 30) {
  return all<Notice>(
    `SELECT notification_id, kind, title, body, ref_table, ref_id, is_read, created_at
       FROM notification WHERE reg_no = ?
      ORDER BY notification_id DESC LIMIT ?`,
    regNo,
    limit,
  );
}

export function unreadCount(regNo: string) {
  return scalar<number>(
    "SELECT COUNT(*) FROM notification WHERE reg_no = ? AND is_read = 0",
    regNo,
  );
}

/* ============================================================ leave documents */

export type LeaveDoc = {
  document_id: number;
  certificate_id: number;
  ref_no: string;
  days_granted: number;
  valid_from: string;
  valid_to: string;
  diagnosis_note: string;
  advice: string | null;
  fit_to_resume: string;
  issued_at: string;
  reg_no: string;
  student_name: string;
  student_email: string;
  dept_name: string;
  dept_code: string;
  campus_name: string;
  year_of_study: number;
  hostel_block: string | null;
  room_no: string | null;
  proctor_name: string | null;
  proctor_email: string | null;
  hod_name: string | null;
  hod_email: string | null;
  doctor_name: string;
  doctor_type: string;
  reg_council_no: string;
  certificate_status: string;
};

const LEAVE_SELECT = `
  SELECT ld.*, s.name AS student_name, s.email AS student_email, s.year_of_study,
         s.hostel_block, s.room_no, s.proctor_name, s.proctor_email, s.hod_name, s.hod_email,
         dep.name AS dept_name, dep.code AS dept_code, cam.name AS campus_name,
         doc.name AS doctor_name, doc.doctor_type, doc.reg_council_no,
         mc.status AS certificate_status
    FROM leave_document ld
    JOIN student    s   ON s.reg_no = ld.reg_no
    JOIN department dep ON dep.dept_id = s.dept_id
    JOIN campus     cam ON cam.campus_id = s.campus_id
    JOIN doctor     doc ON doc.doctor_id = ld.issued_by
    JOIN medical_certificate mc ON mc.certificate_id = ld.certificate_id
`;

export function leaveDocsFor(regNo: string) {
  return all<LeaveDoc>(`${LEAVE_SELECT} WHERE ld.reg_no = ? ORDER BY ld.document_id DESC`, regNo);
}

export function leaveDoc(documentId: number) {
  return one<LeaveDoc>(`${LEAVE_SELECT} WHERE ld.document_id = ?`, documentId);
}

export function allLeaveDocs() {
  return all<LeaveDoc>(`${LEAVE_SELECT} ORDER BY ld.document_id DESC`);
}

export function recipientsFor(documentId: number) {
  return all<{
    recipient_role: string;
    recipient_name: string;
    recipient_email: string | null;
    delivered_at: string;
  }>(
    `SELECT recipient_role, recipient_name, recipient_email, delivered_at
       FROM document_recipient WHERE document_id = ?
      ORDER BY CASE recipient_role WHEN 'STUDENT' THEN 0 WHEN 'PROCTOR' THEN 1 ELSE 2 END`,
    documentId,
  );
}

/* ================================================================ prescribing */

export function rxLines(prescriptionId: number) {
  return all<{
    line_no: number;
    drug_id: number;
    drug_name: string;
    strength: string;
    form: string;
    dosage: string;
    frequency: string;
    duration_days: number;
    quantity: number;
  }>(
    `SELECT pi.line_no, pi.drug_id, d.name AS drug_name, d.strength, d.form,
            pi.dosage, pi.frequency, pi.duration_days, pi.quantity
       FROM prescription_item pi
       JOIN drug d ON d.drug_id = pi.drug_id
      WHERE pi.prescription_id = ?
      ORDER BY pi.line_no`,
    prescriptionId,
  );
}

export function alertsFor(prescriptionId: number) {
  return all<{ alert_id: number; severity: string; message: string; acknowledged: number }>(
    `SELECT alert_id, severity, message, acknowledged
       FROM clinical_alert WHERE prescription_id = ? ORDER BY alert_id DESC`,
    prescriptionId,
  );
}

export function allDrugs() {
  return all<StoreDrug & { schedule_class: string }>(
    `SELECT drug_id, name, generic_name, form, strength, schedule_class, unit_price, requires_rx,
            0 AS qty_on_hand
       FROM drug ORDER BY requires_rx DESC, name`,
  );
}

/* ================================================================ doctor side */

export function doctorRoster() {
  return all<{
    doctor_id: number;
    name: string;
    doctor_type: string;
    campus_id: number;
    campus_name: string;
    reg_council_no: string;
    years_experience: number;
    booked: number;
  }>(
    `SELECT d.doctor_id, d.name, d.doctor_type, d.campus_id, c.name AS campus_name,
            d.reg_council_no, d.years_experience,
            (SELECT COUNT(*) FROM appointment a
              WHERE a.doctor_id = d.doctor_id AND a.status = 'BOOKED') AS booked
       FROM doctor d JOIN campus c ON c.campus_id = d.campus_id
      ORDER BY d.campus_id, d.name`,
  );
}

export function doctorStats(doctorId: number) {
  return {
    waiting: scalar<number>(
      "SELECT COUNT(*) FROM appointment WHERE doctor_id = ? AND status = 'BOOKED'",
      doctorId,
    ),
    seen: scalar<number>(
      "SELECT COUNT(*) FROM appointment WHERE doctor_id = ? AND status = 'COMPLETED'",
      doctorId,
    ),
    urgent: scalar<number>(
      "SELECT COUNT(*) FROM appointment WHERE doctor_id = ? AND status = 'BOOKED' AND triage_level = 'RED'",
      doctorId,
    ),
    leaves: scalar<number>("SELECT COUNT(*) FROM leave_document WHERE issued_by = ?", doctorId),
  };
}

/**
 * Publishes a rolling week of slots for a doctor. Runs on registration and
 * whenever a student looks at a doctor's calendar, so it never runs dry.
 */
export function topUpSlots(doctorId: number) {
  return Number(
    run(
      `WITH RECURSIVE days(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM days WHERE n < 6),
       times(t, mode) AS (
         SELECT '09:00','VIDEO' UNION ALL SELECT '09:30','VIDEO' UNION ALL
         SELECT '10:00','VIDEO' UNION ALL SELECT '10:30','IN_PERSON' UNION ALL
         SELECT '11:00','VIDEO' UNION ALL SELECT '11:30','VIDEO' UNION ALL
         SELECT '14:00','VIDEO' UNION ALL SELECT '14:30','VIDEO' UNION ALL
         SELECT '15:00','VIDEO' UNION ALL SELECT '15:30','IN_PERSON' UNION ALL
         SELECT '16:00','VIDEO' UNION ALL SELECT '16:30','VIDEO' UNION ALL
         SELECT '17:00','VIDEO' UNION ALL SELECT '18:00','VIDEO' UNION ALL
         SELECT '19:00','VIDEO' UNION ALL SELECT '20:00','VIDEO' UNION ALL
         SELECT '21:00','VIDEO'
       )
       INSERT OR IGNORE INTO slot (doctor_id, slot_date, slot_time, mode, status)
       SELECT ?, date('now', 'localtime', '+' || days.n || ' day'), times.t, times.mode, 'OPEN'
         FROM days, times`,
      doctorId,
    ).changes,
  );
}

/** A doctor's open slots from now on — never one that has already passed. */
export function bookableSlots(doctorId: number) {
  topUpSlots(doctorId);
  return all<{ slot_date: string; slot_time: string; mode: string }>(
    `SELECT slot_date, slot_time, mode FROM slot
      WHERE doctor_id = ? AND status = 'OPEN'
        AND slot_date || ' ' || slot_time > strftime('%Y-%m-%d %H:%M', 'now', 'localtime')
      ORDER BY slot_date, slot_time`,
    doctorId,
  );
}

/* ================================================================ attendance */

export type Enrollment = {
  enrollment_id: number;
  course_code: string;
  course_title: string;
  credits: number;
  faculty_name: string;
  semester: string;
  classes_held: number;
  classes_attended: number;
  condoned_days: number;
  attendance_pct: number | null;
};

export function enrollmentsFor(regNo: string) {
  return all<Enrollment>(
    `SELECT e.enrollment_id, e.course_code, c.title AS course_title, c.credits,
            f.name AS faculty_name, e.semester, e.classes_held, e.classes_attended, e.condoned_days,
            ROUND(100.0 * e.classes_attended / NULLIF(e.classes_held, 0), 1) AS attendance_pct
       FROM enrollment e
       JOIN course  c ON c.course_code = e.course_code
       JOIN faculty f ON f.faculty_id = e.faculty_id
      WHERE e.reg_no = ?
      ORDER BY e.semester DESC, e.course_code`,
    regNo,
  );
}

/* ================================================================= directory */

export type Person = {
  user_id: number;
  display_name: string;
  role: string;
  username: string;
  linked_ref: string | null;
  detail: string | null;
  campus_name: string | null;
  online: number;
  last_seen: string | null;
};

/** Everyone with an account, with whether any of their browsers polled recently. */
export function directory() {
  return all<Person>(
    `SELECT u.user_id, u.display_name, r.role_name AS role, u.username, u.linked_ref,
            CASE r.role_name
              WHEN 'DOCTOR'  THEN (SELECT CASE d.doctor_type WHEN 'GP' THEN 'General practitioner'
                                                             WHEN 'SPECIALIST' THEN 'Specialist'
                                                             ELSE 'Counsellor' END
                                     FROM doctor d WHERE d.doctor_id = CAST(u.linked_ref AS INTEGER))
              WHEN 'STUDENT' THEN (SELECT 'Student · ' || s.reg_no || ' · Year ' || s.year_of_study
                                     FROM student s WHERE s.reg_no = u.linked_ref)
            END AS detail,
            CASE r.role_name
              WHEN 'DOCTOR'  THEN (SELECT c.name FROM doctor d JOIN campus c ON c.campus_id = d.campus_id
                                    WHERE d.doctor_id = CAST(u.linked_ref AS INTEGER))
              WHEN 'STUDENT' THEN (SELECT c.name FROM student s JOIN campus c ON c.campus_id = s.campus_id
                                    WHERE s.reg_no = u.linked_ref)
            END AS campus_name,
            EXISTS (SELECT 1 FROM app_session ss WHERE ss.user_id = u.user_id
                       AND ss.last_seen_at > datetime('now', '-20 second')) AS online,
            (SELECT MAX(ss.last_seen_at) FROM app_session ss WHERE ss.user_id = u.user_id) AS last_seen
       FROM app_user u JOIN app_role r ON r.role_id = u.role_id
      WHERE r.role_name IN ('DOCTOR', 'STUDENT') AND u.password_hash IS NOT NULL
      ORDER BY online DESC, r.role_name, u.display_name`,
  );
}

export type DoctorCard = {
  doctor_id: number;
  name: string;
  email: string;
  doctor_type: string;
  campus_id: number;
  campus_name: string;
  reg_council_no: string;
  years_experience: number;
  consult_fee: number;
  specialisations: string | null;
  user_id: number | null;
  online: number;
  open_slots: number;
  seen: number;
};

export function doctorCards() {
  return all<DoctorCard>(
    `SELECT d.doctor_id, d.name, d.email, d.doctor_type, d.campus_id, c.name AS campus_name,
            d.reg_council_no, d.years_experience, d.consult_fee,
            (SELECT GROUP_CONCAT(sp.name, ', ')
               FROM doctor_specialization ds JOIN specialization sp ON sp.spec_id = ds.spec_id
              WHERE ds.doctor_id = d.doctor_id) AS specialisations,
            u.user_id,
            COALESCE(EXISTS (SELECT 1 FROM app_session ss WHERE ss.user_id = u.user_id
                               AND ss.last_seen_at > datetime('now', '-20 second')), 0) AS online,
            (SELECT COUNT(*) FROM slot s WHERE s.doctor_id = d.doctor_id AND s.status = 'OPEN'
                AND s.slot_date >= date('now', 'localtime')) AS open_slots,
            (SELECT COUNT(*) FROM appointment a WHERE a.doctor_id = d.doctor_id
                AND a.status = 'COMPLETED') AS seen
       FROM doctor d
       JOIN campus c ON c.campus_id = d.campus_id
       LEFT JOIN app_user u ON u.linked_ref = CAST(d.doctor_id AS TEXT)
                           AND u.role_id = (SELECT role_id FROM app_role WHERE role_name = 'DOCTOR')
      ORDER BY online DESC, d.name`,
  );
}

export function specialisations() {
  return all<{ spec_id: number; name: string; body_system: string }>(
    "SELECT spec_id, name, body_system FROM specialization ORDER BY name",
  );
}
