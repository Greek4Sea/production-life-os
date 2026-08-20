// Homestead world: ONE big outdoor map (48x34) with a lake, a river, and a
// boarded cave to the mine. Buildings are crafted as kits and placed anywhere;
// bridges are laid tile by tile over water. Interiors: house/coop/barn + mine.

import { T, type FarmSave, type SceneId, type BuildingDef, type WorldObject } from '../types';

export interface Door { x: number; y: number; to: SceneId; sx: number; sy: number; requires?: keyof FarmSave['unlocks'] }
export interface BuildingVis { x: number; y: number; sprite: string; when?: string }

export interface SceneDef {
  id: SceneId; w: number; h: number; outdoor: boolean; water?: 'pond' | 'river';
  tiles: number[];
  objects: Record<number, WorldObject>;
  doors: Door[];
  buildings: BuildingVis[];
  spawn: { x: number; y: number };
}

function grid(w: number, h: number, fill: T): number[] {
  return new Array(w * h).fill(fill);
}
function rect(t: number[], w: number, x: number, y: number, rw: number, rh: number, v: T) {
  for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) t[j * w + i] = v;
}
const idx = (w: number) => (x: number, y: number) => y * w + x;

export const FARM_W = 64, FARM_H = 44;

// ---------------- placeable buildings (crafted as kits, placed anywhere) ----
export const BUILDINGS: BuildingDef[] = [
  { id: 'house', name: 'Cozy Cabin', w: 5, h: 4, interior: 'house', sprite: 'house_ext', kit: 'house_kit' },
  { id: 'coop',  name: 'Coop',       w: 3, h: 3, interior: 'coop',  sprite: 'coop_ext',  kit: 'coop_kit' },
  { id: 'barn',  name: 'Barn',       w: 4, h: 3, interior: 'barn',  sprite: 'barn_ext',  kit: 'barn_kit' },
];
export const BUILDING_BY_ID: Record<string, BuildingDef> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
export const BUILDING_BY_KIT: Record<string, BuildingDef> = Object.fromEntries(BUILDINGS.map((b) => [b.kit, b]));

export const TENT_AT: [number, number][] = [[7, 5], [8, 5]];

// ---------------- the homestead map ----------------
function buildFarm(): SceneDef {
  const w = FARM_W, h = FARM_H, at = idx(w);
  const tiles = grid(w, h, T.GRASS);
  rect(tiles, w, 0, 0, w, 1, T.WALL); rect(tiles, w, 0, h - 1, w, 1, T.WALL);
  rect(tiles, w, 0, 0, 1, h, T.WALL); rect(tiles, w, w - 1, 0, 1, h, T.WALL);
  // lake (south-west) — the water source
  rect(tiles, w, 4, 24, 12, 7, T.WATER);
  // river cutting off the east ridge, full height
  rect(tiles, w, 32, 1, 2, h - 2, T.WATER);
  // cave mouth on the east ridge
  rect(tiles, w, 38, 2, 4, 3, T.WALL);
  rect(tiles, w, 39, 5, 2, 1, T.PATH);
  const objects: Record<number, WorldObject> = {};
  // the starting tent (two tiles; sprite drawn from the first)
  objects[at(7, 5)] = { kind: 'tent' };
  objects[at(8, 5)] = { kind: 'tent', meta: 'silent' };
  objects[at(30, 17)] = { kind: 'sign', meta: 'The east ridge holds the old mine. A few planks over the water would get you across…' };
  // ——— the far east: deep old forest, and things best found by walking ———
  objects[at(55, 30)] = { kind: 'altar' };
  objects[at(53, 32)] = { kind: 'sign', meta: 'Weathered carving: “when three shards sing, the still stone wakes.”' };
  objects[at(60, 40)] = { kind: 'chest', meta: 'east' };
  // ——— the south hollow: someone lived here long before you ———
  objects[at(5, 39)] = { kind: 'gravestone' };
  objects[at(7, 39)] = { kind: 'gravestone' };
  objects[at(6, 41)] = { kind: 'sign', meta: '“Here rests the last keeper. The dark took the farm; the fences came too late.”' };
  // ——— the keeper's diary, scattered where the wind left it ———
  objects[at(44, 36)] = { kind: 'sign', meta: 'Diary, p.12: “The shades fear no blade as much as they fear a good fence. BUILD THE FENCES.”' };
  objects[at(45, 37)] = { kind: 'gravestone' };
  objects[at(46, 36)] = { kind: 'gravestone' };
  objects[at(59, 8)] = { kind: 'sign', meta: 'Diary, p.31: “Sold the trader my last pumpkin for a shard of singing stone. It wants two more. TWO MORE.”' };
  objects[at(10, 33)] = { kind: 'sign', meta: 'Diary, p.44: “Fed the golden fish by moonlight. I swear it looked back at me. It KNOWS things.”' };
  return {
    id: 'farm', w, h, outdoor: true, water: 'pond',
    tiles, objects,
    doors: [
      { x: 39, y: 5, to: 'mine', sx: 0, sy: 0, requires: 'mine' },
      { x: 40, y: 5, to: 'mine', sx: 0, sy: 0, requires: 'mine' },
    ],
    buildings: [
      { x: 38, y: 2, sprite: 'cave_ext' },
    ],
    spawn: { x: 9, y: 8 },
  };
}

// ---------------- interiors ----------------
function buildHouse(): SceneDef {
  const w = 10, h = 8, at = idx(w);
  const tiles = grid(w, h, T.FLOOR);
  rect(tiles, w, 0, 0, w, 1, T.WALL); rect(tiles, w, 0, h - 1, w, 1, T.WALL);
  rect(tiles, w, 0, 0, 1, h, T.WALL); rect(tiles, w, w - 1, 0, 1, h, T.WALL);
  tiles[at(4, h - 1)] = T.FLOOR;
  const objects: Record<number, WorldObject> = {};
  objects[at(7, 1)] = { kind: 'bed' };
  return {
    id: 'house', w, h, outdoor: false, tiles, objects,
    doors: [{ x: 4, y: h - 1, to: 'farm', sx: 0, sy: 0 }],
    buildings: [], spawn: { x: 4, y: 6 },
  };
}

function buildInterior(id: 'coop' | 'barn', w: number, h: number): SceneDef {
  const at = idx(w);
  const tiles = grid(w, h, T.FLOOR);
  rect(tiles, w, 0, 0, w, 1, T.WALL); rect(tiles, w, 0, h - 1, w, 1, T.WALL);
  rect(tiles, w, 0, 0, 1, h, T.WALL); rect(tiles, w, w - 1, 0, 1, h, T.WALL);
  const dx = Math.floor(w / 2);
  tiles[at(dx, h - 1)] = T.FLOOR;
  const objects: Record<number, WorldObject> = {};
  objects[at(2, 1)] = { kind: 'trough' };
  return {
    id, w, h, outdoor: false, tiles, objects,
    // sx/sy are placeholders — exits land below the building's placed door
    doors: [{ x: dx, y: h - 1, to: 'farm', sx: 0, sy: 0 }],
    buildings: [], spawn: { x: dx, y: h - 2 },
  };
}

export const SCENES: Record<Exclude<SceneId, 'mine'>, SceneDef> = {
  farm: buildFarm(),
  house: buildHouse(),
  coop: buildInterior('coop', 12, 8),
  barn: buildInterior('barn', 14, 10),
};
