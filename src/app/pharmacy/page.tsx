import { Page } from "@/components/ui";
import { PharmacyStudio } from "@/components/pharmacy-studio";
import {
  catalog,
  clinicalAlerts,
  interactionGraph,
  lowStock,
  orders,
  pharmacies,
  students,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function PharmacyPage() {
  const shops = pharmacies();
  const catalogs = Object.fromEntries(shops.map((p) => [p.pharmacy_id, catalog(p.pharmacy_id)]));

  return (
    <Page wide>
      <PharmacyStudio
        students={students()}
        pharmacies={shops}
        catalogs={catalogs}
        orders={orders(12)}
        interactions={interactionGraph()}
        alerts={clinicalAlerts(6)}
        stockAlerts={lowStock()}
      />
    </Page>
  );
}
