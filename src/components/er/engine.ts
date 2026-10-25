import type { ErEdge, ErTable, ModuleKey } from "@/lib/db/model";

/* ============================================================ node metrics */

export const NODE_W = 196;
export const HEAD_H = 27;
export const ROW_H = 15;
export const PAD_B = 5;

export type ColumnMode = "keys" | "all" | "none";

/** Which columns a node shows in the current mode. */
export function visibleColumns(table: ErTable, mode: ColumnMode) {
  if (mode === "none") return [];
  if (mode === "all") return table.columns;
  return table.columns.filter((c) => c.pkOrder > 0 || c.isFk || c.isUnique);
}

export function nodeHeight(table: ErTable, mode: ColumnMode) {
  const n = visibleColumns(table, mode).length;
  return HEAD_H + n * ROW_H + (n ? PAD_B : 0);
}

/* ============================================================== simulation */

export type SimNode = {
  id: string;
  module: ModuleKey;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  pinned: boolean;
};

export type SimLink = { source: string; target: string; strength: number };

export const WORLD = { w: 2200, h: 1500 };

/** Where each module wants to live on the canvas. */
export const MODULE_ANCHOR: Record<ModuleKey, { x: number; y: number }> = {
  institution: { x: 360, y: 520 },
  clinical: { x: 960, y: 450 },
  condonation: { x: 660, y: 950 },
  pharmacy: { x: 1560, y: 760 },
  security: { x: 1180, y: 1180 },
};

const ORDER: ModuleKey[] = ["institution", "clinical", "condonation", "pharmacy", "security"];

/* ------------------------------------------------------------ initial sets */

/** Deterministic grid, grouped by module - the tidy "presentation" layout. */
export function moduleLayout(tables: ErTable[], mode: ColumnMode): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};
  const colGap = NODE_W + 46;
  let cursorX = 90;

  for (const key of ORDER) {
    const group = tables.filter((t) => t.module === key);
    if (!group.length) continue;
    const perCol = Math.ceil(group.length / Math.ceil(group.length / 4));
    let x = cursorX;
    let y = 110;
    let used = 0;
    let widest = 0;

    for (const t of group) {
      const h = nodeHeight(t, mode);
      if (used >= perCol) {
        x += colGap;
        y = 110;
        used = 0;
        widest = Math.max(widest, colGap);
      }
      pos[t.name] = { x, y };
      y += h + 34;
      used += 1;
    }
    cursorX = x + colGap + 56;
  }
  return pos;
}

/** Layered left-to-right by foreign-key depth - reads like a data-flow chart. */
export function flowLayout(
  tables: ErTable[],
  edges: ErEdge[],
  mode: ColumnMode,
): Record<string, { x: number; y: number }> {
  const depth = new Map<string, number>();
  const parents = new Map<string, string[]>();
  for (const t of tables) parents.set(t.name, []);
  for (const e of edges) {
    if (e.fromTable === e.toTable) continue;
    parents.get(e.fromTable)!.push(e.toTable);
  }

  // longest-path depth with cycle protection
  function resolve(name: string, seen: Set<string>): number {
    if (depth.has(name)) return depth.get(name)!;
    if (seen.has(name)) return 0;
    seen.add(name);
    const ps = parents.get(name) ?? [];
    const d = ps.length ? Math.max(...ps.map((p) => resolve(p, seen) + 1)) : 0;
    seen.delete(name);
    depth.set(name, d);
    return d;
  }
  for (const t of tables) resolve(t.name, new Set());

  const byDepth = new Map<number, ErTable[]>();
  for (const t of tables) {
    const d = depth.get(t.name) ?? 0;
    byDepth.set(d, [...(byDepth.get(d) ?? []), t]);
  }

  const pos: Record<string, { x: number; y: number }> = {};
  const layerGap = NODE_W + 132;
  for (const [d, group] of [...byDepth.entries()].sort((a, b) => a[0] - b[0])) {
    group.sort((a, b) => ORDER.indexOf(a.module) - ORDER.indexOf(b.module) || a.name.localeCompare(b.name));
    const total = group.reduce((n, t) => n + nodeHeight(t, mode) + 30, 0);
    let y = Math.max(90, (WORLD.h - total) / 2);
    for (const t of group) {
      pos[t.name] = { x: 90 + d * layerGap, y };
      y += nodeHeight(t, mode) + 30;
    }
  }
  return pos;
}

