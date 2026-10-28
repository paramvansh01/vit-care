import { randomInt } from "node:crypto";
import { all, one, run } from "@/lib/db";

export type CallSide = "HOST" | "GUEST";

export type CallRow = {
  call_id: number;
  room_code: string;
  caller_id: number | null;
  callee_id: number | null;
  appointment_id: number | null;
  status: "OPEN" | "RINGING" | "ACTIVE" | "ENDED" | "DECLINED" | "MISSED";
  created_at: string;
  rang_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  caller_name: string | null;
  caller_role: string | null;
  callee_name: string | null;
  callee_role: string | null;
};

const CALL_SELECT = `
  SELECT c.*, cu.display_name AS caller_name, cr.role_name AS caller_role,
         ee.display_name AS callee_name, er.role_name AS callee_role
    FROM call_session c
    LEFT JOIN app_user cu ON cu.user_id = c.caller_id
    LEFT JOIN app_role cr ON cr.role_id = cu.role_id
    LEFT JOIN app_user ee ON ee.user_id = c.callee_id
    LEFT JOIN app_role er ON er.role_id = ee.role_id`;

/** How long a call rings before the database marks it MISSED. */
const RING_SECONDS = 45;
/** A peer whose last poll is older than this has left the room. */
export const PRESENCE_SECONDS = 6;

// No 0/O or 1/I: the code is read out loud across a room.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newRoomCode() {
  for (;;) {
    let raw = "";
    for (let i = 0; i < 6; i++) raw += ALPHABET[randomInt(ALPHABET.length)];
    const code = `${raw.slice(0, 3)}-${raw.slice(3)}`;
    if (!one("SELECT 1 FROM call_session WHERE room_code = ?", code)) return code;
  }
}

export function normaliseCode(input: string) {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // Consultation rooms keep their VITC-0001 shape; ad-hoc rooms are ABC-DEF.
  if (raw.startsWith("VITC")) return `VITC-${raw.slice(4)}`;
  return raw.length === 6 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : input.trim().toUpperCase();
}

/** Calls that rang out become MISSED; trg_notify_missed_call does the rest. */
export function expireRinging() {
  run(
    `UPDATE call_session SET status = 'MISSED'
      WHERE status = 'RINGING'
        AND COALESCE(rang_at, created_at) < datetime('now', ?)`,
    `-${RING_SECONDS} second`,
  );
}

export function callByCode(code: string) {
  return one<CallRow>(`${CALL_SELECT} WHERE c.room_code = ?`, code) ?? ensureConsultationCall(code);
}

export function callsFor(userId: number, limit = 20) {
  return all<CallRow>(
    `${CALL_SELECT} WHERE c.caller_id = ? OR c.callee_id = ?
      ORDER BY c.call_id DESC LIMIT ?`,
    userId,
    userId,
    limit,
  );
}

export function incomingFor(userId: number) {
  return all<CallRow>(
    `${CALL_SELECT} WHERE c.callee_id = ? AND c.status = 'RINGING'
      ORDER BY c.call_id DESC`,
    userId,
  );
}

/** The app_user behind a doctor or a student, if they have an account. */
export function userForDoctor(doctorId: number) {
  return one<{ user_id: number }>(
    `SELECT u.user_id FROM app_user u JOIN app_role r ON r.role_id = u.role_id
      WHERE r.role_name = 'DOCTOR' AND u.linked_ref = ?`,
    String(doctorId),
  )?.user_id;
}

export function userForStudent(regNo: string) {
  return one<{ user_id: number }>(
    `SELECT u.user_id FROM app_user u JOIN app_role r ON r.role_id = u.role_id
      WHERE r.role_name = 'STUDENT' AND u.linked_ref = ?`,
    regNo,
  )?.user_id;
}

/**
 * A consultation's room code exists before anyone dials it. The first time it
 * is used, the call row is created from the appointment: doctor calls student.
 */
function ensureConsultationCall(code: string) {
  const consult = one<{ appointment_id: number; doctor_id: number; reg_no: string }>(
    `SELECT c.appointment_id, c.doctor_id, a.reg_no
       FROM consultation c JOIN appointment a ON a.appointment_id = c.appointment_id
      WHERE c.video_room_code = ?`,
    code,
  );
  if (!consult) return undefined;
  run(
    `INSERT OR IGNORE INTO call_session (room_code, caller_id, callee_id, appointment_id, status)
     VALUES (?, ?, ?, ?, 'OPEN')`,
    code,
    userForDoctor(consult.doctor_id) ?? null,
    userForStudent(consult.reg_no) ?? null,
    consult.appointment_id,
  );
  return one<CallRow>(`${CALL_SELECT} WHERE c.room_code = ?`, code);
}

/**
 * Which end of the call this user is. The caller hosts; the callee is the
 * guest. Anyone can claim the empty guest seat of an open room by its code.
 */
export function sideFor(call: CallRow, userId: number): CallSide | null {
  if (call.caller_id === userId) return "HOST";
  if (call.callee_id === userId) return "GUEST";
  if (call.callee_id === null) {
    const claimed = run(
      "UPDATE call_session SET callee_id = ? WHERE call_id = ? AND callee_id IS NULL",
      userId,
      call.call_id,
    );
    if (claimed.changes > 0) {
      call.callee_id = userId;
      return "GUEST";
    }
  }
  return null;
}

export function counterpartName(call: CallRow, side: CallSide) {
  return (side === "HOST" ? call.callee_name : call.caller_name) ?? "the other person";
}

export function placeCall(callerId: number, calleeId: number | null) {
  const code = newRoomCode();
  run(
    `INSERT INTO call_session (room_code, caller_id, callee_id, status, rang_at)
     VALUES (?, ?, ?, ?, CASE WHEN ? IS NULL THEN NULL ELSE datetime('now') END)`,
    code,
    callerId,
    calleeId,
    calleeId ? "RINGING" : "OPEN",
    calleeId,
  );
  return code;
}

/** Rings the guest again, unless they are already in the room. */
export function ring(call: CallRow) {
  if (!call.callee_id) return;
  run(
    `UPDATE call_session
        SET status = 'RINGING', rang_at = datetime('now')
      WHERE call_id = ?
        AND NOT (status = 'ACTIVE' AND guest_seen_at > datetime('now', ?))`,
    call.call_id,
    `-${PRESENCE_SECONDS} second`,
  );
}

export function setStatus(callId: number, status: "ACTIVE" | "DECLINED" | "ENDED") {
  if (status === "ACTIVE") {
    run(
      `UPDATE call_session
          SET status = 'ACTIVE', answered_at = COALESCE(answered_at, datetime('now')), ended_at = NULL
        WHERE call_id = ?`,
      callId,
    );
  } else {
    run(
      "UPDATE call_session SET status = ?, ended_at = datetime('now') WHERE call_id = ?",
      status,
      callId,
    );
  }
}
