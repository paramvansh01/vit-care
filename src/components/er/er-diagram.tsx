"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  Crosshair,
  Focus,
  KeyRound,
  Link2,
  Maximize2,
  Minimize2,
  Minus,
  Scan,
  Play,
  Plus,
  Shuffle,
  Sparkles,
  Waypoints,
  X,
} from "lucide-react";
import { MODULES, type ErModel, type ErTable, type ModuleKey } from "@/lib/db/model";
import {
  type Box,
  type ColumnMode,
  type SimState,
  HEAD_H,
  NODE_W,
  ROW_H,
  WORLD,
  createSim,
  crowsFoot,
  edgeGeometry,
  flowLayout,
  moduleLayout,
  nodeHeight,
  oneTick,
  seedForce,
  selfLoopGeometry,
  tick,
  visibleColumns,
} from "./engine";

type LayoutMode = "force" | "modules" | "flow";

const KIND_LABEL: Record<string, string> = {
  strong: "Strong entity",
  weak: "Weak entity",
  associative: "Associative (M:N)",
  subclass: "EER subclass",
  system: "System / event",
};

export function ErDiagram({ model }: { model: ErModel }) {
  const [layout, setLayout] = useState<LayoutMode>("force");
  const [colMode, setColMode] = useState<ColumnMode>("keys");
  const [activeModules, setActiveModules] = useState<Set<ModuleKey>>(
    () => new Set(Object.keys(MODULES) as ModuleKey[]),
  );
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [flowing, setFlowing] = useState(true);
  const [settled, setSettled] = useState(false);
  const [panning, setPanning] = useState(false);
  // Positions are published out of the physics loop as a snapshot rather than
  // read off the sim ref during render, so React always renders a stable frame.
  const [boxes, setBoxes] = useState<Map<string, Box>>(() => new Map());
  const [view, setView] = useState({ x: 0, y: 0, k: 0.72 });

  const viewportRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<SimState | null>(null);
  const rafRef = useRef<number>(0);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const tables = useMemo(
    () => model.tables.filter((t) => activeModules.has(t.module)),
    [model.tables, activeModules],
  );
  const tableNames = useMemo(() => new Set(tables.map((t) => t.name)), [tables]);
  const edges = useMemo(
    () => model.edges.filter((e) => tableNames.has(e.fromTable) && tableNames.has(e.toTable)),
    [model.edges, tableNames],
  );
  const byName = useMemo(() => new Map(model.tables.map((t) => [t.name, t])), [model.tables]);

  /* ------------------------------------------------------------- simulation */

  /** Copy the simulation's current positions into React state. */
  const publishBoxes = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    const map = new Map<string, Box>();
    for (const t of tables) {
      const n = sim.nodes.get(t.name);
      if (n) map.set(t.name, { x: n.x, y: n.y, w: NODE_W, h: nodeHeight(t, colMode) });
    }
    setBoxes(map);
  }, [tables, colMode]);

  const buildLayout = useCallback(() => {
    if (layout === "modules") return moduleLayout(tables, colMode);
    if (layout === "flow") return flowLayout(tables, edges, colMode);
    return seedForce(tables);
  }, [layout, tables, edges, colMode]);

  useEffect(() => {
    simRef.current = createSim(tables, edges, colMode, buildLayout());

    // Deterministic layouts are already final - publish once and come to rest.
    if (layout !== "force") {
      simRef.current.alpha = 0;
      rafRef.current = requestAnimationFrame(() => {
        publishBoxes();
        setSettled(true);
      });
      return () => cancelAnimationFrame(rafRef.current);
    }

    let stop = false;
    const step = () => {
      if (stop || !simRef.current) return;
      const energy = tick(simRef.current, true);
      publishBoxes();
      if (simRef.current.alpha <= 0.002 && energy < 0.22) {
        setSettled(true);
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(() => {
      setSettled(false);
      step();
    });
    return () => {
      stop = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [buildLayout, publishBoxes, tables, edges, colMode, layout]);

  /** Wake the physics back up (after a drag, or on demand). */
  const reheat = useCallback(
    (alpha = 0.55) => {
      if (layout !== "force" || !simRef.current) return;
      simRef.current.alpha = alpha;
      setSettled(false);
      cancelAnimationFrame(rafRef.current);
      const step = () => {
        if (!simRef.current) return;
        const energy = tick(simRef.current, true);
        publishBoxes();
        if (simRef.current.alpha <= 0.002 && energy < 0.22 && !dragRef.current) {
          setSettled(true);
          return;
        }
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [layout, publishBoxes],
  );

  /** Index of each column inside the currently rendered row list. */
  const colIndex = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const t of tables) {
      const inner = new Map<string, number>();
      visibleColumns(t, colMode).forEach((c, i) => inner.set(c.name, i));
      map.set(t.name, inner);
    }
    return map;
  }, [tables, colMode]);

  /* ------------------------------------------------------------ highlight */

  const focus = hovered ?? selected;
  const neighbours = useMemo(() => {
    if (!focus) return null;
    const set = new Set<string>([focus]);
    for (const e of edges) {
      if (e.fromTable === focus) set.add(e.toTable);
      if (e.toTable === focus) set.add(e.fromTable);
    }
    return set;
  }, [focus, edges]);

  /* --------------------------------------------------------- interactions */

  function onNodePointerDown(e: React.PointerEvent, name: string) {
    e.stopPropagation();
    const sim = simRef.current;
    if (!sim) return;
    const node = sim.nodes.get(name);
    if (!node) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    node.pinned = true;
    dragRef.current = {
      id: name,
      dx: e.clientX / view.k - node.x,
      dy: e.clientY / view.k - node.y,
    };
    reheat(0.35);
  }

  function onNodePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const sim = simRef.current;
    if (!drag || !sim) return;
    const node = sim.nodes.get(drag.id);
    if (!node) return;
    node.x = e.clientX / view.k - drag.dx;
    node.y = e.clientY / view.k - drag.dy;
    node.vx = 0;
    node.vy = 0;
    publishBoxes();
  }

  function onNodePointerUp() {
    const drag = dragRef.current;
    if (drag && simRef.current) {
      const node = simRef.current.nodes.get(drag.id);
      if (node) node.pinned = false;
    }
    dragRef.current = null;
    reheat(0.3);
  }

  function onViewportPointerDown(e: React.PointerEvent) {
    if (dragRef.current) return;
    panRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    setPanning(true);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }

  function onViewportPointerMove(e: React.PointerEvent) {
    onNodePointerMove(e);
    const pan = panRef.current;
    if (!pan) return;
    setView((v) => ({ ...v, x: pan.vx + (e.clientX - pan.x), y: pan.vy + (e.clientY - pan.y) }));
  }

  function onViewportPointerUp() {
    panRef.current = null;
    setPanning(false);
    onNodePointerUp();
  }

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setView((v) => {
        const k = Math.max(0.18, Math.min(2.2, v.k * Math.exp(-e.deltaY * 0.0016)));
        const ratio = k / v.k;
        return { k, x: mx - (mx - v.x) * ratio, y: my - (my - v.y) * ratio };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const fit = useCallback(() => {
    const el = viewportRef.current;
    const sim = simRef.current;
    if (!el || !sim || !tables.length) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const t of tables) {
      const n = sim.nodes.get(t.name);
      if (!n) continue;
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + NODE_W);
      maxY = Math.max(maxY, n.y + nodeHeight(t, colMode));
    }
    const pad = 70;
    const bw = maxX - minX + pad * 2;
    const bh = maxY - minY + pad * 2;
    const k = Math.max(0.18, Math.min(1.5, Math.min(el.clientWidth / bw, el.clientHeight / bh)));
    setView({
      k,
      x: (el.clientWidth - (maxX - minX) * k) / 2 - minX * k,
      y: (el.clientHeight - (maxY - minY) * k) / 2 - minY * k,
    });
  }, [tables, colMode]);

  useEffect(() => {
    if (settled) fit();
    // only auto-fit once the physics comes to rest
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, layout, colMode]);

  const zoomBy = (factor: number) => {
    const el = viewportRef.current;
    if (!el) return;
    const mx = el.clientWidth / 2;
    const my = el.clientHeight / 2;
    setView((v) => {
      const k = Math.max(0.18, Math.min(2.2, v.k * factor));
      const ratio = k / v.k;
      return { k, x: mx - (mx - v.x) * ratio, y: my - (my - v.y) * ratio };
    });
  };

  const toggleModule = (key: ModuleKey) => {
    setActiveModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev;
        next.delete(key);
      } else next.add(key);
      return next;
    });
  };

  const selectedTable = selected ? byName.get(selected) ?? null : null;

  /* ---------------------------------------------------------- fullscreen */

  // Real browser fullscreen where it is allowed; otherwise the canvas is
  // pinned over the whole window. Either way the layout is re-fitted to the
  // new size once it has settled.
  const rootRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    function sync() {
      setFull(document.fullscreenElement === rootRef.current);
    }
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    const id = setTimeout(fit, 120);
    if (!full) return () => clearTimeout(id);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !document.fullscreenElement) setFull(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
    // re-fit only when the size mode flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);

  async function toggleFull() {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    if (full) {
      setFull(false);
      return;
    }
    if (document.fullscreenEnabled && el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        /* blocked (e.g. inside an iframe) - fall back to the pinned overlay */
      }
    }
    setFull(true);
  }

  /* -------------------------------------------------------------- render */

  return (
    <div
      ref={rootRef}
      className={`flex min-h-0 flex-1 flex-col bg-surface ${full ? "fixed inset-0 z-50 h-screen w-screen" : ""}`}
    >
      <Toolbar
        layout={layout}
        setLayout={setLayout}
        colMode={colMode}
        setColMode={setColMode}
        flowing={flowing}
        setFlowing={setFlowing}
        activeModules={activeModules}
        toggleModule={toggleModule}
        onFit={fit}
        full={full}
        onToggleFull={toggleFull}
        onZoomIn={() => zoomBy(1.22)}
        onZoomOut={() => zoomBy(1 / 1.22)}
        onShuffle={() => {
          if (layout !== "force") setLayout("force");
          else {
            const sim = simRef.current;
            if (sim) {
              for (const n of sim.nodes.values()) {
                n.vx += (Math.random() - 0.5) * 26;
                n.vy += (Math.random() - 0.5) * 26;
              }
            }
            reheat(0.9);
          }
        }}
        settled={settled}
        counts={{ tables: tables.length, edges: edges.length }}
      />

      <div className="relative flex min-h-0 flex-1">
        <div
          ref={viewportRef}
          className={`er-viewport relative min-h-[560px] flex-1 overflow-hidden ${panning ? "is-panning" : ""}`}
          onPointerDown={onViewportPointerDown}
          onPointerMove={onViewportPointerMove}
          onPointerUp={onViewportPointerUp}
          onPointerLeave={onViewportPointerUp}
          onClick={() => setSelected(null)}
        >
          <div
            className="absolute left-0 top-0"
            style={{
              width: WORLD.w,
              height: WORLD.h,
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
              transformOrigin: "0 0",
            }}
          >
            <svg
              width={WORLD.w}
              height={WORLD.h}
              className="pointer-events-none absolute left-0 top-0 overflow-visible"
            >
              <defs>
                <filter id="er-glow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="2.6" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {edges.map((edge) => {
                const child = boxes.get(edge.fromTable);
                const parent = boxes.get(edge.toTable);
                if (!child || !parent) return null;

                const cIdx = colIndex.get(edge.fromTable)?.get(edge.fromColumns[0]);
                const pIdx = colIndex.get(edge.toTable)?.get(edge.toColumns[0]);
                const geo =
                  edge.fromTable === edge.toTable
                    ? selfLoopGeometry(child, cIdx ?? null, pIdx ?? null)
                    : edgeGeometry(child, parent, cIdx ?? null, pIdx ?? null);

                const hue = MODULES[byName.get(edge.toTable)?.module ?? "security"].hue;
                const isActive = !focus || edge.fromTable === focus || edge.toTable === focus;
                const dim = focus && !isActive;
                const strong = focus && isActive;

                const dash =
                  edge.kind === "non-identifying" ? "5 4" : edge.kind === "recursive" ? "1 0" : undefined;

                return (
                  <g key={edge.id} opacity={dim ? 0.1 : 1} style={{ transition: "opacity .25s ease" }}>
                    <path
                      id={`path-${edge.id}`}
                      d={geo.d}
                      fill="none"
                      stroke={edge.kind === "recursive" ? "#EA580C" : hue}
                      strokeOpacity={strong ? 0.95 : 0.5}
                      strokeWidth={strong ? 2.1 : 1.35}
                      strokeDasharray={dash}
                      strokeLinecap="round"
                      filter={strong ? "url(#er-glow)" : undefined}
                    />

                    {/* the travelling current along the relationship */}
                    {flowing && (
                      <path
                        d={geo.d}
                        fill="none"
                        stroke={edge.kind === "recursive" ? "#FB923C" : hue}
                        strokeOpacity={strong ? 0.95 : 0.34}
                        strokeWidth={strong ? 2.6 : 1.7}
                        strokeLinecap="round"
                        strokeDasharray="3 26"
                        style={{
                          animation: `flow-dash ${strong ? 1.1 : 2.3}s linear infinite`,
                        }}
                      />
                    )}

                    {/* cardinality notation */}
                    <path
                      d={
                        edge.childCardinality === "many"
                          ? crowsFoot(geo.cx, geo.cy, geo.cDir)
                          : oneTick(geo.cx, geo.cy, geo.cDir)
                      }
                      fill="none"
                      stroke={edge.kind === "recursive" ? "#EA580C" : hue}
                      strokeOpacity={strong ? 1 : 0.7}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                    <path
                      d={oneTick(geo.px, geo.py, geo.pDir)}
                      fill="none"
                      stroke={edge.kind === "recursive" ? "#EA580C" : hue}
                      strokeOpacity={strong ? 1 : 0.7}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                    {edge.optional && (
                      <circle
                        cx={geo.cx + geo.cDir * 20}
                        cy={geo.cy}
                        r={3.1}
                        fill="#fff"
                        stroke={hue}
                        strokeOpacity={0.8}
                        strokeWidth={1.3}
                      />
                    )}

                    {/* EER disjoint-specialization symbol */}
                    {edge.kind === "specialization" && (
                      <g>
                        <circle
                          cx={(geo.cx + geo.px) / 2}
                          cy={(geo.cy + geo.py) / 2}
                          r={8}
                          fill="#fff"
                          stroke="#7C3AED"
                          strokeWidth={1.4}
                        />
                        <text
                          x={(geo.cx + geo.px) / 2}
                          y={(geo.cy + geo.py) / 2 + 3.2}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="700"
                          fill="#7C3AED"
                        >
                          d
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {tables.map((t) => {
              const box = boxes.get(t.name);
              if (!box) return null;
              const dim = neighbours ? !neighbours.has(t.name) : false;
              return (
                <ErNode
                  key={t.name}
                  table={t}
                  box={box}
                  colMode={colMode}
                  dimmed={dim}
                  focused={focus === t.name}
                  selected={selected === t.name}
                  onEnter={() => setHovered(t.name)}
                  onLeave={() => setHovered(null)}
                  onPointerDown={(e) => onNodePointerDown(e, t.name)}
                  onSelect={(e) => {
                    e.stopPropagation();
                    setSelected((s) => (s === t.name ? null : t.name));
                  }}
                />
              );
            })}
          </div>

          <Legend />

          <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-1.5">
            <span className="pointer-events-auto rounded-full border border-line bg-surface/90 px-2.5 py-1 text-[10.5px] text-ink-mute shadow-sm backdrop-blur mono">
              {Math.round(view.k * 100)}%
            </span>
            {!settled && (
              <span className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-teal-200 bg-brand-wash/90 px-2.5 py-1 text-[10.5px] font-medium text-brand-deep shadow-sm backdrop-blur">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-brand" />
                solving layout
              </span>
            )}
          </div>
        </div>

        {selectedTable && (
          <TableInspector table={selectedTable} model={model} onClose={() => setSelected(null)} />
        )}
      </div>
    </div>
  );
}

/* ================================================================== node */

const ErNode = memo(function ErNode({
  table,
  box,
  colMode,
  dimmed,
  focused,
  selected,
  onEnter,
  onLeave,
  onPointerDown,
  onSelect,
}: {
  table: ErTable;
  box: Box;
  colMode: ColumnMode;
  dimmed: boolean;
  focused: boolean;
  selected: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onSelect: (e: React.MouseEvent) => void;
}) {
  const hue = MODULES[table.module].hue;
  const cols = visibleColumns(table, colMode);

  return (
    <div
      className={`er-node ${dimmed ? "dimmed" : ""} ${focused ? "focused" : ""}`}
      style={{
        transform: `translate(${box.x}px, ${box.y}px)`,
        left: 0,
        top: 0,
        width: NODE_W,
        borderColor: focused || selected ? hue : undefined,
        outline: selected ? `2px solid ${hue}33` : undefined,
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onPointerDown={onPointerDown}
      onClick={onSelect}
    >
      <div className="er-node-head" style={{ height: HEAD_H, background: hue }}>
        {table.kind === "weak" && <span className="text-[9px] opacity-80">◇</span>}
        {table.kind === "subclass" && <span className="text-[9px] opacity-80">⊂</span>}
        {table.kind === "associative" && <span className="text-[9px] opacity-80">⋈</span>}
        <span className="mono truncate">{table.name}</span>
        <span className="ml-auto rounded bg-white/22 px-1.5 py-[1px] text-[9px] font-semibold tabular-nums">
          {table.rowCount}
        </span>
      </div>

      {cols.map((c) => (
        <div
          key={c.name}
          className={`er-col ${c.pkOrder > 0 ? "hot" : ""}`}
          style={{ height: ROW_H }}
          title={`${c.name} ${c.type}${c.notNull ? " NOT NULL" : ""}`}
        >
          <span
            className="er-key mono"
            style={{ color: c.pkOrder > 0 ? "#B45309" : c.isFk ? hue : "#C4C8CC" }}
          >
            {c.pkOrder > 0 ? "PK" : c.isFk ? "FK" : c.isUnique ? "U" : ""}
          </span>
          <span
            className="mono truncate"
            style={{
              color: c.pkOrder > 0 ? "#78350F" : "#3F4854",
              fontWeight: c.pkOrder > 0 ? 650 : 400,
            }}
          >
            {c.name}
          </span>
          <span className="mono ml-auto text-[8.5px] text-[#B4BAC2]">
            {c.type.replace("INTEGER", "INT").replace("TEXT", "TXT")}
          </span>
        </div>
      ))}

      {colMode !== "none" && cols.length < table.columns.length && (
        <div className="er-col text-[9px] text-ink-mute" style={{ height: ROW_H }}>
          <span className="er-key" />
          <span className="mono">+{table.columns.length - cols.length} more</span>
        </div>
      )}
    </div>
  );
});

/* =============================================================== toolbar */

function Toolbar(props: {
  layout: LayoutMode;
  setLayout: (m: LayoutMode) => void;
  colMode: ColumnMode;
  setColMode: (m: ColumnMode) => void;
  flowing: boolean;
  setFlowing: (b: boolean) => void;
  activeModules: Set<ModuleKey>;
  toggleModule: (k: ModuleKey) => void;
  onFit: () => void;
  full: boolean;
  onToggleFull: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onShuffle: () => void;
  settled: boolean;
  counts: { tables: number; edges: number };
}) {
  const layouts: { id: LayoutMode; label: string; icon: typeof Waypoints }[] = [
    { id: "force", label: "Force", icon: Sparkles },
    { id: "modules", label: "Modules", icon: Boxes },
    { id: "flow", label: "Flow", icon: Waypoints },
  ];
  const colModes: { id: ColumnMode; label: string }[] = [
    { id: "keys", label: "Keys" },
    { id: "all", label: "All columns" },
    { id: "none", label: "Entities only" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
      <Segmented
        items={layouts.map((l) => ({ id: l.id, label: l.label, icon: <l.icon size={12} /> }))}
        value={props.layout}
        onChange={(v) => props.setLayout(v as LayoutMode)}
      />
      <Segmented
        items={colModes.map((c) => ({ id: c.id, label: c.label }))}
        value={props.colMode}
        onChange={(v) => props.setColMode(v as ColumnMode)}
      />

      <button
        onClick={() => props.setFlowing(!props.flowing)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] transition ${
          props.flowing
            ? "border-teal-200 bg-brand-wash text-brand-deep"
            : "border-line text-ink-soft hover:bg-sunk"
        }`}
      >
        <Play size={11} />
        Flow
      </button>

      <span className="mx-1 hidden h-5 w-px bg-line sm:block" />

      <div className="flex flex-wrap items-center gap-1.5">
        {(Object.keys(MODULES) as ModuleKey[]).map((key) => {
          const on = props.activeModules.has(key);
          const m = MODULES[key];
          return (
            <button
              key={key}
              onClick={() => props.toggleModule(key)}
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition"
              style={{
                borderColor: on ? m.hue + "55" : "var(--line)",
                background: on ? m.accent : "transparent",
                color: on ? m.hue : "var(--ink-mute)",
                opacity: on ? 1 : 0.55,
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: on ? m.hue : "var(--line-strong)" }}
              />
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="mono hidden text-[10.5px] text-ink-mute md:inline">
          {props.counts.tables} entities · {props.counts.edges} relationships
        </span>
        <IconBtn onClick={props.onShuffle} title="Re-run the force layout">
          <Shuffle size={13} />
        </IconBtn>
        <IconBtn onClick={props.onZoomOut} title="Zoom out">
          <Minus size={13} />
        </IconBtn>
        <IconBtn onClick={props.onZoomIn} title="Zoom in">
          <Plus size={13} />
        </IconBtn>
        <IconBtn onClick={props.onFit} title="Fit the diagram to the view">
          <Scan size={13} />
        </IconBtn>
        <IconBtn onClick={props.onToggleFull} title={props.full ? "Exit full screen (Esc)" : "Full screen"}>
          {props.full ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </IconBtn>
      </div>
    </div>
  );
}

function Segmented({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center rounded-lg border border-line bg-sunk p-0.5">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={`flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[11.5px] transition ${
            value === item.id
              ? "bg-surface font-semibold text-ink shadow-sm"
              : "text-ink-mute hover:text-ink-soft"
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="grid h-7 w-7 place-items-center rounded-lg border border-line text-ink-soft transition hover:border-line-strong hover:bg-sunk"
    >
      {children}
    </button>
  );
}

/* ================================================================ legend */

function Legend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-line bg-surface/92 p-3 text-[10.5px] shadow-sm backdrop-blur">
      <p className="eyebrow mb-2">Notation</p>
      <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-ink-soft">
        <Row svg={<path d="M2 6 H34" stroke="#0D9488" strokeWidth="1.6" fill="none" />} label="Identifying" />
        <Row
          svg={<path d="M2 6 H34" stroke="#64748B" strokeWidth="1.4" strokeDasharray="5 4" fill="none" />}
          label="Non-identifying"
        />
        <Row
          svg={
            <>
              <path d="M2 6 H26" stroke="#7C3AED" strokeWidth="1.5" fill="none" />
              <circle cx="30" cy="6" r="5" fill="#fff" stroke="#7C3AED" strokeWidth="1.2" />
              <text x="30" y="8.6" fontSize="6.5" fontWeight="700" fill="#7C3AED" textAnchor="middle">
                d
              </text>
            </>
          }
          label="EER specialization"
        />
        <Row
          svg={<path d="M2 6 H34" stroke="#EA580C" strokeWidth="1.6" fill="none" />}
          label="Recursive"
        />
        <Row
          svg={
            <>
              <path d="M18 6 H34" stroke="#3F4854" strokeWidth="1.3" fill="none" />
              <path d="M18 6 L6 1.5 M18 6 L6 6 M18 6 L6 10.5" stroke="#3F4854" strokeWidth="1.3" fill="none" />
            </>
          }
          label="Many"
        />
        <Row
          svg={
            <>
              <path d="M2 6 H34" stroke="#3F4854" strokeWidth="1.3" fill="none" />
              <path d="M12 1.5 V10.5" stroke="#3F4854" strokeWidth="1.3" />
            </>
          }
          label="Exactly one"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-line pt-2 text-ink-mute">
        <span>◇ weak</span>
        <span>⊂ subclass</span>
        <span>⋈ M:N</span>
        <span className="text-[#B45309]">PK</span>
        <span className="text-brand">FK</span>
      </div>
    </div>
  );
}

function Row({ svg, label }: { svg: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="36" height="12" className="shrink-0">
        {svg}
      </svg>
      {label}
    </span>
  );
}

/* ============================================================= inspector */

function TableInspector({
  table,
  model,
  onClose,
}: {
  table: ErTable;
  model: ErModel;
  onClose: () => void;
}) {
  // Keyed by table name so switching tables shows the loader without a
  // synchronous reset inside the effect.
  const [loaded, setLoaded] = useState<{ key: string; rows: Record<string, unknown>[] } | null>(null);
  const rows = loaded?.key === table.name ? loaded.rows : null;
  const hue = MODULES[table.module].hue;

  useEffect(() => {
    let live = true;
    fetch(`/api/table/${table.name}?limit=8`)
      .then((r) => r.json())
      .then((d) => live && setLoaded({ key: table.name, rows: d.rows ?? [] }))
      .catch(() => live && setLoaded({ key: table.name, rows: [] }));
    return () => {
      live = false;
    };
  }, [table.name]);

  const outgoing = model.edges.filter((e) => e.fromTable === table.name);
  const incoming = model.edges.filter((e) => e.toTable === table.name && e.fromTable !== table.name);

  return (
    <aside className="slide-in-left flex w-[370px] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface">
      <div className="sticky top-0 z-10 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: hue }} />
              <h3 className="mono truncate text-[14px] font-semibold">{table.name}</h3>
            </div>
            <p className="mt-1 text-[11.5px] text-ink-mute">
              {KIND_LABEL[table.kind]} · {MODULES[table.module].label} · {table.rowCount} rows
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded-md text-ink-mute transition hover:bg-sunk hover:text-ink"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-5 p-4">
        <section>
          <p className="eyebrow mb-2 flex items-center gap-1.5">
            <KeyRound size={11} /> Columns
          </p>
          <div className="overflow-hidden rounded-lg border border-line">
            {table.columns.map((c, i) => (
              <div
                key={c.name}
                className={`flex items-center gap-2 px-2.5 py-[5px] text-[11px] ${
                  i ? "border-t border-line" : ""
                } ${c.pkOrder > 0 ? "bg-amber-50/60" : ""}`}
              >
                <span
                  className="mono w-5 shrink-0 text-[8.5px] font-bold"
                  style={{ color: c.pkOrder > 0 ? "#B45309" : c.isFk ? hue : "#C4C8CC" }}
                >
                  {c.pkOrder > 0 ? "PK" : c.isFk ? "FK" : c.isUnique ? "U" : ""}
                </span>
                <span className="mono min-w-0 flex-1 truncate">{c.name}</span>
                <span className="mono shrink-0 text-[9.5px] text-ink-mute">{c.type}</span>
                {c.notNull && <span className="shrink-0 text-[8.5px] text-rose-500">NN</span>}
              </div>
            ))}
          </div>
        </section>

        {(outgoing.length > 0 || incoming.length > 0) && (
          <section>
            <p className="eyebrow mb-2 flex items-center gap-1.5">
              <Link2 size={11} /> Relationships
            </p>
            <div className="space-y-1">
              {outgoing.map((e) => (
                <p key={e.id} className="mono text-[10.5px] text-ink-soft">
                  <span className="text-ink-mute">→ </span>
                  {e.fromColumns.join(", ")}{" "}
                  <span className="text-ink-mute">references</span>{" "}
                  <span className="font-semibold" style={{ color: MODULES[model.tables.find((t) => t.name === e.toTable)?.module ?? "security"].hue }}>
                    {e.toTable}
                  </span>
                  {e.onDelete !== "NO ACTION" && (
                    <span className="text-ink-mute"> · ON DELETE {e.onDelete}</span>
                  )}
                </p>
              ))}
              {incoming.map((e) => (
                <p key={e.id} className="mono text-[10.5px] text-ink-soft">
                  <span className="text-ink-mute">← </span>
                  <span className="font-semibold">{e.fromTable}</span>
                  <span className="text-ink-mute">.{e.fromColumns.join(", ")}</span>
                </p>
              ))}
            </div>
          </section>
        )}

        {table.triggers.length > 0 && (
          <section>
            <p className="eyebrow mb-2 flex items-center gap-1.5">
              <Crosshair size={11} /> Triggers on this table
            </p>
            <div className="space-y-1">
              {table.triggers.map((t) => (
                <p key={t} className="mono rounded-md bg-violet-50 px-2 py-1 text-[10.5px] text-violet-700">
                  {t}
                </p>
              ))}
            </div>
          </section>
        )}

        {table.indexes.length > 0 && (
          <section>
            <p className="eyebrow mb-2 flex items-center gap-1.5">
              <Focus size={11} /> Indexes
            </p>
            <div className="space-y-1">
              {table.indexes.map((idx) => (
                <p key={idx.name} className="mono text-[10.5px] text-ink-soft">
                  {idx.unique && <span className="text-emerald-600">UNIQUE </span>}
                  {idx.columns.join(", ")}
                </p>
              ))}
            </div>
          </section>
        )}

        <section>
          <p className="eyebrow mb-2">Live rows</p>
          {rows === null ? (
            <div
              className="h-20 rounded-lg border border-line"
              style={{
                background:
                  "linear-gradient(90deg, #f6f7f8 25%, #eef0f1 37%, #f6f7f8 63%) 0 0 / 200% 100%",
                animation: "shimmer 1.4s linear infinite",
              }}
            />
          ) : rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line-strong px-3 py-4 text-center text-[11px] text-ink-mute">
              No rows yet
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="mono w-full text-[10px]">
                <thead>
                  <tr>
                    {Object.keys(rows[0]).slice(0, 5).map((k) => (
                      <th
                        key={k}
                        className="whitespace-nowrap border-b border-line bg-sunk px-2 py-1.5 text-left font-semibold text-ink-mute"
                      >
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {Object.keys(rows[0]).slice(0, 5).map((k) => (
                        <td
                          key={k}
                          className="max-w-[110px] truncate whitespace-nowrap border-b border-line px-2 py-1 text-ink-soft"
                          title={String(r[k] ?? "")}
                        >
                          {r[k] === null ? <span className="text-ink-mute">NULL</span> : String(r[k])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <p className="eyebrow mb-2">DDL</p>
          <pre className="mono max-h-64 overflow-auto rounded-lg border border-line bg-[#fcfcfb] p-2.5 text-[9.5px] leading-[1.6] text-ink-soft">
            {table.ddl}
          </pre>
        </section>
      </div>
    </aside>
  );
}
