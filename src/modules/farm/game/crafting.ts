// Crafting: recipe discovery on first pickup, station-gated crafting,
// tool-tier upgrades, and the backpack special-case.

import { ITEMS } from '../data/items';
import { RECIPES } from '../data/recipes';
import { TOOL_DUR, TOOL_ORDER, type Recipe, type Station } from '../types';
import { bump } from './goals';
import { addItem, countItem, removeFromSlot, removeItem, slotCount } from './inventory';
import { toast, type Game } from './runtime';

// Called whenever an item enters the inventory for the first time.
export function discoverRecipes(g: Game, itemId: string) {
  const s = g.save;
  for (const r of RECIPES) {
    if (r.unlockOn !== itemId || s.knownRecipes.includes(r.id)) continue;
    s.knownRecipes.push(r.id);
    toast(g, `New recipe: ${r.name}!`, '💡');
  }
  g.dirty = true;
}

export function knownAtBoot(g: Game) {
  const s = g.save;
  const has = (id: string) =>
    countItem(s, id) > 0
    || Object.values(s.chests ?? {}).some((store) => store?.some((x) => x?.id === id));
  for (const r of RECIPES) {
    if (s.knownRecipes.includes(r.id)) continue;
    // 'start' recipes always; item-keyed ones also unlock retroactively if
    // you already own the key item (fixes saves that predate a recipe)
    if (r.unlockOn === 'start' || has(r.unlockOn)) s.knownRecipes.push(r.id);
  }
}

// All item gains route through here so first-pickups reveal recipes.
export function gainItem(g: Game, id: string, qty = 1, q: 0 | 1 | 2 = 0): boolean {
  const had = countItem(g.save, id) > 0;
  const ok = addItem(g.save, id, qty, q);
  if (ok && !had) discoverRecipes(g, id);
  if (ok && id === 'rune_shard') {
    bump(g, 'shardsFound', qty);
    toast(g, 'A Rune Shard! It hums, pulling faintly toward the old forest…', '💠');
  }
  return ok;
}

export function recipesFor(g: Game, station: Station): Recipe[] {
  return RECIPES.filter((r) => r.station === station && g.save.knownRecipes.includes(r.id));
}

export function canCraft(g: Game, r: Recipe): boolean {
  if (typeof r.out !== 'string') {
    // any tier is craftable as long as it beats what you're holding —
    // materials gate progression, and broken tools (-1) can be replaced
    // at whatever tier you can afford
    const cur = g.save.player.tools[r.out.tool] as number;
    if (cur >= r.out.tier) return false;
  }
  if (r.out === 'backpack_upgrade' && g.save.unlocks.backpack) return false;
  return r.mats.every((m) => countItem(g.save, m.id) >= m.qty);
}

export function eatFromSlot(g: Game, slot: number) {
  const s = g.save;
  const inv = s.inventory[slot];
  const def = inv && ITEMS[inv.id];
  if (!def?.edible) return;
  removeFromSlot(s, slot, 1);
  s.player.energy = Math.min(s.player.maxEnergy, s.player.energy + def.edible);
  toast(g, `Ate ${def.name} (+${def.edible} energy)`, '🍽️');
  g.dirty = true;
  g.notify();
}

export function craft(g: Game, r: Recipe): boolean {
  const s = g.save;
  if (!canCraft(g, r)) { toast(g, 'Missing materials.', '🧰'); return false; }
  for (const m of r.mats) removeItem(s, m.id, m.qty);

  if (typeof r.out === 'string') {
    if (r.out === 'backpack_upgrade') {
      s.unlocks.backpack = true;
      while (s.inventory.length < slotCount(s)) s.inventory.push(null);
      toast(g, 'Backpack upgraded — 12 more slots!', '🎒');
    } else {
      if (!addItem(s, r.out, r.outQty ?? 1)) {
        // no room even after the mats left — give everything back
        for (const m of r.mats) addItem(s, m.id, m.qty);
        toast(g, 'No room in your backpack for that — nothing was used.', '🎒');
        g.notify();
        return false;
      }
      discoverRecipes(g, r.out);
      toast(g, `Crafted ${ITEMS[r.out]?.name ?? r.out}${(r.outQty ?? 1) > 1 ? ` ×${r.outQty}` : ''}`, '🔨');
    }
  } else {
    s.player.tools[r.out.tool] = r.out.tier;
    s.player.toolDur[r.out.tool] = TOOL_DUR[r.out.tier];
    // equip it and show what this thing can actually do (first reveal!)
    s.player.selectedSlot = TOOL_ORDER.indexOf(r.out.tool);
    g.newTool = { tool: r.out.tool, tier: r.out.tier, name: r.name };
    g.dialog = 'newtool';
    bump(g, 'toolsCrafted');
    if (r.out.tier >= 1) bump(g, 'metalToolsCrafted');
    if (r.out.tier === 2) bump(g, 'ironToolsCrafted');
    if (r.out.tier === 3) bump(g, 'goldToolsCrafted');
  }
  g.dirty = true;
  g.notify();
  return true;
}
