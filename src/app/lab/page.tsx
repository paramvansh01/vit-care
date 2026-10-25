import { Page } from "@/components/ui";
import { TriggerLab } from "@/components/trigger-lab";
import { all } from "@/lib/db";
import { clinicalAlerts, interactionGraph, triggerFeed } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function LabPage() {
  const prescriptions = all<{ prescription_id: number; patient: string; drugs: string; lines: number }>(
    `SELECT p.prescription_id,
            s.name AS patient,
            (SELECT GROUP_CONCAT(d.name, ', ')
               FROM prescription_item pi JOIN drug d ON d.drug_id = pi.drug_id
              WHERE pi.prescription_id = p.prescription_id) AS drugs,
            (SELECT COUNT(*) FROM prescription_item pi WHERE pi.prescription_id = p.prescription_id) AS lines
       FROM prescription p
       JOIN consultation c ON c.consultation_id = p.consultation_id
       JOIN appointment  a ON a.appointment_id = c.appointment_id
       JOIN student      s ON s.reg_no = a.reg_no
      WHERE p.status = 'ACTIVE'
      ORDER BY p.prescription_id`,
  );

  const drugs = all<{ drug_id: number; name: string; generic_name: string; interactions: number }>(
    `SELECT d.drug_id, d.name, d.generic_name,
            (SELECT COUNT(*) FROM drug_interaction di WHERE di.drug_id = d.drug_id) AS interactions
       FROM drug d ORDER BY interactions DESC, d.name`,
  );

  return (
    <Page wide>
      <TriggerLab
        prescriptions={prescriptions}
        drugs={drugs}
        interactions={interactionGraph()}
        alerts={clinicalAlerts(12)}
        feed={triggerFeed(30)}
      />
    </Page>
  );
}
