// Tool, hand-gathering & interaction dispatch — homestead rules: bare hands
// pick forage; stations open crafting; sites open building; food tames.

import { CROPS, cropsForSeason } from '../data/crops';
import { ANIMALS, ITEMS } from '../data/items';
import { T, type Quality, type ToolKind, type WorldObject } from '../types';
import { BUILDING_BY_KIT } from '../data/maps';

import { placeBuildingKit, placeBridgeTile } from './building';
import { cropDead, cropReady, absDay } from './clock';
import { gainItem } from './crafting';
import { bump, checkGoals } from './goals';
import { removeFromSlot, removeItem, countItem } from './inventory';
import { enterMine, onRockBroken, swingSword } from './mine';
import { faceTile } from './movement';
import { curScene, tileOf, toast, type Game } from './runtime';
import { startCast } from './fishing';
import { tryTame, wildAt } from './wild';
import { enterBelow, isNight, swingAtShades } from './monsters';
import { addXp, doubleForageChance, qualityBonus } from './skills';
import { removeItem as removeItemN } from './inventory';
import { traderHere, TRADER_SPOT } from './trader';

export { TOOL_ORDER } from '../types';
import { TOOL_ORDER } from '../types';

export type Selection = { type: 'tool'; tool: ToolKind } | { type: 'item'; slot: number } | null;

export function selection(g: Game): Selection {
  const s = g.save.player.selectedSlot;
  if (s < 100) {
    const tool = TOOL_ORDER[s];
    return tool && g.save.player.tools[tool] >= 0 ? { type: 'tool', tool } : null;
  }
  return g.save.inventory[s - 100] ? { type: 'item', slot: s - 100 } : null;
}

// the mutable object layer for the current scene (farm ground or cabin floor)
function objStore(g: Game): Record<number, WorldObject> | null {
  if (g.save.player.scene === 'farm') return g.save.farm.objects;
  if (g.save.player.scene === 'house') return g.save.houseObjects;
  return null;
}

function spend(g: Game, base: number, tool?: ToolKind): boolean {
  const s = g.save;
  const tier = tool ? Math.max(0, s.player.tools[tool] as number) : 0;
  const cost = Math.max(1, base - tier);
  if (s.player.energy <= 0) { toast(g, 'Too exhausted…', '😵'); return false; }
  s.player.energy = Math.max(0, s.player.energy - cost);
  // Minecraft-style wear: every swing costs 1 durability; the breaking
  // swing still does its job, then the tool is gone (re-craft it).
  if (tool && (s.player.tools[tool] as number) >= 0) {
    s.player.toolDur[tool] = Math.max(0, (s.player.toolDur[tool] ?? 0) - 1);
    const left = s.player.toolDur[tool];
    if (left === 0) {
      s.player.tools[tool] = -1;
      toast(g, `Your ${tool} broke! Craft a new one.`, '💥');
    } else if (left === 10) {
      toast(g, `Your ${tool} is about to break… (${left} uses left)`, '⚠️');
    }
    g.dirty = true;
  }
  return true;
}

function rollQuality(g: Game): Quality {
  const r = Math.random();
  const bonus = qualityBonus(g);
  return r < 0.08 + bonus ? 2 : r < 0.28 + bonus ? 1 : 0;
}

function sparkle(g: Game, i: number) {
  const v = curScene(g);
  const x = (i % v.w) * 16 + 8, y = Math.floor(i / v.w) * 16 + 8;
  for (let n = 0; n < 5; n++) {
    g.particles.push({ x, y, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 25, life: 600, kind: 'sparkle' });
  }
}

function chips(g: Game, i: number, kind: 'chip' | 'leaf') {
  const v = curScene(g);
  const x = (i % v.w) * 16 + 8, y = Math.floor(i / v.w) * 16 + 8;
  for (let n = 0; n < 4; n++) {
    g.particles.push({ x, y, vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 20, life: 450, kind });
  }
}

function seasonalSeed(g: Game): string {
  const pool = cropsForSeason(g.save.calendar.season);
  return pool[Math.floor(Math.random() * pool.length)].seedId;
}

