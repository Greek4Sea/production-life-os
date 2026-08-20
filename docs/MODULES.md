# Modules

Every feature in Life OS is a module: a folder under `src/modules/<id>/` with a server-side manifest, plus a tile on the dashboard and a page at `/m/<id>`. This document describes each shipped module and then how to write your own.

## Shipped modules

### Calendar (`gcal`)
Google Calendar agenda with a month view, multi-calendar support and an AI chat (`CalChat`) that can add events ("dinner with Sam Thursday 7pm").
- **Needs:** Google sign-in. Anthropic key for the chat.
- **Sync:** every 5 min. Pulls the calendar list and events from the selected calendars into `mod_gcal_*` tables and `day_items`.
- **Settings:** `calendarIds` (empty = your primary calendar only).

### Gmail AI inbox (`gmail`)
New mail is fetched, summarised and triaged by Claude, labelled in Gmail, and shown as a prioritised inbox with one-tap replies.
- **Needs:** Google sign-in (`gmail.modify` + `gmail.send`) and an Anthropic API key. Message content is sent to Anthropic for triage.
- **Sync:** every 1 min.
- **Settings:** `notifyImportant` (desktop notification for important mail), `keepSenders` (never archive), `importantSenders` (always flag). The "about me" text from setup is included in the prompt for better judgement.

### Tasks (`tasks`)
Google-Tasks-style todos: simple, scheduled, or repeating every N days. A due task fires a notification at its due time; completing a repeating task rolls it forward. A chat box turns freeform text into create/complete/delete operations via AI.
- **Needs:** local Ollama (`tasksModel`, default `qwen3.5:9b`) or Anthropic (`claude-haiku-4-5`) if you chose Anthropic-only.

### Recipes (`recipes`)
Describe a dish in plain words and it is saved structured: ingredients, steps, estimated kcal per serving, tags, and "lighter" calorie-cutting swaps.
- **Needs:** local Ollama (`recipesModel`) or Anthropic.

### Passwords (`passwords`)
A password manager backed by its own separate markdown vault folder. Paste messy text ("wifi at mom's is FooBar pw hunter2") and a model extracts service / username / password / URL / extras and writes one markdown file per entry, grouped by category.
- **Needs:** a vault folder (Settings → Passwords) and local Ollama (`passwordsModel`, default `llama3.2`) — or Anthropic if you chose Anthropic-only, in which case pasted text leaves your machine.
- Files are plain markdown, not encrypted; open them in Obsidian if you like.

### Notes (`obsidian`)
Reads an Obsidian vault straight from disk (a vault is just markdown), so it works whether or not Obsidian is running: browse, search, read and edit notes; daily-note shortcut. Paths are confined to the vault.
- **Needs:** a vault folder (Settings → Notes). Notes over 512 KB are not opened.

