// The mine: generated floors, ore rocks, hidden ladders, elevator, slimes.

import { T, type FloorGen, type WorldObject } from '../types';
import { gainItem } from './crafting';
import { bump } from './goals';
import { onBossDefeated } from './monsters';
import { addXp, combatBonus, oreBonus } from './skills';
import { setTilePos, tileOf, toast, type Game } from './runtime';

const W = 20, H = 14;

// mulberry32 — small seeded RNG for floor layouts
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let visitNonce = 1; // fresh layouts every descent within a session

function oreFor(floor: number, r: () => number): { ore: string; sprite: WorldObject['kind'] } | null {
  const roll = r();
  if (roll < 0.015 && floor >= 8) return { ore: 'diamond', sprite: 'gemrock' };
  if (roll < 0.05 && floor >= 4) return { ore: floor >= 15 ? 'emerald' : 'quartz', sprite: 'gemrock' };
  const band = floor < 10 ? 'copper_ore' : floor < 20 ? 'iron_ore' : 'gold_ore';
  if (roll < 0.22) return { ore: band, sprite: 'orerock' };
  if (roll < 0.30) return { ore: 'coal', sprite: 'orerock' };
  return null;
}

export function genFloor(floor: number): FloorGen {
  const tiles = new Array(W * H).fill(T.WALL);
  const objects: Record<number, WorldObject> = {};
  const slimes: FloorGen['slimes'] = [];
  const r = rng(floor * 7919 + (floor === 0 ? 0 : visitNonce++) * 104729 + 13);

  const entry = { x: 2, y: 2 };
  // carve caverns with random walks from the entry
  let cx = entry.x, cy = entry.y;
  const carve = (x: number, y: number) => { tiles[y * W + x] = T.ROCKFLOOR; };
  // guaranteed open room around the entry so fixtures always have floor
  for (let y = entry.y - 1; y <= entry.y + 1; y++) {
    for (let x = entry.x - 1; x <= entry.x + 2; x++) carve(x, y);
  }
  const steps = floor === 0 ? 120 : 260;
  for (let i = 0; i < steps; i++) {
    const d = Math.floor(r() * 4);
    cx = Math.max(1, Math.min(W - 2, cx + [0, 0, 1, -1][d]));
    cy = Math.max(1, Math.min(H - 2, cy + [1, -1, 0, 0][d]));
    carve(cx, cy);
    if (r() < 0.35) carve(Math.max(1, cx - 1), cy);
    if (r() < 0.06) { cx = entry.x; cy = entry.y; } // branch back
  }

  const open: number[] = [];
  for (let i = 0; i < tiles.length; i++) if (tiles[i] === T.ROCKFLOOR) open.push(i);

  // every floor has a way OUT at the entrance — walk onto it to leave
  objects[entry.y * W + (entry.x - 1)] = { kind: 'door', meta: 'farm:39,6' };
  if (floor === 0) {
    // lobby: exit + ladder down + elevator, no rocks
    objects[entry.y * W + entry.x + 1] = { kind: 'elevator' };
    const far = open[open.length - 1];
    objects[far] = { kind: 'ladder' };
  } else if (floor % 5 === 0) {
    // checkpoint floors carry their own elevator by the entrance
    // (the entry room above guarantees this tile is open floor)
    objects[(entry.y + 1) * W + entry.x + 1] = { kind: 'elevator' };
  }
  if (floor > 0) {
    // sprinkle rocks on ~55% of open tiles away from entry
    const rocks: number[] = [];
    for (const i of open) {
      const x = i % W, y = Math.floor(i / W);
      if (Math.abs(x - entry.x) + Math.abs(y - entry.y) < 3) continue;
      if (r() < 0.55) {
        const ore = oreFor(floor, r);
        objects[i] = ore
          ? { kind: ore.sprite, ore: ore.ore, hp: 3 + Math.floor(floor / 10) }
          : { kind: 'minerock', hp: 2 + Math.floor(floor / 12) };
        rocks.push(i);
      }
    }
    // the way down is ALWAYS visible — a ladder standing in the open
    // (you may have to mine PAST rocks to reach it, but never to find it)
    const farOpen = open.filter((i) => !objects[i]
      && Math.abs((i % W) - entry.x) + Math.abs(Math.floor(i / W) - entry.y) > 8);
    const anyOpen = open.filter((i) => !objects[i]
      && Math.abs((i % W) - entry.x) + Math.abs(Math.floor(i / W) - entry.y) > 2);
    const spot = (farOpen.length ? farOpen : anyOpen)[Math.floor(r() * (farOpen.length ? farOpen.length : anyOpen.length))];
    if (spot !== undefined) objects[spot] = { kind: 'ladder' };
    // rocks only ever hide LOOT — the way down is always in plain sight
    for (const i of rocks) {
      if (r() < 0.04) { objects[i] = { ...objects[i], meta: 'bonus' }; break; }
    }
    // slimes
    const n = Math.min(4, 1 + Math.floor(floor / 5) + (r() < 0.5 ? 1 : 0));
    for (let s = 0; s < n; s++) {
      const i = open[Math.floor(r() * open.length)];
      const x = i % W, y = Math.floor(i / W);
      if (Math.abs(x - entry.x) + Math.abs(y - entry.y) > 4 && !objects[i]) {
        slimes.push({ x, y, hp: 2 + Math.floor(floor / 8), t: 0 });
      }
    }
  }
  return { floor, w: W, h: H, tiles, objects, slimes, ladderAt: null, entry };
}

