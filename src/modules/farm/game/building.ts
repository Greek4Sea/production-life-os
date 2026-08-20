// Free placement: building kits go down wherever there's open flat ground
// (the tapped tile becomes the door), and bridge planks pave water tile by
// tile. One of each building; walls + a door object materialize on placement.

import { BUILDING_BY_KIT } from '../data/maps';
import { T, type BuildingDef, type FarmSave } from '../types';
import { bump } from './goals';
import { setTilePos, toast, type Game } from './runtime';

export function footprintOf(def: BuildingDef, doorX: number, doorY: number) {
  const x0 = doorX - Math.floor(def.w / 2);
  const y0 = doorY - def.h + 1;
  return { x0, y0, x1: x0 + def.w - 1, y1: doorY };
}

const GROUND = new Set([T.GRASS, T.DIRT, T.PATH]);

export function canPlaceBuilding(s: FarmSave, def: BuildingDef, doorX: number, doorY: number): string | null {
  if (s.built[def.id]) return `You already have a ${def.name.toLowerCase()}.`;
  const { w, h } = s.farm;
  const f = footprintOf(def, doorX, doorY);
  if (f.x0 < 1 || f.y0 < 1 || f.x1 > w - 2 || f.y1 > h - 3) return 'Too close to the edge.';
  for (let y = f.y0; y <= f.y1; y++) {
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * w + x;
      if (!GROUND.has(s.farm.tiles[i])) return 'Needs open flat ground.';
      if (s.farm.objects[i] || s.farm.crops[i]) return 'Something is in the way.';
    }
  }
  const below = (doorY + 1) * w + doorX;
  if (!GROUND.has(s.farm.tiles[below]) || s.farm.objects[below]) return 'The doorway needs a clear step in front.';
  return null;
}

// returns true if the kit was consumed
export function placeBuildingKit(g: Game, kitId: string, doorX: number, doorY: number): boolean {
  const s = g.save;
  const def = BUILDING_BY_KIT[kitId];
  if (!def) return false;
  const err = canPlaceBuilding(s, def, doorX, doorY);
  if (err) { toast(g, err, '🏗️'); return false; }
  const { w } = s.farm;
  const f = footprintOf(def, doorX, doorY);
  for (let y = f.y0; y <= f.y1; y++) {
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * w + x;
      s.farm.tiles[i] = T.WALL;
      delete s.farm.objects[i];
      delete s.farm.crops[i];
      delete s.farm.watered[i];
    }
  }
  const di = doorY * w + doorX;
  s.farm.tiles[di] = T.PATH;
  s.farm.objects[di] = { kind: 'door', meta: def.interior };
  s.built[def.id] = true;
  s.placed[def.id] = { x: doorX, y: doorY };
  // never wall the player in — step them out the front door
  if (s.player.x >= f.x0 && s.player.x <= f.x1 && s.player.y >= f.y0 && s.player.y <= f.y1) {
    g.path = []; g.pending = null;
    setTilePos(g, doorX, doorY + 1);
  }
  toast(g, `${def.name} built! 🎉`, '🏗️');
  bump(g, `built_${def.id}`);
  g.dirty = true;
  g.notify();
  return true;
}

export function placeBridgeTile(g: Game, i: number): boolean {
  const s = g.save;
  if (s.farm.tiles[i] !== T.WATER) { toast(g, 'Bridge planks go on water.', '🌉'); return false; }
  s.farm.tiles[i] = T.BRIDGE;
  bump(g, 'bridgeTiles');
  bump(g, 'built_bridge'); // first plank satisfies the journal goal chain
  toast(g, 'Planks laid across the water.', '🌉');
  g.dirty = true;
  g.notify();
  return true;
}
