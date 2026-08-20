// Wild animals: spawn on the meadows over time, wander, get tamed with food,
// and (once housed) breed into babies.

import { ANIMALS, ANIMAL_NAMES, ITEMS } from '../data/items';
import { hash2 } from '../engine/sprites';
import { T, type Animal, type FarmSave, type WildAnimal } from '../types';
import { bump } from './goals';
import { removeFromSlot } from './inventory';
import { curScene, toast, type Game } from './runtime';

export const BUILDING_CAP = { coop: 4, barn: 6 };
const KINDS: Animal['kind'][] = ['chicken', 'duck', 'sheep', 'cow', 'goat'];

function freeMeadowTile(s: FarmSave, seed: number): number | null {
  const { w, h } = s.farm;
  for (let tries = 0; tries < 40; tries++) {
    const x = 3 + Math.floor(hash2(seed, tries, 31) * (w - 6));
    const y = 3 + Math.floor(hash2(seed, tries, 32) * (h - 6));
    const i = y * w + x;
    if (s.farm.tiles[i] === T.GRASS && !s.farm.objects[i] && !s.farm.crops[i]
        && !s.wild.some((a) => a.x === x && a.y === y)) return i;
  }
  return null;
}

// Nightly: at most one animal MAY wander in, and only for a species you
// don't yet have a breeding pair of (wild + tamed combined < 2). Bigger
// animals appear later (minDay). Animals NEVER despawn — once here, they
// stay until tamed.
export function nightlyWildSpawn(g: Game, day: number) {
  const s = g.save;
  const eligible = KINDS.filter((kind) => {
    const def = ANIMALS[kind];
    if (day < (def.minDay ?? 0)) return false;
    const have = s.wild.filter((a) => a.kind === kind).length
      + s.animals.filter((a) => a.kind === kind).length;
    return have < 2;
  });
  if (!eligible.length) return;
  if (hash2(day, 7, 501) > 0.4) return;          // ~40% of eligible nights
  const kind = eligible[Math.floor(hash2(day, 11, 502) * eligible.length)];
  const spot = freeMeadowTile(s, day);
  if (spot === null) return;
  const x = spot % s.farm.w, y = Math.floor(spot / s.farm.w);
  s.wild.push({ id: `wild_${day}_${Math.floor(Math.random() * 1e5)}`, kind, x, y, ax: x, ay: y });
  s.lastSummary?.lines.push(`A wild ${kind} has settled on the homestead!`);
}

// runtime wander (farm scene only): each animal grazes near its home anchor,
// so it's always where you last saw it — no roaming across the map.
export function tickWild(g: Game, dt: number) {
  const s = g.save;
  if (s.player.scene !== 'farm') return;
  for (const a of s.wild) {
    if (a.ax === undefined) { a.ax = a.x; a.ay = a.y; }
    a.t = (a.t ?? hash2(a.x, a.y, 3) * 2000) + dt;
    if (a.t < 2600) continue;
    a.t = 0;
    if (Math.random() < 0.5) continue;
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    const [dx, dy] = dirs[Math.floor(Math.random() * 4)];
    const nx = a.x + dx, ny = a.y + dy;
    if (Math.abs(nx - a.ax) > 3 || Math.abs(ny - a.ay) > 3) continue;
    const i = ny * s.farm.w + nx;
    if (s.farm.tiles[i] !== T.GRASS || s.farm.objects[i] || s.farm.crops[i]) continue;
    if (s.wild.some((o) => o !== a && o.x === nx && o.y === ny)) continue;
    a.x = nx; a.y = ny;
  }
}

export function wildAt(g: Game, x: number, y: number): WildAnimal | undefined {
  return g.save.wild.find((a) => a.x === x && a.y === y);
}

// tap a wild animal while holding feedable food → tame (needs a free home)
export function tryTame(g: Game, a: WildAnimal): boolean {
  const s = g.save;
  const sel = s.player.selectedSlot;
  const slot = sel >= 100 ? s.inventory[sel - 100] : null;
  const def = ANIMALS[a.kind];
  if (!slot || !ITEMS[slot.id]?.feed) {
    toast(g, `The ${a.kind} eyes you warily. (Hold some food and tap it!)`, '🐾');
    return true;
  }
  if (!s.built[def.home]) {
    toast(g, `It would follow you… if you had a ${def.home}.`, '🏠');
    return true;
  }
  if (s.animals.filter((x) => x.home === def.home).length >= BUILDING_CAP[def.home]) {
    toast(g, `Your ${def.home} is full.`, '🏠');
    return true;
  }
  removeFromSlot(s, sel - 100, 1);
  s.wild = s.wild.filter((x) => x !== a);
  const name = ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)];
  s.animals.push({
    id: a.id, kind: a.kind, name, home: def.home,
    fedToday: true, happiness: 140, produceReady: false, ageDays: 0,
  });
  toast(g, `${name} the ${a.kind} trusts you now! (moved into the ${def.home})`, '❤️');
  bump(g, 'tamed');
  g.dirty = true; g.notify();
  return true;
}

// nightly breeding: two+ fed, happy animals of a kind with space → maybe a baby
export function nightlyBreeding(g: Game) {
  const s = g.save;
  for (const kind of KINDS) {
    const def = ANIMALS[kind];
    const grown = s.animals.filter((x) => x.kind === kind && !x.babyDays && x.fedToday && x.happiness >= 150);
    const housed = s.animals.filter((x) => x.home === def.home).length;
    if (grown.length >= 2 && housed < BUILDING_CAP[def.home] && Math.random() < 0.18) {
      const name = ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)];
      s.animals.push({
        id: `baby_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
        kind, name, home: def.home,
        fedToday: false, happiness: 200, produceReady: false, ageDays: 0, babyDays: 3,
      });
      s.lastSummary?.lines.push(`A baby ${kind} was born — welcome, ${name}! 🎉`);
      bump(g, 'born');
    }
  }
}
