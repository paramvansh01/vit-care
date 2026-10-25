"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronRight,
  GitBranch,
  Minus,
  PackageSearch,
  Plus,
  Search,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { advanceOrder, placeOrder, type ActionResult } from "@/app/actions";
import { Bar, Card, Chip, Empty, SectionHead, Table, Td, Th } from "@/components/ui";
import { ResultPanel } from "@/components/booking-studio";
import type { CatalogRow, OrderRow, Student } from "@/lib/queries";

const SEVERITY_TONE = { SEVERE: "danger", MODERATE: "warn", MINOR: "neutral" } as const;

const STATUS_TONE: Record<string, "neutral" | "info" | "warn" | "ok" | "danger"> = {
  PLACED: "info",
  PACKED: "warn",
  OUT_FOR_DELIVERY: "warn",
  DELIVERED: "ok",
  CANCELLED: "neutral",
};

export function PharmacyStudio({
  students,
  pharmacies,
  catalogs,
  orders,
  interactions,
  alerts,
  stockAlerts,
}: {
  students: Student[];
  pharmacies: { pharmacy_id: number; name: string; location: string; campus_id: number; campus_name: string }[];
  catalogs: Record<number, CatalogRow[]>;
  orders: OrderRow[];
  interactions: { a: string; b: string; severity: string; description: string }[];
  alerts: { alert_id: number; severity: string; message: string; acknowledged: number }[];
  stockAlerts: { name: string; pharmacy_name: string; qty_on_hand: number; reorder_level: number }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const [regNo, setRegNo] = useState(students[0]?.reg_no ?? "");
  const student = students.find((s) => s.reg_no === regNo);

  const campusShops = useMemo(
    () => pharmacies.filter((p) => !student || p.campus_id === student.campus_id),
    [pharmacies, student],
  );
  const [pharmacyId, setPharmacyId] = useState(campusShops[0]?.pharmacy_id ?? pharmacies[0].pharmacy_id);
  const activeShop =
    campusShops.find((p) => p.pharmacy_id === pharmacyId) ?? campusShops[0] ?? pharmacies[0];

  const items = catalogs[activeShop.pharmacy_id] ?? [];
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [payment, setPayment] = useState("COD");

  const shown = items.filter(
    (d) =>
      !query.trim() ||
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      d.generic_name.toLowerCase().includes(query.toLowerCase()),
  );

  const cartLines = Object.entries(cart)
    .map(([id, qty]) => ({ drug: items.find((d) => d.drug_id === Number(id))!, qty }))
    .filter((l) => l.drug && l.qty > 0);
  const total = cartLines.reduce((n, l) => n + l.drug.unit_price * l.qty, 0);

  // Warn about interactions between things already in the cart. cartLines is
  // rebuilt every render, so memoizing on it would never hit - compute directly.
  const cartNames = new Set(cartLines.map((l) => l.drug.name));
  const cartWarnings = interactions.filter((i) => cartNames.has(i.a) && cartNames.has(i.b));

  function setQty(drugId: number, qty: number) {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[drugId];
      else next[drugId] = qty;
      return next;
    });
  }

  function checkout() {
    startTransition(async () => {
      const res = await placeOrder({
        regNo,
        pharmacyId: activeShop.pharmacy_id,
        items: cartLines.map((l) => ({ drugId: l.drug.drug_id, quantity: l.qty })),
        paymentMode: payment,
      });
      setResult(res);
      if (res.ok) setCart({});
      router.refresh();
    });
  }

  function advance(orderId: number) {
    startTransition(async () => {
      setResult(await advanceOrder(orderId));
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-5">
        {/* ------------------------------------------------ storefront */}
        <Card className="p-4">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <p className="eyebrow mb-1">Ordering as</p>
              <select
                value={regNo}
                onChange={(e) => {
                  setRegNo(e.target.value);
                  setCart({});
                }}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] outline-none transition focus:border-brand"
              >
                {students.map((s) => (
                  <option key={s.reg_no} value={s.reg_no}>
                    {s.name} · {s.reg_no} · {s.hostel_block}-{s.room_no}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 flex-1">
              <p className="eyebrow mb-1">Pharmacy · {student?.campus_name}</p>
              <select
                value={activeShop.pharmacy_id}
                onChange={(e) => {
                  setPharmacyId(Number(e.target.value));
                  setCart({});
                }}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] outline-none transition focus:border-brand"
              >
                {campusShops.map((p) => (
                  <option key={p.pharmacy_id} value={p.pharmacy_id}>
                    {p.name} — {p.location}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="relative mb-3">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mute" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by brand or generic name…"
              className="w-full rounded-lg border border-line bg-sunk py-2 pl-7 pr-3 text-[12.5px] outline-none transition placeholder:text-ink-mute focus:border-brand focus:bg-surface"
            />
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((d) => {
              const qty = cart[d.drug_id] ?? 0;
              const low = d.qty_on_hand <= d.reorder_level;
              return (
                <div
                  key={d.drug_id}
                  className={`rounded-xl border p-3 transition ${
                    qty > 0 ? "border-brand bg-brand-wash/60" : "border-line bg-surface hover:border-line-strong"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-semibold leading-snug">{d.name}</p>
                      <p className="truncate text-[10.5px] text-ink-mute">
                        {d.generic_name} · {d.strength}
                      </p>
                    </div>
                    <span className="mono shrink-0 text-[12px] font-semibold tabular-nums">
                      ₹{d.unit_price.toFixed(2)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <Chip tone={d.requires_rx ? "danger" : "ok"}>
                      {d.requires_rx ? `Rx · ${d.schedule_class}` : "OTC"}
                    </Chip>
                    <Chip tone="neutral">{d.form.toLowerCase()}</Chip>
                    {d.interactions > 0 && (
                      <Chip tone="warn">
                        <GitBranch size={9} />
                        {d.interactions}
                      </Chip>
                    )}
                  </div>

                  <div className="mt-2.5">
                    <div className="mb-1 flex items-baseline justify-between text-[10px]">
                      <span className={low ? "text-orange-600" : "text-ink-mute"}>
                        {d.qty_on_hand} in stock
                      </span>
                      <span className="text-ink-mute">reorder at {d.reorder_level}</span>
                    </div>
                    <Bar
                      pct={Math.min(100, (d.qty_on_hand / Math.max(d.reorder_level * 4, 1)) * 100)}
                      tone={low ? "warn" : "ok"}
                    />
                  </div>

                  <div className="mt-2.5 flex items-center gap-1.5">
                    <button
                      onClick={() => setQty(d.drug_id, qty - 1)}
                      disabled={qty === 0}
                      className="grid h-6 w-6 place-items-center rounded border border-line text-ink-soft transition hover:bg-sunk disabled:opacity-40"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="mono w-7 text-center text-[12px] font-semibold tabular-nums">
                      {qty}
                    </span>
                    <button
                      onClick={() => setQty(d.drug_id, qty + 1)}
                      disabled={qty >= d.qty_on_hand}
                      className="grid h-6 w-6 place-items-center rounded border border-line text-ink-soft transition hover:bg-sunk disabled:opacity-40"
                    >
                      <Plus size={11} />
                    </button>
                    {qty > 0 && (
                      <span className="mono ml-auto text-[11px] tabular-nums text-brand-deep">
                        ₹{(qty * d.unit_price).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {shown.length === 0 && <Empty>Nothing in this pharmacy matches “{query}”.</Empty>}
        </Card>

        {result && <ResultPanel result={result} />}

        {/* --------------------------------------------------- orders */}
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <p className="eyebrow">v_pharmacist_fulfilment</p>
            <h3 className="text-[14px] font-semibold tracking-tight">
              Fulfilment board{" "}
              <span className="text-[11px] font-normal text-ink-mute">
                the pharmacist view carries no diagnosis column
              </span>
            </h3>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Student</Th>
                <Th>Deliver to</Th>
                <Th>Type</Th>
                <Th className="text-right">Lines</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.order_id} className="hover:bg-sunk/60">
                  <Td className="mono text-[11px] text-ink-mute">{o.order_id}</Td>
                  <Td className="font-medium">{o.student_name}</Td>
                  <Td className="text-[11.5px] text-ink-soft">
                    {o.hostel_block}-{o.room_no}
                  </Td>
                  <Td>
                    <Chip tone={o.order_type === "RX" ? "danger" : "ok"}>{o.order_type}</Chip>
                  </Td>
                  <Td className="text-right tabular-nums">{o.line_count}</Td>
                  <Td className="mono text-right tabular-nums">₹{o.total_amount.toFixed(2)}</Td>
                  <Td className="text-right">
                    <Chip tone={STATUS_TONE[o.order_status] ?? "neutral"}>
                      {o.order_status.replace(/_/g, " ")}
                    </Chip>
                  </Td>
                  <Td className="text-right">
                    {o.order_status !== "DELIVERED" && o.order_status !== "CANCELLED" && (
                      <button
                        onClick={() => advance(o.order_id)}
                        disabled={pending}
                        className="flex items-center gap-1 rounded border border-line px-2 py-0.5 text-[10.5px] text-ink-soft transition hover:border-brand hover:bg-brand-wash hover:text-brand-deep disabled:opacity-50"
                      >
                        Advance
                        <ChevronRight size={10} />
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        {/* -------------------------------------------- interactions */}
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <p className="eyebrow">drug_interaction · recursive relationship</p>
            <h3 className="text-[14px] font-semibold tracking-tight">
              Drug cross-reference{" "}
              <span className="text-[11px] font-normal text-ink-mute">
                drug related to itself — the pairs the interaction trigger checks
              </span>
            </h3>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Drug</Th>
                <Th />
                <Th>Interacts with</Th>
                <Th>Severity</Th>
                <Th>Clinical note</Th>
              </tr>
            </thead>
            <tbody>
              {interactions.map((i, idx) => (
                <tr key={idx} className="hover:bg-sunk/60">
                  <Td className="font-medium">{i.a}</Td>
                  <Td className="text-center text-ink-mute">⇄</Td>
                  <Td className="font-medium">{i.b}</Td>
                  <Td>
                    <Chip tone={SEVERITY_TONE[i.severity as keyof typeof SEVERITY_TONE]}>
                      {i.severity}
                    </Chip>
                  </Td>
                  <Td className="text-[11.5px] text-ink-soft">{i.description}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      {/* --------------------------------------------------------- cart */}
      <aside className="space-y-4">
        <Card className="sticky top-[72px] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <ShoppingCart size={14} className="text-brand" />
            <h3 className="text-[14px] font-semibold tracking-tight">Cart</h3>
            {cartLines.length > 0 && <Chip tone="brand" className="ml-auto">{cartLines.length}</Chip>}
          </div>

          {cartLines.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12px] text-ink-mute">
              Add medicines from the catalog.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {cartLines.map((l) => (
                  <li key={l.drug.drug_id} className="flex items-center gap-2 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium">{l.drug.name}</p>
                      <p className="mono text-[10px] text-ink-mute">
                        {l.qty} × ₹{l.drug.unit_price.toFixed(2)}
                      </p>
                    </div>
                    <span className="mono shrink-0 text-[11.5px] tabular-nums">
                      ₹{(l.qty * l.drug.unit_price).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>

              {cartWarnings.length > 0 && (
                <div className="border-t border-line bg-amber-50/70 px-4 py-2.5">
                  <p className="eyebrow mb-1.5 text-amber-700">Interaction in this cart</p>
                  {cartWarnings.map((w, i) => (
                    <p key={i} className="text-[11px] leading-snug text-amber-800">
                      <AlertTriangle size={10} className="mr-1 inline" />
                      <strong>{w.severity}</strong> · {w.a} + {w.b}
                    </p>
                  ))}
                </div>
              )}

              <div className="border-t border-line px-4 py-3">
                <p className="eyebrow mb-1.5">Payment</p>
                <div className="mb-3 flex gap-1.5">
                  {["COD", "UPI", "CARD"].map((m) => (
                    <button
                      key={m}
                      onClick={() => setPayment(m)}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] transition ${
                        payment === m
                          ? "border-brand bg-brand-wash font-semibold text-brand-deep"
                          : "border-line text-ink-soft hover:bg-sunk"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-[12px] text-ink-soft">Total</span>
                  <span className="mono text-[18px] font-semibold tabular-nums">
                    ₹{total.toFixed(2)}
                  </span>
                </div>

                <p className="mb-3 flex items-start gap-1.5 text-[10.5px] leading-snug text-ink-mute">
                  <Truck size={11} className="mt-0.5 shrink-0" />
                  Delivered to {student?.hostel_block}-{student?.room_no}, {student?.campus_name}
                </p>

                <button
                  onClick={checkout}
                  disabled={pending}
                  className="w-full rounded-lg bg-brand-deep py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-brand disabled:opacity-60"
                >
                  {pending ? "Writing order…" : "Place order"}
                </button>
              </div>
            </>
          )}
        </Card>

        <Card className="p-4">
          <SectionHead eyebrow="What the database enforces" title="Triggers on checkout" />
          <TriggerNote
            name="trg_stock_availability_guard"
            event="BEFORE INSERT ON order_item"
            body="Aborts a line that exceeds on-hand stock. The whole order rolls back — quantity can never go negative."
          />
          <TriggerNote
            name="trg_stock_deduct"
            event="AFTER INSERT ON order_item"
            body="Deducts inventory and rolls the line total up onto the order. No application code computes the total."
          />
          <TriggerNote
            name="trg_low_stock_alert"
            event="AFTER UPDATE ON inventory"
            body="Raises a stock_alert the moment a deduction crosses the reorder level."
          />
          <TriggerNote
            name="trg_prescription_dispensed"
            event="AFTER UPDATE ON pharmacy_order"
            body="Marks the linked prescription DISPENSED once the order reaches DELIVERED."
          />
        </Card>

        {(alerts.length > 0 || stockAlerts.length > 0) && (
          <Card className="p-4">
            <SectionHead eyebrow="Raised by triggers" title="Open alerts" />
            <div className="space-y-1.5">
              {alerts.map((a) => (
                <p
                  key={a.alert_id}
                  className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10.5px] leading-snug text-amber-800"
                >
                  {a.message}
                </p>
              ))}
              {stockAlerts.map((s, i) => (
                <p
                  key={i}
                  className="rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-[10.5px] leading-snug text-orange-800"
                >
                  <PackageSearch size={10} className="mr-1 inline" />
                  {s.name} at {s.pharmacy_name}: {s.qty_on_hand} left (reorder {s.reorder_level})
                </p>
              ))}
            </div>
          </Card>
        )}
      </aside>
    </div>
  );
}

function TriggerNote({ name, event, body }: { name: string; event: string; body: string }) {
  return (
    <div className="mb-3 border-l-2 border-orange-300 pl-3 last:mb-0">
      <p className="mono text-[10.5px] font-semibold text-orange-700">{name}</p>
      <p className="mono text-[9.5px] text-ink-mute">{event}</p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}
