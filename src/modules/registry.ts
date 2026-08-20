import type { ModuleManifest } from './types';
import { getConfig } from '@/lib/config';
import { gcal } from './gcal';
import { canvas } from './canvas';
import { gmail } from './gmail';
import { spotify } from './spotify';
import { fitness } from './fitness';
import { competitions } from './competitions';
import { obsidian } from './obsidian';
import { vaultmirror } from './vaultmirror';
import { passwords } from './passwords';
import { kairos } from './kairos';
import { tasksModule } from './tasks';
import { recipesModule } from './recipes';
import { farmModule } from './farm';

// Pseudo-module: app-wide settings (timezone) live under /api/settings/system.
const system: ModuleManifest = {
  id: 'system', name: 'System', tileSize: 'sm',
  get defaultSettings() { return { tz: getConfig().core.tz || 'UTC' }; },
};

// Adding a module = create its folder + one line here.
export const MODULES: ModuleManifest[] = [gcal, canvas, gmail, spotify, fitness, competitions, obsidian, vaultmirror, passwords, kairos, tasksModule, recipesModule, farmModule, system];

export function getModule(id: string): ModuleManifest | undefined {
  return MODULES.find((m) => m.id === id);
}
