import { Page } from "@/components/ui";
import { CondonationStudio } from "@/components/condonation-studio";
import { attendanceRisk, certificates, condonationInbox } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function CondonationPage() {
  return (
    <Page wide>
      <CondonationStudio
        certificates={certificates()}
        requests={condonationInbox()}
        risk={attendanceRisk(20)}
      />
    </Page>
  );
}
