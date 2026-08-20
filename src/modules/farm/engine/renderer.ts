// Canvas renderer: terrain → buildings → y-sorted entities → particles →
// weather → night tint → fishing overlay. All coords in virtual pixels
// (16px tiles); FarmView sets the integer zoom transform.

import { BUILDING_BY_ID, SCENES } from '../data/maps';
import { ITEMS } from '../data/items';
import { TRADER_SPOT, traderHere } from '../game/trader';
import { CROPS, cropStage } from '../data/crops';
import { cropDead, cropReady } from '../game/clock';
import { curScene, tileOf, type Game } from '../game/runtime';
import { T, type WorldObject } from '../types';
import { hash2, sprite } from './sprites';

const OBJ_SPRITE: Partial<Record<WorldObject['kind'], string>> = {
  stump: 'stump', rock: 'rock', bigrock: 'bigrock', weed: 'weed',
  bed: 'bed', trough: 'trough',
  sprinkler: 'sprinkler', scarecrow: 'scarecrow', ladder: 'ladder', elevator: 'elevator',
  minerock: 'mrock', sign: 'sign',
  bench: 'bench', anvil: 'anvil', campfire: 'campfire_lit',
  mushroom: 'mushroom_obj', branch: 'branch_obj', stonepile: 'stonepile',
  fence: 'fence', gate: 'gate', gravestone: 'gravestone', starstone: 'starstone_obj',
};

function oreSprite(o: WorldObject): string {
  if (o.kind === 'gemrock') return 'rock_gem';
  switch (o.ore) {
    case 'copper_ore': return 'rock_copper';
    case 'iron_ore': return 'rock_iron';
    case 'gold_ore': return 'rock_gold';
    default: return 'mrock';
  }
}

function drawAnchored(ctx: CanvasRenderingContext2D, cv: HTMLCanvasElement, tx: number, ty: number) {
  ctx.drawImage(cv, Math.round(tx * 16 + 8 - cv.width / 2), Math.round(ty * 16 + 16 - cv.height));
}

