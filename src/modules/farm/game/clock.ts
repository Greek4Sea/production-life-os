// The in-game clock and the end-of-day simulation.

import { CROPS, cropTotalDays } from '../data/crops';
import { ANIMALS } from '../data/items';
import { hash2 } from '../engine/sprites';
import { T, type FarmSave, type Season } from '../types';
import { clearShades } from './monsters';
import { nightlyBreeding, nightlyWildSpawn } from './wild';
import { setTilePos, toast, type Game } from './runtime';
import { storeSave } from './state';
import { TRADER_SPOT, traderHere as traderMorning } from './trader';

export const DAY_START = 360;      // 6:00
export const DAY_END = 1560;       // 2:00 next day
export const TICK_MS = 7000;       // 10 game minutes per 7 real seconds

export const absDay = (c: FarmSave['calendar']) => (c.year - 1) * 112 + c.season * 28 + (c.day - 1);

export function fmtClock(timeMin: number): string {
  const h24 = Math.floor(timeMin / 60) % 24, m = timeMin % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${h24 < 12 ? 'am' : 'pm'}`;
}

export const SEASON_NAMES = ['Spring', 'Summer', 'Fall', 'Winter'];

function rollWeather(year: number, season: Season, day: number): FarmSave['calendar']['weather'] {
  if (season === 3) return 'snow';
  const chance = season === 1 ? 0.15 : 0.25;
  return hash2(year * 331 + day, season, 913) < chance ? 'rain' : 'sun';
}

export function tickClock(g: Game, dt: number): 'passout' | null {
  g.clockAcc += dt;
  g.save.meta.playMs += dt;
  while (g.clockAcc >= TICK_MS) {
    g.clockAcc -= TICK_MS;
    g.save.calendar.timeMin += 10;
    if (g.save.calendar.timeMin === 1200 && g.save.player.scene === 'farm' && absDay(g.save.calendar) >= 6) {
      toast(g, 'The sun is gone. You are not alone out here.', '🌙');
    }
    g.dirty = true;
    g.notify();
    if (g.save.calendar.timeMin >= DAY_END) return 'passout';
  }
  return null;
}

function waterFromSprinklers(s: FarmSave) {
  const { w, h } = s.farm;
  for (const [k, o] of Object.entries(s.farm.objects)) {
    if (o.kind !== 'sprinkler') continue;
    const i = Number(k), cx = i % w, cy = Math.floor(i / w);
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const j = y * w + x;
      if (s.farm.tiles[j] === T.TILLED) {
        s.farm.watered[j] = true;
        const c = s.farm.crops[j];
        if (c) c.watered = true;
      }
    }
  }
}

function waterEverything(s: FarmSave) {
  for (const [k, t] of s.farm.tiles.entries()) {
    if (t === T.TILLED) s.farm.watered[k] = true;
  }
  for (const c of Object.values(s.farm.crops)) c.watered = true;
}

// tiles forage must never claim: spawn, cave doors, and placed-door landings
import { SCENES, FARM_W } from '../data/maps';
function protectedTiles(s: FarmSave): Set<number> {
  const set = new Set<number>();
  const add = (x: number, y: number) => set.add(y * FARM_W + x);
  const def = SCENES.farm;
  add(def.spawn.x, def.spawn.y);
  add(14, 8); add(14, 9);         // the trader's camp
  add(55, 31);                    // the ground before the old stone
  for (const d of def.doors) { add(d.x, d.y); add(d.x, d.y + 1); }
  for (const door of Object.values(s.placed)) { add(door.x, door.y); add(door.x, door.y + 1); }
  return set;
}

// Regrowth only happens where the land is still WILD. A tile qualifies when
// its 5x5 neighborhood has enough untouched nature (trees, rocks, bushes…)
// and zero signs of the player (tilled soil, crops, stations, buildings).
// Land you've cleared and claimed stays clean — the frontier keeps growing.
const NATURAL = new Set(['tree', 'stump', 'rock', 'bigrock', 'weed', 'branch', 'stonepile', 'bush', 'mushroom']);
const PLAYER_MADE = new Set(['bench', 'anvil', 'campfire', 'furnace', 'sprinkler', 'scarecrow', 'door', 'tent']);
const GATHERABLE = new Set(['weed', 'branch', 'stonepile', 'mushroom']);

// Neighborhood test, two strictness levels. "Claimed" (tilled soil, crops, or
// anything you built within 2 tiles) is ALWAYS off-limits — your cleared land
// stays clean. The nature threshold only applies when forage is plentiful;
// when the map runs low, anything unclaimed is fair game so fiber, branches,
// and stone NEVER stop respawning.
function spotAllowed(s: FarmSave, tx: number, ty: number, needNature: boolean): boolean {
  const { w, h } = s.farm;
  let nature = 0;
  for (let y = ty - 2; y <= ty + 2; y++) {
    for (let x = tx - 2; x <= tx + 2; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x;
      if (s.farm.tiles[i] === T.TILLED || s.farm.crops[i]) return false;   // farmland
      const o = s.farm.objects[i];
      if (o) {
        if (PLAYER_MADE.has(o.kind)) return false;                          // your stuff
        if (NATURAL.has(o.kind)) nature++;
      }
    }
  }
  return needNature ? nature >= 3 : true;
}

function forageStock(s: FarmSave): number {
  let n = 0;
  for (const o of Object.values(s.farm.objects)) {
    if (GATHERABLE.has(o.kind) || (o.kind === 'bush' && o.stage === 1)) n++;
  }
  return n;
}

const FORAGE_FLOOR = 25; // below this the land replenishes aggressively

function regrowForage(s: FarmSave, day: number) {
  const { w, h } = s.farm;
  const off = protectedTiles(s);
  for (const o of Object.values(s.farm.objects)) {
    if (o.kind === 'bush' && o.stage !== 1 && hash2(day, 3, 61) < 0.35) o.stage = 1;
  }
  const scarce = forageStock(s) < FORAGE_FLOOR;
  const attempts = scarce ? 24 : 8;
  for (let n = 0; n < attempts; n++) {
    const x = 2 + Math.floor(hash2(day, n, 87) * (w - 4));
    const y = 2 + Math.floor(hash2(day, n, 88) * (h - 4));
    const i = y * w + x;
    if (s.farm.tiles[i] !== T.GRASS || s.farm.objects[i] || s.farm.crops[i] || off.has(i)) continue;
    if (!spotAllowed(s, x, y, !scarce)) continue;
    const r = hash2(day, n, 89);
    if (r < 0.22) s.farm.objects[i] = { kind: 'branch' };
    else if (r < 0.40) s.farm.objects[i] = { kind: 'weed' };
    else if (r < 0.50) s.farm.objects[i] = { kind: 'mushroom' };
    else if (r < 0.60) s.farm.objects[i] = { kind: 'stonepile' };
    else if (r < 0.68) s.farm.objects[i] = { kind: 'tree', stage: 0 };
    else if (r < 0.74) s.farm.objects[i] = { kind: 'bush', stage: 1 };
  }
}

export function endDay(g: Game, passedOut: boolean) {
  const s = g.save;
  const lines: string[] = [];
  s.lastSummary = { lines };

  if (passedOut) lines.push('You passed out from exhaustion…');

  // crops grow on watered soil
  for (const c of Object.values(s.farm.crops)) {
    if (c.watered) { c.daysGrown += 1; c.watered = false; }
  }
  s.farm.watered = {};

  // animals: produce, babies grow up
  for (const a of s.animals) {
    const def = ANIMALS[a.kind];
    // animals whose home is packed into a kit are snoozing in there —
    // no produce, no aging, no unhappiness, until it's placed again
    if (!s.built[def.home]) { a.fedToday = false; continue; }
    if (a.babyDays && a.babyDays > 0) {
      a.babyDays -= 1;
      if (a.babyDays === 0) lines.push(`${a.name} is all grown up!`);
      a.fedToday = false;
      continue;
    }
    if (a.fedToday) {
      a.happiness = Math.min(255, a.happiness + 12);
      a.ageDays += 1;
      if (a.ageDays % def.everyDays === 0) a.produceReady = true;
    } else {
      a.happiness = Math.max(0, a.happiness - 25);
    }
    a.fedToday = false;
  }
  s.troughFilled = { coop: false, barn: false };
  nightlyBreeding(g);

  // furnace jobs
  const today = absDay(s.calendar) + 1;

  // trees grow; forage regrows; wild animals arrive
  for (const [k, o] of Object.entries(s.farm.objects)) {
    if (o.kind === 'tree' && (o.stage ?? 2) < 2 && hash2(Number(k), today, 41) < 0.4) {
      o.stage = (o.stage ?? 0) + 1;
      if (o.stage === 2) o.hp = 5;
    }
  }
  regrowForage(s, today);
  nightlyWildSpawn(g, today);
  clearShades(g);
  g.drops = [];

  // rare night skyfall — worth investigating
  if (today >= 8 && hash2(today, 4, 941) < 0.05) {
    for (let tries = 0; tries < 30; tries++) {
      const x = 3 + Math.floor(hash2(today, tries, 942) * (s.farm.w - 6));
      const y = 3 + Math.floor(hash2(today, tries, 943) * (s.farm.h - 6));
      const i = y * s.farm.w + x;
      if (s.farm.tiles[i] === T.GRASS && !s.farm.objects[i] && !s.farm.crops[i]) {
        s.farm.objects[i] = { kind: 'starstone' };
        lines.push('Something streaked across the sky last night and fell nearby…');
        break;
      }
    }
  }
  // a trader some mornings
  if (traderMorning(g)) {
    const ti = TRADER_SPOT.y * s.farm.w + TRADER_SPOT.x;
    const o = s.farm.objects[ti];
    if (o && o.kind !== 'tent' && o.kind !== 'chest') delete s.farm.objects[ti];
    lines.push('A wandering trader has set camp on your land — for today only!');
  }

  // advance calendar; season change withers out-of-season crops
  s.calendar.day += 1;
  if (s.calendar.day > 28) {
    s.calendar.day = 1;
    s.calendar.season = ((s.calendar.season + 1) % 4) as Season;
    if (s.calendar.season === 0) s.calendar.year += 1;
    let died = 0;
    for (const [k, c] of Object.entries(s.farm.crops)) {
      const def = CROPS[c.id];
      if (def && !def.seasons.includes(s.calendar.season)) {
        s.farm.crops[Number(k)] = { ...c, daysGrown: -1, watered: false };
        died++;
      }
    }
    if (died) lines.push(`The season changed — ${died} out-of-season crops withered.`);
    lines.push(`${SEASON_NAMES[s.calendar.season]} has arrived!`);
  }
  s.calendar.timeMin = DAY_START;
  s.calendar.weather = rollWeather(s.calendar.year, s.calendar.season, s.calendar.day);
  if (s.calendar.weather === 'rain') waterEverything(s);
  waterFromSprinklers(s);

  // wake up
  s.player.energy = passedOut ? Math.floor(s.player.maxEnergy * 0.55) : s.player.maxEnergy;
  g.mineFloor = null;
  g.fishing = null;
  g.path = []; g.pending = null;
  if (s.built.house) {
    s.player.scene = 'house';
    setTilePos(g, 7, 3);
  } else {
    s.player.scene = 'farm';
    const tentK = Object.entries(s.farm.objects).find(([, o]) => o.kind === 'tent' && !o.meta)?.[0];
    if (tentK !== undefined) {
      const ti = Number(tentK);
      setTilePos(g, ti % s.farm.w, Math.floor(ti / s.farm.w) + 1); // in front of the tent
    } else {
      setTilePos(g, SCENES.farm.spawn.x, SCENES.farm.spawn.y);
      lines.push('No tent, no bed… you slept under the stars. 🌌');
    }
  }
  s.player.facing = 0;

  g.dialog = 'summary';
  g.sleeping = false;
  g.dirty = false;
  g.notify();
  void storeSave(s).catch(() => { g.dirty = true; });
}

export function cropReady(c: { id: string; daysGrown: number }): boolean {
  const def = CROPS[c.id];
  return !!def && c.daysGrown >= 0 && c.daysGrown >= cropTotalDays(def);
}
export const cropDead = (c: { daysGrown: number }) => c.daysGrown < 0;
