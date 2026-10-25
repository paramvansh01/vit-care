import { introspect } from "@/lib/db/introspect";
import { SchemaExplorer } from "@/components/schema-explorer";

export const dynamic = "force-dynamic";

export default function SchemaPage() {
  return <SchemaExplorer model={introspect()} />;
}
