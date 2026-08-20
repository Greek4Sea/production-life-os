// BFS pathfinding + walk-then-act queueing. Grids are ≤40x30 so plain BFS.

import { curScene, isWalkable, setTilePos, tileOf, type Game } from './runtime';

const STEP_MS = 110;

// Dijkstra with a turn penalty: shortest paths that prefer straight runs, so
// the avatar walks an L instead of stair-stepping (and doesn't twitch around).
const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]] as const;
const FACING_DIR = [0, 3, 2, 1]; // facing (d,l,r,u) → DIRS index

export function findPath(g: Game, tx: number, ty: number): { x: number; y: number }[] | null {
  const v = curScene(g);
  const from = tileOf(g);
  if (from.x === tx && from.y === ty) return [];
  const key = (x: number, y: number) => y * v.w + x;
  const target = key(tx, ty);
  // state = tile * 5 + (lastDir + 1); lastDir -1 = start (current facing, free)
  const startDir = FACING_DIR[g.save.player.facing];
  const best = new Map<number, number>();
  const prev = new Map<number, number>(); // state → state
  const start = key(from.x, from.y) * 5 + (startDir + 1);
  best.set(start, 0);
  // tiny binary-heap-free frontier: grids are ≤ 1200 tiles, a sorted-insert list is fine
  const frontier: [number, number][] = [[0, start]];
  let goalState = -1;
  while (frontier.length) {
    frontier.sort((a, b) => b[0] - a[0]);
    const [cost, state] = frontier.pop()!;
    if ((best.get(state) ?? Infinity) < cost) continue;
    const tile = Math.floor(state / 5), lastDir = (state % 5) - 1;
    if (tile === target) { goalState = state; break; }
    const cx = tile % v.w, cy = Math.floor(tile / v.w);
    for (let d = 0; d < 4; d++) {
      const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
      if (!isWalkable(v, nx, ny)) continue;
      const nCost = cost + 1 + (lastDir >= 0 && lastDir !== d ? 0.4 : 0);
      const nState = key(nx, ny) * 5 + (d + 1);
      if (nCost < (best.get(nState) ?? Infinity)) {
        best.set(nState, nCost);
        prev.set(nState, state);
        frontier.push([nCost, nState]);
      }
    }
  }
  if (goalState < 0) return null;
  const path: { x: number; y: number }[] = [];
  let cur = goalState;
  while (cur !== start) {
    const tile = Math.floor(cur / 5);
    path.unshift({ x: tile % v.w, y: Math.floor(tile / v.w) });
    cur = prev.get(cur)!;
  }
  return path;
}

// Walk to `tile` if walkable, else to the nearest 4-neighbor of it. When
// `act`, the queued action fires on arrival (adjacent or on the tile).
export function walkTowards(g: Game, tx: number, ty: number, act: boolean): boolean {
  const v = curScene(g);
  const from = tileOf(g);
  const near = Math.abs(from.x - tx) + Math.abs(from.y - ty) <= 1;
  if (act && near) { g.pending = { tile: ty * v.w + tx, act: true }; g.path = []; return true; }

  let path = isWalkable(v, tx, ty) ? findPath(g, tx, ty) : null;
  if (!path && act) {
    // choose the reachable neighbor with the shortest path
    let best: { x: number; y: number }[] | null = null;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
      const nx = tx + dx, ny = ty + dy;
      if (!isWalkable(v, nx, ny)) continue;
      const p = findPath(g, nx, ny);
      if (p && (!best || p.length < best.length)) best = p;
    }
    path = best;
  }
  if (!path) return false;
  g.path = path;
  g.walkT = 0;
  g.pending = act ? { tile: ty * v.w + tx, act: true } : null;
  return true;
}

// advance walking; returns pending action tile when arrived with one queued
export function tickWalk(g: Game, dt: number): number | null {
  if (!g.path.length) {
    if (g.pending) { const t = g.pending.tile; g.pending = null; return t; }
    return null;
  }
  g.walkT += dt;
  g.anim += dt;
  const cur = tileOf(g);
  const next = g.path[0];
  // face the step direction
  g.save.player.facing = next.y > cur.y ? 0 : next.x < cur.x ? 1 : next.x > cur.x ? 2 : 3;
  const t = Math.min(1, g.walkT / STEP_MS);
  g.px = (cur.x + (next.x - cur.x) * t) * 16 + 8;
  g.py = (cur.y + (next.y - cur.y) * t) * 16 + 16;
  if (t >= 1) {
    g.path.shift();
    g.walkT = 0;
    setTilePos(g, next.x, next.y);
  }
  return null;
}

export function faceTile(g: Game, tx: number, ty: number) {
  const from = tileOf(g);
  if (ty > from.y) g.save.player.facing = 0;
  else if (ty < from.y) g.save.player.facing = 3;
  else if (tx < from.x) g.save.player.facing = 1;
  else if (tx > from.x) g.save.player.facing = 2;
}
