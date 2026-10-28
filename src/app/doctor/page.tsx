import { redirect } from "next/navigation";
import { Page } from "@/components/ui";
import { DoctorConsole } from "@/components/doctor-console";
import { requireUser } from "@/lib/auth";
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

export default async function DoctorPage() {
  const user = await requireUser("DOCTOR", "/doctor");
  const doctor = doctorRoster().find((d) => d.doctor_id === Number(user.linked_ref));
  if (!doctor) redirect("/");

  const board = doctorBoard(doctor.doctor_id);

  // The panel shows each patient's escalation chain, so their profile travels
  // with the queue row.
  const patients: Record<string, StudentProfile> = {};
  for (const reg of new Set(board.map((a) => a.reg_no))) {
    const p = profile(reg);
    if (p) patients[reg] = p;
  }

  const leaveDocs = allLeaveDocs().filter((d) => board.some((a) => a.document_id === d.document_id));
  const recipientsByDoc = Object.fromEntries(
    leaveDocs.map((d) => [d.document_id, recipientsFor(d.document_id)]),
  );

  return (
    <Page wide>
      <DoctorConsole
        doctor={doctor}
        stats={doctorStats(doctor.doctor_id)}
        board={board}
        drugs={allDrugs()}
        patients={patients}
        leaveDocs={leaveDocs}
        recipientsByDoc={recipientsByDoc}
      />
    </Page>
  );
}
