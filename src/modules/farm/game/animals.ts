// Animal wandering inside the coop/barn (runtime only — positions aren't saved).

import { SCENES } from '../data/maps';
import { hash2 } from '../engine/sprites';
import { T } from '../types';
import type { Game } from './runtime';

export function initAnimalsRt(g: Game) {
  const s = g.save;
  if (s.player.scene !== 'coop' && s.player.scene !== 'barn') return;
  const def = SCENES[s.player.scene];
  const housed = s.animals.filter((a) => a.home === s.player.scene);
  g.animalsRt = {};
  let n = 0;
  for (const a of housed) {
    // deterministic spread across the floor
    let x = 2 + (n * 3) % (def.w - 4), y = 2 + Math.floor(hash2(n, 7, 3) * (def.h - 4));
    if (def.tiles[y * def.w + x] !== T.FLOOR) { x = 2; y = 2 + n; }
    g.animalsRt[a.id] = { x, y, t: hash2(n, 1, 9) * 2000 };
    n++;
  }
}

export function tickAnimals(g: Game, dt: number) {
  const s = g.save;
  if (s.player.scene !== 'coop' && s.player.scene !== 'barn') return;
  const def = SCENES[s.player.scene];
  for (const a of s.animals) {
    const rt = g.animalsRt[a.id];
    if (!rt || a.home !== s.player.scene) continue;
    rt.t += dt;
    if (rt.t < 1800 + (a.id.charCodeAt(a.id.length - 1) % 7) * 300) continue;
    rt.t = 0;
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 0]];
    const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
    const nx = rt.x + dx, ny = rt.y + dy;
    const i = ny * def.w + nx;
    if (def.tiles[i] !== T.FLOOR || def.objects[i]) continue;
    if (Object.values(g.animalsRt).some((o) => o !== rt && o.x === nx && o.y === ny)) continue;
    rt.x = nx; rt.y = ny;
  }
}