function harvest(g: Game, i: number) {
  const s = g.save;
  const c = s.farm.crops[i];
  const def = CROPS[c.id];
  const q = rollQuality(g);
  const n = def.yield ?? 1;
  if (!gainItem(g, c.id, n, q)) { toast(g, 'Inventory full!', '🎒'); return; }
  bump(g, 'cropsHarvested', n);
  bump(g, `harvested_${c.id}`, n);
  addXp(g, 'farming', 5);
  // wheat threshes into hay too — grow your own animal feed
  if (c.id === 'wheat') {
    gainItem(g, 'hay', 2);
    toast(g, '+2 hay from the straw', '🌾');
  }
  // crops sometimes give their seeds back — that's how varieties spread
  if (Math.random() < 0.25) { gainItem(g, def.seedId, 1); toast(g, `+1 ${ITEMS[def.seedId].name}`, '🌱'); }
  if (def.regrowDays) {
    const total = def.stageDays.reduce((a, b) => a + b, 0);
    s.farm.crops[i] = { ...c, daysGrown: total - def.regrowDays, regrowing: true };
  } else {
    delete s.farm.crops[i];
    s.farm.tiles[i] = T.TILLED;
  }
  sparkle(g, i);
  toast(g, `+${n} ${def.id}${q === 2 ? ' ★' : q === 1 ? ' ☆' : ''}`, '🌾');
}

// bare-hand forage pickup; returns loot applied
function gather(g: Game, i: number, o: WorldObject): boolean {
  const s = g.save;
  const drop = (id: string, qty: number) => {
    const total = qty + (Math.random() < doubleForageChance(g) ? qty : 0);
    if (!gainItem(g, id, total)) { toast(g, 'Inventory full!', '🎒'); return false; }
    toast(g, `+${total} ${ITEMS[id].name}`, '🧺');
    return true;
  };
  switch (o.kind) {
    case 'branch':
      if (!drop('branch', 1 + (Math.random() < 0.4 ? 1 : 0))) return false;
      delete s.farm.objects[i];
      break;
    case 'stonepile':
      if (!drop('stone', 1 + (Math.random() < 0.4 ? 1 : 0))) return false;
      delete s.farm.objects[i];
      break;
    case 'weed': {
      if (!drop('fiber', 1)) return false;
      const roll = Math.random();
      if (roll < 0.18) { gainItem(g, 'wheat_seeds', 1); toast(g, '+1 Wheat Seeds', '🌾'); }
      else if (roll < 0.36) { gainItem(g, 'mixed_seeds', 1); toast(g, '+1 Mixed Seeds', '🌱'); }
      delete s.farm.objects[i];
      break;
    }
    case 'mushroom':
      if (!drop('mushroom', 1)) return false;
      delete s.farm.objects[i];
      break;
    case 'bush':
      if (o.stage !== 1) { toast(g, 'The bush has no berries right now.', '🌳'); return true; }
      if (!drop('berries', 1 + (Math.random() < 0.5 ? 1 : 0))) return false;
      if (Math.random() < 0.2) { gainItem(g, seasonalSeed(g), 1); toast(g, 'Found seeds in the bush!', '🌱'); }
      o.stage = 0;
      break;
    default:
      return false;
  }
  bump(g, 'gathered');
  addXp(g, 'foraging', 3);
  chips(g, i, 'leaf');
  g.dirty = true; g.notify();
  return true;
}

