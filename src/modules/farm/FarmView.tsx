'use client';

// Life OS Farm — client host: canvas + loop + input + DOM UI overlays.

import { useEffect, useReducer, useRef, useState } from 'react';
import { render } from './engine/renderer';
import { registerSheets } from './engine/sprites';
import { createGame, dropSelected, flushSave, handleTap, tick } from './game/game';
import { fishingTap } from './game/fishing';
import { walkTowards } from './game/movement';
import type { Game } from './game/runtime';
import { loadSave, newSave, storeSave } from './game/state';
import { CROPS_ART } from './sprites/cropsArt';
import { CHARS_ART } from './sprites/charactersArt';
import { DARK_ART } from './sprites/darkArt';
import { HOMESTEAD_ART } from './sprites/homesteadArt';
import { ITEMS_ART } from './sprites/itemsArt';
import { OBJECTS_ART } from './sprites/objectsArt';
import { TERRAIN } from './sprites/terrainArt';
import { FarmDialogs } from './ui/Dialogs';
import { Hotbar } from './ui/Hotbar';
import { Hud } from './ui/Hud';

const KEY_DIRS: Record<string, [number, number]> = {
  ArrowDown: [0, 1], ArrowUp: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  s: [0, 1], w: [0, -1], a: [-1, 0], d: [1, 0],
};

export function FarmView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [, force] = useReducer((n: number) => n + 1, 0);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    registerSheets(TERRAIN, CROPS_ART, OBJECTS_ART, CHARS_ART, ITEMS_ART, HOMESTEAD_ART, DARK_ART);
    (async () => {
      let save;
      try {
        save = await loadSave();
      } catch {
        if (alive) setPhase('error');
        return;
      }
      if (!alive) return;
      if (!save) {
        save = newSave();
        void storeSave(save).catch(() => {});
      }
      const game = createGame(save, force);
      if (save.meta.playMs < 1000) game.dialog = 'help'; // first visit → guide
      gameRef.current = game;
      setPhase('ready');
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (phase !== 'ready') return;
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const g = gameRef.current!;
    const ctx = canvas.getContext('2d')!;
    let zoom = 3, dpr = 1, vw = 384, vh = 256;
    let raf = 0, last = performance.now();
    let held = false;
    const keys = new Set<string>();

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      const r = wrap.getBoundingClientRect();
      zoom = Math.max(2, Math.min(5, Math.round((r.width * dpr) / (16 * 14))));
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      vw = canvas.width / zoom;
      vh = canvas.height / zoom;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const toTile = (e: PointerEvent): [number, number] => {
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) * dpr) / zoom + g.camX;
      const y = ((e.clientY - r.top) * dpr) / zoom + g.camY;
      return [Math.floor(x / 16), Math.floor(y / 16)];
    };
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      held = true;
      if (g.fishing) { fishingTap(g, true); return; }
      const [tx, ty] = toTile(e);
      handleTap(g, tx, ty);
    };
    const onUp = () => { held = false; };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    const onKey = (e: KeyboardEvent) => {
      if (g.dialog) return;
      if (KEY_DIRS[e.key]) { keys.add(e.key); e.preventDefault(); }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 8) { g.save.player.selectedSlot = n - 1; g.notify(); }
      if (e.key === 'q' || e.key === 'Q') dropSelected(g, e.shiftKey);
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);

    const onVis = () => {
      if (document.hidden) flushSave(g, true);
    };
    const onHide = () => flushSave(g, true);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);

    ctx.imageSmoothingEnabled = false;

    const loop = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      // keyboard walking
      if (!g.dialog && !g.path.length && !g.fishing) {
        for (const k of keys) {
          const d = KEY_DIRS[k];
          if (d) {
            walkTowards(g, g.save.player.x + d[0], g.save.player.y + d[1], false);
            break;
          }
        }
      }
      tick(g, dt, held, document.hidden);
      ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
      ctx.imageSmoothingEnabled = false;
      render(ctx, g, vw, vh, now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      flushSave(g);
    };
  }, [phase]);

  const g = gameRef.current;
  return (
    <div className="farm-root">
      <div className="farm-canvas-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} className="farm-canvas" />
        {phase === 'loading' && <div className="farm-center-msg">Loading the farm…</div>}
        {phase === 'error' && <div className="farm-center-msg">Couldn’t reach the farm — check the server.</div>}
        {phase === 'ready' && g && <Hud g={g} />}
        {phase === 'ready' && g && g.save.player.energy <= 25 && g.save.player.energy > 0 && (
          <div className="farm-hunger">
            ⚠️ {g.save.player.energy <= 12 ? 'ABOUT TO COLLAPSE — EAT NOW OR DROP YOUR THINGS!' : 'STARVING — eat something soon!'}
          </div>
        )}
        {phase === 'ready' && g && (
          <div className="farm-toasts">
            {g.toasts.map((t, i) => (
              <div key={i} className="farm-toast" style={{ opacity: t.t > 2800 ? 1 - (t.t - 2800) / 700 : 1 }}>
                {t.icon && <span>{t.icon} </span>}{t.text}
              </div>
            ))}
          </div>
        )}
      </div>
      {phase === 'ready' && g && <Hotbar g={g} />}
      {phase === 'ready' && g && <FarmDialogs g={g} />}
      <div className="farm-version">
        Life OS Farm {process.env.NEXT_PUBLIC_FARM_VERSION} · Life OS {process.env.NEXT_PUBLIC_OS_VERSION} · {process.env.NEXT_PUBLIC_FARM_HASH}
      </div>
    </div>
  );
}
