// Game orchestrator: creation, the master tick, tap routing, scene changes.

import { SCENES } from '../data/maps';
import { TOOL_ORDER, type FarmSave, type SceneId } from '../types';
import { actOn } from './actions';
import { initAnimalsRt, tickAnimals } from './animals';
import { endDay, tickClock } from './clock';
import { knownAtBoot } from './crafting';
import { fishingTap, tickFishing } from './fishing';
import { bump, checkGoals } from './goals';
import { enterMine, tickSlimes } from './mine';
import { tickWalk, walkTowards } from './movement';
import { gainItem } from './crafting';
import { removeFromSlot } from './inventory';
import { tickShades } from './monsters';
import { curScene, setTilePos, tileOf, toast, type Game } from './runtime';
import { storeSave } from './state';
import { tickWild } from './wild';

export function createGame(save: FarmSave, notify: () => void): Game {
  const g: Game = {
    save,
    px: 0, py: 0,
    path: [], walkT: 0, pending: null, anim: 0,
    clockAcc: 0, invulnT: 0,
    dialog: null, craftStation: null, newTool: null,
    fishing: null, mineFloor: null,
    particles: [], toasts: [], animalsRt: {},
    monsters: [], drops: [], chestAt: null,
    dirty: false, sleeping: false,
    uiTick: 0,
    notify: () => { g.uiTick++; notify(); },
    camX: 0, camY: 0,
  };
  if (save.player.scene === 'mine') save.player.scene = 'farm';
  if (save.player.scene !== 'farm' && !save.built[save.player.scene === 'house' ? 'house' : save.player.scene]) {
    save.player.scene = 'farm';
    save.player.x = SCENES.farm.spawn.x; save.player.y = SCENES.farm.spawn.y;
  }
  setTilePos(g, save.player.x, save.player.y);
  if (save.player.scene === 'coop' || save.player.scene === 'barn') initAnimalsRt(g);
  knownAtBoot(g);
  checkGoals(g);
  return g;
}

export function changeScene(g: Game, to: SceneId, sx: number, sy: number) {
  if (to === 'mine') { enterMine(g, 0); return; }
  g.save.player.scene = to;
  g.mineFloor = null;
  g.path = []; g.pending = null; g.fishing = null;
  setTilePos(g, sx, sy);
  if (to === 'coop' || to === 'barn') initAnimalsRt(g);
  g.notify();
}

function checkDoor(g: Game) {
  const s = g.save;
  const v = curScene(g);
  const p = tileOf(g);
  const i = p.y * v.w + p.x;
  const o = v.objects[i];
  if (o?.kind === 'door' && o.meta) {
    // meta is "scene" or "scene:x,y" for a specific landing tile
    const [to, coords] = o.meta.split(':') as [SceneId, string?];
    if (coords) {
      const [cx, cy] = coords.split(',').map(Number);
      g.mineFloor = null;
      changeScene(g, to, cx, cy);
      return;
    }
    const spawn = to === 'mine' ? { x: 0, y: 0 } : SCENES[to as Exclude<SceneId, 'mine'>].spawn;
    changeScene(g, to, spawn.x, spawn.y);
    return;
  }
  for (const d of v.doors) {
    if (d.x !== p.x || d.y !== p.y) continue;
    // interior exits land just below the building's placed door
    if (d.to === 'farm' && s.placed[s.player.scene]) {
      const door = s.placed[s.player.scene];
      changeScene(g, 'farm', door.x, door.y + 1);
      return;
    }
    if (d.requires && !s.unlocks[d.requires]) {
      // the boarded cave opens itself to anyone carrying a pickaxe
      if (d.requires === 'mine') {
        if (s.player.tools.pickaxe >= 0) {
          s.unlocks.mine = true;
          bump(g, 'mineOpened');
          toast(g, 'You pry the boards off the cave mouth!', '⛏️');
        } else {
          toast(g, 'Boarded up tight. A pickaxe would get you in.', '⛰️');
          return;
        }
      } else {
        return;
      }
    }
    changeScene(g, d.to, d.sx, d.sy);
    return;
  }
}

