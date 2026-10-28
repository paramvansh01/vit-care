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
npm run lan:prod     # build, then serve on this laptop and over HTTPS to the Wi-Fi
npm run lan          # same, in development mode (hot reload)
npm run dev          # plain next dev, this laptop only
```

Requires **Node 22.5+** (uses the built-in `node:sqlite` module — no native compilation, no
database server to install).

`npm run lan` prints two addresses: `http://localhost:3000` for this laptop and
`https://<your-ip>:3443` for every other device on the same Wi-Fi. Browsers only give a page
the camera over HTTPS (or on localhost), so the second device **must** use the https address.
The certificate is signed by a small certificate authority that VIT-Care creates on first run
(`data/certs/`). Until a device trusts that authority the browser says "Not secure" — the page
still works, camera included. To remove the warning, run `npm run trust` on this laptop, and on
every other device open `https://<your-ip>:3443/secure` and install the downloaded
`vitcare-ca.crt` (step-by-step for Windows, macOS, Android and iOS on that page). If Windows asks
whether Node.js may use the network, allow it.

The database file is created at `data/vitcare.db` on first request from
`schema.sql` → `triggers.sql` → `reference.sql`. That is institutional data only — campuses,
schools, faculty, courses, the drug formulary, pharmacies and their stock. **There are no
students, doctors or appointments until people sign up.** The account menu (top right) can reset
the database empty, or reset it with the demo people from `sample.sql` (every sample account's
password is `vitcare`; students sign in with their registration number, doctors with their email).

## Accounts, and the video-call demo

- **Sign up** on the first page as a student (registration number + password) or as a doctor
  (email + password). A new student is enrolled in their school's courses automatically; a new
  doctor gets a week of open slots. Anyone signed in can also add a doctor from **Doctors**.
- Sessions live in `app_session`; passwords are scrypt hashes in `app_user.password_hash`. Both
  columns are redacted from the SQL console and the table browser.
- **Calls**: from **Calls** or **Doctors**, press *Call* — the other person's browser rings on
  whatever page they have open (accept / decline). Or press *New room with a code* and read the
  code (`ABC-123`) out; whoever types it in joins. A doctor who opens a consultation and presses
  *Join call* rings the student the same way. Unanswered calls become MISSED after 45 s and
  `trg_notify_missed_call` puts them in the student's inbox.
- Audio and video go straight between the two browsers (WebRTC). Only the handshake passes
  through the server, as rows in `video_signal`; on one Wi-Fi no internet is needed.

## Online payment (Razorpay)

The pharmacy checkout offers **Cash on delivery** or **Pay online · Razorpay**. Put your keys in
`.env.local` (copy `.env.example`; the file is git-ignored — never commit the secret):

```
RAZORPAY_KEY_ID=rzp_test_…
RAZORPAY_KEY_SECRET=…
```

The server computes the amount from catalogue prices and opens a Razorpay order (recorded in the
`payment` table as CREATED). After the student pays in Razorpay's window, the server verifies the
HMAC signature with the secret, re-reads the payment from Razorpay, captures it if needed, and only
then writes the `pharmacy_order` — in the same transaction that marks the payment PAID
(`trg_payment_captured` logs it). If the cart changed meanwhile, the payment is refunded. Test-mode
card: `5267 3181 8797 5449`, any future expiry, any CVV, any OTP. The laptop running the server
needs internet for this step.

**Two-laptop demo:** laptop A runs `npm run lan:prod` and signs up as a student. Laptop B opens
the printed `https://…:3443` address, accepts the certificate, and signs up as a doctor. A books a
video slot with B; B opens the booking → *Start consultation* → *Video call* → *Join call*; A's
screen rings → *Accept*. (On one machine, use a normal and a private window.)

```bash
npm run build && npm start   # production build
npx tsc --noEmit             # typecheck
npx eslint .                 # lint
```

## What's where

```
src/lib/db/
  schema.sql        the relations, keys and indexes (incl. app_session, call_session, video_signal)
  triggers.sql      the triggers + role-based access views
  reference.sql     institutional data a deployment starts with
  sample.sql        optional demo people and history
  index.ts          lazy connection, bootstrap, reset, secret redaction
src/lib/auth.ts     sessions (cookie → app_session), sign-in guards
src/lib/calls.ts    call_session: placing, ringing, joining by code
server.mjs          HTTPS server for the LAN
scripts/certs.mjs   local CA + server certificate; scripts/trust.mjs trusts it
  introspect.ts     reads sqlite_master + PRAGMA into the ER model
  model.ts          pure types/constants (no driver — safe for client bundles)

src/app/            one route per page (see below)
src/app/actions.ts  server actions; every write reports which triggers fired
src/app/api/signal  WebRTC signalling relayed through video_signal
src/components/er/  ER canvas — engine.ts is the physics + crow's-foot geometry
```

## The pages

| Route | What it shows |
|---|---|
| `/` | Sign in, or create a student / doctor account |
| `/student` | Student portal: book, join calls, cart, leave letters, attendance |
| `/doctor` | Doctor console: queue, consultation, video call, prescribing, leave |
| `/calls` | Everyone with an account (online status), call / room codes, call history |
| `/call/[code]` | The video call itself |
| `/doctors` | Registered doctors; add a doctor |
| `/about` | Project narrative: problem, pipeline, DB concepts, SDG alignment |
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
- Older `data/vitcare.db` files built from a previous schema are rebuilt automatically
  (`PRAGMA user_version`).