/** Seed positions in module clusters, then let the physics settle them. */
export function seedForce(tables: ErTable[]): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};
  const counts: Partial<Record<ModuleKey, number>> = {};
  for (const t of tables) {
    const i = (counts[t.module] = (counts[t.module] ?? 0) + 1);
    const a = MODULE_ANCHOR[t.module];
    const angle = i * 2.399963; // golden angle - even spread, no clumping
    const r = 42 + Math.sqrt(i) * 62;
    pos[t.name] = { x: a.x + Math.cos(angle) * r, y: a.y + Math.sin(angle) * r * 0.78 };
  }
  return pos;
}

/* --------------------------------------------------------------- the ticker */

export type SimState = { nodes: Map<string, SimNode>; links: SimLink[]; alpha: number };

export function createSim(
  tables: ErTable[],
  edges: ErEdge[],
  mode: ColumnMode,
  start: Record<string, { x: number; y: number }>,
): SimState {
  const nodes = new Map<string, SimNode>();
  for (const t of tables) {
    const p = start[t.name] ?? { x: WORLD.w / 2, y: WORLD.h / 2 };
    nodes.set(t.name, {
      id: t.name,
      module: t.module,
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      w: NODE_W,
      h: nodeHeight(t, mode),
      pinned: false,
    });
  }
  const links: SimLink[] = edges
    .filter((e) => e.fromTable !== e.toTable && nodes.has(e.fromTable) && nodes.has(e.toTable))
    .map((e) => ({
      source: e.fromTable,
      target: e.toTable,
      // identifying / specialization edges hold their tables closer together
      strength: e.kind === "specialization" ? 0.055 : e.kind === "identifying" ? 0.04 : 0.024,
    }));

  return { nodes, links, alpha: 1 };
}

const DAMPING = 0.82;
const ALPHA_DECAY = 0.0135;

/** One physics step. Returns the remaining alpha (0 = settled). */
export function tick(sim: SimState, clustered: boolean): number {
  const list = [...sim.nodes.values()];
  const a = sim.alpha;

  // 1. pairwise separation - keeps boxes from overlapping and spreads the field
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const n1 = list[i];
      const n2 = list[j];
      const dx = n2.x + n2.w / 2 - (n1.x + n1.w / 2);
      const dy = n2.y + n2.h / 2 - (n1.y + n1.h / 2);
      const dist = Math.hypot(dx, dy) || 0.01;

      const minX = (n1.w + n2.w) / 2 + 30;
      const minY = (n1.h + n2.h) / 2 + 24;
      const overlapX = minX - Math.abs(dx);
      const overlapY = minY - Math.abs(dy);

      if (overlapX > 0 && overlapY > 0) {
        // hard separation along the cheaper axis
        if (overlapX / minX < overlapY / minY) {
          const push = (overlapX / 2) * 0.32 * (dx >= 0 ? 1 : -1);
          n1.vx -= push;
          n2.vx += push;
        } else {
          const push = (overlapY / 2) * 0.32 * (dy >= 0 ? 1 : -1);
          n1.vy -= push;
          n2.vy += push;
        }
      } else if (dist < 430) {
        // soft long-range repulsion
        const f = (1500 / (dist * dist)) * a;
        n1.vx -= (dx / dist) * f;
        n1.vy -= (dy / dist) * f;
        n2.vx += (dx / dist) * f;
        n2.vy += (dy / dist) * f;
      }
    }
  }

  // 2. relationship springs
  for (const link of sim.links) {
    const s = sim.nodes.get(link.source)!;
    const t = sim.nodes.get(link.target)!;
    const dx = t.x + t.w / 2 - (s.x + s.w / 2);
    const dy = t.y + t.h / 2 - (s.y + s.h / 2);
    const dist = Math.hypot(dx, dy) || 0.01;
    const rest = (s.w + t.w) / 2 + 70;
    const f = (dist - rest) * link.strength * a;
    const fx = (dx / dist) * f;
    const fy = (dy / dist) * f;
    s.vx += fx;
    s.vy += fy;
    t.vx -= fx;
    t.vy -= fy;
  }

  // 3. module gravity + world centering
  for (const n of list) {
    if (clustered) {
      const anchor = MODULE_ANCHOR[n.module];
      n.vx += (anchor.x - (n.x + n.w / 2)) * 0.034 * a;
      n.vy += (anchor.y - (n.y + n.h / 2)) * 0.034 * a;
    } else {
      n.vx += (WORLD.w / 2 - (n.x + n.w / 2)) * 0.004 * a;
      n.vy += (WORLD.h / 2 - (n.y + n.h / 2)) * 0.004 * a;
    }
  }

  // 4. integrate
  let energy = 0;
  for (const n of list) {
    if (n.pinned) {
      n.vx = 0;
      n.vy = 0;
      continue;
    }
    n.vx *= DAMPING;
    n.vy *= DAMPING;
    const speed = Math.hypot(n.vx, n.vy);
    if (speed > 14) {
      n.vx = (n.vx / speed) * 14;
      n.vy = (n.vy / speed) * 14;
    }
    n.x += n.vx;
    n.y += n.vy;
    n.x = Math.max(40, Math.min(WORLD.w - n.w - 40, n.x));
    n.y = Math.max(40, Math.min(WORLD.h - n.h - 40, n.y));
    energy += speed;
  }

  sim.alpha = Math.max(0, sim.alpha - ALPHA_DECAY);
  return energy / Math.max(1, list.length);
}

