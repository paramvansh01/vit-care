import { Page } from "@/components/ui";
import { DoctorConsole } from "@/components/doctor-console";
import {
  allDrugs,
  allLeaveDocs,
  doctorBoard,
  doctorRoster,
  doctorStats,
  profile,
  recipientsFor,
} from "@/lib/care";
import type { StudentProfile } from "@/lib/care";

export const dynamic = "force-dynamic";

export default async function DoctorPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const roster = doctorRoster();
  const doctorId = Number(id) || roster[0]?.doctor_id;
  const doctor = roster.find((d) => d.doctor_id === doctorId) ?? roster[0] ?? null;

  const board = doctor ? doctorBoard(doctor.doctor_id) : [];

  // The panel shows each patient's escalation chain, so their profile travels
  // with the queue row.
  const patients: Record<string, StudentProfile> = {};
  for (const reg of new Set(board.map((a) => a.reg_no))) {
    const p = profile(reg);
    if (p) patients[reg] = p;
  }

  const leaveDocs = allLeaveDocs();
  const recipientsByDoc = Object.fromEntries(
    leaveDocs.map((d) => [d.document_id, recipientsFor(d.document_id)]),
  );

  return (
    <Page wide>
      <DoctorConsole
        doctor={doctor}
        roster={roster}
        stats={doctor ? doctorStats(doctor.doctor_id) : { waiting: 0, seen: 0, urgent: 0, leaves: 0 }}
        board={board}
        drugs={allDrugs()}
        patients={patients}
        leaveDocs={leaveDocs}
        recipientsByDoc={recipientsByDoc}
      />
    </Page>
  );
}
