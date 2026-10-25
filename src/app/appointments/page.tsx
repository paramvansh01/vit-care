import { Page } from "@/components/ui";
import { BookingStudio } from "@/components/booking-studio";
import { doctors, doctorQueue, openSlots, students, symptoms } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function AppointmentsPage() {
  const doctorList = doctors();
  const slotsByDoctor = Object.fromEntries(doctorList.map((d) => [d.doctor_id, openSlots(d.doctor_id)]));

  return (
    <Page wide>
      <BookingStudio
        students={students()}
        doctors={doctorList}
        slotsByDoctor={slotsByDoctor}
        symptoms={symptoms()}
        queue={doctorQueue(14)}
      />
    </Page>
  );
}