export function handleTap(g: Game, tx: number, ty: number) {
  if (g.dialog || g.sleeping) return;
  if (g.fishing) { fishingTap(g, true); return; }
  const v = curScene(g);
  if (tx < 0 || ty < 0 || tx >= v.w || ty >= v.h) return;
  const o = v.objects[ty * v.w + tx];
  const isDoor = o?.kind === 'door' || v.doors.some((d) => d.x === tx && d.y === ty);
  // holding the pickaxe turns a BUILDING's door into a demolition target
  // instead of an entrance (scene doors like the mine exit stay doors)
  const sel = g.save.player.selectedSlot;
  const holdingPickaxe = sel < 100 && TOOL_ORDER[sel] === 'pickaxe' && g.save.player.tools.pickaxe >= 0;
  const buildingDoor = o?.kind === 'door' && !!o.meta && !o.meta.includes(':');
  walkTowards(g, tx, ty, !isDoor || (holdingPickaxe && buildingDoor));
}

let saveTimer = 0;

export function tick(g: Game, dt: number, held: boolean, hidden: boolean) {
  if (g.sleeping) return;

  const paused = g.dialog !== null || hidden;
  if (!paused) {
    const out = tickClock(g, dt);
    if (out === 'passout') { doSleep(g, true); return; }
    if (g.save.player.energy <= 0 && !g.fishing) {
      die(g);
      return;
    }
    // starvation warnings, loud and early
    {
      const e = g.save.player.energy;
      if (e > 30) g.energyWarned = 0;
      else if (e <= 12 && (g.energyWarned ?? 0) < 2) {
        g.energyWarned = 2;
        toast(g, '💀 YOU WILL COLLAPSE SOON — eat something NOW or you\'ll drop your things!', '🍽️');
      } else if (e <= 28 && (g.energyWarned ?? 0) < 1) {
        g.energyWarned = 1;
        toast(g, 'Your stomach growls — eat soon, or the ground will catch you.', '🍽️');
      }
    }

    const arrived = tickWalk(g, dt);
    if (arrived !== null) actOn(g, arrived);
    // a queued action (e.g. pickaxe on a building door) resolves BEFORE the
    // door can whisk you inside
    if (!g.path.length && !g.pending) checkDoor(g);

    if (g.fishing) tickFishing(g, dt, held);

    if (g.save.player.scene === 'mine' && g.mineFloor) {
      g.invulnT = Math.max(0, g.invulnT - dt);
      if (tickSlimes(g, dt) && g.invulnT <= 0) {
        g.invulnT = 1000;
        const p = tileOf(g);
        const royal = g.mineFloor.slimes.some((sl) => sl.boss && Math.abs(sl.x - p.x) + Math.abs(sl.y - p.y) <= 1);
        g.save.player.energy = Math.max(0, g.save.player.energy - (royal ? 25 : 8));
        toast(g, royal ? 'The King CRUSHES you!' : 'Ouch! A slime got you.', royal ? '👑' : '🟢');
        g.notify();
      }
    } else if (g.save.player.scene === 'farm') {
      g.invulnT = Math.max(0, g.invulnT - dt);
    }
    tickAnimals(g, dt);
    tickWild(g, dt);
    tickShades(g, dt);

    // dropped items: despawn after a minute, walk over to pick back up
    if (g.drops.length) {
      const p = tileOf(g);
      for (const d of [...g.drops]) {
        d.t += dt;
        if (d.t > 60000) { g.drops.splice(g.drops.indexOf(d), 1); continue; }
        // it stays on the ground until you WALK AWAY and come back onto it
        if (!d.left && (d.x !== p.x || d.y !== p.y)) d.left = true;
        if (d.left && d.x === p.x && d.y === p.y && g.save.player.scene === 'farm') {
          if (gainItem(g, d.id, d.qty, d.q ?? 0)) {
            g.drops.splice(g.drops.indexOf(d), 1);
            g.notify();
          }
        }
      }
    }
  }

  for (const p of g.particles) {
    p.life -= dt;
    p.x += p.vx * (dt / 1000);
    p.y += p.vy * (dt / 1000);
    p.vy += 40 * (dt / 1000);
  }
  g.particles = g.particles.filter((p) => p.life > 0);
  for (const t of g.toasts) t.t += dt;
  const before = g.toasts.length;
  g.toasts = g.toasts.filter((t) => t.t < 3500);
  if (g.toasts.length !== before) g.notify();

  saveTimer += dt;
  if (saveTimer > 30000) {
    saveTimer = 0;
    if (g.dirty) {
      g.dirty = false;
      void storeSave(g.save).catch(() => { g.dirty = true; });
    }
  }
}

