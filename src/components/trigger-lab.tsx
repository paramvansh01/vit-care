"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Beaker, Check, FlaskConical, GitBranch, Pill } from "lucide-react";
import { acknowledgeAlert, addPrescriptionLine, type ActionResult } from "@/app/actions";
import { Card, Chip, Empty, SectionHead, Table, Td, Th } from "@/components/ui";
import { ResultPanel } from "@/components/booking-studio";
import { TriggerFeed } from "@/components/trigger-feed";
import type { TriggerEvent } from "@/lib/queries";

const SEVERITY_TONE = { SEVERE: "danger", MODERATE: "warn", MINOR: "neutral" } as const;

export function TriggerLab({
  prescriptions,
  drugs,
  interactions,
  alerts,
  feed,
}: {
  prescriptions: { prescription_id: number; patient: string; drugs: string; lines: number }[];
  drugs: { drug_id: number; name: string; generic_name: string; interactions: number }[];
  interactions: { a: string; b: string; severity: string; description: string }[];
  alerts: { alert_id: number; prescription_id: number; severity: string; message: string; acknowledged: number }[];
  feed: TriggerEvent[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [prescriptionId, setPrescriptionId] = useState(prescriptions[0]?.prescription_id ?? 0);
  const [drugId, setDrugId] = useState(drugs[0]?.drug_id ?? 0);
  const [quantity, setQuantity] = useState(6);

  const rx = prescriptions.find((p) => p.prescription_id === prescriptionId);
  const drug = drugs.find((d) => d.drug_id === drugId);

  // Will this combination trip the interaction trigger? Same check the DB does.
  const onRx = (rx?.drugs ?? "").split(", ").filter(Boolean);
  const predicted = interactions.filter(
    (i) =>
      (i.a === drug?.name && onRx.includes(i.b)) || (i.b === drug?.name && onRx.includes(i.a)),
  );

  function prescribe() {
    startTransition(async () => {
      setResult(await addPrescriptionLine(prescriptionId, drugId, quantity));
      router.refresh();
    });
  }

  function ack(alertId: number) {
    startTransition(async () => {
      setResult(await acknowledgeAlert(alertId));
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-5">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <FlaskConical size={15} className="text-violet-600" />
            <div>
              <p className="eyebrow">trg_drug_interaction_alert</p>
              <h2 className="text-[15px] font-semibold tracking-tight">
                Prescribe a drug and watch the recursive relationship do its job
              </h2>
            </div>
          </div>

          <div className="p-4">
            <p className="mb-4 max-w-3xl text-[12.5px] leading-relaxed text-ink-soft">
              Adding a line to a prescription fires a trigger that joins{" "}
              <span className="mono text-[11px]">drug_interaction</span> — the relation that relates{" "}
              <span className="mono text-[11px]">drug</span> to itself — against every other drug
              already on that prescription. Any hit becomes a{" "}
              <span className="mono text-[11px]">clinical_alert</span> row. Nothing in the
              application performs this check.
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="eyebrow mb-1.5">Prescription</p>
                <select
                  value={prescriptionId}
                  onChange={(e) => setPrescriptionId(Number(e.target.value))}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[12px] outline-none transition focus:border-brand"
                >
                  {prescriptions.map((p) => (
                    <option key={p.prescription_id} value={p.prescription_id}>
                      Rx #{p.prescription_id} · {p.patient} · {p.lines} lines
                    </option>
                  ))}
                </select>
                {rx && (
                  <p className="mt-1.5 text-[10.5px] leading-snug text-ink-mute">
                    Already on this Rx: {rx.drugs || "nothing yet"}
                  </p>
                )}
              </div>

              <div>
                <p className="eyebrow mb-1.5">Drug to add</p>
                <select
                  value={drugId}
                  onChange={(e) => setDrugId(Number(e.target.value))}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[12px] outline-none transition focus:border-brand"
                >
                  {drugs.map((d) => (
                    <option key={d.drug_id} value={d.drug_id}>
                      {d.name} ({d.generic_name})
                      {d.interactions > 0 ? ` · ${d.interactions} known interactions` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="eyebrow mb-1.5">Quantity</p>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[12px] outline-none transition focus:border-brand"
                />
              </div>
            </div>

            {predicted.length > 0 && (
              <div className="fade mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="eyebrow mb-1 text-amber-700">Predicted outcome</p>
                {predicted.map((p, i) => (
                  <p key={i} className="text-[11.5px] leading-snug text-amber-800">
                    <AlertTriangle size={11} className="mr-1 inline" />
                    <strong>{p.severity}</strong> — {p.a} + {p.b}: {p.description}
                  </p>
                ))}
                <p className="mt-1 text-[10.5px] text-amber-700">
                  The trigger will raise a clinical_alert when you submit.
                </p>
              </div>
            )}

            <button
              onClick={prescribe}
              disabled={pending || !prescriptionId || !drugId}
              className="mt-3 flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
            >
              <Pill size={13} />
              {pending ? "Writing line…" : "Add prescription line"}
            </button>
          </div>
        </Card>

        {result && <ResultPanel result={result} />}

        {/* ------------------------------------------------------ alerts */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="eyebrow">clinical_alert</p>
              <h3 className="text-[14px] font-semibold tracking-tight">
                Alerts the database raised
              </h3>
            </div>
            <Chip tone={alerts.some((a) => !a.acknowledged) ? "warn" : "ok"}>
              {alerts.filter((a) => !a.acknowledged).length} open
            </Chip>
          </div>
          {alerts.length === 0 ? (
            <div className="p-4">
              <Empty>No interaction alerts yet. Try prescribing Ibuprofen onto Rx #1.</Empty>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {alerts.map((a) => (
                <li key={a.alert_id} className="flex items-start gap-3 px-4 py-3">
                  <AlertTriangle
                    size={14}
                    className={`mt-0.5 shrink-0 ${a.acknowledged ? "text-ink-mute" : "text-amber-600"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[12px] leading-relaxed ${a.acknowledged ? "text-ink-mute line-through" : "text-ink-soft"}`}
                    >
                      {a.message}
                    </p>
                    <p className="mono mt-0.5 text-[10px] text-ink-mute">
                      alert #{a.alert_id} · prescription #{a.prescription_id}
                    </p>
                  </div>
                  {!a.acknowledged && (
                    <button
                      onClick={() => ack(a.alert_id)}
                      disabled={pending}
                      className="flex shrink-0 items-center gap-1 rounded border border-line px-2 py-0.5 text-[10.5px] text-ink-soft transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                    >
                      <Check size={10} />
                      Acknowledge
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ------------------------------------------------ interactions */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <GitBranch size={14} className="text-orange-600" />
            <div>
              <p className="eyebrow">drug_interaction — recursive relationship</p>
              <h3 className="text-[14px] font-semibold tracking-tight">The reference table</h3>
            </div>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Pair</Th>
                <Th>Severity</Th>
                <Th>Clinical note</Th>
              </tr>
            </thead>
            <tbody>
              {interactions.map((i, idx) => (
                <tr key={idx} className="hover:bg-sunk/60">
                  <Td className="font-medium">
                    {i.a} <span className="text-ink-mute">⇄</span> {i.b}
                  </Td>
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
          <p className="border-t border-line bg-sunk/40 px-4 py-2.5 text-[11.5px] text-ink-soft">
            Pairs are stored in both directions so a lookup is symmetric regardless of which drug is
            prescribed first. A <span className="mono text-[11px]">CHECK (drug_id &lt;&gt; interacts_with)</span>{" "}
            constraint stops a drug from interacting with itself.
          </p>
        </Card>
      </div>

      {/* ------------------------------------------------------- sidebar */}
      <aside className="space-y-4">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <Beaker size={14} className="text-brand" />
            <div className="min-w-0">
              <p className="eyebrow">trigger_log</p>
              <h3 className="text-[14px] font-semibold tracking-tight">Live event stream</h3>
            </div>
            <span className="live-dot ml-auto h-2 w-2 shrink-0 rounded-full bg-ok" />
          </div>
          <TriggerFeed initial={feed} />
        </Card>

        <Card className="p-4">
          <SectionHead eyebrow="Try these" title="Reproducible experiments" />
          <ol className="space-y-2.5 text-[11.5px] leading-relaxed text-ink-soft">
            <li className="flex gap-2">
              <span className="mono shrink-0 text-ink-mute">1.</span>
              <span>
                Add <strong>Ibuprofen 400</strong> to a prescription that already contains{" "}
                <strong>Dolo 650</strong> — a MINOR alert appears.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mono shrink-0 text-ink-mute">2.</span>
              <span>
                Add <strong>Warfarin</strong> to any prescription holding{" "}
                <strong>Ibuprofen 400</strong> — a SEVERE bleed-risk alert.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mono shrink-0 text-ink-mute">3.</span>
              <span>
                On <em>Teleconsultation</em>, book a slot already struck through — the slot-conflict
                guard aborts the insert.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mono shrink-0 text-ink-mute">4.</span>
              <span>
                On <em>e-Pharmacy</em>, order more Warfarin than is in stock — the availability guard
                rolls the whole order back.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mono shrink-0 text-ink-mute">5.</span>
              <span>
                On <em>Condonation</em>, verify a DRAFT certificate — the fan-out generates one
                request per enrolled course.
              </span>
            </li>
          </ol>
        </Card>
      </aside>
    </div>
  );
}
