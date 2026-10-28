import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { one, run } from "@/lib/db";

export const SESSION_COOKIE = "vitcare_session";

export type Role = "STUDENT" | "DOCTOR" | "PHARMACIST" | "FACULTY" | "ADMIN";

export type SessionUser = {
  user_id: number;
  username: string;
  display_name: string;
  role: Role;
  /** reg_no for a student, doctor_id (as text) for a doctor */
  linked_ref: string | null;
};

const SESSION_SELECT = `
  SELECT u.user_id, u.username, u.display_name, r.role_name AS role, u.linked_ref
    FROM app_session s
    JOIN app_user u ON u.user_id = s.user_id
    JOIN app_role r ON r.role_id = u.role_id
   WHERE s.token = ?`;

/** Resolves the signed-in user from the session cookie, or null. */
export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return one<SessionUser>(SESSION_SELECT, token) ?? null;
}

/** Same lookup for route handlers, which also bump the presence heartbeat. */
export async function touchSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const user = one<SessionUser>(SESSION_SELECT, token);
  if (!user) return null;
  run("UPDATE app_session SET last_seen_at = datetime('now') WHERE token = ?", token);
  return user;
}

export async function requireUser(role?: Role, next?: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(next ? `/?next=${encodeURIComponent(next)}` : "/");
  if (role && user.role !== role) redirect(homeFor(user.role));
  return user;
}

export function homeFor(role: Role) {
  if (role === "DOCTOR") return "/doctor";
  if (role === "STUDENT") return "/student";
  return "/dashboard";
}

/** Opens a session row and hands its token to the browser. Server actions only. */
export async function startSession(userId: number) {
  const token = randomBytes(24).toString("base64url");
  run("INSERT INTO app_session (token, user_id) VALUES (?, ?)", token, userId);
  run("UPDATE app_user SET last_login_at = datetime('now') WHERE user_id = ?", userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) run("DELETE FROM app_session WHERE token = ?", token);
  store.delete(SESSION_COOKIE);
}

/** A user counts as online while any of their sessions polled in the last 20 s. */
export const ONLINE_SQL = `EXISTS (SELECT 1 FROM app_session ss
                                    WHERE ss.user_id = u.user_id
                                      AND ss.last_seen_at > datetime('now', '-20 second'))`;
