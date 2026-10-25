import { all, db } from "./index";
import {
  MODULES,
  MODULE_OF,
  SYSTEM_TABLES,
  type ErColumn,
  type ErEdge,
  type ErModel,
  type ErTable,
  type EdgeKind,
} from "./model";

export * from "./model";
export { MODULES };

/* ----------------------------------------------------------- raw pragmas */

type PragmaColumn = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

type PragmaFk = {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string | null;
  on_update: string;
  on_delete: string;
};

type PragmaIndex = { seq: number; name: string; unique: number; origin: string; partial: number };

/**
 * Reads the live schema straight out of SQLite. Nothing here is hand-written:
 * every table, column, key and relationship on the ER canvas comes from
 * sqlite_master + PRAGMA, so the diagram can never drift from the database.
 */
export function introspect(): ErModel {
  const master = all<{ name: string; type: string; tbl_name: string; sql: string | null }>(
    "SELECT name, type, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name",
  );

  const tableNames = master.filter((m) => m.type === "table").map((m) => m.name);
  const ddlByName = new Map(master.map((m) => [m.name, m.sql ?? ""]));

  const triggersByTable = new Map<string, string[]>();
  const triggerList: { name: string; table: string; ddl: string }[] = [];
  for (const m of master.filter((x) => x.type === "trigger")) {
    const list = triggersByTable.get(m.tbl_name) ?? [];
    list.push(m.name);
    triggersByTable.set(m.tbl_name, list);
    triggerList.push({ name: m.name, table: m.tbl_name, ddl: m.sql ?? "" });
  }

  const views = master
    .filter((m) => m.type === "view")
    .map((m) => ({ name: m.name, ddl: m.sql ?? "" }));

  const tables: ErTable[] = [];
  const edges: ErEdge[] = [];
  const fkByTable = new Map<string, { columns: string[]; parent: string; parentColumns: string[]; onDelete: string }[]>();

  // pass 1 - columns, keys, indexes, foreign keys
  for (const name of tableNames) {
    const cols = db.prepare(`PRAGMA table_info("${name}")`).all() as unknown as PragmaColumn[];
    const fks = db.prepare(`PRAGMA foreign_key_list("${name}")`).all() as unknown as PragmaFk[];
    const idxs = db.prepare(`PRAGMA index_list("${name}")`).all() as unknown as PragmaIndex[];

    // composite FKs arrive as several rows sharing the same `id`
    const grouped = new Map<number, PragmaFk[]>();
    for (const fk of fks) {
      const list = grouped.get(fk.id) ?? [];
      list.push(fk);
      grouped.set(fk.id, list);
    }
    const constraints = [...grouped.values()].map((rows) => {
      const ordered = [...rows].sort((a, b) => a.seq - b.seq);
      return {
        columns: ordered.map((r) => r.from),
        parent: ordered[0].table,
        parentColumns: ordered.map((r, i) => r.to ?? primaryKeyOf(ordered[0].table)[i] ?? "rowid"),
        onDelete: ordered[0].on_delete,
      };
    });
    fkByTable.set(name, constraints);

    const fkColumns = new Set(constraints.flatMap((c) => c.columns));
    const refByColumn = new Map<string, { table: string; column: string }>();
    for (const c of constraints) {
      c.columns.forEach((col, i) => refByColumn.set(col, { table: c.parent, column: c.parentColumns[i] }));
    }

    const uniqueSingles = new Set<string>();
    const indexes: ErTable["indexes"] = [];
    for (const idx of idxs) {
      const info = db.prepare(`PRAGMA index_info("${idx.name}")`).all() as unknown as {
        seqno: number;
        cid: number;
        name: string;
      }[];
      const columns = info.sort((a, b) => a.seqno - b.seqno).map((i) => i.name);
      if (idx.unique && columns.length === 1) uniqueSingles.add(columns[0]);
      if (!idx.name.startsWith("sqlite_autoindex")) {
        indexes.push({ name: idx.name, unique: !!idx.unique, columns });
      } else {
        indexes.push({ name: `unique(${columns.join(", ")})`, unique: true, columns });
      }
    }

    const columns: ErColumn[] = cols.map((c) => ({
      name: c.name,
      type: c.type || "ANY",
      notNull: !!c.notnull,
      pkOrder: c.pk,
      isFk: fkColumns.has(c.name),
      isUnique: uniqueSingles.has(c.name),
      defaultValue: c.dflt_value,
      references: refByColumn.get(c.name) ?? null,
    }));

    const primaryKey = cols
      .filter((c) => c.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((c) => c.name);

    let rowCount = 0;
    try {
      rowCount = (db.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get() as { n: number }).n;
    } catch {
      rowCount = 0;
    }

    tables.push({
      name,
      module: MODULE_OF[name] ?? "security",
      kind: "strong", // resolved in pass 2
      columns,
      primaryKey,
      rowCount,
      indexes,
      triggers: triggersByTable.get(name) ?? [],
      ddl: ddlByName.get(name) ?? "",
    });
  }

  const byName = new Map(tables.map((t) => [t.name, t]));

  function primaryKeyOf(table: string): string[] {
    const cached = byName.get(table);
    if (cached) return cached.primaryKey;
    const cols = db.prepare(`PRAGMA table_info("${table}")`).all() as unknown as PragmaColumn[];
    return cols.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.name);
  }

  // pass 2 - classify each table and build the edge list
  for (const table of tables) {
    const constraints = fkByTable.get(table.name) ?? [];
    const pk = table.primaryKey;
    const pkSet = new Set(pk);
    const fkColsInPk = constraints.flatMap((c) => c.columns).filter((c) => pkSet.has(c));
    const distinctParentsInPk = new Set(
      constraints.filter((c) => c.columns.every((col) => pkSet.has(col))).map((c) => c.parent),
    );

    if (SYSTEM_TABLES.has(table.name)) {
      table.kind = "system";
    } else if (
      pk.length === 1 &&
      fkColsInPk.length === 1 &&
      constraints.some((c) => c.columns.length === 1 && c.columns[0] === pk[0])
    ) {
      table.kind = "subclass";
    } else if (pk.length > 1 && fkColsInPk.length === pk.length && distinctParentsInPk.size >= 1) {
      // every PK column is borrowed from a parent -> pure junction
      table.kind = "associative";
    } else if (pk.length > 1 && fkColsInPk.length > 0) {
      // PK = borrowed key + partial key -> weak entity
      table.kind = "weak";
    } else {
      table.kind = "strong";
    }

    for (const [i, c] of constraints.entries()) {
      const recursive = c.parent === table.name;
      const identifying = c.columns.every((col) => pkSet.has(col));
      let kind: EdgeKind = "non-identifying";
      if (recursive) kind = "recursive";
      else if (table.kind === "subclass" && identifying) kind = "specialization";
      else if (identifying) kind = "identifying";

      const childIsUnique =
        c.columns.length === pk.length && c.columns.every((col) => pkSet.has(col)) && pk.length === 1
          ? true
          : c.columns.length === 1 &&
            table.columns.find((col) => col.name === c.columns[0])?.isUnique === true;

      edges.push({
        id: `${table.name}.${c.columns.join("+")}->${c.parent}`,
        fromTable: table.name,
        fromColumns: c.columns,
        toTable: c.parent,
        toColumns: c.parentColumns,
        onDelete: c.onDelete,
        kind,
        childCardinality: childIsUnique || kind === "specialization" ? "one" : "many",
        optional: c.columns.some(
          (col) => table.columns.find((tc) => tc.name === col)?.notNull === false,
        ),
      });
      void i;
    }
  }

  const stats = {
    tables: tables.length,
    columns: tables.reduce((n, t) => n + t.columns.length, 0),
    relationships: edges.length,
    triggers: triggerList.length,
    views: views.length,
    indexes: tables.reduce((n, t) => n + t.indexes.filter((i) => !i.name.startsWith("unique(")).length, 0),
    rows: tables.reduce((n, t) => n + t.rowCount, 0),
  };

  return { tables, edges, views, triggers: triggerList, stats };
}
