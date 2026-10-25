import { ErDiagram } from "@/components/er/er-diagram";
import { introspect } from "@/lib/db/introspect";

export const dynamic = "force-dynamic";

export default function ErDiagramPage() {
  const model = introspect();

  return (
    <div className="flex h-[calc(100vh-56px)] min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-surface px-5 py-3">
        <div>
          <p className="eyebrow">Entity–Relationship Model</p>
          <h2 className="text-[16px] font-semibold tracking-tight">
            Introspected live from <span className="mono text-brand-deep">vitcare.db</span>
          </h2>
        </div>
        <div className="ml-auto flex flex-wrap gap-x-5 gap-y-1 text-[11.5px]">
          <Metric n={model.stats.tables} label="entities" />
          <Metric n={model.stats.relationships} label="relationships" />
          <Metric n={model.stats.columns} label="attributes" />
          <Metric n={model.stats.triggers} label="triggers" />
          <Metric n={model.stats.views} label="views" />
          <Metric n={model.stats.rows} label="rows" />
        </div>
      </div>

      <p className="border-b border-line bg-brand-wash/50 px-5 py-2 text-[11.5px] text-ink-soft">
        Every box, key and line below is read at request time from{" "}
        <span className="mono">sqlite_master</span>, <span className="mono">PRAGMA table_info</span>,{" "}
        <span className="mono">PRAGMA foreign_key_list</span> and{" "}
        <span className="mono">PRAGMA index_list</span> — nothing is hand-drawn, so the diagram cannot
        drift from the database. Drag any entity, scroll to zoom, click one to inspect it.
      </p>

      <ErDiagram model={model} />
    </div>
  );
}

function Metric({ n, label }: { n: number; label: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[15px] font-semibold tabular-nums tracking-tight">{n}</span>
      <span className="text-ink-mute">{label}</span>
    </span>
  );
}