// Collapse from exhaustion: half your pockets spill into a bag where you
// fell (a chest you can walk back to), then the night takes you home.
export function die(g: Game) {
  const s = g.save;
  const cause = g.monsters.length > 0 && g.save.calendar.timeMin >= 1200
    ? 'The dark drained the last of you.'
    : 'You starved — always carry food (berries, mushrooms, cooked meals)!';
  toast(g, 'Everything goes dark…', '💀');
  const held = s.inventory.map((slot, i) => ({ slot, i })).filter((x) => x.slot);
  const lose = held.sort(() => Math.random() - 0.5).slice(0, Math.ceil(held.length / 2));
  if (lose.length) {
    const p = tileOf(g);
    const spot = s.player.scene === 'farm' ? p.y * s.farm.w + p.x : 6 * s.farm.w + 39; // died indoors/below → bag by the cave
    const bag: (typeof s.inventory) = [];
    for (const { slot, i } of lose) { bag.push(slot); s.inventory[i] = null; }
    // stack bags if one already lies here
    if (s.farm.objects[spot] && s.farm.objects[spot].kind !== 'chest') delete s.farm.objects[spot];
    s.farm.objects[spot] = { kind: 'chest', meta: 'bag' };
    const key = `farm:${spot}`;
    s.chests[key] = [...(s.chests[key] ?? []).filter(Boolean), ...bag];
    s.lastSummary = { lines: [] };
    s.lastSummary.lines.push(`💀 ${cause}`);
    s.lastSummary.lines.push(`You collapsed! ${lose.length} stack${lose.length === 1 ? '' : 's'} of your things were left where you fell — go get them back.`);
  } else {
    s.lastSummary = { lines: [`💀 ${cause}`] };
  }
  doSleep(g, true);
}

export function dropSelected(g: Game, all = false) {
  const s = g.save;
  const sel = s.player.selectedSlot;
  if (sel < 100) return;
  const slot = s.inventory[sel - 100];
  if (!slot || s.player.scene !== 'farm') return;
  const qty = all ? slot.qty : 1;
  const taken = removeFromSlot(s, sel - 100, qty);
  if (!taken) return;
  const p = tileOf(g);
  // drop lands on the tile you're FACING (falls at your feet if blocked/off-map)
  const [fx, fy] = [[0, 1], [-1, 0], [1, 0], [0, -1]][s.player.facing];
  let dx = p.x + fx, dy = p.y + fy;
  if (dx < 1 || dy < 1 || dx >= s.farm.w - 1 || dy >= s.farm.h - 1) { dx = p.x; dy = p.y; }
  g.drops.push({ x: dx, y: dy, id: taken.id, qty: taken.qty, q: taken.q, t: 0 });
  toast(g, `Dropped ${taken.qty}× ${taken.id} (fades in 1 min)`, '🫳');
  g.notify();
}

export function doSleep(g: Game, passedOut: boolean) {
  if (g.sleeping) return;
  g.sleeping = true;
  g.dialog = null;
  g.notify();
  setTimeout(() => endDay(g, passedOut), 700);
}

export function flushSave(g: Game, keepalive = false) {
  if (!g.dirty) return;
  g.dirty = false;
  void storeSave(g.save, keepalive).catch(() => { g.dirty = true; });
}
