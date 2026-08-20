// Fishing: cast → wait → bite (tap!) → bobber-bar minigame → catch/escape.

import { FISH, rollFish } from '../data/fishDefs';
import { ITEMS } from '../data/items';
import { gainItem } from './crafting';
import { bump } from './goals';
import { addXp, fishBarBonus } from './skills';
import { toast, type Game } from './runtime';

export function startCast(g: Game, tile: number, water: 'pond' | 'river') {
  const fish = rollFish(Math.random, g.save.calendar.season, water);
  g.fishing = {
    phase: 'cast', at: tile, t: 0,
    biteIn: 1800 + Math.random() * 5500,
    fish,
    fishPos: 0.5, fishVel: 0,
    barPos: 0.35, barVel: 0,
    barSize: 0.28 + 0.05 * Math.max(0, g.save.player.tools.rod as number) + fishBarBonus(g),
    progress: 0.3,
  };
  g.notify();
}

export function fishingTap(g: Game, down: boolean) {
  const f = g.fishing;
  if (!f) return;
  if (f.phase === 'bite' && down) {
    f.phase = 'play';
    f.t = 0;
    return;
  }
  if (f.phase === 'wait' && down) {
    // reeled in too early
    g.fishing = null;
    g.notify();
  }
  if (f.phase === 'done' && down) {
    g.fishing = null;
    g.notify();
  }
}

// `held` = pointer currently down (drives the bar up)
export function tickFishing(g: Game, dt: number, held: boolean) {
  const f = g.fishing;
  if (!f) return;
  f.t += dt;

  if (f.phase === 'cast') {
    if (f.t > 600) { f.phase = 'wait'; f.t = 0; }
    return;
  }
  if (f.phase === 'wait') {
    if (f.t > f.biteIn) { f.phase = 'bite'; f.t = 0; }
    return;
  }
  if (f.phase === 'bite') {
    if (f.t > 900) { // missed the window
      g.fishing = null;
      toast(g, 'It got away…', '🎣');
      g.notify();
    }
    return;
  }
  if (f.phase !== 'play') return;

  const def = FISH.find((x) => x.id === f.fish);
  const diff = def?.difficulty ?? 0.6;

  // fish wander: sine drift + random darts scaled by difficulty
  f.fishVel += (Math.sin(f.t / 380) * 0.25 + (Math.random() - 0.5) * 2.2 * diff) * (dt / 1000);
  f.fishVel *= 0.92;
  f.fishPos = Math.max(0, Math.min(1, f.fishPos + f.fishVel * (dt / 1000) * 2.2));
  if (f.fishPos === 0 || f.fishPos === 1) f.fishVel = 0;

  // bar physics: hold = up, gravity = down
  f.barVel += (held ? -3.4 : 3.0) * (dt / 1000);
  f.barVel *= 0.94;
  f.barPos = Math.max(0, Math.min(1 - f.barSize, f.barPos + f.barVel * (dt / 1000) * 1.6));
  if (f.barPos === 0 || f.barPos === 1 - f.barSize) f.barVel *= -0.25;

  const inside = f.fishPos >= f.barPos && f.fishPos <= f.barPos + f.barSize;
  f.progress += (inside ? 0.24 : -0.3) * (dt / 1000);

  if (f.progress >= 1) {
    f.progress = 1;
    f.phase = 'done';
    f.caught = true;
    gainItem(g, f.fish, 1);
    if (f.fish !== 'old_boot' && f.fish !== 'old_bottle') {
      bump(g, 'fishCaught');
      addXp(g, 'fishing', f.fish === 'golden_koi' ? 40 : 10);
    }
    if (f.fish === 'golden_koi') bump(g, 'caught_golden_koi');
    if (f.fish === 'old_bottle') toast(g, 'A corked bottle… there is a note inside. (Read it from your backpack.)', '🍾');
    toast(g, `Caught ${ITEMS[f.fish]?.name ?? f.fish}!`, '🐟');
    g.dirty = true;
    g.notify();
  } else if (f.progress <= 0) {
    g.fishing = null;
    toast(g, 'It got away…', '🎣');
    g.notify();
  }
}
