import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "@/lib/password";

export type Row = Record<string, unknown>;

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "vitcare.db");
const SQL_DIR = path.join(process.cwd(), "src", "lib", "db");

// Next.js hot-reloads modules in dev, and `next build` collects page data in
// several worker processes at once. Keep one handle per process on globalThis.
const globalForDb = globalThis as unknown as { __vitcareDb?: DatabaseSync };

function readSql(file: string) {
  return fs.readFileSync(path.join(SQL_DIR, file), "utf8");
}

/** Best-effort PRAGMA: another build worker may hold the lock for a moment. */
function tryExec(database: DatabaseSync, sql: string) {
  try {
    database.exec(sql);
  } catch {
    /* non-fatal - the setting is either already applied or will be retried */
  }
}

function bootstrap(): DatabaseSync {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  const database = new DatabaseSync(DB_FILE, { timeout: 8000 });
  tryExec(database, "PRAGMA busy_timeout = 8000;");
  tryExec(database, "PRAGMA journal_mode = WAL;");
  tryExec(database, "PRAGMA foreign_keys = ON;");

  const built = database
    .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'campus'")
    .get() as { n: number };
  const version = (database.prepare("PRAGMA user_version").get() as { user_version: number })
    .user_version;

  // The file is generated, never authored: one built from an older schema is
  // simply rebuilt rather than migrated.
  if (built.n === 0) build(database, false);
  else if (version < SCHEMA_VERSION) rebuild(database, false);
  return database;
}

/** Bumped whenever schema.sql or triggers.sql changes shape. */
const SCHEMA_VERSION = 4;

/** Password every account in sample.sql signs in with. */
export const SAMPLE_PASSWORD = "vitcare";

function build(database: DatabaseSync, withSample: boolean) {
  database.exec(readSql("schema.sql"));
  database.exec(readSql("triggers.sql"));
  database.exec(readSql("reference.sql"));
  if (withSample) {
    database.exec(readSql("sample.sql"));
    const hash = hashPassword(SAMPLE_PASSWORD);
    database.prepare("UPDATE app_user SET password_hash = ? WHERE password_hash IS NULL").run(hash);
  }
  database.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

function rebuild(conn: DatabaseSync, withSample: boolean) {
  conn.exec("PRAGMA foreign_keys = OFF;");
  const objects = conn
    .prepare(
      `SELECT type, name FROM sqlite_master
        WHERE name NOT LIKE 'sqlite_%'
        ORDER BY CASE type
                   WHEN 'trigger' THEN 0 WHEN 'view' THEN 1
                   WHEN 'index' THEN 2 ELSE 3 END`,
    )
    .all() as { type: string; name: string }[];

  for (const o of objects) {
    if (o.type === "index" && o.name.startsWith("sqlite_autoindex")) continue;
    conn.exec(`DROP ${o.type.toUpperCase()} IF EXISTS "${o.name}"`);
  }
  build(conn, withSample);
  conn.exec("PRAGMA foreign_keys = ON;");
}

function connection(): DatabaseSync {
  if (!globalForDb.__vitcareDb) globalForDb.__vitcareDb = bootstrap();
  return globalForDb.__vitcareDb;
}

/**
 * Opened lazily on first use. Importing this module during `next build` must
 * not touch the file, or parallel workers deadlock on the same database.
 */
export const db: DatabaseSync = new Proxy({} as DatabaseSync, {
  get(_target, prop, receiver) {
    const value = Reflect.get(connection(), prop, receiver) as unknown;
    return typeof value === "function" ? value.bind(connection()) : value;
  },
});

/**
 * Drop every object and rebuild from schema + triggers + reference data.
 * With `withSample`, the demo people and history in sample.sql come too.
 */
export function resetDatabase(withSample = false) {
  rebuild(connection(), withSample);
}

// node:sqlite hands back null-prototype objects, which React refuses to send
// from a Server Component to a Client Component. Re-spread into plain objects.
function plain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

export function all<T = Row>(sql: string, ...params: unknown[]): T[] {
  return (connection().prepare(sql).all(...(params as never[])) as unknown[]).map((r) =>
    plain<T>(r),
  );
}

export function one<T = Row>(sql: string, ...params: unknown[]): T | undefined {
  const row = connection().prepare(sql).get(...(params as never[]));
  return row === undefined ? undefined : plain<T>(row);
}

export function run(sql: string, ...params: unknown[]) {
  return connection().prepare(sql).run(...(params as never[]));
}

export function scalar<T = number>(sql: string, ...params: unknown[]): T {
  const row = one<Record<string, T>>(sql, ...params);
  return row ? (Object.values(row)[0] as T) : (0 as unknown as T);
}

/* ----------------------------------------------------------------- secrets */

/** Columns whose values never leave the server: password hashes and session tokens. */
export const SECRET_COLUMNS = new Set(["password_hash", "token"]);

export function redactRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const key of Object.keys(out)) {
    if (SECRET_COLUMNS.has(key.toLowerCase()) && out[key] != null) out[key] = "•••••• (redacted)";
  }
  return out as T;
}
