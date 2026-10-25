# VIT-Care

**Telemedicine & Attendance Condonation Platform**
CSE2003 — Database Management Systems

Param Vansh Singh (25BCE2256) · Harshit Aryan (25BCE2378)
Faculty Guide: Prof. Saraswathi U

---

A working Next.js application over a fully normalized (3NF) SQLite database that unifies
teleconsultation, e-prescription, pharmacy inventory and automated attendance condonation
across all four VIT campuses.

The point of the build is that **the database does the work**. Slot conflicts, stock
deduction, drug-interaction alerts, the certificate → condonation fan-out and the attendance
write-back are all SQL triggers compiled into the schema — not application code. The UI exists
to make that visible.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

Requires **Node 22.5+** (uses the built-in `node:sqlite` module — no native compilation, no
database server to install).

The database file is created at `data/vitcare.db` on first request and populated from
`schema.sql` → `triggers.sql` → `seed.sql`. Delete the file, or hit **Reset DB** in the top
bar, to rebuild it from scratch at any time.

```bash
npm run build && npm start   # production build
npx tsc --noEmit             # typecheck
npx eslint .                 # lint
```

## What's where

```
src/lib/db/
  schema.sql        36 relations, 53 foreign keys, 10 indexes
  triggers.sql      13 triggers + 6 role-based access views
  seed.sql          reference + transactional data, 4 campuses
  index.ts          lazy connection, bootstrap, reset
  introspect.ts     reads sqlite_master + PRAGMA into the ER model
  model.ts          pure types/constants (no driver — safe for client bundles)

src/app/            one route per page (see below)
src/app/actions.ts  server actions; every write reports which triggers fired
src/components/er/  ER canvas — engine.ts is the physics + crow's-foot geometry
```

## The pages

| Route | What it shows |
|---|---|
| `/` | Project narrative: problem, pipeline, DB concepts, SDG alignment |
| `/dashboard` | Live KPIs, cross-campus rollup, attendance risk, trigger event stream |
| `/er-diagram` | **Interactive ER diagram, introspected live from the database** |
| `/schema` | Table explorer: columns, keys, indexes, DDL, real rows |
| `/triggers` | Every trigger and RBAC view with its DDL and purpose |
| `/normalization` | 1NF → 2NF → 3NF decompositions against the real relations |
| `/sql` | Read-only SQL console with 10 saved queries and `EXPLAIN QUERY PLAN` |
| `/appointments` | Booking flow — demonstrates the slot-conflict guard |
| `/pharmacy` | Catalog, cart, COD checkout — demonstrates stock triggers |
| `/condonation` | Certificate → auto fan-out → faculty decision → attendance |
| `/lab` | Prescribe drugs and watch the recursive interaction check fire |

## The ER diagram

Nothing on the canvas is hand-drawn. On every request the server calls `introspect()`, which
reads `sqlite_master`, `PRAGMA table_info`, `PRAGMA foreign_key_list` and `PRAGMA index_list`,
then classifies each relation and relationship. **The diagram cannot drift from the schema** —
change `schema.sql` and the picture changes with it.

- **Entity classification** is derived, not configured: a table whose primary key is entirely
  borrowed from parents is *associative*; borrowed key + partial key is *weak*; a single-column
  PK that is also an FK to its parent is an *EER subclass*.
- **Force layout** settles over roughly 1.4 seconds, then rests. Drag any entity and the
  physics reheats around it. Two deterministic layouts (grouped by module, and layered by
  foreign-key depth) are available for screenshots.
- **Crow's-foot notation**: solid lines for identifying relationships, dashed for
  non-identifying, a circled `d` at disjoint EER specializations, orange for recursive ones,
  hollow circles for optional (nullable) participation.
- Relationship lines anchor to the **specific columns** involved, and carry a travelling
  current so the direction of every dependency is readable at a glance.

## Database concepts, and where to find them running

| Concept | Implementation | See it at |
|---|---|---|
| EER specialization | `doctor` superclass; `gp_doctor` / `specialist_doctor` / `counselor` disjoint subclasses | `/er-diagram`, `/sql` |
| Weak entities | `slot` (owner `doctor` + partial key `slot_date, slot_time`), `prescription_item`, `order_item` | `/appointments` |
| Composite foreign key | `appointment(doctor_id, slot_date, slot_time) → slot` | `/schema` |
| Recursive relationships | `drug_interaction` (drug ⇄ drug), `faculty.reports_to` | `/lab`, `/sql` |
| M:N associative relations | `doctor_specialization`, `appointment_symptom`, `inventory` | `/er-diagram` |
| Normalization 1NF→3NF | decomposition proofs against the live relations | `/normalization` |
| Triggers | 13, all logged to `trigger_log` as they fire | `/triggers`, `/lab` |
| RBAC | 6 views; the pharmacist board has no diagnosis column, the faculty inbox has no clinical notes | `/triggers` |

## Things worth trying in a demo

1. **`/condonation`** — verify a DRAFT certificate. The database generates one condonation
   request per enrolled course, routed to that course's faculty, with the day count computed
   from the certificate's validity range. Approve one and watch the attendance ledger move.
2. **`/appointments`** — pick a slot that's struck through. `trg_slot_conflict_guard` raises
   `ABORT` and the insert never happens.
3. **`/lab`** — add Warfarin to a prescription that already contains Ibuprofen. The recursive
   `drug_interaction` relation produces a SEVERE alert.
4. **`/pharmacy`** — order more of something than is in stock. The whole order rolls back.
5. **`/er-diagram`** — drag an entity and watch the relationships follow; click one to inspect
   its columns, keys, triggers and live rows.

Every write in the UI reports the SQL it issued and the triggers that fired in response.

## Notes

- The SQL console is deliberately read-only. Writes must go through the application pages so
  they pass through the real triggers.
- `data/vitcare.db` is gitignored; it is generated, never authored.
- Light theme only, by design.
