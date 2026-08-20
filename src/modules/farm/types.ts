// Life OS Farm (Homestead) — shared types. FarmSave is the persisted blob;
// Runtime holds everything transient. Start-from-nothing rules: no gold, no
// shops — everything is found, crafted at stations, or built at fixed sites.

export type ItemId = string;
export type ToolKind = 'hoe' | 'can' | 'axe' | 'pickaxe' | 'scythe' | 'sword' | 'pail' | 'rod';
export const TOOL_ORDER: ToolKind[] = ['hoe', 'can', 'axe', 'pickaxe', 'scythe', 'sword', 'pail', 'rod'];
export const TOOL_DUR = [75, 200, 500, 1200, 3000]; // uses per tier
export type ToolTier = 0 | 1 | 2 | 3 | 4; // crude / copper / iron / gold / +one beyond…
export type SceneId = 'farm' | 'house' | 'coop' | 'barn' | 'mine';
export type Season = 0 | 1 | 2 | 3;
export type Weather = 'sun' | 'rain' | 'snow';
export type Quality = 0 | 1 | 2;

export enum T {
  GRASS = 0, DIRT = 1, TILLED = 2, PATH = 3, WATER = 4,
  FLOOR = 5, WALL = 6, VOID = 7, ROCKFLOOR = 8, BRIDGE = 9,
}
export const WALKABLE = new Set([T.GRASS, T.DIRT, T.TILLED, T.PATH, T.FLOOR, T.ROCKFLOOR, T.BRIDGE]);

export type ObjKind =
  | 'tree' | 'stump' | 'rock' | 'bigrock' | 'weed' | 'sprinkler' | 'furnace' | 'scarecrow'
  | 'bed' | 'trough' | 'door' | 'sign' | 'chest' | 'cave'
  | 'tent' | 'bench' | 'anvil' | 'campfire' | 'bush' | 'mushroom' | 'branch' | 'stonepile'
  | 'site' | 'ladder' | 'elevator' | 'minerock' | 'orerock' | 'gemrock'
  | 'fence' | 'gate' | 'altar' | 'gravestone' | 'starstone';

export interface WorldObject {
  kind: ObjKind;
  stage?: number;          // tree growth 0..2; bush: 1 = has berries
  hp?: number;
  ore?: ItemId;
  smelting?: { out: ItemId; readyOnDay: number } | null;
  meta?: string;           // door target, sign text, site id, chest key
}

export interface InvSlot { id: ItemId; qty: number; q?: Quality }

export interface Crop {
  id: ItemId;
  daysGrown: number;
  watered: boolean;
  regrowing?: boolean;
}

export interface Animal {
  id: string;
  kind: 'chicken' | 'duck' | 'cow' | 'goat' | 'sheep';
  name: string;
  home: 'coop' | 'barn';
  fedToday: boolean;
  happiness: number;
  produceReady: boolean;
  ageDays: number;
  babyDays?: number;       // >0 = still a baby (no produce, drawn small)
}

export interface WildAnimal {
  id: string;
  kind: Animal['kind'];
  x: number; y: number;
  ax: number; ay: number;  // home anchor — wanders only a few tiles around it
  t?: number;              // runtime wander timer (not meaningful across saves)
}