export function actOn(g: Game, i: number): boolean {
  const s = g.save;
  const v = curScene(g);
  const x = i % v.w, y = Math.floor(i / v.w);
  faceTile(g, x, y);
  const o = v.objects[i];
  const sel = selection(g);

  // ---- interactable objects / stations / sites ----
  if (o) {
    switch (o.kind) {
      case 'tent':
        if (sel?.type === 'tool' && sel.tool === 'pickaxe') {
          // fold the tent (both tiles) back into a kit
          for (const [k, oo] of Object.entries(s.farm.objects)) {
            if (oo.kind === 'tent') delete s.farm.objects[Number(k)];
          }
          gainItem(g, 'tent_kit', 1);
          toast(g, 'Tent folded up. Home is wherever you pitch it.', '⛺');
          g.dirty = true; g.notify();
          return true;
        }
        g.dialog = 'sleep'; g.notify(); return true;
      case 'bed': g.dialog = 'sleep'; g.notify(); return true;
      case 'sign': toast(g, o.meta ?? '…', '🪧'); return true;
      case 'bench': case 'anvil': case 'campfire': {
        if (sel?.type === 'tool' && sel.tool === 'pickaxe') {
          // pack the station back into its kit so you can move it
          const store = objStore(g);
          if (!store) return false;
          gainItem(g, o.kind === 'bench' ? 'bench_kit' : o.kind === 'anvil' ? 'anvil_kit' : 'campfire_kit', 1);
          delete store[i];
          toast(g, 'Packed it up — place it anywhere.', '📦');
          g.dirty = true; g.notify();
          return true;
        }
        g.craftStation = o.kind;
        g.dialog = 'craft';
        g.notify();
        return true;
      }
      case 'furnace': {
        if (sel?.type === 'tool' && sel.tool === 'pickaxe') {
          if (o.smelting) { toast(g, 'It’s mid-smelt — collect the bar first.', '🔥'); return false; }
          const store = objStore(g);
          if (!store) return false;
          gainItem(g, 'furnace', 1);
          delete store[i];
          toast(g, 'Furnace packed up (still warm).', '📦');
          g.dirty = true; g.notify();
          return true;
        }
        return useFurnace(g, i, o);
      }
      case 'chest': {
        if (o.meta === 'east' || (o.meta && o.meta !== 'storage' && o.meta !== 'bag' && !g.save.chests[i])) {
          // an old treasure chest someone hid long ago
          if (s.stats[`chest_${o.meta}`]) { toast(g, 'Empty. Someone got here first — you.', '🪙'); return true; }
          s.stats[`chest_${o.meta}`] = 1;
          s.player.gold += 500;
          s.stats.goldPeak = Math.max(s.stats.goldPeak ?? 0, s.player.gold);
          gainItem(g, 'star_metal', 2);
          gainItem(g, 'old_bottle', 1);
          sparkle(g, i);
          toast(g, 'An old cache! +500g, strange metal… and a corked bottle.', '💰');
          g.dirty = true; g.notify();
          return true;
        }
        g.chestAt = `${s.player.scene}:${i}`;
        g.dialog = 'chest';
        g.notify();
        return true;
      }
      case 'altar': {
        if (!s.stats.altarFound) { bump(g, 'altarFound'); }
        const shards = s.inventory.reduce((a, x) => a + (x?.id === 'rune_shard' ? x.qty : 0), 0);
        if (shards >= 3) {
          removeItemN(s, 'rune_shard', 3);
          toast(g, 'The three shards sink into the stone. The world opens.', '🌀');
          enterBelow(g);
        } else {
          toast(g, `Three notches wait in the stone. Something shard-shaped would fit. (${shards}/3)`, '🗿');
        }
        return true;
      }
      case 'gravestone': toast(g, 'A name too worn to read. Someone left flowers once.', '🪦'); return true;
      case 'starstone':
        if (sel?.type === 'tool' && sel.tool === 'pickaxe') {
          if (!spend(g, 2, 'pickaxe')) return false;
          delete s.farm.objects[i];
          gainItem(g, 'star_metal', 2);
          sparkle(g, i);
          toast(g, 'Still warm from the sky. +2 Star Metal', '🌠');
          g.dirty = true; g.notify();
          return true;
        }
        toast(g, 'A fallen star, half-buried. A pickaxe could free it.', '🌠');
        return true;
      case 'fence': case 'gate':
        if (sel?.type === 'tool' && sel.tool === 'pickaxe') {
          gainItem(g, o.kind, 1);
          delete s.farm.objects[i];
          g.dirty = true; g.notify();
          return true;
        }
        return o.kind === 'gate'; // gates are walked through, fences just sit there
      case 'ladder': enterMine(g, (g.mineFloor?.floor ?? 0) + 1); return true;
      case 'elevator': g.dialog = 'elevator'; g.notify(); return true;
      case 'trough': return fillTrough(g);
      case 'branch': case 'stonepile': case 'weed': case 'mushroom': case 'bush':
        // axe chops a bush out entirely (hand-taps just pick its berries)
        if (o.kind === 'bush' && sel?.type === 'tool' && sel.tool === 'axe') {
          return useTool(g, 'axe', i, o);
        }
        // scythe clears weeds into hay; anything else is a hand-pick
        if (o.kind === 'weed' && sel?.type === 'tool' && sel.tool === 'scythe') {
          if (!spend(g, 1, 'scythe')) return false;
          delete s.farm.objects[i];
          chips(g, i, 'leaf');
          gainItem(g, 'hay', 1);
          toast(g, '+1 hay', '🌾');
          bump(g, 'gathered');
          g.dirty = true; g.notify();
          return true;
        }
        return gather(g, i, o);
      case 'sprinkler': case 'scarecrow':
        if (sel?.type === 'tool' && sel.tool === 'pickaxe') {
          const store = objStore(g);
          if (!store) return false;
          gainItem(g, o.kind, 1);
          delete store[i];
          g.dirty = true; g.notify();
          return true;
        }
        return false;
      case 'door':
        // pickaxe on a building's own door = tear the building down (kit back)
        if (sel?.type === 'tool' && sel.tool === 'pickaxe' && s.player.scene === 'farm' && o.meta && !o.meta.includes(':')) {
          return demolishBuilding(g, o.meta);
        }
        return true;
    }
  }

  // ---- the trader, if camped today ----
  if (s.player.scene === 'farm' && traderHere(g) && x === TRADER_SPOT.x && y === TRADER_SPOT.y) {
    g.dialog = 'trader';
    g.notify();
    return true;
  }

  // ---- night shades: swing steel at them ----
  if (s.player.scene === 'farm' && isNight(g) && sel?.type === 'tool' && sel.tool === 'sword'
      && g.monsters.some((m) => Math.abs(m.x - x) + Math.abs(m.y - y) <= 1)) {
    if (!spend(g, 1, 'sword')) return false;
    swingAtShades(g, x, y);
    g.notify();
    return true;
  }

  // ---- wild animals on the farm ----
  if (s.player.scene === 'farm') {
    const wa = wildAt(g, x, y);
    if (wa) return tryTame(g, wa);
  }

  // ---- housed animals ----
  if ((s.player.scene === 'coop' || s.player.scene === 'barn') && tapAnimal(g, x, y)) return true;

  // ---- crops ----
  const c = s.player.scene === 'farm' ? s.farm.crops[i] : undefined;
  if (c) {
    // pickaxe clears any crop and returns the land to grass (like un-tilling)
    if (sel?.type === 'tool' && sel.tool === 'pickaxe') {
      if (!spend(g, 2, 'pickaxe')) return false;
      const def = CROPS[c.id];
      delete s.farm.crops[i];
      s.farm.tiles[i] = T.GRASS;
      delete s.farm.watered[i];
      if (def && !cropDead(c) && Math.random() < 0.5) {
        gainItem(g, def.seedId, 1);
        toast(g, `Cleared — the ${ITEMS[def.seedId].name} survived!`, '🌱');
      } else {
        toast(g, 'Cleared back to grass.', '⛏️');
      }
      chips(g, i, 'leaf');
      g.dirty = true; g.notify();
      return true;
    }
    if (cropDead(c)) {
      delete s.farm.crops[i];
      gainItem(g, 'fiber', 1);
      chips(g, i, 'leaf');
      g.dirty = true; g.notify();
      return true;
    }
    if (cropReady(c)) { harvest(g, i); g.dirty = true; g.notify(); return true; }
    if (sel?.type === 'tool' && sel.tool === 'can') return waterAt(g, i);
    return false;
  }

  if (sel?.type === 'tool') return useTool(g, sel.tool, i, o);
  if (sel?.type === 'item') return useItem(g, sel.slot, i);
  return false;
}

