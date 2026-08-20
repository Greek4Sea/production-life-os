'use client';

// Top HUD: date/clock/weather chip, energy bar, goals + help + mine controls.

import { fmtClock, SEASON_NAMES } from '../game/clock';
import { changeScene } from '../game/game';
import { visibleGoals } from '../game/goals';
import type { Game } from '../game/runtime';

const WEATHER_ICON = { sun: '☀️', rain: '🌧️', snow: '❄️' };

export function Hud({ g }: { g: Game }) {
  const s = g.save;
  const c = s.calendar;
  const inMine = s.player.scene === 'mine';
  const energyPct = Math.round((s.player.energy / s.player.maxEnergy) * 100);
  const openGoals = visibleGoals(g).length;

  return (
    <div className="farm-hud">
      <div className="farm-hud-chip">
        <span>{WEATHER_ICON[c.weather]}</span>
        <span>{SEASON_NAMES[c.season]} {c.day}, Y{c.year}</span>
        <span className="farm-hud-clock">{fmtClock(c.timeMin)}</span>
      </div>
      <div className="farm-hud-chip">
        <span title="Gold">💰 {s.player.gold.toLocaleString()}</span>
        <button className="farm-hud-btn" onClick={() => { g.dialog = 'goals'; g.notify(); }} title="Journal">
          📜{openGoals > 0 && <span className="farm-hud-count">{openGoals}</span>}
        </button>
        <button className="farm-hud-btn" onClick={() => { g.dialog = 'help'; g.notify(); }} title="How to play">❓</button>
        {inMine && (
          <>
            <span>⛏️ {g.mineFloor?.floor === -1 ? 'the Below' : `floor ${g.mineFloor?.floor ?? 0}`}</span>
            <button className="farm-hud-btn" onClick={() => changeScene(g, 'farm', 39, 6)}>Leave</button>
          </>
        )}
      </div>
      <div className={`farm-energy${energyPct <= 25 ? ' low' : ''}`} title={`Energy ${s.player.energy}/${s.player.maxEnergy}`}>
        <div
          className="farm-energy-fill"
          style={{ width: `${energyPct}%`, background: energyPct < 25 ? '#e8574f' : energyPct < 55 ? '#f4c542' : '#63c74d' }}
        />
      </div>
    </div>
  );
}