export function enterMine(g: Game, floor: number) {
  g.mineFloor = genFloor(floor);
  g.save.player.scene = 'mine';
  setTilePos(g, g.mineFloor.entry.x, g.mineFloor.entry.y);
  g.path = []; g.pending = null;
  if (floor > g.save.mine.deepestFloor) {
    g.save.mine.deepestFloor = floor;
    g.save.stats.floorReached = Math.max(g.save.stats.floorReached ?? 0, floor);
    bump(g, 'floorVisits'); // checkGoals runs via bump; floorReached is set above
    if (floor % 5 === 0 && floor > 0) toast(g, `Elevator now stops at floor ${floor}.`, '🛗');
  }
  g.dirty = true;
  g.notify();
}

// A mine rock broke: drop loot, maybe reveal the hidden ladder.
export function onRockBroken(g: Game, i: number, o: WorldObject) {
  const s = g.save;
  bump(g, 'rocksBroken');
  if (o.ore) {
    const qty = (o.kind === 'gemrock' ? 1 : 1 + (i % 2)) + (Math.random() < oreBonus(g) ? 1 : 0);
    gainItem(g, o.ore, qty);
    addXp(g, 'mining', 6);
    toast(g, `+${qty} ${o.ore.replace('_', ' ')}`, '⛏️');
    // legend has it starfruit seeds hide deep in gem veins
    if (o.kind === 'gemrock' && (g.mineFloor?.floor ?? 0) >= 15 && Math.random() < 0.2) {
      gainItem(g, 'starfruit_seeds', 1);
      toast(g, 'Starfruit seeds, hidden in the crystal!', '🌟');
    }
    // …and deeper still, in the oldest veins, something else entirely
    if (o.kind === 'gemrock' && (g.mineFloor?.floor ?? 0) >= 20 && Math.random() < 0.08) {
      gainItem(g, 'rune_shard', 1);
    }
  } else {
    gainItem(g, 'stone', 1 + (i % 2));
    addXp(g, 'mining', 3);
    if (Math.random() < 0.15) gainItem(g, 'coal', 1);
  }
  if (o.meta === 'bonus') {
    // the old lucky-rock surprise pays out in riches now, never stairs
    gainItem(g, 'coal', 2);
    if (Math.random() < 0.4) gainItem(g, 'quartz', 1);
    toast(g, 'A hollow rock — packed with goodies!', '💎');
  }
  return false;
}

// slime think/step + contact damage; returns true if player got hit.
// A boss slime moves faster, hits harder, and calls minions.
export function tickSlimes(g: Game, dt: number): boolean {
  const f = g.mineFloor;
  if (!f) return false;
  const p = tileOf(g);
  let hit = false;
  const boss = f.slimes.find((s) => s.boss);
  if (boss) {
    g.bossMinionT = (g.bossMinionT ?? 0) + dt;
    if (g.bossMinionT > 9000 && f.slimes.length < 4) {
      g.bossMinionT = 0;
      f.slimes.push({ x: boss.x, y: boss.y + 1, hp: 2, t: 0 });
    }
  }
  for (const sl of f.slimes) {
    sl.t += dt;
    if (sl.t < (sl.boss ? 480 : 650)) continue;
    sl.t = 0;
    const dist = Math.abs(sl.x - p.x) + Math.abs(sl.y - p.y);
    if (dist > 7 && !sl.boss) continue;   // the king never loses interest
    if (dist === 0 || dist === 1) { hit = true; continue; }
    const dx = Math.sign(p.x - sl.x), dy = Math.sign(p.y - sl.y);
    const tryMove = (nx: number, ny: number) => {
      const i = ny * f.w + nx;
      if (f.tiles[i] !== T.ROCKFLOOR || f.objects[i]) return false;
      if (f.slimes.some((o) => o !== sl && o.x === nx && o.y === ny)) return false;
      sl.x = nx; sl.y = ny; return true;
    };
    if (Math.abs(sl.x - p.x) >= Math.abs(sl.y - p.y)) { tryMove(sl.x + dx, sl.y) || tryMove(sl.x, sl.y + dy); }
    else { tryMove(sl.x, sl.y + dy) || tryMove(sl.x + dx, sl.y); }
    if (Math.abs(sl.x - p.x) + Math.abs(sl.y - p.y) <= 1 && Math.random() < 0.6) hit = true;
  }
  return hit;
}

export function swingSword(g: Game, tx: number, ty: number): boolean {
  const f = g.mineFloor;
  if (!f) return false;
  const dmg = 1 + (g.save.player.tools.sword as number) + combatBonus(g);
  let any = false;
  for (const sl of [...f.slimes]) {
    if (Math.abs(sl.x - tx) + Math.abs(sl.y - ty) <= 1) {
      sl.hp -= dmg;
      any = true;
      if (sl.hp <= 0) {
        f.slimes.splice(f.slimes.indexOf(sl), 1);
        if (sl.boss) {
          onBossDefeated(g);
        } else {
          gainItem(g, 'slime_goo', 1 + Math.floor(Math.random() * 2));
          addXp(g, 'combat', 5);
          toast(g, 'Slime squished! +goo', '✨');
        }
      } else if (sl.boss) {
        toast(g, `It shudders! (${sl.hp} left)`, '👑');
      }
    }
  }
  return any;
}
