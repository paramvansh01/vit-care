import { redirect } from "next/navigation";
import { Page } from "@/components/ui";
import { StudentPortal } from "@/components/student-portal";
import { doctors, symptoms } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import {
  appointmentsFor,
  bookableSlots,
  campuses,
  cart,
  departments,
  enrollmentsFor,
  leaveDocsFor,
  notifications,
  ordersFor,
  primaryPharmacy,
  profile,
  recipientsFor,
  storeFor,
} from "@/lib/care";

export const dynamic = "force-dynamic";

export default async function StudentPage() {
  const user = await requireUser("STUDENT", "/student");
  const me = profile(user.linked_ref ?? "");
  if (!me) redirect("/");

  const doctorList = doctors();
  const slotsByDoctor = Object.fromEntries(
    doctorList.map((d) => [d.doctor_id, bookableSlots(d.doctor_id)]),
  );

  const docs = leaveDocsFor(me.reg_no);
  const recipientsByDoc = Object.fromEntries(
    docs.map((d) => [d.document_id, recipientsFor(d.document_id)]),
  );

  return (
    <Page wide>
      <StudentPortal
        profile={me}
        doctors={doctorList}
        slotsByDoctor={slotsByDoctor}
        symptoms={symptoms()}
        appointments={appointmentsFor(me.reg_no)}
        cart={cart(me.reg_no)}
        store={storeFor(me.campus_id)}
        orders={ordersFor(me.reg_no)}
        notices={notifications(me.reg_no)}
        docs={docs}
        recipientsByDoc={recipientsByDoc}
        campusList={campuses()}
        deptList={departments()}
        pharmacy={primaryPharmacy(me.campus_id) ?? null}
        enrollments={enrollmentsFor(me.reg_no)}
      />
    </Page>
  );
}
