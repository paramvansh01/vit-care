import { one, scalar } from "@/lib/db";

/**
 * The strip along the bottom, like a spreadsheet's: a few honest numbers read
 * from the database on every render.
 */
export function StatusBar({ userName }: { userName: string | null }) {
  const tables = scalar<number>(
    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  const triggers = scalar<number>("SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger'");
  const accounts = scalar<number>("SELECT COUNT(*) FROM app_user WHERE password_hash IS NOT NULL");
  const online = scalar<number>(
    "SELECT COUNT(DISTINCT user_id) FROM app_session WHERE last_seen_at > datetime('now', '-20 second')",
  );
  const last = one<{ trigger_name: string; ago: number }>(
    `SELECT trigger_name, CAST((julianday('now') - julianday(at)) * 86400 AS INTEGER) AS ago
       FROM trigger_log ORDER BY log_id DESC LIMIT 1`,
  );

  return (
    <footer className="mono sticky bottom-0 z-20 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-[#f8fcfb] px-4 py-1.5 text-[11.5px] text-ink-soft sm:px-6">
      <span>vitcare.db</span>
      <span className="text-line-strong">·</span>
      <span>
        {tables} tables · {triggers} triggers
      </span>
      <span className="hidden sm:inline">
        {accounts} account{accounts === 1 ? "" : "s"} · {online} online
      </span>
      {last && (
        <span className="ml-auto hidden truncate md:inline">
          last trigger: {last.trigger_name} · {ago(last.ago)}
        </span>
      )}
      <span className={last ? "md:hidden ml-auto" : "ml-auto"}>{userName ? `signed in: ${userName}` : "signed out"}</span>
    </footer>
  );
}

function ago(seconds: number) {
  if (seconds < 60) return `${Math.max(0, seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