function waterAt(g: Game, i: number): boolean {
  const s = g.save;
  if (s.player.canWater <= 0) { toast(g, 'Watering can is empty — refill at the lake or river.', '💧'); return false; }
  if (!spend(g, 2, 'can')) return false;
  s.player.canWater -= 1;
  s.farm.watered[i] = true;
  const c = s.farm.crops[i];
  if (c && !cropDead(c)) c.watered = true;
  const v = curScene(g);
  g.particles.push({ x: (i % v.w) * 16 + 8, y: Math.floor(i / v.w) * 16 + 8, vx: 0, vy: -5, life: 350, kind: 'splash' });
  g.dirty = true; g.notify();
  return true;
}

function useTool(g: Game, tool: ToolKind, i: number, o?: WorldObject): boolean {
  const s = g.save;
  const tier = Math.max(0, s.player.tools[tool] as number);
  const scene = s.player.scene;
  const tile = curScene(g).tiles[i];

  switch (tool) {
    case 'hoe':
      if (scene !== 'farm' || o || (tile !== T.GRASS && tile !== T.DIRT)) return false;
      if (!spend(g, 2, 'hoe')) return false;
      s.farm.tiles[i] = T.TILLED;
      addXp(g, 'farming', 1);
      chips(g, i, 'chip');
      g.dirty = true; g.notify();
      return true;

    case 'can':
      if (tile === T.WATER) {
        s.player.canWater = canCapacity(g);
        toast(g, 'Watering can refilled.', '💧');
        g.notify();
        return true;
      }
      if (scene === 'farm' && tile === T.TILLED) return waterAt(g, i);
      return false;

    case 'axe': {
      if (scene !== 'farm' || !o) return false;
      if (o.kind === 'tree') {
        if (!spend(g, 2, 'axe')) return false;
        chips(g, i, 'leaf');
        if ((o.stage ?? 2) < 2) {
          delete s.farm.objects[i];
          gainItem(g, 'wood', 1);
          bump(g, 'woodChopped');
        } else {
          o.hp = (o.hp ?? 5) - 1 - tier;
          if (o.hp <= 0) {
            s.farm.objects[i] = { kind: 'stump', hp: 2 };
            gainItem(g, 'wood', 8);
            if (Math.random() < 0.5) gainItem(g, 'acorn', 1);
            bump(g, 'woodChopped', 8);
            addXp(g, 'foraging', 4);
            sparkle(g, i);
          }
        }
        g.dirty = true; g.notify();
        return true;
      }
      if (o.kind === 'bush') {
        // clearing a bush frees its spot — the forage caps make room elsewhere
        if (!spend(g, 2, 'axe')) return false;
        const hadBerries = o.stage === 1;
        delete s.farm.objects[i];
        chips(g, i, 'leaf');
        gainItem(g, 'fiber', 2);
        gainItem(g, 'wood', 1);
        if (hadBerries) gainItem(g, 'berries', 1);
        toast(g, `Bush cleared — +2 fiber, +1 wood${hadBerries ? ', +berries' : ''}`, '🪓');
        g.dirty = true; g.notify();
        return true;
      }
      if (o.kind === 'stump') {
        if (!spend(g, 2, 'axe')) return false;
        o.hp = (o.hp ?? 2) - 1 - tier;
        chips(g, i, 'chip');
        if (o.hp <= 0) {
          delete s.farm.objects[i];
          gainItem(g, 'wood', 2);
          gainItem(g, 'hardwood', 1);
          toast(g, '+1 Hardwood!', '🪵');
          bump(g, 'woodChopped', 2);
        }
        g.dirty = true; g.notify();
        return true;
      }
      return false;
    }

    case 'pickaxe': {
      if (scene === 'mine' && o && (o.kind === 'minerock' || o.kind === 'orerock' || o.kind === 'gemrock')) {
        if (!spend(g, 2, 'pickaxe')) return false;
        o.hp = (o.hp ?? 2) - 1 - tier;
        chips(g, i, 'chip');
        if (o.hp <= 0) {
          const keep = onRockBroken(g, i, o);
          if (!keep) delete g.mineFloor!.objects[i];
        }
        g.notify();
        return true;
      }
      if (scene !== 'farm') return false;
      if (o?.kind === 'rock' || o?.kind === 'bigrock') {
        if (o.kind === 'bigrock' && tier < 1) { toast(g, 'Too hard — needs a copper pickaxe.', '⛏️'); return false; }
        if (!spend(g, 2, 'pickaxe')) return false;
        o.hp = (o.hp ?? 2) - 1 - tier;
        chips(g, i, 'chip');
        if (o.hp <= 0) {
          delete s.farm.objects[i];
          gainItem(g, 'stone', o.kind === 'bigrock' ? 4 : 2);
          if (o.kind === 'bigrock' && Math.random() < 0.35) gainItem(g, 'copper_ore', 1);
          bump(g, 'rocksBroken');
        }
        g.dirty = true; g.notify();
        return true;
      }
      if (!o && tile === T.TILLED && !s.farm.crops[i]) {
        if (!spend(g, 2, 'pickaxe')) return false;
        s.farm.tiles[i] = T.GRASS;
        delete s.farm.watered[i];
        g.dirty = true; g.notify();
        return true;
      }
      // tapping ANY part of a placed building with the pickaxe packs it up
      if (!o && tile === T.WALL) {
        const x = i % s.farm.w, y = Math.floor(i / s.farm.w);
        for (const [id, door] of Object.entries(s.placed)) {
          const def = BUILDING_BY_KIT[`${id}_kit`];
          if (!def) continue;
          const x0 = door.x - Math.floor(def.w / 2), y0 = door.y - def.h + 1;
          if (x >= x0 && x < x0 + def.w && y >= y0 && y <= door.y) {
            return demolishBuilding(g, id);
          }
        }
      }
      return false;
    }

    case 'scythe': {
      // shear a sheep in the barn
      if (scene === 'barn') {
        const v2 = curScene(g);
        const x = i % v2.w, y = Math.floor(i / v2.w);
        const a = s.animals.find((an) => {
          const rt = g.animalsRt[an.id];
          return rt && an.home === 'barn' && an.kind === 'sheep' && rt.x === x && rt.y === y;
        });
        if (a) {
          if (a.babyDays) { toast(g, `${a.name} is too little to shear!`, '🍼'); return false; }
          if (!a.produceReady) { toast(g, `${a.name}'s wool needs to grow back.`, '🐑'); return false; }
          if (!spend(g, 2, 'scythe')) return false;
          a.produceReady = false;
          const q: Quality = a.happiness > 180 ? 2 : a.happiness > 90 ? 1 : 0;
          gainItem(g, 'wool', 1, q);
          toast(g, `Sheared ${a.name} — +1 Wool!`, '🐑');
          g.dirty = true; g.notify();
          return true;
        }
      }
      return false; // weeds handled in the object branch
    }

    case 'sword': {
      if (scene !== 'mine') return false;
      if (!spend(g, 1, 'sword')) return false;
      const v = curScene(g);
      const hit = swingSword(g, i % v.w, Math.floor(i / v.w));
      if (hit) g.notify();
      return true;
    }

    case 'pail':
      return milkAt(g, i);

    case 'rod': {
      const v = curScene(g);
      if (v.tiles[i] !== T.WATER) return false;
      if (!spend(g, 4, 'rod')) return false;
      startCast(g, i, (i % v.w) >= 30 ? 'river' : 'pond');
      return true;
    }
  }
  return false;
}