### Vault mirror (`vaultmirror`)
Continuously exports your Life OS data (fencing results, tasks, recipes, today's items…) as markdown into `<vault>/LifeOS/`. The vault is the durable, human-owned copy; the database stays the operational store.
- **Needs:** Notes configured. **Sync:** every 30 min.

### Canvas (`canvas`)
Courses, current grades, upcoming assignments (with submission state) and announcements from any Canvas LMS instance. Assignments become `day_items` and get a reminder notification before they are due.
- **Needs:** your school's Canvas base URL (e.g. `https://canvas.yourschool.edu`) and a personal access token (Canvas → Account → Settings → *New Access Token*).
- **Sync:** every 5 min.
- **Settings:** `remindHoursBefore` (default 12), `hideZeroPoint` (hide 0-point assignments).

### Spotify (`spotify`)
Now playing, recently played, top tracks, and in-app playback via the Web Playback SDK (desktop only; on macOS it can also control Spotify.app directly).
- **Needs:** a Spotify Developer app — see [INTEGRATIONS.md](INTEGRATIONS.md#spotify).

### Fitness (`fitness`)
A tile showing today's eaten / burned / deficit / streak, and a page that embeds your own fitness web app in an iframe. Data arrives through a tiny HTTP endpoint any app or script can POST to.
- **Needs:** nothing to show the tile; `fitness.appUrl` to embed a page. Endpoint details in [INTEGRATIONS.md](INTEGRATIONS.md#fitness-ingest-api).

### Fencing competitions (`competitions`)
Upcoming tournaments from askFRED and USA Fencing regional listings, filtered to your home states, with registration-close dates. Plus your own results and ratings, pushed by `scripts/fencingtracker_scrape.py`.
- **Needs:** home states (Settings → Fencing). Results need python3 — see [INTEGRATIONS.md](INTEGRATIONS.md#fencing-results-ingest).
- **Sync:** every 12 h.

### Farm (`farm`)
A Stardew-style pixel farming game. The whole save is one JSON row (`mod_farm_state`), written on sleep and autosave; client-authoritative, max 1 MB.

### Kairos (`kairos`)
Claude Code living inside the app. A tmux session (`kairos`) runs in its own workspace folder (`<data dir>/kairos` by default) and is streamed to an in-app terminal over a one-time-ticket WebSocket (`/kairos/term`, hosted by `server.js`). A file panel shows the workspace, jailed to that folder.
- **Needs:** macOS or Linux, `tmux`, and the Claude Code CLI (`claude`) — the wizard can install both. Sign in to Claude by typing `/login` inside the terminal.

### System (`system`)
Pseudo-module holding app-wide settings (timezone). No tile.

## Adding a module

Adding a module is a folder plus one line in the registry. Walk through it with a hypothetical `water` module that logs glasses of water.

### 1. Manifest — `src/modules/water/index.ts`

The contract lives in `src/modules/types.ts`:

```ts
export interface ModuleManifest {
  id: string;                     // 'water' — used in URLs, tables, settings
  name: string;                   // 'Water'
  tileSize: 'sm' | 'wide' | 'tall' | 'big';
  syncEveryMin?: number;          // how often sync() runs (default 30 when sync is set)
  sync?: () => Promise<void>;     // background job: pull data, write day_items, queue notifications
  api?: (req: Request, path: string[]) => Promise<Response | null>; // /api/mod/water/<path...>; null = 404
  dashboardData?: () => Promise<unknown>;  // summary blob for the tile
  defaultSettings?: Record<string, unknown>; // per-module settings (src/lib/settings.ts)
}
```

Rules of thumb:

- The manifest is **server-only**. Never import React here — API routes import it.
- `sync()` should be idempotent and quick (minutes of budget, not hours); throw on failure so the scheduler can record `lastError` and alert the user if it persists (`src/lib/tick.ts`).
- Anything with a date belongs in **`day_items`** (`moduleId`, `date`, `kind` = `event | task | metric | note`, `title`, optional `time`, `url`, `payload`, `externalId` for upserts). That is what the dashboard's "today" and the daily digest read.
- To notify, insert into `notifications` (or use `notify()` from `src/lib/notify.ts`) with a `scheduledFor` and a `dedupeKey`; the scheduler delivers it.
- Read config via `getConfig()` (`src/lib/config.ts`); if your module needs a new secret, add a field to `AppConfig`, `defaultConfig()`, `getPublicConfig()` and, if useful for dev, `ENV_MAP`.
- Use `chatJson()` from `src/lib/llm.ts` for "text in, JSON out" AI; it routes to Ollama or Anthropic according to the user's choice.

```ts
import { randomUUID } from 'crypto';
import { db, t } from '@/db';
import { localDate } from '@/lib/dates';
import type { ModuleManifest } from '../types';

async function api(req: Request, p: string[]): Promise<Response | null> {
  if (req.method === 'POST' && p[0] === 'log') {
    await db().insert(t.waterLogs).values({ id: randomUUID(), date: localDate(), glasses: 1 });
    return Response.json({ ok: true });
  }
  return null;
}

async function dashboardData() {
  const rows = await db().query.waterLogs.findMany({ where: (w, { eq }) => eq(w.date, localDate()) });
  return { today: rows.reduce((n, r) => n + r.glasses, 0) };
}

export const water: ModuleManifest = { id: 'water', name: 'Water', tileSize: 'sm', api, dashboardData };
```

### 2. Register — `src/modules/registry.ts`

```ts
import { water } from './water';
export const MODULES: ModuleManifest[] = [gcal, canvas, /* … */, water, system];
```

That single line wires up `/api/mod/water/*`, the scheduler, settings, and dashboard data.

### 3. Tables — `src/db/schema.ts`

Prefix module tables with `mod_<id>_`:

```ts
export const waterLogs = pgTable('mod_water_logs', {
  id: text('id').primaryKey(),
  date: date('date').notNull(),
  glasses: integer('glasses').notNull(),
});
```

Then generate a migration:

```bash
npm run db:generate
```

Migrations in `drizzle/` are applied automatically on boot (and shipped inside the installers).

### 4. Page — `src/app/(app)/m/water/page.tsx`

A server component that checks the session and renders your UI. Copy the header/back-button pattern from an existing page (e.g. `src/app/(app)/m/fitness/page.tsx`). Client components can live next to the manifest in `src/modules/water/` (see `gcal/CalChat.tsx`) and call `fetch('/api/mod/water/log', { method: 'POST' })`.

### 5. Tile — `src/ui/Dashboard.tsx`

Add your module's summary to the dashboard data type and render a `<Link href="/m/water" className="tile accent-…">` block like the others, reading `data.tiles.water`. The dashboard fetches every module's `dashboardData()` in one request.

### 6. Settings (optional)

If you set `defaultSettings`, add a form section in `src/ui/SettingsClient.tsx`; values are read with `getSettings<T>('water')`.

### Checklist

- [ ] `src/modules/<id>/index.ts` exports a `ModuleManifest`
- [ ] one line in `src/modules/registry.ts`
- [ ] tables prefixed `mod_<id>_` + `npm run db:generate`
- [ ] page at `src/app/(app)/m/<id>/page.tsx`
- [ ] tile in `src/ui/Dashboard.tsx`
- [ ] `npm run typecheck` passes
- [ ] new config fields documented in `docs/INTEGRATIONS.md`
