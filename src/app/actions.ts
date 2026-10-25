"use server";

import { revalidatePath } from "next/cache";
import { all, db, one, run, scalar } from "@/lib/db";

export type ActionResult = {
  ok: boolean;
  message: string;
  /** DB-level detail worth surfacing: which trigger fired, what it did */
  detail?: string[];
  sql?: string;
};

/** Everything a trigger wrote while `fn` ran. */
function capturingTriggerLog<T>(fn: () => T): { result: T; fired: string[] } {
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
  return { ok: false, message: clean, detail: ["The database rejected the write — no rows changed."] };
}

/* ========================================================== appointments */

export async function bookAppointment(form: FormData): Promise<ActionResult> {
  const regNo = String(form.get("reg_no") ?? "");
  const doctorId = Number(form.get("doctor_id"));
  const slot = String(form.get("slot") ?? "");
  const complaint = String(form.get("chief_complaint") ?? "").trim();
  const triage = String(form.get("triage_level") ?? "GREEN");
  const symptomIds = form.getAll("symptom_id").map(Number).filter(Boolean);
  const [slotDate, slotTime] = slot.split("|");

  if (!regNo || !doctorId || !slotDate || !slotTime || !complaint) {
    return { ok: false, message: "Pick a student, a doctor, a slot and describe the complaint." };
  }

  const sql = `INSERT INTO appointment (reg_no, doctor_id, slot_date, slot_time, mode, triage_level, chief_complaint)
VALUES ('${regNo}', ${doctorId}, '${slotDate}', '${slotTime}', '${form.get("mode") ?? "VIDEO"}', '${triage}', '…');`;

  try {
    const { result, fired } = capturingTriggerLog(() => {
      const info = run(
        `INSERT INTO appointment (reg_no, doctor_id, slot_date, slot_time, mode, triage_level, chief_complaint)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        regNo,
        doctorId,
        slotDate,
        slotTime,
        String(form.get("mode") ?? "VIDEO"),
        triage,
        complaint,
      );
      const appointmentId = Number(info.lastInsertRowid);
      for (const symptomId of symptomIds) {
        run(
          "INSERT OR IGNORE INTO appointment_symptom (appointment_id, symptom_id, severity, duration_days) VALUES (?, ?, ?, ?)",
          appointmentId,
          symptomId,
          Number(form.get(`severity_${symptomId}`) ?? 5),
          Number(form.get("duration_days") ?? 1),
        );
      }
      return appointmentId;
    });

    revalidatePath("/appointments");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: `Appointment #${result} confirmed for ${slotDate} at ${slotTime}.`,
      detail: fired,
      sql,
    };
  } catch (error) {
    return { ...fail(error), sql };
  }
}

export async function cancelAppointment(appointmentId: number): Promise<ActionResult> {
  try {
    const { fired } = capturingTriggerLog(() =>
      run("UPDATE appointment SET status = 'CANCELLED' WHERE appointment_id = ?", appointmentId),
    );
    revalidatePath("/appointments");
    return {
      ok: true,
      message: `Appointment #${appointmentId} cancelled.`,
      detail: fired,
      sql: `UPDATE appointment SET status = 'CANCELLED' WHERE appointment_id = ${appointmentId};`,
    };
  } catch (error) {
    return fail(error);
  }
}

/* ============================================================== pharmacy */

export async function placeOrder(payload: {
  regNo: string;
  pharmacyId: number;
  items: { drugId: number; quantity: number }[];
  paymentMode: string;
}): Promise<ActionResult> {
  const { regNo, pharmacyId, items, paymentMode } = payload;
  if (!regNo || !items.length) return { ok: false, message: "Your cart is empty." };

  const address = one<{ address_id: number }>(
    "SELECT address_id FROM delivery_address WHERE reg_no = ? ORDER BY is_default DESC LIMIT 1",
    regNo,
  );
  if (!address) return { ok: false, message: `No delivery address on file for ${regNo}.` };

  const needsRx = items.some(
    (i) => scalar<number>("SELECT requires_rx FROM drug WHERE drug_id = ?", i.drugId) === 1,
  );

  try {
    const { result, fired } = capturingTriggerLog(() => {
      // A transaction keeps the order and its lines atomic: if any line trips
      // the stock guard, the whole order rolls back.
      db.exec("BEGIN");
      try {
        const info = run(
          `INSERT INTO pharmacy_order (reg_no, pharmacy_id, address_id, order_type, payment_mode)
           VALUES (?, ?, ?, ?, ?)`,
          regNo,
          pharmacyId,
          address.address_id,
          needsRx ? "RX" : "OTC",
          paymentMode,
        );
        const orderId = Number(info.lastInsertRowid);
        items.forEach((item, index) => {
          const price = scalar<number>("SELECT unit_price FROM drug WHERE drug_id = ?", item.drugId);
          run(
            `INSERT INTO order_item (order_id, line_no, drug_id, quantity, unit_price, line_total)
             VALUES (?, ?, ?, ?, ?, ?)`,
            orderId,
            index + 1,
            item.drugId,
            item.quantity,
            price,
            Math.round(price * item.quantity * 100) / 100,
          );
        });
        db.exec("COMMIT");
        return orderId;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    });

    const total = scalar<number>("SELECT total_amount FROM pharmacy_order WHERE order_id = ?", result);
    revalidatePath("/pharmacy");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: `Order #${result} placed · ₹${total.toFixed(2)} · ${paymentMode === "COD" ? "cash on delivery" : paymentMode}.`,
      detail: fired,
      sql: `INSERT INTO pharmacy_order (...) VALUES (...);\nINSERT INTO order_item (...) VALUES (...);  -- ${items.length} line(s)`,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function advanceOrder(orderId: number): Promise<ActionResult> {
  const flow = ["PLACED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"];
  const current = scalar<string>("SELECT status FROM pharmacy_order WHERE order_id = ?", orderId);
  const next = flow[flow.indexOf(current) + 1];
  if (!next) return { ok: false, message: `Order #${orderId} is already ${current}.` };

  try {
    const { fired } = capturingTriggerLog(() =>
      run("UPDATE pharmacy_order SET status = ? WHERE order_id = ?", next, orderId),
    );
    revalidatePath("/pharmacy");
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

/* =========================================================== condonation */

export async function verifyCertificate(certificateId: number): Promise<ActionResult> {
  try {
    const { fired } = capturingTriggerLog(() =>
      run("UPDATE medical_certificate SET status = 'VERIFIED' WHERE certificate_id = ?", certificateId),
    );
    const generated = scalar<number>(
      "SELECT COUNT(*) FROM condonation_request WHERE certificate_id = ?",
      certificateId,
    );
    revalidatePath("/condonation");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: `Certificate #${certificateId} verified — the database fanned out ${generated} condonation request(s) on its own.`,
      detail: fired,
      sql: `UPDATE medical_certificate SET status = 'VERIFIED' WHERE certificate_id = ${certificateId};`,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function decideCondonation(
  requestId: number,
  decision: "APPROVED" | "REJECTED",
  remarks?: string,
): Promise<ActionResult> {
  try {
    const { fired } = capturingTriggerLog(() =>
      run(
        "UPDATE condonation_request SET status = ?, remarks = COALESCE(?, remarks) WHERE request_id = ?",
        decision,
        remarks ?? null,
        requestId,
      ),
    );
    revalidatePath("/condonation");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: `Request #${requestId} ${decision.toLowerCase()}.`,
      detail: fired,
      sql: `UPDATE condonation_request SET status = '${decision}' WHERE request_id = ${requestId};`,
    };
  } catch (error) {
    return fail(error);
  }
}

/* ============================================================ prescribing */

export async function addPrescriptionLine(
  prescriptionId: number,
  drugId: number,
  quantity: number,
): Promise<ActionResult> {
  const nextLine =
    scalar<number>(
      "SELECT COALESCE(MAX(line_no), 0) FROM prescription_item WHERE prescription_id = ?",
      prescriptionId,
    ) + 1;
  try {
    const { fired } = capturingTriggerLog(() =>
      run(
        `INSERT INTO prescription_item (prescription_id, line_no, drug_id, dosage, frequency, duration_days, quantity)
         VALUES (?, ?, ?, '1 unit', 'BD after food', 3, ?)`,
        prescriptionId,
        nextLine,
        drugId,
        quantity,
      ),
    );
    const drug = scalar<string>("SELECT name FROM drug WHERE drug_id = ?", drugId);
    revalidatePath("/lab");
    return {
      ok: true,
      message: `${drug} added to prescription #${prescriptionId} as line ${nextLine}.`,
      detail: fired.length ? fired : ["No interaction found against the other drugs on this prescription."],
      sql: `INSERT INTO prescription_item (prescription_id, line_no, drug_id, dosage, frequency, duration_days, quantity)
VALUES (${prescriptionId}, ${nextLine}, ${drugId}, '1 unit', 'BD after food', 3, ${quantity});`,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function acknowledgeAlert(alertId: number): Promise<ActionResult> {
  run("UPDATE clinical_alert SET acknowledged = 1 WHERE alert_id = ?", alertId);
  revalidatePath("/lab");
  return { ok: true, message: `Alert #${alertId} acknowledged.` };
}

/* ============================================================ SQL console */

const WRITE = /\b(insert|update|delete|drop|alter|create|replace|attach|detach|vacuum|pragma)\b/i;

export async function runQuery(sql: string): Promise<{
  ok: boolean;
  columns: string[];
  rows: unknown[][];
  error?: string;
  ms: number;
  plan?: string[];
}> {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  if (!trimmed) return { ok: false, columns: [], rows: [], error: "Nothing to run.", ms: 0 };
  if (WRITE.test(trimmed)) {
    return {
      ok: false,
      columns: [],
      rows: [],
      error:
        "The console is read-only. Use the Teleconsultation, e-Pharmacy, Condonation or Trigger Lab pages to write — that way every write goes through the real triggers.",
      ms: 0,
    };
  }

  const started = performance.now();
  try {
    const result = all<Record<string, unknown>>(trimmed);
    const ms = performance.now() - started;
    const columns = result.length ? Object.keys(result[0]) : [];
    let plan: string[] = [];
    try {
      plan = all<{ detail: string }>(`EXPLAIN QUERY PLAN ${trimmed}`).map((r) => r.detail);
    } catch {
      plan = [];
    }
    return {
      ok: true,
      columns,
      rows: result.slice(0, 500).map((r) => columns.map((c) => r[c])),
      ms,
      plan,
    };
  } catch (error) {
    return {
      ok: false,
      columns: [],
      rows: [],
      error: error instanceof Error ? error.message : String(error),
      ms: performance.now() - started,
    };
  }
}