function useItem(g: Game, slot: number, i: number): boolean {
  const s = g.save;
  const inv = s.inventory[slot];
  if (!inv) return false;
  const def = ITEMS[inv.id];
  const v = curScene(g);
  const tile = v.tiles[i];

  // building kits: the tapped tile becomes the door
  if (inv.id.endsWith('_kit') && BUILDING_BY_KIT[inv.id] && s.player.scene === 'farm') {
    if (placeBuildingKit(g, inv.id, i % v.w, Math.floor(i / v.w))) {
      removeFromSlot(s, slot, 1);
      return true;
    }
    return false;
  }
  // bridge planks pave water
  if (inv.id === 'bridge_kit' && s.player.scene === 'farm') {
    if (tile === T.WATER && placeBridgeTile(g, i)) {
      removeFromSlot(s, slot, 1);
      return true;
    }
    if (tile !== T.WATER) toast(g, 'Bridge planks go on water.', '🌉');
    return false;
  }

  if (def?.seedOf && s.player.scene === 'farm' && tile === T.TILLED && !s.farm.crops[i]) {
    const cropId = def.seedOf === 'mixed'
      ? cropsForSeason(s.calendar.season)[Math.floor(Math.random() * cropsForSeason(s.calendar.season).length)].id
      : def.seedOf;
    const crop = CROPS[cropId];
    if (!crop.seasons.includes(s.calendar.season)) { toast(g, 'Wrong season for that seed.', '🌱'); return false; }
    removeFromSlot(s, slot, 1);
    s.farm.crops[i] = { id: crop.id, daysGrown: 0, watered: !!s.farm.watered[i] };
    bump(g, 'planted');
    addXp(g, 'farming', 2);
    g.dirty = true; g.notify();
    return true;
  }
  // acorns plant trees on open grass
  if (inv.id === 'acorn' && s.player.scene === 'farm' && tile === T.GRASS && !curScene(g).objects[i] && !s.farm.crops[i]) {
    removeFromSlot(s, slot, 1);
    s.farm.objects[i] = { kind: 'tree', stage: 0 };
    toast(g, 'Planted a tree 🌱', '🌳');
    g.dirty = true; g.notify();
    return true;
  }
  // the tent: two tiles wide, farm only
  if (inv.id === 'tent_kit' && s.player.scene === 'farm') {
    const GROUND = new Set([T.GRASS, T.DIRT, T.PATH]);
    const ok = GROUND.has(tile) && !s.farm.objects[i] && !s.farm.crops[i]
      && GROUND.has(v.tiles[i + 1]) && !s.farm.objects[i + 1] && !s.farm.crops[i + 1]
      && (i % v.w) < v.w - 2;
    if (!ok) { toast(g, 'The tent needs two clear tiles side by side.', '⛺'); return false; }
    removeFromSlot(s, slot, 1);
    s.farm.objects[i] = { kind: 'tent' };
    s.farm.objects[i + 1] = { kind: 'tent', meta: 'silent' };
    toast(g, 'Home sweet (portable) home.', '⛺');
    g.dirty = true; g.notify();
    return true;
  }
  // stations, chests & co: farm ground, or the cabin floor
  const indoors = s.player.scene === 'house';
  const INDOOR_OK = new Set(['chest', 'bench', 'anvil', 'campfire', 'furnace']);
  if (def?.placeable && (s.player.scene === 'farm' || (indoors && INDOOR_OK.has(def.placeable)))) {
    const store = objStore(g);
    const groundOk = indoors ? tile === T.FLOOR : (tile === T.GRASS || tile === T.DIRT || tile === T.PATH);
    if (store && groundOk && !curScene(g).objects[i] && (indoors || !s.farm.crops[i])) {
      removeFromSlot(s, slot, 1);
      store[i] = { kind: def.placeable, ...(def.placeable === 'furnace' ? { smelting: null } : {}) };
      if (def.placeable === 'bench') bump(g, 'built_bench');
      if (def.placeable === 'fence') bump(g, 'fencesPlaced');
      if (def.placeable === 'chest') s.chests[`${s.player.scene}:${i}`] = s.chests[`${s.player.scene}:${i}`] ?? [];
      g.dirty = true; g.notify();
      return true;
    }
    if (indoors && !groundOk) toast(g, 'Needs a clear patch of floor.', '🏠');
    return false;
  }
  return false;
}

