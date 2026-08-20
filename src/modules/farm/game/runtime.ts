// Runtime game object (never serialized) + the scene view every system reads.

import { SCENES, type Door, type SceneDef } from '../data/maps';
import { T, WALKABLE, type DialogId, type FarmSave, type FishingRun, type FloorGen, type Particle, type WorldObject } from '../types';

export interface Toast { text: string; t: number; icon?: string }

export interface Game {
  save: FarmSave;
  // player position in virtual px (anchored at feet center)
  px: number; py: number;
  path: { x: number; y: number }[];
  walkT: number;                       // ms into current step
  pending: { tile: number; act: boolean } | null;  // do action on arrival
  anim: number;                        // ms accumulator for walk frames
  clockAcc: number;                    // ms toward next 10-min tick
  invulnT: number;                     // slime i-frames
  dialog: DialogId;
  craftStation: import('../types').Station | null;  // which station opened the craft dialog
  newTool: { tool: import('../types').ToolKind; tier: number; name: string } | null;
  fishing: FishingRun | null;
  mineFloor: FloorGen | null;          // present while scene === 'mine'
  particles: Particle[];
  toasts: Toast[];
  animalsRt: Record<string, { x: number; y: number; t: number }>; // wander state in coop/barn
  monsters: import('../types').Monster[];     // night shades on the farm (runtime)
  shadeTimer?: number;
  bossMinionT?: number;
  energyWarned?: number;   // 0 fine, 1 warned-low, 2 warned-critical
  drops: import('../types').GroundDrop[];     // dropped items (despawn after a minute)
  chestAt: string | null;                     // open chest's key "<scene>:<tile>"
  dirty: boolean;
  sleeping: boolean;                   // fade-out in progress
  uiTick: number;
  notify: () => void;                  // bump React UI
  camX: number; camY: number;
}

export interface SceneView {
  id: string;
  w: number; h: number;
  outdoor: boolean;
  water?: 'pond' | 'river';
  tiles: number[];
  objects: Record<number, WorldObject>;
  doors: Door[];
}

export function curScene(g: Game): SceneView {
  const s = g.save;
  if (s.player.scene === 'mine') {
    const f = g.mineFloor!;
    return { id: 'mine', w: f.w, h: f.h, outdoor: false, tiles: f.tiles, objects: f.objects, doors: [] };
  }
  if (s.player.scene === 'farm') {
    const def = SCENES.farm;
    return {
      id: 'farm', w: s.farm.w, h: s.farm.h, outdoor: true, water: 'pond',
      tiles: s.farm.tiles, objects: s.farm.objects, doors: def.doors,
    };
  }
  // interiors only exist once built — a stale save scene falls back to farm
  if (!SCENES[s.player.scene]) {
    s.player.scene = 'farm';
    return curScene(g);
  }
  if (s.player.scene === 'house') {
    const def = SCENES.house;
    return {
      id: 'house', w: def.w, h: def.h, outdoor: false,
      tiles: def.tiles, objects: s.houseObjects, doors: def.doors,
    };
  }
  const def: SceneDef = SCENES[s.player.scene];
  return {
    id: def.id, w: def.w, h: def.h, outdoor: def.outdoor, water: def.water,
    tiles: def.tiles, objects: def.objects, doors: def.doors,
  };
}

export function isWalkable(v: SceneView, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= v.w || y >= v.h) return false;
  const i = y * v.w + x;
  if (!WALKABLE.has(v.tiles[i])) return false;
  const o = v.objects[i];
  if (o && o.kind !== 'door' && o.kind !== 'gate') return false; // gates open for YOU
  return true;
}

export function tileOf(g: Game): { x: number; y: number } {
  return { x: Math.round((g.px - 8) / 16), y: Math.round((g.py - 16) / 16) };
}

export function setTilePos(g: Game, x: number, y: number) {
  g.px = x * 16 + 8; g.py = y * 16 + 16;
  g.save.player.x = x; g.save.player.y = y;
}

export function toast(g: Game, text: string, icon?: string) {
  g.toasts.push({ text, t: 0, icon });
  if (g.toasts.length > 4) g.toasts.shift();
  g.notify();
}

export const isRaining = (g: Game) => g.save.calendar.weather === 'rain';
