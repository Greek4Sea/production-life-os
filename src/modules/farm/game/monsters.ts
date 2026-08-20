// The dark side of the homestead: shades that rise at night, the place a
// certain old stone can open, and what rules it. Fences hold the line.

import { hash2 } from '../engine/sprites';
import { T, type FloorGen, type Monster } from '../types';
import { absDay } from './clock';
import { gainItem } from './crafting';
import { bump } from './goals';
import { addXp, combatBonus } from './skills';
import { setTilePos, tileOf, toast, type Game } from './runtime';

export const NIGHT_START = 1200;       // 20:00 — when shades rise
const FIRST_NIGHT_DAY = 6;             // early days are safe
const CONTACT_DRAIN = 12;

const blockedForMonsters = (g: Game, x: number, y: number): boolean => {
  const s = g.save;
  if (x < 1 || y < 1 || x >= s.farm.w - 1 || y >= s.farm.h - 1) return true;
  const i = y * s.farm.w + x;
  if (!new Set([T.GRASS, T.DIRT, T.TILLED, T.PATH, T.BRIDGE]).has(s.farm.tiles[i])) return true;
  if (s.farm.objects[i]) return true;    // fences, gates, trees — all block them
  return false;
};

export function isNight(g: Game): boolean {
  return g.save.calendar.timeMin >= NIGHT_START;
}

// called from the main tick while on the farm
export function tickShades(g: Game, dt: number) {
  const s = g.save;
  if (s.player.scene !== 'farm') return;
  const day = absDay(s.calendar);
  if (!isNight(g) || day < FIRST_NIGHT_DAY) return;

  // spawn pressure grows with the days
  g.shadeTimer = (g.shadeTimer ?? 0) + dt;
  const cap = Math.min(6, 1 + Math.floor(day / 12));
  if (g.shadeTimer > 16000 && g.monsters.length < cap) {
    g.shadeTimer = 0;
    const p = tileOf(g);
    for (let tries = 0; tries < 30; tries++) {
      const x = 2 + Math.floor(Math.random() * (s.farm.w - 4));
      const y = 2 + Math.floor(Math.random() * (s.farm.h - 4));
      if (Math.abs(x - p.x) + Math.abs(y - p.y) < 8) continue;
      if (blockedForMonsters(g, x, y) || s.farm.crops[y * s.farm.w + x]) continue;
      g.monsters.push({ x, y, hp: 2, t: 0 });
      if (g.monsters.length === 1) toast(g, 'Something stirs in the dark…', '👁️');
      break;
    }
  }

  // movement + contact
  const p = tileOf(g);
  let hit = false;
  for (const m of g.monsters) {
    m.t += dt;
    if (m.t < 750) continue;
    m.t = 0;
    const dist = Math.abs(m.x - p.x) + Math.abs(m.y - p.y);
    if (dist === 1 || dist === 0) { hit = true; continue; }
    const dx = Math.sign(p.x - m.x), dy = Math.sign(p.y - m.y);
    const chase = dist <= 12;
    const [mx, my] = chase
      ? (Math.abs(m.x - p.x) >= Math.abs(m.y - p.y) ? [dx, 0] : [0, dy])
      : [[0, 1, -1, 0][Math.floor(Math.random() * 4)], [1, 0, 0, -1][Math.floor(Math.random() * 4)]];
    if (!blockedForMonsters(g, m.x + mx, m.y + my)
        && !g.monsters.some((o) => o !== m && o.x === m.x + mx && o.y === m.y + my)) {
      m.x += mx; m.y += my;
    } else if (chase) {
      // try the other axis before giving up (fences reward good walls)
      const [ax, ay] = mx !== 0 ? [0, dy] : [dx, 0];
      if ((ax || ay) && !blockedForMonsters(g, m.x + ax, m.y + ay)) { m.x += ax; m.y += ay; }
    }
  }
  if (hit && g.invulnT <= 0) {
    g.invulnT = 1100;
    drainEnergy(g, CONTACT_DRAIN, 'The cold of it burns!');
  }
}

export function drainEnergy(g: Game, n: number, msg: string) {
  const s = g.save;
  s.player.energy = Math.max(0, s.player.energy - n);
  toast(g, msg, '💢');
  g.notify();
}

// sword swing vs night shades (farm) — returns true if something was hit
export function swingAtShades(g: Game, tx: number, ty: number): boolean {
  const dmg = 1 + Math.max(0, g.save.player.tools.sword as number) + combatBonus(g);
  let any = false;
  for (const m of [...g.monsters]) {
    if (Math.abs(m.x - tx) + Math.abs(m.y - ty) <= 1) {
      m.hp -= dmg;
      any = true;
      if (m.hp <= 0) {
        g.monsters.splice(g.monsters.indexOf(m), 1);
        bump(g, 'shadesSlain');
        addXp(g, 'combat', 8);
        if (Math.random() < 0.5) gainItem(g, 'slime_goo', 1);
        if (Math.random() < 0.16) {
          gainItem(g, 'shade_essence', 1);
          toast(g, '+1 Shade Essence — it hums, pulling faintly east.', '🌑');
        }
        if (Math.random() < 0.03) {
          gainItem(g, 'rune_shard', 1);
        }
        toast(g, 'The shade scatters!', '⚔️');
      }
    }
  }
  return any;
}

// dawn clears the land
export function clearShades(g: Game) {
  g.monsters = [];
  g.shadeTimer = 0;
}

// ————— the place the old stone opens (reached from the altar) —————

const VW = 22, VH = 14;

export function genBelow(): FloorGen {
  const tiles = new Array(VW * VH).fill(T.WALL);
  for (let y = 2; y < VH - 2; y++) for (let x = 2; x < VW - 2; x++) tiles[y * VW + x] = T.ROCKFLOOR;
  const entry = { x: 3, y: Math.floor(VH / 2) };
  const objects: FloorGen['objects'] = {};
  objects[entry.y * VW + (entry.x - 1)] = { kind: 'door', meta: 'farm:55,31' };
  return {
    floor: -1, w: VW, h: VH, tiles, objects,
    slimes: [{ x: VW - 5, y: Math.floor(VH / 2), hp: 60, t: 0, boss: true } as FloorGen['slimes'][number] & { boss: boolean }],
    ladderAt: null, entry,
  };
}

export function enterBelow(g: Game) {
  g.mineFloor = genBelow();
  g.save.player.scene = 'mine';
  setTilePos(g, g.mineFloor.entry.x, g.mineFloor.entry.y);
  g.path = []; g.pending = null;
  toast(g, 'The air is wrong here. Something enormous is watching.', '🌑');
  g.notify();
}

export function onBossDefeated(g: Game) {
  const s = g.save;
  bump(g, 'bossKills');
  addXp(g, 'combat', 250);
  s.player.gold += 800;
  s.stats.goldPeak = Math.max(s.stats.goldPeak ?? 0, s.player.gold);
  gainItem(g, 'void_heart', 1);
  gainItem(g, 'gloom_crown', 1);
  toast(g, 'The Gloom King bursts like a storm cloud! Something heavy drops…', '👑');
  g.dirty = true;
  g.notify();
}