// Tear a building down: footprint back to grass, the kit back in your pack.
function demolishBuilding(g: Game, id: string): boolean {
  const s = g.save;
  const def = BUILDING_BY_KIT[`${id}_kit`];
  const door = s.placed[id];
  if (!def || !door) return false;
  const housed = s.animals.filter((a) => a.home === id).length;
  const { w } = s.farm;
  const x0 = door.x - Math.floor(def.w / 2), y0 = door.y - def.h + 1;
  for (let y = y0; y < y0 + def.h; y++) {
    for (let x = x0; x < x0 + def.w; x++) {
      s.farm.tiles[y * w + x] = T.GRASS;
      delete s.farm.objects[y * w + x];
    }
  }
  delete s.built[id];
  delete s.placed[id];
  gainItem(g, def.kit, 1);
  toast(g, housed > 0
    ? `${def.name} packed up — ${housed} animal${housed > 1 ? 's' : ''} riding along in the kit! 🐾`
    : `${def.name} packed back into its kit.`, '📦');
  g.dirty = true; g.notify();
  return true;
}

// ---- housed animals ----

function tapAnimal(g: Game, x: number, y: number): boolean {
  const s = g.save;
  const a = s.animals.find((an) => {
    const rt = g.animalsRt[an.id];
    return rt && an.home === s.player.scene && rt.x === x && rt.y === y;
  });
  if (!a) return false;
  const def = ANIMALS[a.kind];
  if (a.produceReady && !def.viaTool && !a.babyDays) {
    a.produceReady = false;
    const q: Quality = a.happiness > 180 ? 2 : a.happiness > 90 ? 1 : 0;
    if (def.produce === 'egg' && a.happiness >= 220 && Math.random() < 0.04) {
      gainItem(g, 'golden_egg', 1);
      toast(g, `${a.name} left you… a GOLDEN egg?!`, '🌟');
    } else {
      gainItem(g, def.produce, 1, q);
      toast(g, `${a.name} left you ${ITEMS[def.produce].name}!`, '🥚');
    }
  } else {
    a.happiness = Math.min(255, a.happiness + 6);
    g.particles.push({ x: x * 16 + 8, y: y * 16, vx: 0, vy: -15, life: 700, kind: 'sparkle' });
    toast(g, `${a.name} loves you ♥`, '❤️');
  }
  g.dirty = true; g.notify();
  return true;
}