/* ================================================================ geometry */

export type Box = { x: number; y: number; w: number; h: number };

export function anchorY(box: Box, colIndex: number | null) {
  if (colIndex === null) return box.y + HEAD_H / 2;
  const y = box.y + HEAD_H + colIndex * ROW_H + ROW_H / 2;
  return Math.min(y, box.y + box.h - 4);
}

/**
 * Builds the SVG path for one relationship plus the points its crow's-foot
 * and cardinality ticks hang off.
 */
export function edgeGeometry(
  child: Box,
  parent: Box,
  childCol: number | null,
  parentCol: number | null,
) {
  const cCenter = child.x + child.w / 2;
  const pCenter = parent.x + parent.w / 2;
  const childExitsRight = pCenter >= cCenter;

  const cx = childExitsRight ? child.x + child.w : child.x;
  const cy = anchorY(child, childCol);
  const px = childExitsRight ? parent.x : parent.x + parent.w;
  const py = anchorY(parent, parentCol);

  const cDir = childExitsRight ? 1 : -1;
  const pDir = childExitsRight ? -1 : 1;

  const gap = Math.abs(px - cx);
  const bow = Math.max(46, Math.min(gap * 0.52, 190));

  const d = `M ${cx} ${cy} C ${cx + cDir * bow} ${cy}, ${px + pDir * bow} ${py}, ${px} ${py}`;

  return { d, cx, cy, px, py, cDir, pDir };
}

/** Self-referencing relationship: a loop that leaves and re-enters the right edge. */
export function selfLoopGeometry(box: Box, fromCol: number | null, toCol: number | null) {
  const x = box.x + box.w;
  const y1 = anchorY(box, fromCol);
  const y2 = anchorY(box, toCol) + (fromCol === toCol ? 14 : 0);
  const out = 62;
  const d = `M ${x} ${y1} C ${x + out} ${y1 - 10}, ${x + out} ${y2 + 10}, ${x} ${y2}`;
  return { d, cx: x, cy: y1, px: x, py: y2, cDir: 1, pDir: 1 };
}

/** Three prongs opening onto the entity box - the "many" end. */
export function crowsFoot(x: number, y: number, dir: number) {
  const tip = x + dir * 13;
  return `M ${tip} ${y} L ${x} ${y - 5.5} M ${tip} ${y} L ${x} ${y} M ${tip} ${y} L ${x} ${y + 5.5}`;
}

/** A single bar across the line - the "one" end. */
export function oneTick(x: number, y: number, dir: number) {
  const at = x + dir * 11;
  return `M ${at} ${y - 5} L ${at} ${y + 5}`;
}
