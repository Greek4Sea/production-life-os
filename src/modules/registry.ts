import type { ModuleManifest } from './types';
import { imessageAvailable, imessageTarget, sendIMessage } from '@/lib/imessage';
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
  async api(req, p) {
    // POST /api/mod/system/test-text — send a test iMessage to the saved number.
    if (req.method === 'POST' && p[0] === 'test-text') {
      try {
        const to = await imessageTarget();
        if (!to) return Response.json({ ok: false, error: 'Save a phone number first' }, { status: 400 });
        await sendIMessage(to, '👋 Life OS: task reminders will arrive here.');
        return Response.json({ ok: true });
      } catch (e) {
        return Response.json({ ok: false, error: String((e as Error).message ?? e) }, { status: 502 });
      }
    }
    if (req.method === 'GET' && p[0] === 'text-status') {
      return Response.json({ available: imessageAvailable(), to: await imessageTarget() });
    }
    return null;
  },
  get defaultSettings() { return { tz: getConfig().core.tz || 'UTC' }; },
};

// Adding a module = create its folder + one line here.
export const MODULES: ModuleManifest[] = [gcal, canvas, gmail, spotify, fitness, competitions, obsidian, vaultmirror, passwords, kairos, tasksModule, recipesModule, farmModule, system];

export function getModule(id: string): ModuleManifest | undefined {
  return MODULES.find((m) => m.id === id);
}
