'use client';

// Bottom hotbar: tools row + a scrollable item strip + bag button.

import { TOOL_ORDER } from '../game/actions';
import { TOOL_DUR } from '../types';
import type { Game } from '../game/runtime';
import { spriteUrl } from '../engine/sprites';
import { ITEMS } from '../data/items';

const TIER_COLORS = ['#8b8ba3', '#d97e28', '#c2c2d1', '#f4c542'];

export function Hotbar({ g }: { g: Game }) {
  const s = g.save;
  const sel = s.player.selectedSlot;
  const pick = (n: number) => { s.player.selectedSlot = n; g.notify(); };

  return (
    <div className="farm-hotbar">
      <div className="farm-hotbar-row">
        {TOOL_ORDER.map((tool, i) => {
          const tier = s.player.tools[tool];
          if (tier < 0) return null;
          return (
            <button
              key={tool}
              className={`farm-slot${sel === i ? ' sel' : ''}`}
              style={{ borderColor: sel === i ? undefined : TIER_COLORS[tier as number] }}
              onClick={() => pick(i)}
              title={tool}
            >
              <img src={spriteUrl(`t_${tool}`)} alt={tool} draggable={false} />
              {tool === 'can' && <span className="farm-slot-badge">{s.player.canWater}</span>}
              {(() => {
                const max = TOOL_DUR[tier as number];
                const pct = Math.max(0, Math.min(1, (s.player.toolDur[tool] ?? 0) / max));
                if (pct >= 1) return null;
                return (
                  <span className="farm-dur">
                    <span style={{ width: `${pct * 100}%`, background: pct < 0.15 ? '#e8574f' : pct < 0.45 ? '#f4c542' : '#63c74d' }} />
                  </span>
                );
              })()}
            </button>
          );
        })}
        <button
          className={`farm-slot bag${g.dialog === 'inventory' ? ' sel' : ''}`}
          onClick={() => { g.dialog = g.dialog === 'inventory' ? null : 'inventory'; g.notify(); }}
          title="Backpack"
        >🎒</button>
      </div>
      <div className="farm-hotbar-row items">
        {s.inventory.map((slot, i) => {
          if (!slot) return (
            <button key={i} className={`farm-slot empty${sel === 100 + i ? ' sel' : ''}`} onClick={() => pick(100 + i)} />
          );
          const def = ITEMS[slot.id];
          return (
            <button
              key={i}
              className={`farm-slot${sel === 100 + i ? ' sel' : ''}`}
              onClick={() => pick(100 + i)}
              title={def?.name ?? slot.id}
            >
              <img src={spriteUrl(def?.sprite ?? `i_${slot.id}`)} alt={slot.id} draggable={false} />
              <span className="farm-slot-badge">{slot.qty}</span>
              {slot.q === 1 && <img className="farm-slot-star" src={spriteUrl('star_s')} alt="silver" />}
              {slot.q === 2 && <img className="farm-slot-star" src={spriteUrl('star_g')} alt="gold" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