export function render(ctx: CanvasRenderingContext2D, g: Game, vw: number, vh: number, time: number) {
  const s = g.save;
  const v = curScene(g);
  const season = v.id === 'mine' || !v.outdoor ? 0 : s.calendar.season;

  // ---- camera: follow player, clamp; small scenes center ----
  const worldW = v.w * 16, worldH = v.h * 16;
  let camX = Math.round(g.px - vw / 2), camY = Math.round(g.py - 8 - vh / 2);
  camX = worldW <= vw ? Math.round((worldW - vw) / 2) : Math.max(0, Math.min(worldW - vw, camX));
  camY = worldH <= vh ? Math.round((worldH - vh) / 2) : Math.max(0, Math.min(worldH - vh, camY));
  g.camX = camX; g.camY = camY;

  ctx.fillStyle = '#0a0812';
  ctx.fillRect(0, 0, vw, vh);
  ctx.save();
  ctx.translate(-camX, -camY);

  const x0 = Math.max(0, Math.floor(camX / 16)), x1 = Math.min(v.w - 1, Math.ceil((camX + vw) / 16));
  const y0 = Math.max(0, Math.floor(camY / 16)), y1 = Math.min(v.h - 1, Math.ceil((camY + vh) / 16));
  const waterFrame = Math.floor(time / 600) % 2;

  // ---- terrain ----
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * v.w + x;
      const t = v.tiles[i];
      const px = x * 16, py = y * 16;
      switch (t) {
        case T.GRASS: {
          ctx.drawImage(sprite(`grass${Math.floor(hash2(x, y, 3) * 3)}`, season), px, py);
          // sprinkle wildflowers on open outdoor grass (not in winter)
          if (v.outdoor && season !== 3 && !v.objects[i] && hash2(x, y, 21) < 0.06) {
            ctx.drawImage(sprite(`flower${Math.floor(hash2(x, y, 22) * 2)}`, season), px, py);
          }
          break;
        }
        case T.DIRT: ctx.drawImage(sprite('dirt', season), px, py); break;
        case T.TILLED:
          ctx.drawImage(sprite(s.farm.watered[i] ? 'tilled_wet' : 'tilled', season), px, py);
          break;
        case T.PATH: ctx.drawImage(sprite('path', season), px, py); break;
        case T.WATER: ctx.drawImage(sprite(`water${waterFrame}`, season), px, py); break;
        case T.FLOOR: ctx.drawImage(sprite('floor', 0), px, py); break;
        case T.BRIDGE: ctx.drawImage(sprite('bridge', 0), px, py); break;
        case T.ROCKFLOOR:
          ctx.drawImage(sprite(g.mineFloor?.floor === -1 ? 'voidfloor' : 'rockfloor', 0), px, py);
          break;
        case T.WALL:
          if (v.id === 'mine') {
            ctx.drawImage(sprite('rockfloor', 0), px, py);
            ctx.fillStyle = 'rgba(6,6,14,0.78)';
            ctx.fillRect(px, py, 16, 16);
          } else if (v.outdoor) {
            ctx.drawImage(sprite(`grass${Math.floor(hash2(x, y, 3) * 3)}`, season), px, py);
            ctx.fillStyle = 'rgba(12,10,20,0.42)';
            ctx.fillRect(px, py, 16, 16);
          } else {
            ctx.drawImage(sprite('wall', 0), px, py);
          }
          break;
        default:
          ctx.fillStyle = '#06060a';
          ctx.fillRect(px, py, 16, 16);
      }
    }
  }

  // ---- static visuals (the cave) + player-placed buildings ----
  if (v.id === 'farm') {
    for (const b of SCENES.farm.buildings) {
      const name = b.sprite === 'cave_ext' ? (s.unlocks.mine ? 'cave_ext_open' : 'cave_ext_closed') : b.sprite;
      ctx.drawImage(sprite(name, season), b.x * 16, b.y * 16);
    }
    for (const [id, door] of Object.entries(s.placed)) {
      const def = BUILDING_BY_ID[id];
      if (!def) continue;
      const x0 = door.x - Math.floor(def.w / 2), y0 = door.y - def.h + 1;
      ctx.drawImage(sprite(def.sprite, season), x0 * 16, y0 * 16);
    }
  }

  // ---- collect y-sorted entities ----
  type Ent = { y: number; draw: () => void };
  const ents: Ent[] = [];

  for (const [k, o] of Object.entries(v.objects)) {
    const i = Number(k);
    const x = i % v.w, y = Math.floor(i / v.w);
    if (x < x0 - 2 || x > x1 + 2 || y < y0 - 2 || y > y1 + 3) continue;
    if (o.kind === 'cave' || o.kind === 'site') continue;
    // a door with coordinates in the mine is the way out — show it
    if (o.kind === 'door') {
      if (v.id === 'mine' && o.meta?.includes(':')) {
        const cv = sprite('gate', 0);
        ents.push({ y: y * 16 + 16, draw: () => drawAnchored(ctx, cv, x, y) });
      }
      continue;
    }
    let name: string | null = null;
    if (o.kind === 'tree') name = `tree${o.stage ?? 2}`;
    else if (o.kind === 'altar') name = (s.stats.bossKills ?? 0) > 0 ? 'altar_active' : 'altar';
    else if (o.kind === 'bush') name = o.stage === 1 ? 'bush_berry' : 'bush';
    else if (o.kind === 'tent') name = o.meta ? null : 'tent';
    else if (o.kind === 'chest') name = s.stats[`chest_${o.meta}`] ? 'chest_open' : 'chest';
    else if (o.kind === 'furnace') name = o.smelting ? 'furnace_lit' : 'furnace';
    else if (o.kind === 'orerock' || o.kind === 'gemrock') name = oreSprite(o);
    else name = OBJ_SPRITE[o.kind] ?? null;
    if (!name) continue;
    const cv = sprite(name, season);
    ents.push({ y: y * 16 + 16, draw: () => drawAnchored(ctx, cv, x, y) });
  }

  // crops (farm only)
  if (v.id === 'farm') {
    for (const [k, c] of Object.entries(s.farm.crops)) {
      const i = Number(k);
      const x = i % v.w, y = Math.floor(i / v.w);
      if (x < x0 || x > x1 || y < y0 || y > y1 + 2) continue;
      const def = CROPS[c.id];
      if (!def) continue;
      const name = cropDead(c) ? 'c_dead' : `${def.spriteBase}${cropStage(def, c.daysGrown)}`;
      const cv = sprite(name, season);
      ents.push({
        y: y * 16 + 15, draw: () => {
          drawAnchored(ctx, cv, x, y);
          if (cropReady(c)) {
            const f = Math.floor(time / 350) % 4;
            if (f < 2) ctx.drawImage(sprite(`sparkle${f}`, 0), x * 16 + 10, y * 16 - 2);
          }
        },
      });
    }
  }

  // animals in coop/barn (babies draw at half size)
  if (v.id === 'coop' || v.id === 'barn') {
    const frame = Math.floor(time / 500) % 2;
    for (const a of s.animals) {
      const rt = g.animalsRt[a.id];
      if (!rt || a.home !== v.id) continue;
      const cv = sprite(`${a.kind}${frame}`, 0);
      const baby = !!a.babyDays;
      ents.push({
        y: rt.y * 16 + 16, draw: () => {
          if (baby) {
            ctx.drawImage(cv, Math.round(rt.x * 16 + 8 - cv.width / 4), Math.round(rt.y * 16 + 16 - cv.height / 2), Math.round(cv.width / 2), Math.round(cv.height / 2));
          } else {
            drawAnchored(ctx, cv, rt.x, rt.y);
          }
          if (a.produceReady && !baby) {
            const bob = Math.sin(time / 300) * 1.5;
            ctx.drawImage(sprite('exclaim', 0), rt.x * 16, rt.y * 16 - cv.height - 6 + bob);
          }
        },
      });
    }
  }

  // wild animals roaming the homestead
  if (v.id === 'farm') {
    const frame = Math.floor(time / 550) % 2;
    for (const a of s.wild) {
      if (a.x < x0 - 2 || a.x > x1 + 2 || a.y < y0 - 2 || a.y > y1 + 2) continue;
      const cv = sprite(`${a.kind}${frame}`, 0);
      ents.push({
        y: a.y * 16 + 16, draw: () => {
          drawAnchored(ctx, cv, a.x, a.y);
        },
      });
    }
  }

  // slimes (and worse)
  if (g.mineFloor) {
    const frame = Math.floor(time / 400) % 2;
    for (const sl of g.mineFloor.slimes) {
      const cv = sprite(sl.boss ? `boss_gloom${frame}` : `slime${frame}`, 0);
      ents.push({
        y: sl.y * 16 + 16, draw: () => {
          drawAnchored(ctx, cv, sl.x, sl.y);
        },
      });
    }
  }

  // night shades on the farm
  if (v.id === 'farm' && g.monsters.length) {
    const frame = Math.floor(time / 350) % 2;
    for (const m of g.monsters) {
      const cv = sprite(`shade${frame}`, 0);
      ents.push({
        y: m.y * 16 + 16, draw: () => {
          ctx.globalAlpha = 0.82 + Math.sin(time / 260) * 0.12;
          drawAnchored(ctx, cv, m.x, m.y);
          ctx.globalAlpha = 1;
        },
      });
    }
  }

  // the trader, on days they camp here
  if (v.id === 'farm' && traderHere(g)) {
    const frame = Math.floor(time / 600) % 2;
    const cv = sprite(`trader${frame}`, 0);
    ents.push({
      y: TRADER_SPOT.y * 16 + 16, draw: () => {
        drawAnchored(ctx, cv, TRADER_SPOT.x, TRADER_SPOT.y);
        const bob = Math.sin(time / 320) * 1.5;
        ctx.drawImage(sprite('exclaim', 0), TRADER_SPOT.x * 16, TRADER_SPOT.y * 16 - cv.height - 6 + bob);
      },
    });
  }

  // dropped items, fading out near the end of their minute
  if (v.id === 'farm') {
    for (const d of g.drops) {
      const icon = sprite(ITEMS[d.id]?.sprite ?? `i_${d.id}`, 0);
      ents.push({
        y: d.y * 16 + 15, draw: () => {
          ctx.globalAlpha = d.t > 50000 ? Math.max(0.2, 1 - (d.t - 50000) / 10000) : 1;
          const bob = Math.sin((time + d.x * 97) / 300) * 1.5;
          ctx.drawImage(icon, d.x * 16 + 4, d.y * 16 + 2 + bob, 8, 8);
          ctx.globalAlpha = 1;
        },
      });
    }
  }

  // player
  {
    const dirChar = ['d', 'l', 'r', 'u'][s.player.facing];
    const frame = g.path.length ? 1 + (Math.floor(g.anim / 140) % 2) : 0;
    const cv = sprite(`player_${dirChar}${frame}`, 0);
    const blink = g.invulnT > 0 && Math.floor(time / 100) % 2 === 0;
    ents.push({
      y: g.py, draw: () => {
        if (blink) ctx.globalAlpha = 0.5;
        ctx.drawImage(cv, Math.round(g.px - 8), Math.round(g.py - 24));
        ctx.globalAlpha = 1;
        if (g.fishing && (g.fishing.phase === 'wait' || g.fishing.phase === 'bite')) {
          const fx = (g.fishing.at % v.w) * 16 + 4, fy = Math.floor(g.fishing.at / v.w) * 16 + 2;
          ctx.drawImage(sprite('bobber', 0), fx, fy + Math.sin(time / 250) * 1.5);
          if (g.fishing.phase === 'bite') {
            ctx.drawImage(sprite('exclaim', 0), Math.round(g.px - 8), Math.round(g.py - 42));
          }
        }
      },
    });
  }

  ents.sort((a, b) => a.y - b.y);
  for (const e of ents) e.draw();

  // ---- particles ----
  for (const p of g.particles) {
    const a = Math.max(0, Math.min(1, p.life / 400));
    ctx.globalAlpha = a;
    if (p.kind === 'sparkle') {
      ctx.drawImage(sprite(`sparkle${Math.floor(time / 200) % 2}`, 0), Math.round(p.x - 4), Math.round(p.y - 4));
    } else {
      ctx.fillStyle = p.kind === 'chip' ? '#8b8ba3' : p.kind === 'leaf' ? '#63c74d' : '#8fd3e8';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // ---- weather (screen space) ----
  if (v.outdoor && s.calendar.weather === 'rain') {
    ctx.strokeStyle = 'rgba(143,211,232,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let n = 0; n < 60; n++) {
      const rx = (n * 53 + ((time * 0.35) | 0) * (7 + (n % 5))) % (vw + 20) - 10;
      const ry = (n * 97 + ((time * 0.9) | 0)) % (vh + 20) - 10;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 2, ry + 7);
    }
    ctx.stroke();
  }
  if (v.outdoor && s.calendar.weather === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let n = 0; n < 40; n++) {
      const rx = (n * 61 + Math.sin(time / 900 + n) * 14 + time * 0.02 * (1 + (n % 3))) % vw;
      const ry = (n * 83 + time * 0.03 * (1 + (n % 4))) % vh;
      ctx.fillRect(Math.round(rx), Math.round(ry), 2, 2);
    }
  }

  // ---- night tint (the mine is evenly lit — no vignette) ----
  if (v.outdoor) {
    const t = s.calendar.timeMin;
    let a = 0;
    if (t >= 1080) a = Math.min(0.55, ((t - 1080) / 300) * 0.55);
    else if (t < 420) a = 0.25 * (1 - (t - 360) / 60);
    if (a > 0.01) {
      ctx.fillStyle = `rgba(16,18,58,${a})`;
      ctx.fillRect(0, 0, vw, vh);
    }
  }

  // ---- fishing minigame overlay ----
  const f = g.fishing;
  if (f && (f.phase === 'play' || f.phase === 'done')) {
    const bx = vw - 30, by = Math.round(vh / 2 - 70), bh = 130;
    ctx.fillStyle = 'rgba(10,8,18,0.85)';
    ctx.fillRect(bx - 8, by - 8, 34, bh + 16);
    ctx.strokeStyle = '#54405c';
    ctx.strokeRect(bx - 8.5, by - 8.5, 35, bh + 17);
    // track
    ctx.fillStyle = '#1c2431';
    ctx.fillRect(bx, by, 12, bh);
    // catch bar
    ctx.fillStyle = f.phase === 'done' ? '#63c74d' : '#3e8948';
    ctx.fillRect(bx, by + Math.round(f.barPos * bh), 12, Math.round(f.barSize * bh));
    // fish
    const fishY = by + Math.round(f.fishPos * (bh - 8));
    ctx.drawImage(sprite('fish_shadow', 0), bx - 2, fishY);
    // progress column
    ctx.fillStyle = '#1c2431';
    ctx.fillRect(bx + 16, by, 5, bh);
    ctx.fillStyle = f.progress > 0.6 ? '#f4c542' : '#d97e28';
    const ph = Math.round(f.progress * bh);
    ctx.fillRect(bx + 16, by + bh - ph, 5, ph);
  }

  // ---- starving vignette: the edges of the world close in ----
  if (s.player.energy > 0 && s.player.energy <= 15) {
    const a = 0.25 + (1 - s.player.energy / 15) * 0.3 + Math.sin(time / 300) * 0.08;
    const grad = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.32, vw / 2, vh / 2, Math.max(vw, vh) * 0.72);
    grad.addColorStop(0, 'rgba(168,53,58,0)');
    grad.addColorStop(1, `rgba(168,53,58,${Math.max(0, Math.min(0.6, a))})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, vw, vh);
  }

  // ---- sleep fade ----
  if (g.sleeping) {
    ctx.fillStyle = 'rgba(4,3,10,0.85)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.drawImage(sprite('zzz', 0), Math.round(vw / 2 - 8), Math.round(vh / 2 - 20 + Math.sin(time / 400) * 3));
  }
}
