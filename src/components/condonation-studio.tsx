"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  FileCheck2,
  GraduationCap,
  ShieldCheck,
  Stamp,
  X,
} from "lucide-react";
import { decideCondonation, verifyCertificate, type ActionResult } from "@/app/actions";
import { Bar, Card, Chip, Empty, SectionHead, Table, Td, Th } from "@/components/ui";
import { ResultPanel } from "@/components/booking-studio";
import type { AttendanceRisk, CertificateRow, CondonationRow } from "@/lib/queries";

export function CondonationStudio({
  certificates,
  requests,
  risk,
}: {
  certificates: CertificateRow[];
  requests: CondonationRow[];
  risk: AttendanceRisk[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [remarks, setRemarks] = useState<Record<number, string>>({});

  const drafts = certificates.filter((c) => c.status === "DRAFT");
  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const decided = requests.filter((r) => r.status !== "PENDING");

  function verify(id: number) {
    startTransition(async () => {
      setResult(await verifyCertificate(id));
      router.refresh();
    });
  }

  function decide(id: number, decision: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      setResult(await decideCondonation(id, decision, remarks[id]));
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------ pipeline */}
      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <p className="eyebrow">Objective O4 · the health → academics bridge</p>
          <h2 className="text-[15px] font-semibold tracking-tight">
            Certificate → condonation → attendance, with no human in the middle
          </h2>
        </div>
        <div className="grid gap-0 sm:grid-cols-4">
          <Stage
            n="1"
            icon={<Stamp size={15} />}
            title="Doctor issues certificate"
            body="A consultation produces a medical_certificate with a validity range. It starts as DRAFT."
            actor="DOCTOR"
          />
          <Stage
            n="2"
            icon={<BadgeCheck size={15} />}
            title="Health centre verifies"
            body="Setting status = VERIFIED is the only human action. Everything after this is the database."
            actor="HEALTH CENTRE"
            highlight
          />
          <Stage
            n="3"
            icon={<FileCheck2 size={15} />}
            title="Trigger fans out requests"
            body="trg_auto_condonation_on_verify inserts one request per enrolled course, routed to that course's faculty, with days derived from the validity range."
            actor="DATABASE"
            highlight
          />
          <Stage
            n="4"
            icon={<GraduationCap size={15} />}
            title="Faculty decides"
            body="An approval fires trg_condonation_attendance_writeback, which credits the attendance ledger and stamps decided_at."
            actor="FACULTY"
            last
          />
        </div>
      </Card>

      {result && <ResultPanel result={result} />}

      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-5">
          {/* ------------------------------------------ certificates */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="eyebrow">medical_certificate</p>
                <h3 className="text-[14px] font-semibold tracking-tight">Certificates</h3>
              </div>
              {drafts.length > 0 && (
                <Chip tone="warn">{drafts.length} awaiting verification</Chip>
              )}
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Student</Th>
                  <Th>Issued by</Th>
                  <Th>Validity</Th>
                  <Th className="text-right">Days</Th>
                  <Th className="text-right">Requests</Th>
                  <Th className="text-right">Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {certificates.map((c) => (
                  <tr key={c.certificate_id} className="hover:bg-sunk/60">
                    <Td className="mono text-[11px] text-ink-mute">{c.certificate_id}</Td>
                    <Td>
                      <span className="font-medium">{c.student_name}</span>
                      <span className="mono ml-1.5 text-[10px] text-ink-mute">{c.reg_no}</span>
                      <p className="mt-0.5 max-w-[260px] truncate text-[11px] text-ink-mute" title={c.reason}>
                        {c.reason}
                      </p>
                    </Td>
                    <Td className="text-[11.5px] text-ink-soft">{c.doctor_name}</Td>
                    <Td className="mono text-[11px] text-ink-soft">
                      {c.valid_from} → {c.valid_to}
                    </Td>
                    <Td className="text-right tabular-nums">{c.days}</Td>
                    <Td className="text-right tabular-nums">
                      {c.requests > 0 ? (
                        <Chip tone="violet">{c.requests}</Chip>
                      ) : (
                        <span className="text-ink-mute">—</span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <Chip
                        tone={
                          c.status === "VERIFIED" ? "ok" : c.status === "REVOKED" ? "danger" : "warn"
                        }
                      >
                        {c.status}
                      </Chip>
                    </Td>
                    <Td className="text-right">
                      {c.status === "DRAFT" && (
                        <button
                          onClick={() => verify(c.certificate_id)}
                          disabled={pending}
                          className="flex items-center gap-1 rounded-lg bg-brand-deep px-2.5 py-1 text-[10.5px] font-semibold text-white transition hover:bg-brand disabled:opacity-50"
                        >
                          <BadgeCheck size={11} />
                          Verify
                        </button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {drafts.length > 0 && (
              <p className="border-t border-line bg-brand-wash/50 px-4 py-2.5 text-[11.5px] text-ink-soft">
                Verify a certificate to watch the database generate the condonation requests itself —
                nothing in the application code inserts them.
              </p>
            )}
          </Card>

          {/* -------------------------------------------- faculty inbox */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="eyebrow">v_faculty_condonation_inbox</p>
                <h3 className="text-[14px] font-semibold tracking-tight">
                  Faculty inbox{" "}
                  <span className="text-[11px] font-normal text-ink-mute">
                    reason is visible; the diagnosis is not in this view
                  </span>
                </h3>
              </div>
              {pendingRequests.length > 0 && <Chip tone="violet">{pendingRequests.length} pending</Chip>}
            </div>

            {pendingRequests.length === 0 ? (
              <div className="p-4">
                <Empty>No pending requests. Verify a certificate above to generate some.</Empty>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {pendingRequests.map((r) => (
                  <li key={r.request_id} className="p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="mono text-[10.5px] text-ink-mute">#{r.request_id}</span>
                          <span className="text-[13px] font-semibold">{r.student_name}</span>
                          <span className="mono text-[10.5px] text-ink-mute">{r.reg_no}</span>
                          <Chip tone="neutral">{r.course_code}</Chip>
                          <span className="text-[11.5px] text-ink-soft">{r.course_title}</span>
                        </div>

                        <p className="mt-1.5 text-[12px] text-ink-soft">
                          <span className="text-ink-mute">Medical leave</span>{" "}
                          <span className="mono">{r.valid_from} → {r.valid_to}</span>{" "}
                          <span className="text-ink-mute">·</span>{" "}
                          <strong>{r.days_requested} day{r.days_requested === 1 ? "" : "s"}</strong>{" "}
                          <span className="text-ink-mute">·</span> {r.reason}
                        </p>

                        <div className="mt-2.5 flex max-w-md items-center gap-2.5">
                          <Bar
                            pct={r.attendance_pct}
                            tone={r.attendance_pct < 75 ? "danger" : r.attendance_pct < 80 ? "warn" : "ok"}
                          />
                          <span className="mono w-32 shrink-0 text-[10.5px] text-ink-mute">
                            {r.attendance_pct}% · {r.classes_attended}/{r.classes_held}
                          </span>
                        </div>

                        <p className="mt-1.5 text-[10.5px] text-ink-mute">
                          Routed to {r.faculty_name} · raised {r.raised_at}
                        </p>

                        <input
                          value={remarks[r.request_id] ?? ""}
                          onChange={(e) =>
                            setRemarks((p) => ({ ...p, [r.request_id]: e.target.value }))
                          }
                          placeholder="Optional remarks…"
                          className="mt-2 w-full max-w-md rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11.5px] outline-none transition placeholder:text-ink-mute focus:border-brand"
                        />
                      </div>

                      <div className="flex shrink-0 gap-1.5">
                        <button
                          onClick={() => decide(r.request_id, "APPROVED")}
                          disabled={pending}
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11.5px] font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Check size={12} />
                          Approve
                        </button>
                        <button
                          onClick={() => decide(r.request_id, "REJECTED")}
                          disabled={pending}
                          className="flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-[11.5px] font-medium text-ink-soft transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        >
                          <X size={12} />
                          Reject
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {decided.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-line px-4 py-3">
                <p className="eyebrow">Decided</p>
                <h3 className="text-[14px] font-semibold tracking-tight">Decision history</h3>
              </div>
              <Table>
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Student</Th>
                    <Th>Course</Th>
                    <Th>Faculty</Th>
                    <Th className="text-right">Days</Th>
                    <Th className="text-right">Attendance now</Th>
                    <Th className="text-right">Decision</Th>
                  </tr>
                </thead>
                <tbody>
                  {decided.map((r) => (
                    <tr key={r.request_id} className="hover:bg-sunk/60">
                      <Td className="mono text-[11px] text-ink-mute">{r.request_id}</Td>
                      <Td className="font-medium">{r.student_name}</Td>
                      <Td className="mono text-[11px] text-ink-soft">{r.course_code}</Td>
                      <Td className="text-[11.5px] text-ink-soft">{r.faculty_name}</Td>
                      <Td className="text-right tabular-nums">{r.days_requested}</Td>
                      <Td className="mono text-right text-[11px] tabular-nums">
                        {r.attendance_pct}%
                      </Td>
                      <Td className="text-right">
                        <Chip tone={r.status === "APPROVED" ? "ok" : "danger"}>{r.status}</Chip>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </div>

        {/* -------------------------------------------------------- aside */}
        <aside className="space-y-4">
          <Card className="p-4">
            <SectionHead eyebrow="The trigger that does the work" title="Auto-condonation fan-out" />
            <pre className="mono overflow-x-auto rounded-lg border border-line bg-[#fcfcfb] p-2.5 text-[9.5px] leading-[1.75] text-ink-soft">
{`CREATE TRIGGER trg_auto_condonation_on_verify
AFTER UPDATE OF status ON medical_certificate
FOR EACH ROW
WHEN NEW.status = 'VERIFIED'
 AND OLD.status <> 'VERIFIED'
BEGIN
  INSERT OR IGNORE INTO condonation_request
      (certificate_id, enrollment_id, faculty_id,
       days_requested, status, remarks)
  SELECT NEW.certificate_id,
         e.enrollment_id,
         e.faculty_id,
         CAST(julianday(NEW.valid_to)
            - julianday(NEW.valid_from) + 1 AS INTEGER),
         'PENDING',
         'Auto-generated from certificate #'
           || NEW.certificate_id
    FROM enrollment e
   WHERE e.reg_no = NEW.reg_no;
  ...
END;`}
            </pre>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-soft">
              The day count is computed by the database from the certificate&rsquo;s validity range,
              and the faculty routing comes from the enrollment itself — so a request can never be
              addressed to the wrong professor.
            </p>
          </Card>

          <Card className="p-4">
            <SectionHead eyebrow="RBAC" title="What faculty cannot see" />
            <p className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-soft">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand" />
              The inbox is a view over{" "}
              <span className="mono text-[11px]">condonation_request</span>,{" "}
              <span className="mono text-[11px]">enrollment</span>,{" "}
              <span className="mono text-[11px]">course</span> and{" "}
              <span className="mono text-[11px]">medical_certificate</span>. It projects the
              certificate&rsquo;s <em>reason</em> but never joins{" "}
              <span className="mono text-[11px]">consultation</span>, so the diagnosis and clinical
              notes are structurally out of reach — including for sealed counselling records.
            </p>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <p className="eyebrow">v_attendance_risk</p>
              <h3 className="text-[13.5px] font-semibold tracking-tight">Against the 75% rule</h3>
            </div>
            <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
              {risk.map((r) => (
                <li key={r.enrollment_id} className="px-4 py-2.5">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-[11.5px] font-medium">
                      {r.student_name}
                    </span>
                    <span className="mono shrink-0 text-[10px] text-ink-mute">{r.course_code}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Bar
                      pct={r.attendance_pct}
                      tone={
                        r.risk_band === "AT_RISK" ? "danger" : r.risk_band === "BORDERLINE" ? "warn" : "ok"
                      }
                    />
                    <span className="mono w-10 shrink-0 text-right text-[10px] tabular-nums text-ink-mute">
                      {r.attendance_pct}%
                    </span>
                  </div>
                  {r.condoned_days > 0 && (
                    <p className="mt-1 text-[10px] text-violet-700">
                      <ArrowRight size={9} className="inline" /> {r.condoned_days} day
                      {r.condoned_days === 1 ? "" : "s"} credited by an approved condonation
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Stage({
  n,
  icon,
  title,
  body,
  actor,
  highlight,
  last,
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  actor: string;
  highlight?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`relative p-4 ${last ? "" : "border-b border-line sm:border-b-0 sm:border-r"} ${
        highlight ? "bg-violet-50/40" : ""
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`grid h-8 w-8 place-items-center rounded-lg ${
            highlight ? "bg-violet-600 text-white" : "bg-sunk text-ink-soft"
          }`}
        >
          {icon}
        </span>
        <span className="mono text-[10px] text-ink-mute">{n}</span>
      </div>
      <p
        className={`eyebrow mb-1 ${highlight ? "text-violet-600" : ""}`}
      >
        {actor}
      </p>
      <h3 className="text-[13px] font-semibold leading-snug tracking-tight">{title}</h3>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}
