// The wandering trader: some mornings a stranger with a heavy pack camps on
// your land for the day. The only source and sink of gold.

import { cropsForSeason } from '../data/crops';
import { ITEMS, QUALITY_MULT } from '../data/items';
import { hash2 } from '../engine/sprites';
import { absDay } from './clock';
import { gainItem } from './crafting';
import { bump } from './goals';
import { removeFromSlot } from './inventory';
import { toast, type Game } from './runtime';

export const TRADER_SPOT = { x: 14, y: 8 };

export function traderHere(g: Game): boolean {
  const day = absDay(g.save.calendar);
  return day >= 5 && hash2(day, 5, 777) < 0.28;
}

export interface StockEntry { id: string; qty: number; price: number }

// deterministic daily stock: seasonal seeds, staples, and sometimes… rarities
export function traderStock(g: Game): StockEntry[] {
  const day = absDay(g.save.calendar);
  const out: StockEntry[] = [];
  const seeds = cropsForSeason(g.save.calendar.season);
  const s1 = seeds[Math.floor(hash2(day, 1, 801) * seeds.length)];
  const s2 = seeds[Math.floor(hash2(day, 2, 802) * seeds.length)];
  out.push({ id: s1.seedId, qty: 5, price: Math.max(20, ITEMS[s1.id].sell) });
  if (s2 !== s1) out.push({ id: s2.seedId, qty: 5, price: Math.max(20, ITEMS[s2.id].sell) });
  out.push({ id: 'hay', qty: 10, price: 60 });
  out.push({ id: 'fence', qty: 8, price: 50 });
  const r = hash2(day, 3, 803);
  if (r < 0.12) out.push({ id: 'rune_shard', qty: 1, price: 1500 });
  else if (r < 0.24) out.push({ id: 'starfruit_seeds', qty: 1, price: 500 });
  else if (r < 0.36) out.push({ id: 'star_metal', qty: 1, price: 900 });
  else if (r < 0.50) out.push({ id: 'diamond', qty: 1, price: 1200 });
  return out;
}

export function traderBuy(g: Game, e: StockEntry): boolean {
  const s = g.save;
  if (s.player.gold < e.price) { toast(g, 'Not enough gold.', '💰'); return false; }
  if (!gainItem(g, e.id, e.qty)) { toast(g, 'Inventory full!', '🎒'); return false; }
  s.player.gold -= e.price;
  bump(g, 'trades');
  toast(g, `Bought ${e.qty}× ${ITEMS[e.id]?.name}.`, '🤝');
  g.dirty = true; g.notify();
  return true;
}

export function traderSell(g: Game, slot: number, qty: number) {
  const s = g.save;
  const inv = s.inventory[slot];
  if (!inv || (ITEMS[inv.id]?.sell ?? 0) <= 0) return;
  const taken = removeFromSlot(s, slot, qty);
  if (!taken) return;
  const gold = Math.floor((ITEMS[taken.id].sell) * QUALITY_MULT[taken.q ?? 0]) * taken.qty;
  s.player.gold += gold;
  s.stats.goldPeak = Math.max(s.stats.goldPeak ?? 0, s.player.gold);
  bump(g, 'trades');
  toast(g, `Sold ${taken.qty}× ${ITEMS[taken.id].name} (+${gold}g)`, '💰');
  g.dirty = true; g.notify();
}
