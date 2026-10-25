import {
  Activity,
  AlertTriangle,
  CalendarClock,
  IndianRupee,
  PackageSearch,
  ScrollText,
  Stethoscope,
  TrendingDown,
  Users,
} from "lucide-react";
import { Bar, Card, Chip, Empty, Page, SectionHead, Stat, Table, Td, Th } from "@/components/ui";
import {
  attendanceRisk,
  campusRollup,
  clinicalAlerts,
  doctorQueue,
  headlineStats,
  lowStock,
  topSymptoms,
  triageMix,
  triggerFeed,
  triggerTotals,
} from "@/lib/queries";
import { TriggerFeed } from "@/components/trigger-feed";

export const dynamic = "force-dynamic";

const TRIAGE_TONE = { RED: "danger", AMBER: "warn", GREEN: "ok" } as const;

export default function DashboardPage() {
  const stats = headlineStats();
  const campuses = campusRollup();
  const risk = attendanceRisk(8);
  const queue = doctorQueue(8);
  const feed = triggerFeed(24);
  const totals = triggerTotals();
  const triage = triageMix();
  const symptoms = topSymptoms(6);
  const alerts = clinicalAlerts(5);
  const stock = lowStock();

  const triageTotal = triage.reduce((n, t) => n + t.n, 0) || 1;

  return (
    <Page wide>
      {/* ----------------------------------------------------------- stats */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Stat
          label="Students"
          value={stats.students}
          hint="across 4 campuses"
          icon={<Users size={14} />}
        />
        <Stat
          label="Appointments"
          value={stats.appointments}
          hint={`${stats.consultations} completed consultations`}
          tone="info"
          icon={<CalendarClock size={14} />}
        />
        <Stat
          label="Pending condonations"
          value={stats.pendingCondonations}
          hint={`${stats.approvedCondonations} approved · ${stats.daysCondoned} days credited`}
          tone="violet"
          icon={<ScrollText size={14} />}
        />
        <Stat
          label="At academic risk"
          value={stats.atRisk}
          hint="enrollments below VIT's 75% threshold"
          tone={stats.atRisk > 0 ? "danger" : "ok"}
          icon={<TrendingDown size={14} />}
        />
        <Stat
          label="Pharmacy revenue"
          value={`₹${Number(stats.revenue).toFixed(0)}`}
          hint={`${stats.orders} orders placed`}
          tone="orange"
          icon={<IndianRupee size={14} />}
        />
        <Stat
          label="Open DB alerts"
          value={Number(stats.openAlerts) + Number(stats.stockAlerts)}
          hint={`${stats.openAlerts} interaction · ${stats.stockAlerts} stock`}
          tone={Number(stats.openAlerts) + Number(stats.stockAlerts) > 0 ? "warn" : "ok"}
          icon={<AlertTriangle size={14} />}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-5">
          {/* ------------------------------------------------- campuses */}
          <Card className="overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <p className="eyebrow">v_admin_campus_overview</p>
              <h3 className="text-[14.5px] font-semibold tracking-tight">Cross-campus rollup</h3>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Campus</Th>
                  <Th className="text-right">Students</Th>
                  <Th className="text-right">Doctors</Th>
                  <Th className="text-right">Pharmacies</Th>
                  <Th className="text-right">Appointments</Th>
                  <Th className="text-right">Pending condonation</Th>
                </tr>
              </thead>
              <tbody>
                {campuses.map((c) => (
                  <tr key={c.campus_id} className="transition-colors hover:bg-sunk/60">
                    <Td>
                      <span className="flex items-center gap-2">
                        <span className="mono rounded bg-sunk px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
                          {c.campus_code}
                        </span>
                        <span className="font-medium">{c.campus_name}</span>
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums">{c.students}</Td>
                    <Td className="text-right tabular-nums">{c.doctors}</Td>
                    <Td className="text-right tabular-nums">{c.pharmacies}</Td>
                    <Td className="text-right tabular-nums">{c.appointments}</Td>
                    <Td className="text-right tabular-nums">
                      {c.pending_condonations > 0 ? (
                        <Chip tone="violet">{c.pending_condonations}</Chip>
                      ) : (
                        <span className="text-ink-mute">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {/* --------------------------------------------- attendance risk */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="eyebrow">v_attendance_risk</p>
                <h3 className="text-[14.5px] font-semibold tracking-tight">
                  Attendance against the 75% rule
                </h3>
              </div>
              <Chip tone="neutral">lowest first</Chip>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Course</Th>
                  <Th className="w-[160px]">Attendance</Th>
                  <Th className="text-right">Condoned</Th>
                  <Th className="text-right">Band</Th>
                </tr>
              </thead>
              <tbody>
                {risk.map((r) => {
                  const tone =
                    r.risk_band === "AT_RISK" ? "danger" : r.risk_band === "BORDERLINE" ? "warn" : "ok";
                  return (
                    <tr key={r.enrollment_id} className="transition-colors hover:bg-sunk/60">
                      <Td>
                        <span className="font-medium">{r.student_name}</span>
                        <span className="mono ml-1.5 text-[10.5px] text-ink-mute">{r.reg_no}</span>
                      </Td>
                      <Td className="text-ink-soft">
                        <span className="mono text-[11px]">{r.course_code}</span>
                        <span className="ml-1.5 text-[11.5px]">{r.course_title}</span>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <Bar pct={r.attendance_pct} tone={tone} />
                          <span className="mono w-11 shrink-0 text-right text-[11px] tabular-nums">
                            {r.attendance_pct}%
                          </span>
                        </div>
                        <p className="mono mt-1 text-[9.5px] text-ink-mute">
                          {r.classes_attended}/{r.classes_held} classes
                        </p>
                      </Td>
                      <Td className="text-right tabular-nums">
                        {r.condoned_days > 0 ? (
                          <span className="text-violet-700">+{r.condoned_days}d</span>
                        ) : (
                          <span className="text-ink-mute">—</span>
                        )}
                      </Td>
                      <Td className="text-right">
                        <Chip tone={tone}>{r.risk_band.replace("_", " ")}</Chip>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>

          {/* --------------------------------------------------- queue */}
          <Card className="overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <p className="eyebrow">v_doctor_queue</p>
              <h3 className="text-[14.5px] font-semibold tracking-tight">Consultation queue</h3>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Student</Th>
                  <Th>Doctor</Th>
                  <Th>Slot</Th>
                  <Th>Complaint</Th>
                  <Th className="text-right">Triage</Th>
                  <Th className="text-right">Status</Th>
                </tr>
              </thead>
              <tbody>
                {queue.map((q) => (
                  <tr key={q.appointment_id} className="transition-colors hover:bg-sunk/60">
                    <Td className="mono text-[11px] text-ink-mute">{q.appointment_id}</Td>
                    <Td className="font-medium">{q.student_name}</Td>
                    <Td className="text-ink-soft">
                      {q.doctor_name}
                      <span className="mono ml-1.5 text-[9.5px] text-ink-mute">{q.doctor_type}</span>
                    </Td>
                    <Td className="mono text-[11px] text-ink-soft">
                      {q.slot_date} {q.slot_time}
                    </Td>
                    <Td className="max-w-[240px] truncate text-ink-soft" title={q.chief_complaint}>
                      {q.chief_complaint}
                    </Td>
                    <Td className="text-right">
                      <Chip tone={TRIAGE_TONE[q.triage_level as keyof typeof TRIAGE_TONE]}>
                        {q.triage_level}
                      </Chip>
                    </Td>
                    <Td className="text-right">
                      <Chip tone={q.status === "COMPLETED" ? "ok" : q.status === "BOOKED" ? "info" : "neutral"}>
                        {q.status}
                      </Chip>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {/* --------------------------------------------------- symptoms */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-4">
              <SectionHead eyebrow="appointment_symptom ⋈ symptom" title="Presenting complaints" />
              <div className="space-y-2.5">
                {symptoms.map((s) => (
                  <div key={s.name}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="text-[12.5px] font-medium">{s.name}</span>
                      <span className="mono text-[10.5px] text-ink-mute">
                        {s.episodes} episodes · avg severity {s.avg_severity}/10
                      </span>
                    </div>
                    <Bar
                      pct={(s.avg_severity / 10) * 100}
                      tone={s.avg_severity >= 7 ? "danger" : s.avg_severity >= 5 ? "warn" : "brand"}
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <SectionHead eyebrow="appointment" title="Triage distribution" />
              <div className="mb-4 flex h-3 overflow-hidden rounded-full">
                {["RED", "AMBER", "GREEN"].map((level) => {
                  const n = triage.find((t) => t.triage_level === level)?.n ?? 0;
                  const color = level === "RED" ? "#e11d48" : level === "AMBER" ? "#f59e0b" : "#10b981";
                  return (
                    <div
                      key={level}
                      style={{ width: `${(n / triageTotal) * 100}%`, background: color }}
                      className="transition-[width] duration-700"
                    />
                  );
                })}
              </div>
              <div className="space-y-1.5">
                {["RED", "AMBER", "GREEN"].map((level) => {
                  const n = triage.find((t) => t.triage_level === level)?.n ?? 0;
                  return (
                    <div key={level} className="flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            background:
                              level === "RED" ? "#e11d48" : level === "AMBER" ? "#f59e0b" : "#10b981",
                          }}
                        />
                        <span className="text-ink-soft">{level}</span>
                      </span>
                      <span className="mono tabular-nums text-ink-mute">
                        {n} · {Math.round((n / triageTotal) * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 border-t border-line pt-4">
                <p className="eyebrow mb-2">Open alerts raised by triggers</p>
                {alerts.length === 0 && stock.length === 0 ? (
                  <Empty>No alerts outstanding</Empty>
                ) : (
                  <div className="space-y-1.5">
                    {alerts.map((a) => (
                      <p
                        key={a.alert_id}
                        className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-800"
                      >
                        <AlertTriangle size={10} className="mr-1 inline" />
                        {a.message}
                      </p>
                    ))}
                    {stock.map((s, i) => (
                      <p
                        key={i}
                        className="rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-[11px] leading-snug text-orange-800"
                      >
                        <PackageSearch size={10} className="mr-1 inline" />
                        {s.name} at {s.pharmacy_name} down to {s.qty_on_hand} (reorder at{" "}
                        {s.reorder_level})
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* ------------------------------------------------------ sidebar */}
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <Activity size={14} className="text-brand" />
              <div className="min-w-0">
                <p className="eyebrow">trigger_log</p>
                <h3 className="text-[14px] font-semibold tracking-tight">Database event stream</h3>
              </div>
              <span className="live-dot ml-auto h-2 w-2 shrink-0 rounded-full bg-ok" />
            </div>
            <TriggerFeed initial={feed} />
          </Card>

          <Card className="p-4">
            <SectionHead eyebrow="GROUP BY trigger_name" title="Trigger fire counts" />
            {totals.length === 0 ? (
              <Empty>No triggers have fired yet</Empty>
            ) : (
              <div className="space-y-2">
                {totals.map((t) => (
                  <div key={t.trigger_name}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="mono truncate text-[10.5px] text-ink-soft" title={t.trigger_name}>
                        {t.trigger_name.replace(/^trg_/, "")}
                      </span>
                      <span className="mono text-[10.5px] tabular-nums text-ink-mute">{t.fires}</span>
                    </div>
                    <Bar pct={(t.fires / (totals[0]?.fires || 1)) * 100} tone="brand" />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Stethoscope size={14} className="text-brand" />
              <p className="text-[13px] font-semibold tracking-tight">Reading this page</p>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
              Every number here comes from a SQL query executed on this request — the campus rollup
              and attendance bands are database <em>views</em>, and the event stream is the{" "}
              <span className="mono text-[11px]">trigger_log</span> table that every trigger writes to
              as it fires.
            </p>
          </Card>
        </div>
      </div>
    </Page>
  );
}
