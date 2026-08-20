// Save lifecycle: create, migrate, load/store via /api/mod/farm/state.

import { SCENES } from '../data/maps';
import { hash2 } from '../engine/sprites';
import { T, TOOL_DUR, type FarmSave, type WorldObject } from '../types';

export const SAVE_VERSION = 9;

// forage/debris scatter — denser forest north & the richer east ridge
function scatter(tiles: number[], objects: Record<number, WorldObject>, w: number, h: number) {
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      if (tiles[i] !== T.GRASS || objects[i]) continue;
      const east = x > 33;                                  // across the river
      const yard = x > 4 && x < 16 && y > 3 && y < 12;      // around the tent
      const r = hash2(x, y, 177);
      const m = east ? 1.6 : yard ? 0.5 : 1;
      if (r < 0.05 * m) objects[i] = { kind: 'tree', stage: 2, hp: 5 };
      else if (r < 0.062 * m) objects[i] = { kind: 'tree', stage: hash2(x, y, 5) < 0.5 ? 0 : 1 };
      else if (r < 0.09 * m) objects[i] = { kind: 'rock', hp: 2 };
      else if (r < 0.105 * m) objects[i] = { kind: 'bigrock', hp: 4 };
      else if (r < 0.145 * m) objects[i] = { kind: 'weed' };
      else if (r < 0.170 * m) objects[i] = { kind: 'branch' };
      else if (r < 0.190 * m) objects[i] = { kind: 'stonepile' };
      else if (r < 0.210 * m) objects[i] = { kind: 'bush', stage: hash2(x, y, 9) < 0.6 ? 1 : 0 };
      else if (r < 0.222 * m) objects[i] = { kind: 'mushroom' };
    }
  }
}

export function newSave(): FarmSave {
  const def = SCENES.farm;
  const { w, h } = def;
  const tiles = def.tiles.slice();
  const objects: Record<number, WorldObject> = JSON.parse(JSON.stringify(def.objects));
  scatter(tiles, objects, w, h);
  // guaranteed starter gathering right by the tent
  const starters: [number, number, WorldObject['kind']][] = [
    [6, 8, 'branch'], [10, 6, 'branch'], [12, 9, 'branch'], [5, 10, 'branch'],
    [11, 11, 'stonepile'], [7, 11, 'stonepile'], [13, 10, 'stonepile'],
    [9, 10, 'weed'], [6, 6, 'weed'], [12, 7, 'weed'],
    [5, 12, 'bush'], [14, 11, 'bush'],
  ];
  for (const [x, y, kind] of starters) {
    const i = y * w + x;
    if (tiles[i] === T.GRASS && !objects[i]) objects[i] = { kind, ...(kind === 'bush' ? { stage: 1 } : {}) };
  }
  // arrival/door/landing tiles stay clear (incl. the trader's camp and the
  // ground below the old stone in the east forest)
  const clear = [
    [9, 8], [39, 6], [40, 6], [34, 15], [34, 16], [31, 15], [31, 16],
    [13, 7], [19, 9], [25, 8], [14, 8], [14, 9], [55, 31], [54, 30], [56, 30],
  ];
  for (const [x, y] of clear) {
    const o = objects[y * w + x];
    if (o && o.kind !== 'site' && o.kind !== 'sign' && o.kind !== 'tent') delete objects[y * w + x];
  }
  return {
    version: SAVE_VERSION,
    meta: { createdAt: Date.now(), playMs: 0 },
    calendar: { day: 1, season: 0, year: 1, timeMin: 360, weather: 'sun' },
    player: {
      energy: 100, maxEnergy: 100,
      scene: 'farm', x: def.spawn.x, y: def.spawn.y, facing: 0,
      tools: { hoe: -1, can: -1, axe: -1, pickaxe: -1, scythe: -1, sword: -1, pail: -1, rod: -1 },
      toolDur: { hoe: 0, can: 0, axe: 0, pickaxe: 0, scythe: 0, sword: 0, pail: 0, rod: 0 },
      gold: 0,
      skills: { farming: 0, mining: 0, foraging: 0, fishing: 0, combat: 0 },
      selectedSlot: 100,
      canWater: 0,
    },
    inventory: new Array(24).fill(null),
    farm: { w, h, tiles, watered: {}, crops: {}, objects },
    animals: [],
    wild: [
      { id: 'wild_start_1', kind: 'chicken', x: 21, y: 14, ax: 21, ay: 14 },
      { id: 'wild_start_2', kind: 'chicken', x: 24, y: 15, ax: 24, ay: 15 },
      { id: 'wild_start_3', kind: 'duck', x: 12, y: 20, ax: 12, ay: 20 },
    ],
    hay: 0,
    troughFilled: { coop: false, barn: false },
    mine: { deepestFloor: 0 },
    knownRecipes: [],
    built: {},
    placed: {},
    goalsDone: [],
    houseObjects: { [1 * 10 + 7]: { kind: 'bed' } },
    chests: {},
    unlocks: { mine: false, backpack: false },
    stats: {},
    lastSummary: null,
  };
}

