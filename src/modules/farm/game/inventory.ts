// Inventory helpers — quality-aware stacking, 99 per stack.

import type { FarmSave, InvSlot, Quality } from '../types';

export const STACK_MAX = 99;
export const slotCount = (s: FarmSave) => (s.unlocks.backpack ? 36 : 24);

function ensureLength(s: FarmSave) {
  const n = slotCount(s);
  while (s.inventory.length < n) s.inventory.push(null);
}

export function addItem(s: FarmSave, id: string, qty = 1, q: Quality = 0): boolean {
  ensureLength(s);
  let left = qty;
  for (const slot of s.inventory) {
    if (slot && slot.id === id && (slot.q ?? 0) === q && slot.qty < STACK_MAX) {
      const take = Math.min(left, STACK_MAX - slot.qty);
      slot.qty += take; left -= take;
      if (!left) return true;
    }
  }
  for (let i = 0; i < s.inventory.length; i++) {
    if (!s.inventory[i]) {
      const take = Math.min(left, STACK_MAX);
      s.inventory[i] = { id, qty: take, ...(q ? { q } : {}) };
      left -= take;
      if (!left) return true;
    }
  }
  return left === 0;
}

export function countItem(s: FarmSave, id: string): number {
  return s.inventory.reduce((a, x) => a + (x?.id === id ? x.qty : 0), 0);
}

export function removeItem(s: FarmSave, id: string, qty: number): boolean {
  if (countItem(s, id) < qty) return false;
  let left = qty;
  for (let i = 0; i < s.inventory.length && left > 0; i++) {
    const slot = s.inventory[i];
    if (slot?.id === id) {
      const take = Math.min(left, slot.qty);
      slot.qty -= take; left -= take;
      if (!slot.qty) s.inventory[i] = null;
    }
  }
  return true;
}

export function removeFromSlot(s: FarmSave, i: number, qty: number): InvSlot | null {
  const slot = s.inventory[i];
  if (!slot) return null;
  const take = Math.min(qty, slot.qty);
  slot.qty -= take;
  const out = { ...slot, qty: take };
  if (!slot.qty) s.inventory[i] = null;
  return out;
}

export function hasFreeSlot(s: FarmSave): boolean {
  ensureLength(s);
  return s.inventory.some((x) => !x);
}
