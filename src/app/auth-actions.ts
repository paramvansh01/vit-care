"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions";
import { currentUser, endSession, homeFor, startSession, type Role } from "@/lib/auth";
import { db, one, resetDatabase, run, scalar } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { topUpSlots } from "@/lib/care";

export type AuthResult = ActionResult & { next?: string };

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/* ================================================================= sign in */

export async function signIn(form: FormData): Promise<AuthResult> {
  const username = str(form, "username");
  const password = String(form.get("password") ?? "");
  if (!username) return { ok: false, message: "Enter your registration number or email.", field: "username" };
  if (!password) return { ok: false, message: "Enter your password.", field: "password" };

  const user = one<{ user_id: number; password_hash: string | null; role: Role; display_name: string }>(
    `SELECT u.user_id, u.password_hash, r.role_name AS role, u.display_name
       FROM app_user u JOIN app_role r ON r.role_id = u.role_id
      WHERE u.username = ?`,
    username,
  );
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { ok: false, message: "That username and password do not match an account.", field: "password" };
  }

  await startSession(user.user_id);
  revalidatePath("/", "layout");
  const next = str(form, "next");
  return {
    ok: true,
    message: `Signed in as ${user.display_name}.`,
    next: next.startsWith("/") && !next.startsWith("//") ? next : homeFor(user.role),
  };
}

export async function signOut(): Promise<void> {
  await endSession();
  revalidatePath("/", "layout");
}

/* ====================================================== doctor registration */

/**
 * Registers a clinician: the EER superclass row, exactly one subclass row,
 * their specialisations, a week of open slots, and the login. A doctor
 * registering themselves is signed straight in; anyone else adding a doctor
 * stays signed in as themselves and hands the doctor the credentials.
 */
export async function registerDoctor(form: FormData): Promise<AuthResult> {
  const name = str(form, "name");
  const email = str(form, "email").toLowerCase();
  const council = str(form, "reg_council_no").toUpperCase();
  const type = str(form, "doctor_type");
  const campusId = Number(form.get("campus_id"));
  const years = Number(form.get("years_experience") || 0);
  const fee = Number(form.get("consult_fee") || 0);
  const password = String(form.get("password") ?? "");
  const specIds = form.getAll("spec_id").map(Number).filter(Boolean);

  const bad = (field: string, message: string): AuthResult => ({ ok: false, message, field });
  if (!name) return bad("name", "Enter the doctor's full name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("email", "That email address is not valid.");
  if (!council) return bad("reg_council_no", "Enter the medical council registration number.");
  if (!one("SELECT 1 FROM campus WHERE campus_id = ?", campusId)) return bad("campus_id", "Choose a campus.");
  if (!(years >= 0 && years <= 60)) return bad("years_experience", "Years of experience must be between 0 and 60.");
  if (!(fee >= 0)) return bad("consult_fee", "The consultation fee cannot be negative.");
  if (!["GP", "SPECIALIST", "COUNSELOR"].includes(type)) return { ok: false, message: "Choose the kind of doctor." };
  if (password.length < 6) return bad("password", "Set a password of at least 6 characters.");
  if (one("SELECT 1 FROM app_user WHERE username = ?", email) || one("SELECT 1 FROM doctor WHERE LOWER(email) = ?", email)) {
    return bad("email", `${email} is already registered.`);
  }
  if (one("SELECT 1 FROM doctor WHERE reg_council_no = ?", council)) {
    return bad("reg_council_no", `Council number ${council} is already registered to another doctor.`);
  }

  const me = await currentUser();
  let doctorId = 0;
  let userId = 0;
  let slots = 0;

  db.exec("BEGIN");
  try {
    doctorId = Number(
      run(
        `INSERT INTO doctor (campus_id, name, email, reg_council_no, doctor_type, years_experience, consult_fee)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        campusId,
        name,
        email,
        council,
        type,
        years,
        fee,
      ).lastInsertRowid,
    );

    // Disjoint, total specialisation: one subclass row, chosen by doctor_type.
    if (type === "GP") {
      run(
        "INSERT INTO gp_doctor (doctor_id, opd_room, walk_in_hours) VALUES (?, ?, ?)",
        doctorId,
        str(form, "opd_room") || "Health Centre OPD",
        str(form, "walk_in_hours") || "09:00-17:00",
      );
    } else if (type === "SPECIALIST") {
      run(
        "INSERT INTO specialist_doctor (doctor_id, board_certification, referral_only, tertiary_hospital) VALUES (?, ?, ?, ?)",
        doctorId,
        str(form, "board_certification") || "MD",
        form.get("referral_only") ? 1 : 0,
        str(form, "tertiary_hospital") || null,
      );
    } else {
      run(
        "INSERT INTO counselor (doctor_id, therapy_modality, confidentiality_tier) VALUES (?, ?, ?)",
        doctorId,
        str(form, "therapy_modality") || "Cognitive Behavioural Therapy",
        ["STANDARD", "ELEVATED", "SEALED"].includes(str(form, "confidentiality_tier"))
          ? str(form, "confidentiality_tier")
          : "ELEVATED",
      );
    }

    specIds.forEach((specId, i) => {
      run(
        `INSERT OR IGNORE INTO doctor_specialization (doctor_id, spec_id, certified_on, is_primary)
         VALUES (?, ?, date('now'), ?)`,
        doctorId,
        specId,
        i === 0 ? 1 : 0,
      );
    });

    slots = topUpSlots(doctorId);

    userId = Number(
      run(
        `INSERT INTO app_user (role_id, username, display_name, linked_ref, password_hash)
         VALUES ((SELECT role_id FROM app_role WHERE role_name = 'DOCTOR'), ?, ?, ?, ?)`,
        email,
        name,
        String(doctorId),
        hashPassword(password),
      ).lastInsertRowid,
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    const raw = error instanceof Error ? error.message : String(error);
    return { ok: false, message: raw.replace(/^.*?:\s*/, "") || raw };
  }

  revalidatePath("/", "layout");
  if (!me) {
    await startSession(userId);
    return { ok: true, message: `Welcome, ${name}. ${slots} open slots were published for the next week.`, next: "/doctor" };
  }
  return {
    ok: true,
    message: `${name} is registered with ${slots} open slots. They sign in with ${email} and the password you set.`,
  };
}

/* =================================================================== reset */

export async function resetDb(withSample: boolean): Promise<ActionResult> {
  try {
    resetDatabase(withSample);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
  // Every session row went with the old database, so this browser is signed out.
  await endSession();
  revalidatePath("/", "layout");
  const students = scalar<number>("SELECT COUNT(*) FROM student");
  return {
    ok: true,
    message: withSample
      ? `Rebuilt with sample data: ${students} students. Sample accounts use the password "vitcare".`
      : "Rebuilt with reference data only — no students or doctors yet.",
  };
}