// Homestead reboot: older saves belonged to the shop-era game — the whole
// point now is starting from nothing, so anything below v3 restarts fresh.
const OLD_SITE_DOORS: Record<string, { x: number; y: number }> = {
  house: { x: 13, y: 6 }, coop: { x: 19, y: 8 }, barn: { x: 25, y: 7 },
};
const MIGRATIONS: Record<number, (s: FarmSave) => FarmSave> = {
  // 3 → 4: fixed blueprint sites became free-placement kits. Buildings that
  // already exist keep their old fixed spots as their "placed" position.
  3: (s) => {
    s.placed = s.placed ?? {};
    for (const [id, door] of Object.entries(OLD_SITE_DOORS)) {
      if (s.built[id] && !s.placed[id]) s.placed[id] = door;
    }
    for (const [k, o] of Object.entries(s.farm.objects)) {
      if (o.kind === 'site') delete s.farm.objects[Number(k)];
    }
    return s;
  },
  // 4 → 5: wild animals became persistent grazers with home anchors
  4: (s) => {
    for (const a of s.wild) {
      if (a.ax === undefined) { a.ax = a.x; a.ay = a.y; }
    }
    return s;
  },
  // 5 → 6: tool durability — existing tools start at full for their tier
  5: (s) => {
    const dur: Record<string, number> = {};
    for (const [k, tier] of Object.entries(s.player.tools)) {
      dur[k] = (tier as number) >= 0 ? TOOL_DUR[tier as number] : 0;
    }
    s.player.toolDur = dur as FarmSave['player']['toolDur'];
    return s;
  },
  // 6 → 7: the world grew (48x34 → 64x44) and the dark update arrived.
  // Old land carries over exactly; new land comes from the fresh template.
  6: (s) => {
    const def = SCENES.farm;
    const oldW = s.farm.w, oldH = s.farm.h;
    if (oldW !== def.w || oldH !== def.h) {
      const tiles = def.tiles.slice();
      const objects: Record<number, WorldObject> = JSON.parse(JSON.stringify(def.objects));
      // fresh wilderness on the template, then old-area state pasted over it
      scatter(tiles, objects, def.w, def.h);
      for (let y = 0; y < oldH; y++) {
        for (let x = 0; x < oldW; x++) {
          const oi = y * oldW + x, ni = y * def.w + x;
          const wasOldBorder = x === oldW - 1 || y === oldH - 1;
          if (!wasOldBorder) tiles[ni] = s.farm.tiles[oi];
          // old area: the player's world wins (including empty tiles)
          if (x < oldW - 1 && y < oldH - 1) {
            if (s.farm.objects[oi]) objects[ni] = s.farm.objects[oi];
            else if (objects[ni] && !def.objects[ni]) delete objects[ni];
          }
        }
      }
      const remap = <V,>(rec: Record<number, V>): Record<number, V> => {
        const out: Record<number, V> = {};
        for (const [k, v] of Object.entries(rec)) {
          const oi = Number(k);
          out[Math.floor(oi / oldW) * def.w + (oi % oldW)] = v as V;
        }
        return out;
      };
      s.farm.crops = remap(s.farm.crops);
      s.farm.watered = remap(s.farm.watered);
      s.farm.tiles = tiles;
      s.farm.objects = objects;
      s.farm.w = def.w; s.farm.h = def.h;
    }
    s.player.gold = s.player.gold ?? 0;
    s.player.skills = s.player.skills ?? { farming: 0, mining: 0, foraging: 0, fishing: 0, combat: 0 };
    s.chests = s.chests ?? {};
    // keep the new landmarks approachable
    for (const [x, y] of [[14, 8], [14, 9], [55, 31], [54, 30], [56, 30]]) {
      const o = s.farm.objects[y * s.farm.w + x];
      if (o && ['tree', 'stump', 'rock', 'bigrock', 'weed', 'branch', 'stonepile', 'bush', 'mushroom'].includes(o.kind)) {
        delete s.farm.objects[y * s.farm.w + x];
      }
    }
    return s;
  },
  // 7 → 8: the keeper's diary pages surface in worlds that predate them
  7: (s) => {
    const def = SCENES.farm;
    for (const [k, o] of Object.entries(def.objects)) {
      if ((o.kind === 'sign' || o.kind === 'gravestone') && !s.farm.objects[Number(k)]) {
        s.farm.objects[Number(k)] = JSON.parse(JSON.stringify(o));
      }
    }
    return s;
  },
  // 8 → 9: the cabin gained a furniture layer; chest keys became scene-scoped
  8: (s) => {
    s.houseObjects = s.houseObjects ?? { [1 * 10 + 7]: { kind: 'bed' } };
    const re: typeof s.chests = {};
    for (const [k, v] of Object.entries(s.chests ?? {})) {
      re[k.includes(':') ? k : `farm:${k}`] = v;
    }
    s.chests = re;
    return s;
  },
};

export function migrate(raw: FarmSave): FarmSave {
  if (raw.version < 3) return newSave();
  let s = raw;
  for (let v = s.version; v < SAVE_VERSION; v++) {
    const fn = MIGRATIONS[v];
    if (fn) s = fn(s);
    s.version = v + 1;
  }
  return s;
}

export async function loadSave(): Promise<FarmSave | null> {
  const res = await fetch('/api/mod/farm/state');
  if (!res.ok) throw new Error(`load failed: ${res.status}`);
  const row = await res.json();
  if (!row?.state) return null;
  return migrate(row.state as FarmSave);
}

export async function storeSave(save: FarmSave, keepalive = false): Promise<void> {
  await fetch('/api/mod/farm/state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version: save.version, state: save }),
    keepalive,
  });
}
