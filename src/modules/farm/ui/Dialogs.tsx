'use client';

// Dialog dispatcher + inventory / craft / build / goals / sleep / summary /
// elevator / help — homestead edition (no shops, no gold).

import { useState } from 'react';
import { ITEMS } from '../data/items';
import { spriteUrl } from '../engine/sprites';
import { canCraft, craft, eatFromSlot, recipesFor } from '../game/crafting';
import { doSleep } from '../game/game';
import { goalProgress, visibleGoals } from '../game/goals';
import { countItem } from '../game/inventory';
import { enterMine } from '../game/mine';
import { resetSave } from '../game/state';
import type { Game } from '../game/runtime';
import { SEASON_NAMES } from '../game/clock';
import { TIER_FLAVOR, TIER_NAMES, TOOL_INFO } from '../data/recipes';
import { dropSelected } from '../game/game';
import { addItem, removeFromSlot } from '../game/inventory';
import { bump } from '../game/goals';
import { SKILLS, SKILL_ICON, xpIntoLevel } from '../game/skills';
import { traderStock, traderBuy, traderSell } from '../game/trader';
import { QUALITY_MULT } from '../data/items';
import { TOOL_DUR, type Recipe } from '../types';

function Overlay({ title, g, children }: { title: string; g: Game; children: React.ReactNode }) {
  return (
    <div className="farm-overlay" onClick={() => { g.dialog = null; g.notify(); }}>
      <div className="farm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="farm-dialog-head">
          <span>{title}</span>
          <button className="farm-hud-btn" onClick={() => { g.dialog = null; g.notify(); }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MatList({ g, mats }: { g: Game; mats: { id: string; qty: number }[] }) {
  return (
    <span className="farm-mats">
      {mats.map((m) => {
        const have = countItem(g.save, m.id);
        const name = ITEMS[m.id]?.name ?? m.id;
        return (
          <span key={m.id} className={have >= m.qty ? 'ok' : 'missing'} title={name}>
            <img src={spriteUrl(ITEMS[m.id]?.sprite ?? `i_${m.id}`)} alt={name} />
            <span className="farm-mat-name">{name}</span> {have}/{m.qty}
          </span>
        );
      })}
    </span>
  );
}

function RecipeRow({ g, r }: { g: Game; r: Recipe }) {
  const icon = typeof r.out === 'string' ? (ITEMS[r.out]?.sprite ?? `i_${r.out}`) : `t_${r.out.tool}`;
  const ok = canCraft(g, r);
  const owned = typeof r.out !== 'string' && (g.save.player.tools[r.out.tool] as number) >= r.out.tier;
  if (owned) return null;
  return (
    <button className="farm-shop-row" disabled={!ok} onClick={() => craft(g, r)}>
      <img src={spriteUrl(icon)} alt="" />
      <span>{r.name}{r.desc ? <span className="farm-dim"> — {r.desc}</span> : null}</span>
      <MatList g={g} mats={r.mats} />
    </button>
  );
}

const STATION_TITLES: Record<string, string> = {
  hand: '🧺 Field Crafting', bench: '🔨 Crafting Bench', anvil: '⚒️ Anvil', campfire: '🔥 Campfire',
};

function CraftDialog({ g }: { g: Game }) {
  const station = g.craftStation ?? 'hand';
  const recipes = recipesFor(g, station);
  const hand = station !== 'hand' ? [] : recipesFor(g, 'hand');
  const list = station === 'hand' ? hand : recipes;
  return (
    <Overlay title={STATION_TITLES[station]} g={g}>
      <div className="farm-shop-list">
        {list.length === 0 && <div className="farm-dim">No recipes known here yet — new finds unlock new recipes.</div>}
        {list.map((r) => <RecipeRow key={r.id} g={g} r={r} />)}
      </div>
      {station === 'campfire' && <div className="farm-dim">Cooked food restores far more energy than raw forage.</div>}
    </Overlay>
  );
}

const BOTTLE_NOTE = '“Three shards, scattered far: one sleeps in gem-veins far below, one rides in a trader’s pack, one the night itself carries. When three shards sing, the still stone in the old forest wakes — and the Below opens.” — the last keeper';

function InventoryDialog({ g }: { g: Game }) {
  const s = g.save;
  const [picked, setPicked] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const slot = picked !== null ? s.inventory[picked] : null;
  const def = slot ? ITEMS[slot.id] : null;
  const handRecipes = recipesFor(g, 'hand');
  return (
    <Overlay title="🎒 Backpack" g={g}>
      <div className="farm-inv-grid">
        {s.inventory.map((sl, i) => (
          <button
            key={i}
            className={`farm-slot${picked === i ? ' sel' : ''}${!sl ? ' empty' : ''}`}
            onClick={() => setPicked(sl ? i : null)}
          >
            {sl && <img src={spriteUrl(ITEMS[sl.id]?.sprite ?? `i_${sl.id}`)} alt={sl.id} draggable={false} />}
            {sl && <span className="farm-slot-badge">{sl.qty}</span>}
            {sl?.q === 1 && <img className="farm-slot-star" src={spriteUrl('star_s')} alt="" />}
            {sl?.q === 2 && <img className="farm-slot-star" src={spriteUrl('star_g')} alt="" />}
          </button>
        ))}
      </div>
      {slot && def && (
        <div className="farm-inv-actions">
          <span>{def.name}{slot.q ? (slot.q === 2 ? ' ★' : ' ☆') : ''}</span>
          <span className="farm-inv-btns">
            {def.edible && <button className="farm-btn" onClick={() => { eatFromSlot(g, picked!); setPicked(null); }}>Eat (+{def.edible}⚡)</button>}
            {slot.id === 'old_bottle' && (
              <button className="farm-btn" onClick={() => { setNote(BOTTLE_NOTE); if (!g.save.stats.bottlesRead) bump(g, 'bottlesRead'); }}>Read</button>
            )}
            <button className="farm-btn" onClick={() => { g.save.player.selectedSlot = 100 + picked!; g.dialog = null; g.notify(); }}>Hold</button>
            <button className="farm-btn" onClick={() => { g.save.player.selectedSlot = 100 + picked!; dropSelected(g, false); g.notify(); }}>Drop 1</button>
          </span>
        </div>
      )}
      {note && <div className="farm-note">{note}</div>}
      {handRecipes.length > 0 && (
        <>
          <div className="farm-shop-sub">Craft anywhere</div>
          <div className="farm-shop-list">
            {handRecipes.map((r) => <RecipeRow key={r.id} g={g} r={r} />)}
          </div>
        </>
      )}
    </Overlay>
  );
}

function GoalsDialog({ g }: { g: Game }) {
  const goals = visibleGoals(g);
  const done = g.save.goalsDone.length;
  return (
    <Overlay title={`📜 Journal (${done} done)`} g={g}>
      <div className="farm-shop-sub">Skills</div>
      <div className="farm-skills">
        {SKILLS.map((k) => {
          const { level, have, need } = xpIntoLevel(g.save.player.skills[k] ?? 0);
          return (
            <div key={k} className="farm-skill" title={`${k}: ${have}/${need} xp to next`}>
              <span>{SKILL_ICON[k]} {level}</span>
              <div className="farm-quest-bar"><div style={{ width: `${(have / need) * 100}%` }} /></div>
            </div>
          );
        })}
      </div>
      <div className="farm-shop-sub">Goals</div>
      {goals.length === 0 && <div className="farm-dim">You’ve done everything… for now. 🌟</div>}
      {goals.filter((d) => !d.secret).map((d) => {
        const p = goalProgress(g, d.id);
        return (
          <div key={d.id} className="farm-quest">
            <div className="farm-quest-title">{d.title}</div>
            <div className="farm-dim">{d.text}</div>
            {d.hint && <div className="farm-hint">💡 {d.hint}</div>}
            <div className="farm-quest-bar"><div style={{ width: `${(p.have / p.need) * 100}%` }} /></div>
            <div className="farm-dim">{p.have}/{p.need}</div>
          </div>
        );
      })}
      {goals.some((d) => d.secret) && <div className="farm-shop-sub">??? — things the world is hiding</div>}
      {goals.filter((d) => d.secret).map((d) => {
        const p = goalProgress(g, d.id);
        return (
          <div key={d.id} className="farm-quest secret">
            <div className="farm-quest-title">???</div>
            <div className="farm-hint">{d.text}</div>
            <div className="farm-quest-bar"><div style={{ width: `${(p.have / p.need) * 100}%` }} /></div>
          </div>
        );
      })}
    </Overlay>
  );
}

function TraderDialog({ g }: { g: Game }) {
  const s = g.save;
  const sellable = s.inventory
    .map((slot, i) => ({ slot, i }))
    .filter((x) => x.slot && (ITEMS[x.slot.id]?.sell ?? 0) > 0);
  return (
    <Overlay title={`🧳 The Wandering Trader — 💰 ${s.player.gold.toLocaleString()}g`} g={g}>
      <div className="farm-dim">“Everything's for sale, friend. Even the strange things. ESPECIALLY the strange things.”</div>
      <div className="farm-shop-sub">For sale today</div>
      <div className="farm-shop-list">
        {traderStock(g).map((e, n) => (
          <button key={n} className="farm-shop-row" disabled={s.player.gold < e.price} onClick={() => traderBuy(g, e)}>
            <img src={spriteUrl(ITEMS[e.id]?.sprite ?? `i_${e.id}`)} alt="" />
            <span>{ITEMS[e.id]?.name}{e.qty > 1 ? ` ×${e.qty}` : ''}</span>
            <span className="farm-gold">{e.price}g</span>
          </button>
        ))}
      </div>
      <div className="farm-shop-sub">They'll buy (tap to sell the stack)</div>
      <div className="farm-shop-list">
        {sellable.length === 0 && <div className="farm-dim">Nothing they want right now.</div>}
        {sellable.map(({ slot, i }) => slot && (
          <button key={i} className="farm-shop-row" onClick={() => traderSell(g, i, slot.qty)}>
            <img src={spriteUrl(ITEMS[slot.id].sprite)} alt="" />
            <span>{ITEMS[slot.id].name} ×{slot.qty}{slot.q ? (slot.q === 2 ? ' ★' : ' ☆') : ''}</span>
            <span className="farm-gold">+{Math.floor(ITEMS[slot.id].sell * QUALITY_MULT[slot.q ?? 0]) * slot.qty}g</span>
          </button>
        ))}
      </div>
    </Overlay>
  );
}

function ChestDialog({ g }: { g: Game }) {
  const s = g.save;
  const at = g.chestAt;
  if (at === null) return null;
  const [scene, idxStr] = at.split(':');
  const idx = Number(idxStr);
  const objs = scene === 'house' ? s.houseObjects : s.farm.objects;
  const store = s.chests[at] ?? (s.chests[at] = []);
  const isBag = objs[idx]?.meta === 'bag';
  const toChest = (i: number) => {
    const slot = s.inventory[i];
    if (!slot || store.filter(Boolean).length >= 24) return;
    const taken = removeFromSlot(s, i, slot.qty);
    if (taken) store.push(taken);
    g.dirty = true; g.notify();
  };
  const toInv = (n: number) => {
    const slot = store[n];
    if (!slot) return;
    if (!addItem(s, slot.id, slot.qty, slot.q ?? 0)) return;
    store.splice(n, 1);
    if (isBag && store.filter(Boolean).length === 0) {
      delete objs[idx];
      delete s.chests[at];
      g.dialog = null;
      g.chestAt = null;
    }
    g.dirty = true; g.notify();
  };
  return (
    <Overlay title={isBag ? '🎒 Your dropped things' : '📦 Storage Chest'} g={g}>
      <div className="farm-shop-cols">
        <div>
          <div className="farm-shop-sub">Backpack (tap → store)</div>
          <div className="farm-shop-list">
            {s.inventory.map((slot, i) => slot && (
              <button key={i} className="farm-shop-row" onClick={() => toChest(i)}>
                <img src={spriteUrl(ITEMS[slot.id]?.sprite ?? `i_${slot.id}`)} alt="" />
                <span>{ITEMS[slot.id]?.name} ×{slot.qty}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="farm-shop-sub">Chest (tap → take)</div>
          <div className="farm-shop-list">
            {store.filter(Boolean).length === 0 && <div className="farm-dim">Empty.</div>}
            {store.map((slot, n) => slot && (
              <button key={n} className="farm-shop-row" onClick={() => toInv(n)}>
                <img src={spriteUrl(ITEMS[slot.id]?.sprite ?? `i_${slot.id}`)} alt="" />
                <span>{ITEMS[slot.id]?.name} ×{slot.qty}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {!isBag && <div className="farm-dim">Things in chests are safe even on your worst nights.</div>}
    </Overlay>
  );
}

function SleepDialog({ g }: { g: Game }) {
  return (
    <Overlay title="🛏️ Rest" g={g}>
      <div className="farm-sleep-msg">Sleep until morning? Watered crops grow, fed animals produce, and the world renews itself.</div>
      <div className="farm-inv-btns">
        <button className="farm-btn primary" onClick={() => doSleep(g, false)}>Sleep 💤</button>
        <button className="farm-btn" onClick={() => { g.dialog = null; g.notify(); }}>Not yet</button>
      </div>
    </Overlay>
  );
}

function SummaryDialog({ g }: { g: Game }) {
  const s = g.save;
  const sum = s.lastSummary;
  return (
    <Overlay title={`🌅 ${SEASON_NAMES[s.calendar.season]} ${s.calendar.day}, Year ${s.calendar.year}`} g={g}>
      {sum && sum.lines.length > 0 ? (
        <div className="farm-summary">
          {sum.lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      ) : <div className="farm-dim">A quiet night. A fresh day awaits!</div>}
      <button className="farm-btn primary" onClick={() => { g.dialog = null; g.notify(); }}>Good morning ☀️</button>
    </Overlay>
  );
}

function NewToolDialog({ g }: { g: Game }) {
  const nt = g.newTool;
  if (!nt) return null;
  return (
    <Overlay title={`⚒️ New tool: ${nt.name}!`} g={g}>
      <div className="farm-newtool">
        <img src={spriteUrl(`t_${nt.tool}`)} alt={nt.tool} />
        <div>
          <div className="farm-quest-title">{TIER_NAMES[nt.tier]} {nt.tool}</div>
          <div className="farm-sleep-msg">{TOOL_INFO[nt.tool]}</div>
          <div className="farm-hint">{TIER_FLAVOR[nt.tier]}</div>
          <div className="farm-dim">Durability: {TOOL_DUR[nt.tier]} uses — it will wear out and break, so keep materials handy.</div>
        </div>
      </div>
      <button className="farm-btn primary" onClick={() => { g.dialog = null; g.newTool = null; g.notify(); }}>
        Got it — it’s in my hands!
      </button>
    </Overlay>
  );
}

function ElevatorDialog({ g }: { g: Game }) {
  const stops: number[] = [0];
  for (let f = 5; f <= g.save.mine.deepestFloor; f += 5) stops.push(f);
  return (
    <Overlay title="🛗 Mine Elevator" g={g}>
      <div className="farm-elevator">
        {stops.map((f) => (
          <button
            key={f}
            className={`farm-btn${g.mineFloor?.floor === f ? ' primary' : ''}`}
            onClick={() => { g.dialog = null; enterMine(g, f); }}
          >{f === 0 ? 'Entrance' : `Floor ${f}`}</button>
        ))}
      </div>
    </Overlay>
  );
}

function SettingsDialog({ g }: { g: Game }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const s = g.save;
  const reset = async () => {
    if (!armed) { setArmed(true); return; }
    setBusy(true);
    try {
      await resetSave();
      location.reload();
    } catch (e) {
      setErr(String((e as Error).message ?? e));
      setBusy(false);
      setArmed(false);
    }
  };
  return (
    <Overlay title="⚙️ Settings" g={g}>
      <div className="farm-help">
        <div className="farm-shop-sub">Your farm</div>
        <div>{SEASON_NAMES[s.calendar.season]} {s.calendar.day}, year {s.calendar.year} · 💰 {s.player.gold.toLocaleString()}</div>
        <div className="farm-shop-sub">Start over</div>
        <div>Deletes this farm for good — crops, buildings, tools, gold, everything — and starts a brand-new one. This cannot be undone.</div>
        {err && <div style={{ color: 'var(--red, #f87171)' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className={`farm-btn${armed ? ' primary' : ''}`} onClick={reset} disabled={busy}>
            {busy ? 'Resetting…' : armed ? 'Yes, delete my farm and restart' : 'Reset game'}
          </button>
          {armed && !busy && <button className="farm-btn" onClick={() => setArmed(false)}>Cancel</button>}
        </div>
      </div>
    </Overlay>
  );
}

function HelpDialog({ g }: { g: Game }) {
  return (
    <Overlay title="❓ How to Play" g={g}>
      <div className="farm-help">
        <div className="farm-shop-sub">You start with nothing</div>
        <div>⛺ Just you, a tent, and the wilderness. <b>Tap branches, stone piles, weeds, bushes, and mushrooms</b> to gather with your bare hands — that's how everything begins.</div>
        <div>💡 <b>Recipes are discovered</b>: the first time you pick up a new material, related recipes appear. Craft from your 🎒 backpack anywhere, or at stations you place (bench, campfire, anvil).</div>
        <div className="farm-shop-sub">Controls</div>
        <div>👆 <b>Tap a tile</b> — walk there and use what you're holding. Bottom bar: tools first, items below. Desktop: <b>WASD</b> walks, <b>1–8</b> pick tools.</div>
        <div className="farm-shop-sub">Growing & building</div>
        <div>🌱 Seeds come from weeds, bushes, and harvests. Till with a hoe, plant, water daily (refill the can at any water). Crops only grow on watered days.</div>
        <div>🏗️ Buildings are <b>kits you craft at the bench</b> and place ANYWHERE: hold the kit and tap open ground — the tapped tile becomes the front door. Bridge planks work the same, laid on water one tile at a time. Hardwood comes from old stumps.</div>
        <div>🛏️ Tap your tent (or bed) to sleep: the day ends, everything grows, and the game saves.</div>
        <div className="farm-shop-sub">Beyond</div>
        <div>⛏️ Build the bridge to reach the boarded cave — a pickaxe opens it. Ore + furnace → bars; bars + anvil → better tools. Special finds (hardwood, quartz, emeralds) unlock the best gear.</div>
        <div>🐄 Wild animals wander in over time. <b>Hold food and tap them</b> to tame (they need a coop/barn to move into). Two happy animals may surprise you with a baby.</div>
        <div className="farm-shop-sub">Survival</div>
        <div>🌙 After dark, you may not be alone. A <b>sword</b> helps; <b>fences and gates</b> help more (gates only open for you). If your energy hits zero you <b>collapse and drop half your things</b> where you fell — walk back and reclaim them, or keep valuables in a 📦 <b>storage chest</b>.</div>
        <div>⛏️ <b>Pickaxe picks things back up</b>: stations, fences, chests (when empty) — even whole buildings (tap their door) pack back into kits so you can move them. Desktop: <b>Q drops</b> the held item (drops fade after a minute).</div>
        <div>🧳 Some mornings a <b>wandering trader</b> camps by your tent — the only one around who deals in <b>gold</b>. Sell your surplus; browse their stock, it changes daily. Sometimes they carry… unusual things.</div>
        <div>📜 The journal tracks goals and your <b>skill levels</b> (every skill grows as you use it, with perks each level). And the <b>???</b> entries? The world is keeping secrets. Explore. Read what you find. Pay attention at night.</div>
      </div>
    </Overlay>
  );
}

export function FarmDialogs({ g }: { g: Game }) {
  switch (g.dialog) {
    case 'inventory': return <InventoryDialog g={g} />;
    case 'craft': return <CraftDialog g={g} />;
    case 'goals': return <GoalsDialog g={g} />;
    case 'sleep': return <SleepDialog g={g} />;
    case 'summary': return <SummaryDialog g={g} />;
    case 'elevator': return <ElevatorDialog g={g} />;
    case 'newtool': return <NewToolDialog g={g} />;
    case 'trader': return <TraderDialog g={g} />;
    case 'chest': return <ChestDialog g={g} />;
    case 'help': return <HelpDialog g={g} />;
    case 'settings': return <SettingsDialog g={g} />;
    default: return null;
  }
}
