"use client";

import { useEffect, useMemo, useState } from "react";
import { Database, Search, Table2 } from "lucide-react";
import {
  MODULES,
  TABLE_KIND_LABEL,
  type ErModel,
  type ErTable,
  type ModuleKey,
} from "@/lib/db/model";
import { Card, Chip, Empty, Table, Td, Th } from "@/components/ui";

const KIND_TONE = {
  strong: "neutral",
  weak: "warn",
  associative: "info",
  subclass: "violet",
  system: "neutral",
} as const;

export function SchemaExplorer({ model }: { model: ErModel }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string>(model.tables[0]?.name ?? "");

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<ModuleKey, ErTable[]>();
    for (const t of model.tables) {
      const hit =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.columns.some((c) => c.name.toLowerCase().includes(q));
      if (!hit) continue;
      map.set(t.module, [...(map.get(t.module) ?? []), t]);
    }
    return map;
  }, [model.tables, query]);

  const table = model.tables.find((t) => t.name === active) ?? null;

  return (
    <div className="flex h-[calc(100vh-56px)] min-h-0">
      {/* ------------------------------------------------------ table list */}
      <div className="flex w-[262px] shrink-0 flex-col border-r border-line bg-surface">
        <div className="border-b border-line p-3">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mute" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter tables or columns…"
              className="w-full rounded-lg border border-line bg-sunk py-1.5 pl-7 pr-2.5 text-[12px] outline-none transition placeholder:text-ink-mute focus:border-brand focus:bg-surface"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {[...grouped.entries()].length === 0 && (
            <p className="px-2 py-6 text-center text-[11.5px] text-ink-mute">No match</p>
          )}
          {(Object.keys(MODULES) as ModuleKey[]).map((key) => {
            const list = grouped.get(key);
            if (!list?.length) return null;
            return (
              <div key={key} className="mb-3">
                <p className="eyebrow flex items-center gap-1.5 px-2 pb-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: MODULES[key].hue }} />
                  {MODULES[key].label}
                </p>
                <ul className="space-y-px">
                  {list.map((t) => (
                    <li key={t.name}>
                      <button
                        onClick={() => setActive(t.name)}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-left text-[11.5px] transition ${
                          active === t.name
                            ? "bg-sunk font-semibold text-ink"
                            : "text-ink-soft hover:bg-sunk/70"
                        }`}
                      >
                        <span className="mono min-w-0 flex-1 truncate">{t.name}</span>
                        <span className="mono shrink-0 text-[9.5px] tabular-nums text-ink-mute">
                          {t.rowCount}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="border-t border-line px-3 py-2.5">
          <p className="mono text-[10px] text-ink-mute">
            {model.stats.tables} tables · {model.stats.columns} columns · {model.stats.rows} rows
          </p>
        </div>
      </div>

      {/* --------------------------------------------------------- detail */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        {table ? <TableDetail table={table} model={model} /> : <Empty>Select a table</Empty>}
      </div>
    </div>
  );
}

function TableDetail({ table, model }: { table: ErTable; model: ErModel }) {
  // Keyed by table name so switching tables shows the loader without a
  // synchronous reset inside the effect.
  const [loaded, setLoaded] = useState<{
    key: string;
    rows: Record<string, unknown>[];
    total: number;
  } | null>(null);
  const current = loaded?.key === table.name ? loaded : null;
  const rows = current?.rows ?? null;
  const total = current?.total ?? 0;
  const hue = MODULES[table.module].hue;

  useEffect(() => {
    let live = true;
    fetch(`/api/table/${table.name}?limit=60`)
      .then((r) => r.json())
      .then((d) => live && setLoaded({ key: table.name, rows: d.rows ?? [], total: d.total ?? 0 }))
      .catch(() => live && setLoaded({ key: table.name, rows: [], total: 0 }));
    return () => {
      live = false;
    };
  }, [table.name]);

  const outgoing = model.edges.filter((e) => e.fromTable === table.name);
  const incoming = model.edges.filter((e) => e.toTable === table.name && e.fromTable !== table.name);

  return (
    <div className="p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <span
          className="grid h-9 w-9 place-items-center rounded-lg text-white"
          style={{ background: hue }}
        >
          <Table2 size={17} />
        </span>
        <div className="min-w-0">
          <h2 className="mono text-[19px] font-semibold tracking-tight">{table.name}</h2>
          <p className="text-[11.5px] text-ink-mute">
            {MODULES[table.module].label} module · {total} rows
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Chip tone={KIND_TONE[table.kind]}>{TABLE_KIND_LABEL[table.kind]}</Chip>
          {table.triggers.length > 0 && <Chip tone="violet">{table.triggers.length} triggers</Chip>}
          <Chip tone="neutral">{table.columns.length} columns</Chip>
        </div>
      </div>

      {/* columns */}
      <Card className="mb-5 overflow-hidden">
        <div className="border-b border-line px-4 py-2.5">
          <p className="eyebrow">PRAGMA table_info</p>
        </div>
        <Table>
          <thead>
            <tr>
              <Th className="w-14">Key</Th>
              <Th>Column</Th>
              <Th>Type</Th>
              <Th>Null</Th>
              <Th>Default</Th>
              <Th>References</Th>
            </tr>
          </thead>
          <tbody>
            {table.columns.map((c) => (
              <tr key={c.name} className={c.pkOrder > 0 ? "bg-amber-50/50" : "hover:bg-sunk/60"}>
                <Td>
                  {c.pkOrder > 0 && (
                    <span className="mono text-[10px] font-bold text-amber-700">
                      PK{table.primaryKey.length > 1 ? c.pkOrder : ""}
                    </span>
                  )}
                  {c.pkOrder === 0 && c.isFk && (
                    <span className="mono text-[10px] font-bold" style={{ color: hue }}>
                      FK
                    </span>
                  )}
                  {c.pkOrder === 0 && !c.isFk && c.isUnique && (
                    <span className="mono text-[10px] font-bold text-emerald-600">U</span>
                  )}
                </Td>
                <Td className="mono font-medium">{c.name}</Td>
                <Td className="mono text-[11px] text-ink-soft">{c.type}</Td>
                <Td className="text-[11px]">
                  {c.notNull ? (
                    <span className="text-rose-600">NOT NULL</span>
                  ) : (
                    <span className="text-ink-mute">nullable</span>
                  )}
                </Td>
                <Td className="mono max-w-[170px] truncate text-[10.5px] text-ink-mute">
                  {c.defaultValue ?? "—"}
                </Td>
                <Td className="mono text-[10.5px]">
                  {c.references ? (
                    <span style={{ color: hue }}>
                      {c.references.table}.{c.references.column}
                    </span>
                  ) : (
                    <span className="text-ink-mute">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <p className="eyebrow mb-2">Outgoing foreign keys</p>
          {outgoing.length === 0 ? (
            <p className="text-[11.5px] text-ink-mute">None — this is a root entity.</p>
          ) : (
            <ul className="space-y-1.5">
              {outgoing.map((e) => (
                <li key={e.id} className="mono text-[10.5px] leading-relaxed text-ink-soft">
                  ({e.fromColumns.join(", ")}) → <strong>{e.toTable}</strong>(
                  {e.toColumns.join(", ")})
                  <span className="block pl-3 text-ink-mute">
                    {e.kind} · child is {e.childCardinality}
                    {e.onDelete !== "NO ACTION" && ` · ON DELETE ${e.onDelete}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <p className="eyebrow mb-2">Referenced by</p>
          {incoming.length === 0 ? (
            <p className="text-[11.5px] text-ink-mute">Nothing references this table.</p>
          ) : (
            <ul className="space-y-1">
              {incoming.map((e) => (
                <li key={e.id} className="mono text-[10.5px] text-ink-soft">
                  <strong>{e.fromTable}</strong>({e.fromColumns.join(", ")})
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <p className="eyebrow mb-2">Indexes & triggers</p>
          <ul className="space-y-1">
            {table.indexes.map((i) => (
              <li key={i.name} className="mono text-[10.5px] text-ink-soft">
                {i.unique && <span className="text-emerald-600">UNIQUE </span>}({i.columns.join(", ")})
              </li>
            ))}
            {table.triggers.map((t) => (
              <li key={t} className="mono text-[10.5px] text-violet-700">
                ⚡ {t}
              </li>
            ))}
            {table.indexes.length === 0 && table.triggers.length === 0 && (
              <li className="text-[11.5px] text-ink-mute">None</li>
            )}
          </ul>
        </Card>
      </div>

      {/* data */}
      <Card className="mb-5 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <Database size={13} className="text-brand" />
          <p className="eyebrow">
            SELECT * FROM {table.name} LIMIT 60
          </p>
          <span className="mono ml-auto text-[10.5px] text-ink-mute">
            showing {Math.min(rows?.length ?? 0, 60)} of {total}
          </span>
        </div>
        {rows === null ? (
          <div
            className="h-40"
            style={{
              background: "linear-gradient(90deg,#f6f7f8 25%,#eef0f1 37%,#f6f7f8 63%) 0 0/200% 100%",
              animation: "shimmer 1.4s linear infinite",
            }}
          />
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-[12px] text-ink-mute">This table is empty.</p>
        ) : (
          <div className="max-h-[440px] overflow-auto">
            <table className="mono w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  {Object.keys(rows[0]).map((k) => (
                    <Th key={k}>{k}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-sunk/60">
                    {Object.keys(rows[0]).map((k) => (
                      <td
                        key={k}
                        className="max-w-[240px] truncate whitespace-nowrap border-b border-line px-3 py-1.5 text-ink-soft"
                        title={String(r[k] ?? "NULL")}
                      >
                        {r[k] === null ? (
                          <span className="text-ink-mute italic">NULL</span>
                        ) : (
                          String(r[k])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-2.5">
          <p className="eyebrow">CREATE TABLE statement</p>
        </div>
        <pre className="mono overflow-x-auto p-4 text-[11px] leading-[1.7] text-ink-soft">
          {table.ddl}
        </pre>
      </Card>
    </div>
  );
}
