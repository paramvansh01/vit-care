"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Clock, Database, Eye, Play, Route, Table2 } from "lucide-react";
import { runQuery } from "@/app/actions";
import { Card, Chip, Empty } from "@/components/ui";

type Preset = { label: string; blurb: string; sql: string };
type Result = Awaited<ReturnType<typeof runQuery>>;

export function SqlConsole({
  presets,
  tables,
  views,
  columns,
}: {
  presets: Preset[];
  tables: { name: string; rows: number }[];
  views: string[];
  columns: Record<string, string[]>;
}) {
  const [sql, setSql] = useState(presets[0].sql);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();
  const [openTable, setOpenTable] = useState<string | null>(null);

  function execute(text = sql) {
    startTransition(async () => {
      setResult(await runQuery(text));
    });
  }

  return (
    <div className="flex h-[calc(100vh-56px)] min-h-0">
      {/* ----------------------------------------------------- left rail */}
      <aside className="hidden w-[240px] shrink-0 flex-col overflow-y-auto border-r border-line bg-surface lg:flex">
        <div className="p-3">
          <p className="eyebrow mb-2">Saved queries</p>
          <ul className="space-y-1">
            {presets.map((p) => (
              <li key={p.label}>
                <button
                  onClick={() => {
                    setSql(p.sql);
                    execute(p.sql);
                  }}
                  className="w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-sunk"
                >
                  <span className="block text-[11.5px] font-medium leading-snug">{p.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-ink-mute">
                    {p.blurb}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-line p-3">
          <p className="eyebrow mb-2 flex items-center gap-1.5">
            <Table2 size={11} /> Tables
          </p>
          <ul className="space-y-px">
            {tables.map((t) => (
              <li key={t.name}>
                <button
                  onClick={() => setOpenTable(openTable === t.name ? null : t.name)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] transition hover:bg-sunk"
                >
                  <span className="mono min-w-0 flex-1 truncate text-ink-soft">{t.name}</span>
                  <span className="mono shrink-0 text-[9.5px] text-ink-mute">{t.rows}</span>
                </button>
                {openTable === t.name && (
                  <ul className="fade ml-2 border-l border-line pl-2">
                    {(columns[t.name] ?? []).map((c) => (
                      <li
                        key={c}
                        className="mono cursor-pointer py-[1px] text-[10px] text-ink-mute hover:text-brand"
                        onClick={() => setSql((s) => s + c)}
                      >
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          <p className="eyebrow mb-2 mt-4 flex items-center gap-1.5">
            <Eye size={11} /> Views
          </p>
          <ul className="space-y-px">
            {views.map((v) => (
              <li key={v}>
                <button
                  onClick={() => {
                    const q = `SELECT * FROM ${v} LIMIT 50`;
                    setSql(q);
                    execute(q);
                  }}
                  className="mono w-full truncate rounded px-2 py-1 text-left text-[11px] text-ink-soft transition hover:bg-sunk"
                >
                  {v}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* -------------------------------------------------------- editor */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-line bg-surface p-3">
          <div className="relative">
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  execute();
                }
              }}
              spellCheck={false}
              rows={9}
              className="mono w-full resize-y rounded-xl border border-line bg-[#fcfcfb] p-3.5 text-[12.5px] leading-[1.7] text-ink outline-none transition focus:border-brand focus:bg-surface"
            />
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              onClick={() => execute()}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg bg-brand-deep px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-brand disabled:opacity-60"
            >
              <Play size={12} />
              {pending ? "Running…" : "Run query"}
            </button>
            <span className="text-[11px] text-ink-mute">
              <kbd className="mono rounded border border-line bg-sunk px-1.5 py-0.5 text-[10px]">
                Ctrl
              </kbd>
              {" + "}
              <kbd className="mono rounded border border-line bg-sunk px-1.5 py-0.5 text-[10px]">
                Enter
              </kbd>
            </span>
            <Chip tone="neutral" className="ml-auto">
              <Database size={10} /> read-only session
            </Chip>
          </div>
        </div>

        {/* ------------------------------------------------------ result */}
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {!result && (
            <Empty>Run a query, or pick one from the list on the left.</Empty>
          )}

          {result && !result.ok && (
            <Card className="border-rose-200 bg-rose-50/60 p-4">
              <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-rose-800">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {result.error}
              </p>
            </Card>
          )}

          {result?.ok && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Chip tone="ok">
                  {result.rows.length} row{result.rows.length === 1 ? "" : "s"}
                </Chip>
                <Chip tone="neutral">
                  <Clock size={10} />
                  {result.ms.toFixed(1)} ms
                </Chip>
                <Chip tone="neutral">{result.columns.length} columns</Chip>
              </div>

              {result.rows.length === 0 ? (
                <Empty>The query ran successfully and returned no rows.</Empty>
              ) : (
                <Card className="mb-4 overflow-hidden">
                  <div className="max-h-[52vh] overflow-auto">
                    <table className="mono w-full border-collapse text-[11.5px]">
                      <thead>
                        <tr>
                          {result.columns.map((c) => (
                            <th
                              key={c}
                              className="sticky top-0 z-10 whitespace-nowrap border-b border-line bg-surface px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-mute"
                            >
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, i) => (
                          <tr key={i} className="hover:bg-sunk/60">
                            {row.map((cell, j) => (
                              <td
                                key={j}
                                className="max-w-[320px] truncate whitespace-nowrap border-b border-line px-3 py-1.5 text-ink-soft"
                                title={String(cell ?? "NULL")}
                              >
                                {cell === null ? (
                                  <span className="italic text-ink-mute">NULL</span>
                                ) : (
                                  String(cell)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {result.plan && result.plan.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                    <Route size={13} className="text-brand" />
                    <p className="eyebrow">EXPLAIN QUERY PLAN</p>
                  </div>
                  <ul className="p-3">
                    {result.plan.map((p, i) => (
                      <li key={i} className="mono py-0.5 text-[11px] text-ink-soft">
                        <span className="text-ink-mute">{i + 1}.</span> {p}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
