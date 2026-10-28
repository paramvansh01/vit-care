"use server";

import { revalidatePath } from "next/cache";
import { all, db, one, run, scalar } from "@/lib/db";
import type { ActionResult } from "@/app/actions";
import { currentUser, startSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

/* ------------------------------------------------------------------ helpers */

/** Everything the triggers wrote while `fn` ran — the UI surfaces this verbatim. */
function capturing<T>(fn: () => T): { result: T; fired: string[] } {
  const before = scalar<number>("SELECT COALESCE(MAX(log_id), 0) FROM trigger_log");
  const result = fn();
  const fired = all<{ trigger_name: string; message: string }>(
    "SELECT trigger_name, message FROM trigger_log WHERE log_id > ? ORDER BY log_id",
    before,
  ).map((r) => `${r.trigger_name} — ${r.message}`);
  return { result, fired };
}

function fail(error: unknown): ActionResult {
  const raw = error instanceof Error ? error.message : String(error);
  const clean = raw.replace(/^.*?:\s*/, "").trim() || raw;
  return {
    ok: false,
    message: clean,
    detail: ["The database rejected the write — no rows changed."],
  };
}

function txn<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function refreshAll() {
  revalidatePath("/student");
  revalidatePath("/doctor");
  revalidatePath("/dashboard");
  revalidatePath("/database");
}

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/* ------------------------------------------------------------ authorisation */

const DENIED: ActionResult = { ok: false, message: "Your session cannot do that — sign in as the right person." };

/** null when the signed-in user is this student; the refusal otherwise. */
async function guardStudent(regNo: string) {
  const me = await currentUser();
  return me?.role === "STUDENT" && me.linked_ref === regNo ? null : DENIED;
}

/** null when the signed-in user is the doctor holding this appointment. */
async function guardDoctor(appointmentId: number | undefined) {
  const me = await currentUser();
  if (me?.role !== "DOCTOR" || !appointmentId) return DENIED;
  const owns = one(
    "SELECT 1 FROM appointment WHERE appointment_id = ? AND doctor_id = ?",
    appointmentId,
    Number(me.linked_ref),
  );
  return owns ? null : DENIED;
}

function appointmentOf(consultationId: number) {
  return one<{ appointment_id: number }>(
    "SELECT appointment_id FROM consultation WHERE consultation_id = ?",
    consultationId,
  )?.appointment_id;
}

async function guardCartLine(cartItemId: number) {
  const line = one<{ reg_no: string }>("SELECT reg_no FROM cart_item WHERE cart_item_id = ?", cartItemId);
  return line ? guardStudent(line.reg_no) : DENIED;
}

/* ======================================================== 1. student profile */

/**
 * Creates or updates a student from fields the student typed themselves.
 * Campus and department are institutional reference data, so the typed value
 * is resolved against the existing rows; an unknown department is created
 * inside the chosen campus rather than silently dropped.
 */
export async function saveProfile(form: FormData): Promise<ActionResult> {
  const me = await currentUser();
  const regNo = str(form, "reg_no").toUpperCase();
  if (!me || me.role !== "STUDENT" || me.linked_ref !== regNo) {
    return { ok: false, message: "You can only edit your own profile — sign in as that student first." };
  }
  return writeStudent(form, "update");
}

/**
 * Creates a student account: the student row (with its default delivery
 * address), the login, and an enrollment in every course their school runs
 * this semester. Then it signs the new student in.
 */
export async function registerStudent(form: FormData): Promise<ActionResult> {
  const regNo = str(form, "reg_no").toUpperCase();
  const password = String(form.get("password") ?? "");
  if (password.length < 6) return { ok: false, message: "Choose a password of at least 6 characters." };
  if (password !== String(form.get("password_confirm") ?? "")) {
    return { ok: false, message: "The two passwords do not match." };
  }
  if (one("SELECT 1 FROM app_user WHERE username = ?", regNo) || one("SELECT 1 FROM student WHERE reg_no = ?", regNo)) {
    return { ok: false, message: `${regNo} is already registered. Sign in instead.` };
  }

  const written = writeStudent(form, "create");
  if (!written.ok) return written;

  const student = one<{ name: string; dept_id: number }>(
    "SELECT name, dept_id FROM student WHERE reg_no = ?",
    regNo,
  )!;
  const semester = currentSemester();
  let userId = 0;
  let enrolled = 0;
  try {
    txn(() => {
      userId = Number(
        run(
          `INSERT INTO app_user (role_id, username, display_name, linked_ref, password_hash)
           VALUES ((SELECT role_id FROM app_role WHERE role_name = 'STUDENT'), ?, ?, ?, ?)`,
          regNo,
          student.name,
          regNo,
          hashPassword(password),
        ).lastInsertRowid,
      );
      // Each course is taught by a faculty member of the school that offers it;
      // the most junior one on the reporting chain takes the section.
      enrolled = Number(
        run(
          `INSERT OR IGNORE INTO enrollment (reg_no, course_code, faculty_id, semester)
           SELECT ?, c.course_code,
                  (SELECT f.faculty_id FROM faculty f WHERE f.dept_id = c.dept_id
                    ORDER BY f.reports_to IS NULL, f.faculty_id DESC LIMIT 1),
                  ?
             FROM course c
            WHERE c.dept_id = ?
              AND EXISTS (SELECT 1 FROM faculty f WHERE f.dept_id = c.dept_id)`,
          regNo,
          semester,
          student.dept_id,
        ).changes,
      );
    });
  } catch (error) {
    return fail(error);
  }

  await startSession(userId);
  refreshAll();
  return {
    ok: true,
    message: `Welcome, ${student.name}. Your account is ready${
      enrolled ? ` and you are enrolled in ${enrolled} course(s) for ${semester}` : ""
    }.`,
    detail: written.detail,
  };
}

function currentSemester() {
  const now = new Date();
  return `${now.getMonth() >= 6 ? "FALL" : "WINTER"}-${now.getFullYear()}`;
}

/** Attendance as the student reads it off VTOP; the database guards the bounds. */
export async function saveAttendance(payload: {
  enrollmentId: number;
  held: number;
  attended: number;
}): Promise<ActionResult> {
  const me = await currentUser();
  const owner = one<{ reg_no: string }>("SELECT reg_no FROM enrollment WHERE enrollment_id = ?", payload.enrollmentId);
  if (!me || !owner || me.linked_ref !== owner.reg_no) {
    return { ok: false, message: "You can only update your own attendance." };
  }
  const held = Math.floor(payload.held);
  const attended = Math.floor(payload.attended);
  if (!(held >= 0) || !(attended >= 0)) return { ok: false, message: "Enter whole numbers." };
  if (attended > held) return { ok: false, message: "You cannot have attended more classes than were held." };
  try {
    run(
      "UPDATE enrollment SET classes_held = ?, classes_attended = ? WHERE enrollment_id = ?",
      held,
      attended,
      payload.enrollmentId,
    );
    refreshAll();
    revalidatePath("/condonation");
    return { ok: true, message: `Attendance saved: ${attended}/${held}.` };
  } catch (error) {
    return fail(error);
  }
}

function writeStudent(form: FormData, mode: "create" | "update"): ActionResult {
  const regNo = str(form, "reg_no").toUpperCase();
  const name = str(form, "name");
  const email = str(form, "email");
  const phone = str(form, "phone");
  const dob = str(form, "dob");
  const gender = str(form, "gender") || "M";
  const year = Number(form.get("year_of_study") || 1);
  const campusText = str(form, "campus");
  const deptText = str(form, "department");

  if (!regNo || !name || !email || !phone || !dob) {
    return { ok: false, message: "Registration number, name, email, phone and date of birth are required." };
  }
  if (!/^\d{2}[A-Z]{3}\d{4}$/.test(regNo)) {
    return { ok: false, message: `"${regNo}" is not a VIT registration number — expected two digits, three letters and four digits (YYBRN0000).` };
  }
  if (!email.includes("@")) return { ok: false, message: "That email address is not valid." };
  if (!/^\d{10}$/.test(phone)) return { ok: false, message: "Phone number must be exactly 10 digits." };
  if (year < 1 || year > 5) return { ok: false, message: "Year of study must be between 1 and 5." };

  const campus = one<{ campus_id: number }>(
    `SELECT campus_id FROM campus
      WHERE LOWER(code) = LOWER(?) OR LOWER(name) = LOWER(?) OR LOWER(city) = LOWER(?)`,
    campusText,
    campusText,
    campusText,
  );
  if (!campus) {
    const known = all<{ name: string }>("SELECT name FROM campus").map((c) => c.name).join(", ");
    return { ok: false, message: `Campus "${campusText}" is not a VIT campus. Known campuses: ${known}.` };
  }

  let dept = one<{ dept_id: number }>(
    `SELECT dept_id FROM department
      WHERE campus_id = ? AND (LOWER(code) = LOWER(?) OR LOWER(name) = LOWER(?))`,
    campus.campus_id,
    deptText,
    deptText,
  );

  try {
    const { result, fired } = capturing(() =>
      txn(() => {
        if (!dept) {
          if (!deptText) throw new Error("School / department is required.");
          const info = run(
            "INSERT INTO department (campus_id, code, name) VALUES (?, ?, ?)",
            campus.campus_id,
            deptText.slice(0, 12).toUpperCase(),
            deptText,
          );
          dept = { dept_id: Number(info.lastInsertRowid) };
        }

        const exists = scalar<number>("SELECT COUNT(*) FROM student WHERE reg_no = ?", regNo) > 0;
        if (exists && mode === "create") throw new Error(`${regNo} is already registered.`);
        if (!exists && mode === "update") throw new Error(`No student ${regNo} to update.`);

        if (exists) {
          run(
            `UPDATE student
                SET dept_id = ?, campus_id = ?, name = ?, email = ?, phone = ?, dob = ?,
                    gender = ?, blood_group = ?, hostel_block = ?, room_no = ?, year_of_study = ?,
                    proctor_name = ?, proctor_email = ?, proctor_phone = ?,
                    hod_name = ?, hod_email = ?
              WHERE reg_no = ?`,
            dept.dept_id,
            campus.campus_id,
            name,
            email,
            phone,
            dob,
            gender,
            str(form, "blood_group") || null,
            str(form, "hostel_block") || null,
            str(form, "room_no") || null,
            year,
            str(form, "proctor_name") || null,
            str(form, "proctor_email") || null,
            str(form, "proctor_phone") || null,
            str(form, "hod_name") || null,
            str(form, "hod_email") || null,
            regNo,
          );
        } else {
          run(
            `INSERT INTO student (reg_no, dept_id, campus_id, name, email, phone, dob, gender,
                                  blood_group, hostel_block, room_no, year_of_study,
                                  proctor_name, proctor_email, proctor_phone, hod_name, hod_email)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            regNo,
            dept.dept_id,
            campus.campus_id,
            name,
            email,
            phone,
            dob,
            gender,
            str(form, "blood_group") || null,
            str(form, "hostel_block") || null,
            str(form, "room_no") || null,
            year,
            str(form, "proctor_name") || null,
            str(form, "proctor_email") || null,
            str(form, "proctor_phone") || null,
            str(form, "hod_name") || null,
            str(form, "hod_email") || null,
          );
        }

        // Keep a default delivery address in step with the hostel details,
        // so the pharmacy checkout always has somewhere to ship to.
        const address = one<{ address_id: number }>(
          "SELECT address_id FROM delivery_address WHERE reg_no = ? AND is_default = 1",
          regNo,
        );
        const block = str(form, "hostel_block") || "Not specified";
        const room = str(form, "room_no") || "—";
        if (address) {
          run(
            `UPDATE delivery_address
                SET campus_id = ?, hostel_block = ?, room_no = ?, contact_phone = ?
              WHERE address_id = ?`,
            campus.campus_id,
            block,
            room,
            phone,
            address.address_id,
          );
        } else {
          run(
            `INSERT INTO delivery_address (reg_no, campus_id, label, hostel_block, room_no, contact_phone, is_default)
             VALUES (?, ?, 'Hostel Room', ?, ?, ?, 1)`,
            regNo,
            campus.campus_id,
            block,
            room,
            phone,
          );
        }
        return exists ? "updated" : "created";
      }),
    );

    refreshAll();
    return {
      ok: true,
      message:
        result === "created"
          ? `Profile created for ${name} (${regNo}). Your proctor and HOD are on file — any medical leave letter will reach them automatically.`
          : `Profile for ${regNo} updated.`,
      detail: fired,
      sql: `INSERT INTO student (reg_no, …, proctor_name, proctor_email, hod_name, hod_email)\nVALUES ('${regNo}', …);`,
    };
  } catch (error) {
    return fail(error);
  }
}

/* ============================================================ 2. book a visit */

export async function bookVisit(form: FormData): Promise<ActionResult> {
  const regNo = str(form, "reg_no").toUpperCase();
  const denied = await guardStudent(regNo);
  if (denied) return denied;
  const doctorId = Number(form.get("doctor_id"));
  const [slotDate, slotTime] = str(form, "slot").split("|");
  const complaint = str(form, "chief_complaint");
  const triage = str(form, "triage_level") || "GREEN";
  const mode = str(form, "mode") || "VIDEO";
  const symptomIds = form.getAll("symptom_id").map(Number).filter(Boolean);
  const duration = Number(form.get("duration_days") || 1);

  if (!regNo) return { ok: false, message: "Create or load your profile first." };
  if (!doctorId) return { ok: false, message: "Choose a doctor." };
  if (!slotDate || !slotTime) return { ok: false, message: "Choose an appointment slot." };
  if (complaint.length < 8) {
    return { ok: false, message: "Describe your complaint in a little more detail (at least 8 characters)." };
  }

  try {
    const { result, fired } = capturing(() =>
      txn(() => {
        const info = run(
          `INSERT INTO appointment (reg_no, doctor_id, slot_date, slot_time, mode, triage_level, chief_complaint)
           VALUES (?,?,?,?,?,?,?)`,
          regNo,
          doctorId,
          slotDate,
          slotTime,
          mode,
          triage,
          complaint,
        );
        const id = Number(info.lastInsertRowid);
        for (const sid of symptomIds) {
          run(
            `INSERT OR IGNORE INTO appointment_symptom (appointment_id, symptom_id, severity, duration_days)
             VALUES (?,?,?,?)`,
            id,
            sid,
            Number(form.get(`severity_${sid}`) ?? 5),
            duration,
          );
        }
        return id;
      }),
    );

    refreshAll();
    return {
      ok: true,
      message: `Appointment #${result} confirmed for ${slotDate} at ${slotTime}. It is now in the doctor's queue.`,
      detail: fired,
      sql: `INSERT INTO appointment (reg_no, doctor_id, slot_date, slot_time, mode, triage_level, chief_complaint)
VALUES ('${regNo}', ${doctorId}, '${slotDate}', '${slotTime}', '${mode}', '${triage}', …);`,
    };
  } catch (error) {
    return fail(error);
  }
}

/* ======================================================== 3. the consultation */

function roomCode(appointmentId: number) {
  return `VITC-${String(appointmentId).padStart(4, "0")}`;
}

export async function openConsultation(appointmentId: number): Promise<ActionResult> {
  const denied = await guardDoctor(appointmentId);
  if (denied) return denied;
  const appt = one<{ doctor_id: number; chief_complaint: string }>(
    "SELECT doctor_id, chief_complaint FROM appointment WHERE appointment_id = ?",
    appointmentId,
  );
  if (!appt) return { ok: false, message: `Appointment #${appointmentId} does not exist.` };

  const existing = one<{ consultation_id: number }>(
    "SELECT consultation_id FROM consultation WHERE appointment_id = ?",
    appointmentId,
  );
  if (existing) {
    return { ok: true, message: `Consultation #${existing.consultation_id} resumed.` };
  }

  try {
    const { result, fired } = capturing(() => {
      const info = run(
        `INSERT INTO consultation (appointment_id, doctor_id, started_at, diagnosis, clinical_notes, is_sensitive, video_room_code)
         VALUES (?, ?, datetime('now'), 'Consultation in progress', NULL, 0, ?)`,
        appointmentId,
        appt.doctor_id,
        roomCode(appointmentId),
      );
      return Number(info.lastInsertRowid);
    });

    refreshAll();
    return {
      ok: true,
      message: `Consultation #${result} open · video room ${roomCode(appointmentId)}.`,
      detail: fired,
      sql: `INSERT INTO consultation (appointment_id, doctor_id, started_at, diagnosis, video_room_code)
VALUES (${appointmentId}, ${appt.doctor_id}, datetime('now'), …, '${roomCode(appointmentId)}');`,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function saveConsultation(payload: {
  consultationId: number;
  diagnosis: string;
  notes: string;
  isSensitive: boolean;
  complete: boolean;
}): Promise<ActionResult> {
  const { consultationId, diagnosis, notes, isSensitive, complete } = payload;
  const denied = await guardDoctor(appointmentOf(consultationId));
  if (denied) return denied;
  if (!diagnosis.trim()) return { ok: false, message: "A diagnosis is required before saving." };

  try {
    const { fired } = capturing(() =>
      txn(() => {
        run(
          `UPDATE consultation
              SET diagnosis = ?, clinical_notes = ?, is_sensitive = ?,
                  ended_at = CASE WHEN ? = 1 THEN datetime('now') ELSE ended_at END
            WHERE consultation_id = ?`,
          diagnosis.trim(),
          notes.trim() || null,
          isSensitive ? 1 : 0,
          complete ? 1 : 0,
          consultationId,
        );
        if (complete) {
          run(
            `UPDATE appointment SET status = 'COMPLETED'
              WHERE appointment_id = (SELECT appointment_id FROM consultation WHERE consultation_id = ?)`,
            consultationId,
          );
        }
      }),
    );

    refreshAll();
    return {
      ok: true,
      message: complete
        ? `Consultation #${consultationId} closed and the appointment marked COMPLETED.`
        : `Consultation #${consultationId} saved.`,
      detail: fired,
      sql: `UPDATE consultation SET diagnosis = …, clinical_notes = …, is_sensitive = ${isSensitive ? 1 : 0}
 WHERE consultation_id = ${consultationId};`,
    };
  } catch (error) {
    return fail(error);
  }
}

/* ============================================================ 4. prescribing */

export async function prescribe(payload: {
  consultationId: number;
  advice: string;
  items: {
    drugId: number;
    dosage: string;
    frequency: string;
    durationDays: number;
    quantity: number;
  }[];
}): Promise<ActionResult> {
  const { consultationId, advice, items } = payload;
  const denied = await guardDoctor(appointmentOf(consultationId));
  if (denied) return denied;
  if (!items.length) return { ok: false, message: "Add at least one medicine to the prescription." };

  const bad = items.find((i) => i.quantity < 1 || i.durationDays < 1);
  if (bad) return { ok: false, message: "Every line needs a duration and a quantity of at least 1." };

  try {
    const { result, fired } = capturing(() =>
      txn(() => {
        let rx = one<{ prescription_id: number }>(
          "SELECT prescription_id FROM prescription WHERE consultation_id = ? ORDER BY prescription_id LIMIT 1",
          consultationId,
        );
        if (!rx) {
          const info = run(
            "INSERT INTO prescription (consultation_id, advice, status) VALUES (?, ?, 'ACTIVE')",
            consultationId,
            advice.trim() || null,
          );
          rx = { prescription_id: Number(info.lastInsertRowid) };
        } else if (advice.trim()) {
          run("UPDATE prescription SET advice = ? WHERE prescription_id = ?", advice.trim(), rx.prescription_id);
        }

        let line = scalar<number>(
          "SELECT COALESCE(MAX(line_no), 0) FROM prescription_item WHERE prescription_id = ?",
          rx.prescription_id,
        );
        for (const item of items) {
          line += 1;
          run(
            `INSERT INTO prescription_item (prescription_id, line_no, drug_id, dosage, frequency, duration_days, quantity)
             VALUES (?,?,?,?,?,?,?)`,
            rx.prescription_id,
            line,
            item.drugId,
            item.dosage || "1 unit",
            item.frequency || "BD after food",
            item.durationDays,
            item.quantity,
          );
        }
        return rx.prescription_id;
      }),
    );

    const alerts = all<{ severity: string; message: string }>(
      "SELECT severity, message FROM clinical_alert WHERE prescription_id = ? AND acknowledged = 0",
      result,
    );

    refreshAll();
    return {
      ok: true,
      message: `Prescription #${result} issued — ${items.length} medicine(s) went straight into the student's cart and they have been notified.`,
      detail: [
        ...fired,
        ...alerts.map((a) => `CLINICAL ALERT [${a.severity}] — ${a.message}`),
      ],
      sql: `INSERT INTO prescription_item (prescription_id, line_no, drug_id, dosage, frequency, duration_days, quantity)
VALUES (${result}, …);  -- ${items.length} line(s)
-- trg_prescription_to_cart and trg_notify_prescription then do the rest`,
    };
  } catch (error) {
    return fail(error);
  }
}

/* ========================================================= 5. medical leave */

export async function grantLeave(payload: {
  consultationId: number;
  days: number;
  reason: string;
  diagnosisNote: string;
  advice: string;
  fitToResume: string;
}): Promise<ActionResult> {
  const { consultationId, days, reason, diagnosisNote, advice, fitToResume } = payload;
  const denied = await guardDoctor(appointmentOf(consultationId));
  if (denied) return denied;

  if (!days || days < 1 || days > 30) {
    return { ok: false, message: "Leave duration must be between 1 and 30 days." };
  }
  if (!reason.trim()) return { ok: false, message: "State the reason the leave is being recommended." };

  const consult = one<{ doctor_id: number; reg_no: string }>(
    `SELECT c.doctor_id, a.reg_no
       FROM consultation c JOIN appointment a ON a.appointment_id = c.appointment_id
      WHERE c.consultation_id = ?`,
    consultationId,
  );
  if (!consult) return { ok: false, message: `Consultation #${consultationId} does not exist.` };

  try {
    const { result, fired } = capturing(() =>
      txn(() => {
        // Issued already VERIFIED: that is what makes the database fan the
        // condonation requests out to every enrolled course by itself (T8).
        const cert = run(
          `INSERT INTO medical_certificate (consultation_id, reg_no, issued_by, valid_from, valid_to, reason, status)
           VALUES (?, ?, ?, date('now'), date('now', '+' || ? || ' day'), ?, 'VERIFIED')`,
          consultationId,
          consult.reg_no,
          consult.doctor_id,
          days - 1,
          reason.trim(),
        );
        const certificateId = Number(cert.lastInsertRowid);

        const nextDoc = scalar<number>("SELECT COALESCE(MAX(document_id), 0) + 1 FROM leave_document");
        const refNo = `VIT/HC/ML/${new Date().getFullYear()}/${String(nextDoc).padStart(4, "0")}`;

        const doc = run(
          `INSERT INTO leave_document (certificate_id, reg_no, issued_by, ref_no, days_granted,
                                       valid_from, valid_to, diagnosis_note, advice, fit_to_resume)
           VALUES (?, ?, ?, ?, ?, date('now'), date('now', '+' || ? || ' day'), ?, ?, ?)`,
          certificateId,
          consult.reg_no,
          consult.doctor_id,
          refNo,
          days,
          days - 1,
          diagnosisNote.trim() || reason.trim(),
          advice.trim() || null,
          fitToResume.trim() || `Fit to resume academic duties after ${days} day(s) of rest.`,
        );
        return { documentId: Number(doc.lastInsertRowid), refNo, certificateId };
      }),
    );

    const recipients = all<{ recipient_role: string; recipient_name: string }>(
      "SELECT recipient_role, recipient_name FROM document_recipient WHERE document_id = ?",
      result.documentId,
    );
    const condonations = scalar<number>(
      "SELECT COUNT(*) FROM condonation_request WHERE certificate_id = ?",
      result.certificateId,
    );

    refreshAll();
    return {
      ok: true,
      message: `Leave letter ${result.refNo} generated for ${days} day(s) and delivered to ${recipients
        .map((r) => r.recipient_name)
        .join(", ")}.`,
      detail: [
        ...fired,
        `${condonations} condonation request(s) were auto-raised against the student's enrolled courses.`,
      ],
      sql: `INSERT INTO medical_certificate (…, status) VALUES (…, 'VERIFIED');
INSERT INTO leave_document (certificate_id, ref_no, days_granted, …) VALUES (…);
-- trg_leave_document_fanout copies it to the student, proctor and HOD`,
    };
  } catch (error) {
    return fail(error);
  }
}

/* ================================================================== 6. cart */

export async function addToCart(regNo: string, drugId: number, quantity = 1): Promise<ActionResult> {
  const denied = await guardStudent(regNo);
  if (denied) return denied;
  if (!regNo) return { ok: false, message: "Load your profile first." };
  if (quantity < 1) return { ok: false, message: "Quantity must be at least 1." };

  const drug = one<{ name: string; requires_rx: number }>(
    "SELECT name, requires_rx FROM drug WHERE drug_id = ?",
    drugId,
  );
  if (!drug) return { ok: false, message: "That medicine is not in the catalogue." };
  if (drug.requires_rx === 1) {
    return {
      ok: false,
      message: `${drug.name} is a prescription-only medicine — it can only reach your cart from a doctor.`,
    };
  }

  try {
    run(
      `INSERT INTO cart_item (reg_no, drug_id, quantity, source) VALUES (?, ?, ?, 'SELF')
         ON CONFLICT (reg_no, drug_id, source) DO UPDATE SET quantity = cart_item.quantity + excluded.quantity`,
      regNo,
      drugId,
      quantity,
    );
    revalidatePath("/student");
    return { ok: true, message: `${drug.name} added to your cart.` };
  } catch (error) {
    return fail(error);
  }
}

export async function setCartQty(cartItemId: number, quantity: number): Promise<ActionResult> {
  const denied = await guardCartLine(cartItemId);
  if (denied) return denied;
  try {
    if (quantity < 1) run("DELETE FROM cart_item WHERE cart_item_id = ?", cartItemId);
    else run("UPDATE cart_item SET quantity = ? WHERE cart_item_id = ?", quantity, cartItemId);
    revalidatePath("/student");
    return { ok: true, message: "Cart updated." };
  } catch (error) {
    return fail(error);
  }
}

export async function removeCartLine(cartItemId: number): Promise<ActionResult> {
  const denied = await guardCartLine(cartItemId);
  if (denied) return denied;
  const line = one<{ source: string }>("SELECT source FROM cart_item WHERE cart_item_id = ?", cartItemId);
  if (line?.source === "RX") {
    return {
      ok: false,
      message: "Prescribed lines cannot be removed — they were written by your doctor. Order them or leave them.",
    };
  }
  run("DELETE FROM cart_item WHERE cart_item_id = ?", cartItemId);
  revalidatePath("/student");
  return { ok: true, message: "Item removed from cart." };
}

/* ============================================================== 7. checkout */

export async function checkout(payload: {
  regNo: string;
  paymentMode: string;
  cartItemIds: number[];
}): Promise<ActionResult> {
  const { regNo, paymentMode, cartItemIds } = payload;
  const denied = await guardStudent(regNo);
  if (denied) return denied;
  if (!cartItemIds.length) return { ok: false, message: "Your cart is empty." };

  const student = one<{ campus_id: number }>("SELECT campus_id FROM student WHERE reg_no = ?", regNo);
  if (!student) return { ok: false, message: "Profile not found." };

  const pharmacy = one<{ pharmacy_id: number }>(
    "SELECT pharmacy_id FROM pharmacy WHERE campus_id = ? ORDER BY pharmacy_id LIMIT 1",
    student.campus_id,
  );
  if (!pharmacy) return { ok: false, message: "No pharmacy serves your campus." };

  const address = one<{ address_id: number }>(
    "SELECT address_id FROM delivery_address WHERE reg_no = ? ORDER BY is_default DESC LIMIT 1",
    regNo,
  );
  if (!address) {
    return { ok: false, message: "No delivery address on file — add your hostel block and room in your profile." };
  }

  const placeholders = cartItemIds.map(() => "?").join(",");
  const lines = all<{
    cart_item_id: number;
    drug_id: number;
    quantity: number;
    unit_price: number;
    source: string;
    prescription_id: number | null;
    drug_name: string;
  }>(
    `SELECT ci.cart_item_id, ci.drug_id, ci.quantity, d.unit_price, ci.source,
            ci.prescription_id, d.name AS drug_name
       FROM cart_item ci JOIN drug d ON d.drug_id = ci.drug_id
      WHERE ci.reg_no = ? AND ci.cart_item_id IN (${placeholders})`,
    regNo,
    ...cartItemIds,
  );
  if (!lines.length) return { ok: false, message: "Those cart lines no longer exist." };

  const rxLine = lines.find((l) => l.source === "RX" && l.prescription_id);
  const orderType = lines.some((l) => l.source === "RX") ? "RX" : "OTC";

  try {
    const { result, fired } = capturing(() =>
      txn(() => {
        const info = run(
          `INSERT INTO pharmacy_order (reg_no, pharmacy_id, address_id, prescription_id, order_type, payment_mode)
           VALUES (?,?,?,?,?,?)`,
          regNo,
          pharmacy.pharmacy_id,
          address.address_id,
          rxLine?.prescription_id ?? null,
          orderType,
          paymentMode,
        );
        const orderId = Number(info.lastInsertRowid);

        lines.forEach((line, index) => {
          run(
            `INSERT INTO order_item (order_id, line_no, drug_id, quantity, unit_price, line_total)
             VALUES (?,?,?,?,?,?)`,
            orderId,
            index + 1,
            line.drug_id,
            line.quantity,
            line.unit_price,
            Math.round(line.unit_price * line.quantity * 100) / 100,
          );
        });

        // The lines have become order lines, so they leave the cart.
        run(`DELETE FROM cart_item WHERE cart_item_id IN (${placeholders})`, ...cartItemIds);

        run(
          `INSERT INTO notification (reg_no, kind, title, body, ref_table, ref_id)
           VALUES (?, 'ORDER', 'Order #' || ? || ' placed',
                   ? || ' item(s) are on the way to your hostel room. Payment: ' || ? || '.',
                   'pharmacy_order', ?)`,
          regNo,
          orderId,
          lines.length,
          paymentMode,
          orderId,
        );
        return orderId;
      }),
    );

    const total = scalar<number>("SELECT total_amount FROM pharmacy_order WHERE order_id = ?", result);
    refreshAll();
    return {
      ok: true,
      message: `Order #${result} placed · ₹${total.toFixed(2)} · ${
        paymentMode === "COD" ? "cash on delivery" : paymentMode
      }.`,
      detail: fired,
      sql: `INSERT INTO pharmacy_order (…) VALUES (…);
INSERT INTO order_item (…) VALUES (…);  -- ${lines.length} line(s)
-- trg_stock_availability_guard, then trg_stock_deduct rolls the total up`,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function advanceDelivery(orderId: number): Promise<ActionResult> {
  const flow = ["PLACED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"];
  const current = scalar<string>("SELECT status FROM pharmacy_order WHERE order_id = ?", orderId);
  const next = flow[flow.indexOf(current) + 1];
  if (!next) return { ok: false, message: `Order #${orderId} is already ${current.toLowerCase()}.` };

  try {
    const { fired } = capturing(() =>
      run("UPDATE pharmacy_order SET status = ? WHERE order_id = ?", next, orderId),
    );
    refreshAll();
    return {
      ok: true,
      message: `Order #${orderId} → ${next.replace(/_/g, " ").toLowerCase()}.`,
      detail: fired,
      sql: `UPDATE pharmacy_order SET status = '${next}' WHERE order_id = ${orderId};`,
    };
  } catch (error) {
    return fail(error);
  }
}

/* ========================================================= 8. notifications */

export async function markAllRead(regNo: string): Promise<ActionResult> {
  const denied = await guardStudent(regNo);
  if (denied) return denied;
  run("UPDATE notification SET is_read = 1 WHERE reg_no = ? AND is_read = 0", regNo);
  revalidatePath("/student");
  return { ok: true, message: "Inbox marked as read." };
}