export interface FarmSave {
  version: number;
  meta: { createdAt: number; playMs: number };
  calendar: { day: number; season: Season; year: number; timeMin: number; weather: Weather };
  player: {
    energy: number; maxEnergy: number;
    scene: SceneId; x: number; y: number; facing: 0 | 1 | 2 | 3;
    tools: Record<ToolKind, ToolTier | -1>;   // -1 = not crafted yet
    toolDur: Record<ToolKind, number>;        // remaining uses (Minecraft-style wear)
    gold: number;                             // coin — the wandering trader deals in it
    skills: Record<Skill, number>;            // xp per skill (level derived)
    selectedSlot: number;
    canWater: number;
  };
  inventory: (InvSlot | null)[];
  farm: {
    w: number; h: number;
    tiles: number[];
    watered: Record<number, boolean>;
    crops: Record<number, Crop>;
    objects: Record<number, WorldObject>;
  };
  animals: Animal[];       // tamed, housed
  wild: WildAnimal[];      // roaming the map, tameable
  hay: number;
  troughFilled: { coop: boolean; barn: boolean };
  mine: { deepestFloor: number };
  knownRecipes: string[];
  built: Record<string, boolean>;                    // building kind → constructed
  placed: Record<string, { x: number; y: number }>;  // building kind → door tile
  goalsDone: string[];
  houseObjects: Record<number, WorldObject>;    // furniture placed inside the cabin
  chests: Record<string, (InvSlot | null)[]>;   // "<scene>:<tile>" chest storage (and drop-bags)
  unlocks: { mine: boolean; backpack: boolean };
  stats: Record<string, number>;
  lastSummary: { lines: string[] } | null;
}

// ---------- static defs ----------

export interface ItemDef {
  id: ItemId;
  name: string;
  sell: number;            // legacy value field (no shops — kept for flavor/sorting)
  sprite: string;
  edible?: number;
  seedOf?: ItemId;
  placeable?: ObjKind;
  feed?: boolean;          // wild animals accept this as taming food
}

export interface CropDef {
  id: ItemId;
  seedId: ItemId;
  seasons: Season[];
  stageDays: number[];
  regrowDays?: number;
  spriteBase: string;
  yield?: number;
}

export interface FishDef {
  id: ItemId;
  seasons: Season[];
  difficulty: number;
  waters: ('pond' | 'river')[];
}

export type Station = 'hand' | 'bench' | 'anvil' | 'campfire' | 'furnace';

export interface Recipe {
  id: string;
  name: string;
  station: Station;
  out: ItemId | { tool: ToolKind; tier: ToolTier };
  outQty?: number;
  mats: { id: ItemId; qty: number }[];
  // recipe becomes known the first time this item enters the inventory
  // ('start' = known from the beginning)
  unlockOn: ItemId | 'start';
  desc?: string;
}

export interface BuildingDef {
  id: string;              // 'house' | 'coop' | 'barn'
  name: string;
  w: number; h: number;    // footprint; door = bottom-row center
  interior: SceneId;
  sprite: string;
  kit: ItemId;
}

export type Skill = 'farming' | 'mining' | 'foraging' | 'fishing' | 'combat';

export interface GoalDef {
  id: string;
  title: string;
  text: string;
  stat: string;            // cumulative stats key
  n: number;
  prereq?: string;
  hint?: string;           // shown as "next step" flavor
  secret?: boolean;        // shows as "???" until completed — a mystery to find
}

export interface Monster {   // night creatures on the farm / things below (runtime)
  x: number; y: number;
  hp: number;
  t: number;
  boss?: boolean;
}

export interface AnimalDef {
  kind: Animal['kind'];
  home: 'coop' | 'barn';
  produce: ItemId;
  everyDays: number;
  viaTool?: 'pail' | 'scythe';
  minDay?: number;         // wild ones only wander in from this day on
  sprite: string;
}

export interface FloorGen {
  floor: number;
  w: number; h: number;
  tiles: number[];
  objects: Record<number, WorldObject>;
  slimes: { x: number; y: number; hp: number; t: number; boss?: boolean }[];
  ladderAt: number | null;
  entry: { x: number; y: number };
}

export interface GroundDrop { x: number; y: number; id: ItemId; qty: number; q?: Quality; t: number; left?: boolean }

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; kind: 'sparkle' | 'chip' | 'leaf' | 'splash' | 'puff' }

export interface FishingRun {
  phase: 'cast' | 'wait' | 'bite' | 'play' | 'done';
  at: number;
  t: number;
  biteIn: number;
  fish: ItemId;
  fishPos: number; fishVel: number;
  barPos: number; barVel: number;
  barSize: number;
  progress: number;
  caught?: boolean;
}

export type DialogId = 'inventory' | 'craft' | 'goals' | 'sleep' | 'summary' | 'elevator' | 'help' | 'newtool' | 'trader' | 'chest' | null;
