"use client";

import { useRef } from "react";
import { Download, Printer } from "lucide-react";
import type { LeaveDoc } from "@/lib/care";

const CAMPUS_ADDRESS: Record<string, string> = {
  "VIT Vellore": "Tiruvalam Road, Katpadi, Vellore — 632 014, Tamil Nadu, India",
  "VIT Chennai": "Vandalur — Kelambakkam Road, Chennai — 600 127, Tamil Nadu, India",
  "VIT-AP University": "Inavolu, Beside AP Secretariat, Amaravati — 522 237, Andhra Pradesh, India",
  "VIT Bhopal University": "Bhopal — Indore Highway, Kothrikalan, Sehore — 466 114, Madhya Pradesh, India",
};

function longDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * The generated medical-leave letter on a VIT letterhead. The same markup is
 * what prints and what downloads, so what the proctor receives is exactly what
 * is shown on screen.
 */
export function LeaveLetter({
  doc,
  recipients,
}: {
  doc: LeaveDoc;
  recipients: { recipient_role: string; recipient_name: string; recipient_email: string | null }[];
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  function print() {
    window.print();
  }

  function download() {
    const html = sheetRef.current?.outerHTML ?? "";
    const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${doc.ref_no.replace(/\//g, "-")} · Medical Leave · ${doc.student_name}</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: Georgia, "Times New Roman", serif; color: #14181d; margin: 0; padding: 24px; background: #fff; }
  .letter-sheet { max-width: 800px; margin: 0 auto; }
  .lh-rule { border: 0; border-top: 2px solid #0f766e; margin: 14px 0 4px; }
  .lh-rule-thin { border: 0; border-top: 1px solid #d6d8d2; margin: 0 0 18px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { text-align: left; vertical-align: top; padding: 4px 0; }
  .muted { color: #4b5563; }
  .small { font-size: 12px; }
  .crest { width: 54px; height: 54px; border-radius: 50%; border: 2px solid #0f766e;
           display: inline-grid; place-items: center; font-weight: 700; color: #0f766e;
           font-size: 15px; letter-spacing: 0.5px; }
  .sig { margin-top: 42px; }
  .stamp { display: inline-block; border: 2px solid #0f766e; color: #0f766e; border-radius: 8px;
           padding: 6px 14px; font-size: 11px; font-weight: 700; letter-spacing: 2px;
           transform: rotate(-4deg); }
</style>
</head>
<body>${html}</body>
</html>`;

    const url = URL.createObjectURL(new Blob([page], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.ref_no.replace(/\//g, "-")}-medical-leave.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const address = CAMPUS_ADDRESS[doc.campus_name] ?? doc.campus_name;
  const proctor = recipients.find((r) => r.recipient_role === "PROCTOR");
  const hod = recipients.find((r) => r.recipient_role === "HOD");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <button
          onClick={download}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-brand-deep"
        >
          <Download size={13} />
          Download letter
        </button>
        <button
          onClick={print}
          className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12px] font-medium text-ink-soft transition hover:bg-sunk"
        >
          <Printer size={13} />
          Print / save as PDF
        </button>
        <span className="mono ml-auto text-[11px] text-ink-mute">{doc.ref_no}</span>
      </div>

      {/* --------------------------------------------------------- the letter */}
      <div
        ref={sheetRef}
        className="letter-sheet rounded-xl border border-line bg-white p-7 sm:p-10"
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        {/* letterhead */}
        <table>
          <tbody>
            <tr>
              <td style={{ width: 70 }}>
                <span className="crest">VIT</span>
              </td>
              <td>
                <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "0.02em", color: "#0f766e" }}>
                  VELLORE INSTITUTE OF TECHNOLOGY
                </div>
                <div className="small muted" style={{ fontStyle: "italic" }}>
                  &ldquo;Make a difference to the society&rdquo;
                </div>
                <div className="small muted" style={{ marginTop: 3 }}>
                  {doc.campus_name} · {address}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <hr className="lh-rule" />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.16em",
            color: "#0f766e",
            padding: "2px 0 6px",
          }}
        >
          <span>HEALTH CENTRE</span>
          <span>OFFICE OF THE MEDICAL OFFICER</span>
        </div>
        <hr className="lh-rule-thin" />

        {/* ref + date */}
        <table className="small">
          <tbody>
            <tr>
              <td>
                <strong>Ref. No.:</strong> <span className="mono">{doc.ref_no}</span>
              </td>
              <td style={{ textAlign: "right" }}>
                <strong>Date:</strong> {longDate(doc.issued_at.slice(0, 10))}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 22, fontSize: 13.5, lineHeight: 1.75 }}>
          <p style={{ margin: "0 0 4px" }}>To,</p>
          <p style={{ margin: 0, fontWeight: 700 }}>{proctor?.recipient_name ?? "The Faculty Proctor"}</p>
          <p style={{ margin: 0 }} className="muted">
            Faculty Proctor{proctor?.recipient_email ? ` · ${proctor.recipient_email}` : ""}
          </p>
          <p style={{ margin: "8px 0 0", fontWeight: 700 }}>{hod?.recipient_name ?? "The Head of Department"}</p>
          <p style={{ margin: 0 }} className="muted">
            Head of the Department, {doc.dept_name}
            {hod?.recipient_email ? ` · ${hod.recipient_email}` : ""}
          </p>

          <p
            style={{
              margin: "22px 0 16px",
              fontWeight: 700,
              textDecoration: "underline",
              textUnderlineOffset: 4,
            }}
          >
            Subject: Medical certificate and recommendation for grant of medical leave — reg.
          </p>

          <p style={{ margin: "0 0 14px" }}>Respected Sir / Madam,</p>

          <p style={{ margin: "0 0 14px", textAlign: "justify" }}>
            This is to certify that <strong>{doc.student_name}</strong> (Register Number{" "}
            <span className="mono">{doc.reg_no}</span>), a student of year {doc.year_of_study},{" "}
            {doc.dept_name} ({doc.dept_code}), residing at {doc.hostel_block ?? "campus hostel"}
            {doc.room_no ? `, Room ${doc.room_no}` : ""}, was examined by the undersigned at the
            Institute Health Centre on {longDate(doc.issued_at.slice(0, 10))}.
          </p>

          <p style={{ margin: "0 0 14px", textAlign: "justify" }}>
            On examination the student was diagnosed with <strong>{doc.diagnosis_note}</strong>. In my
            medical opinion the condition renders the student unfit to attend academic sessions, and
            complete rest is advised for a period of <strong>{doc.days_granted} ({numberWord(doc.days_granted)}) day(s)</strong>,
            with effect from <strong>{longDate(doc.valid_from)}</strong> to{" "}
            <strong>{longDate(doc.valid_to)}</strong> (both days inclusive).
          </p>

          {doc.advice && (
            <p style={{ margin: "0 0 14px", textAlign: "justify" }}>
              <strong>Medical advice:</strong> {doc.advice}
            </p>
          )}

          <p style={{ margin: "0 0 14px", textAlign: "justify" }}>{doc.fit_to_resume}</p>

          <p style={{ margin: "0 0 14px", textAlign: "justify" }}>
            It is therefore recommended that the student&rsquo;s absence during the above period be
            treated as <strong>condoned medical leave</strong> and that attendance be regularised in
            accordance with the Institute&rsquo;s academic regulations. The corresponding condonation
            requests have been raised against the student&rsquo;s registered courses for the
            consideration of the respective course faculty.
          </p>

          <p style={{ margin: "0 0 4px" }}>Thanking you,</p>

          {/* signature block */}
          <table className="sig">
            <tbody>
              <tr>
                <td style={{ width: "58%" }}>
                  <span className="stamp">VIT HEALTH CENTRE · VERIFIED</span>
                </td>
                <td>
                  <div style={{ borderTop: "1px solid #14181d", paddingTop: 6, marginTop: 30 }}>
                    <div style={{ fontWeight: 700 }}>{doc.doctor_name}</div>
                    <div className="small muted">
                      {doc.doctor_type === "GP"
                        ? "Medical Officer (General Practice)"
                        : doc.doctor_type === "SPECIALIST"
                          ? "Consultant Specialist"
                          : "Counselling Psychologist"}
                    </div>
                    <div className="small muted">
                      Reg. Council No.: <span className="mono">{doc.reg_council_no}</span>
                    </div>
                    <div className="small muted">Institute Health Centre, {doc.campus_name}</div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <hr className="lh-rule-thin" style={{ marginTop: 26 }} />
          <div className="small muted">
            <strong>Copy to:</strong>{" "}
            {recipients.map((r) => `${r.recipient_name} (${title(r.recipient_role)})`).join(" · ")}
            <br />
            This document was generated by VIT-Care and is recorded against certificate{" "}
            <span className="mono">#{doc.certificate_id}</span>; its authenticity can be verified from
            the Health Centre register using the reference number above.
          </div>
        </div>
      </div>
    </div>
  );
}

function title(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen", "twenty",
];

function numberWord(n: number) {
  return WORDS[n] ?? String(n);
}