function milkAt(g: Game, i: number): boolean {
  const s = g.save;
  const v = curScene(g);
  const x = i % v.w, y = Math.floor(i / v.w);
  const a = s.animals.find((an) => {
    const rt = g.animalsRt[an.id];
    return rt && an.home === s.player.scene && rt.x === x && rt.y === y;
  });
  if (!a) return false;
  const def = ANIMALS[a.kind];
  if (def.viaTool !== 'pail') return tapAnimal(g, x, y);
  if (a.babyDays) { toast(g, `${a.name} is still a baby!`, '🍼'); return false; }
  if (!a.produceReady) { toast(g, `${a.name} has no milk right now.`, '🥛'); return false; }
  if (!spend(g, 2, 'pail')) return false;
  a.produceReady = false;
  const q: Quality = a.happiness > 180 ? 2 : a.happiness > 90 ? 1 : 0;
  gainItem(g, def.produce, 1, q);
  toast(g, `+1 ${ITEMS[def.produce].name}`, '🥛');
  g.dirty = true; g.notify();
  return true;
}

function fillTrough(g: Game): boolean {
  const s = g.save;
  const here = s.player.scene as 'coop' | 'barn';
  const housed = s.animals.filter((a) => a.home === here);
  if (!housed.length) { toast(g, 'No animals to feed yet.', '🌾'); return false; }
  if (s.troughFilled[here]) { toast(g, 'The trough is already full.', '🌾'); return false; }
  const hay = countItem(s, 'hay');
  if (hay < housed.length) { toast(g, `Need ${housed.length} hay (have ${hay}).`, '🌾'); return false; }
  removeItem(s, 'hay', housed.length);
  s.troughFilled[here] = true;
  for (const a of housed) a.fedToday = true;
  toast(g, `Fed ${housed.length} ${housed.length === 1 ? 'animal' : 'animals'}.`, '🌾');
  g.dirty = true; g.notify();
  return true;
}

