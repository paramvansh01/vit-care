import { Page } from "@/components/ui";
import { StudentPortal } from "@/components/student-portal";
import { doctors, symptoms } from "@/lib/queries";
import {
  allProfiles,
  appointmentsFor,
  bookableSlots,
  campuses,
  cart,
  departments,
  leaveDocsFor,
  notifications,
  ordersFor,
  primaryPharmacy,
  profile,
  recipientsFor,
  storeFor,
} from "@/lib/care";

export const dynamic = "force-dynamic";

export default async function StudentPage({
  searchParams,
}: {
  searchParams: Promise<{ reg?: string }>;
}) {
  const { reg } = await searchParams;
  const roster = allProfiles();
  const me = reg ? (profile(reg.toUpperCase()) ?? null) : null;

  const doctorList = doctors();
  const slotsByDoctor = Object.fromEntries(
    doctorList.map((d) => [d.doctor_id, bookableSlots(d.doctor_id)]),
  );

  const docs = me ? leaveDocsFor(me.reg_no) : [];
  const recipientsByDoc = Object.fromEntries(
    docs.map((d) => [d.document_id, recipientsFor(d.document_id)]),
  );

  return (
    <Page wide>
      <StudentPortal
        profile={me}
        roster={roster.map((s) => ({ reg_no: s.reg_no, name: s.name }))}
        doctors={doctorList}
        slotsByDoctor={slotsByDoctor}
        symptoms={symptoms()}
        appointments={me ? appointmentsFor(me.reg_no) : []}
        cart={me ? cart(me.reg_no) : []}
        store={me ? storeFor(me.campus_id) : []}
        orders={me ? ordersFor(me.reg_no) : []}
        notices={me ? notifications(me.reg_no) : []}
        docs={docs}
        recipientsByDoc={recipientsByDoc}
        campusList={campuses()}
        deptList={departments()}
        pharmacy={me ? (primaryPharmacy(me.campus_id) ?? null) : null}
      />
    </Page>
  );
}