// ---- furnace ----

function useFurnace(g: Game, i: number, o: WorldObject): boolean {
  const s = g.save;
  const today = absDay(s.calendar);
  if (o.smelting) {
    if (o.smelting.readyOnDay <= today) {
      gainItem(g, o.smelting.out, 1);
      toast(g, `+1 ${ITEMS[o.smelting.out].name}`, '🔥');
      bump(g, 'barsSmelted');
      o.smelting = null;
      g.dirty = true; g.notify();
      return true;
    }
    toast(g, 'Still smelting — ready tomorrow.', '🔥');
    return false;
  }
  const ores: [string, string][] = [['gold_ore', 'gold_bar'], ['iron_ore', 'iron_bar'], ['copper_ore', 'copper_bar']];
  for (const [ore, bar] of ores) {
    if (countItem(s, ore) >= 5 && countItem(s, 'coal') >= 1) {
      removeItem(s, ore, 5);
      removeItem(s, 'coal', 1);
      o.smelting = { out: bar, readyOnDay: today + 1 };
      toast(g, `Smelting ${bar.replace('_', ' ')} — ready tomorrow.`, '🔥');
      g.dirty = true; g.notify();
      return true;
    }
  }
  // spell out exactly what's missing (backpack only — chests don't count!)
  const have = (id: string) => countItem(s, id);
  const coal = have('coal');
  const best = (['copper_ore', 'iron_ore', 'gold_ore'] as const)
    .map((id) => `${have(id)} ${ITEMS[id].name.toLowerCase()}`)
    .filter((t) => !t.startsWith('0 '));
  toast(g,
    `Needs 5 of ONE ore + 1 coal in your backpack. You carry: ${best.length ? best.join(', ') : 'no ore'} and ${coal} coal.`,
    '🔥');
  return false;
}

export function canCapacity(g: Game): number {
  return 40 + 15 * Math.max(0, g.save.player.tools.can as number);
}

export { checkGoals };
