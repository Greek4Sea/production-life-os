# Life OS

**One dashboard that runs your life — calendar, mail, school, tasks, notes, music, training — running entirely on your own machine.**

<!-- badges -->
[![Release](https://img.shields.io/github/v/release/Greek4Sea/production-life-os?include_prereleases)](https://github.com/Greek4Sea/production-life-os/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)](#download)

<!-- TODO: add docs/screenshot.png -->
![Life OS dashboard](docs/screenshot.png)

Life OS is a local-first desktop app (Electron + Next.js 15 + an embedded PGlite/Postgres database). Every module is a tile on a dark bento grid; tap a tile to open the full page. Syncs run in the background every few minutes and surface as native desktop notifications. There is no server, no account, and no telemetry — only the APIs *you* connect are ever contacted.

## Download

Grab the latest installer from **[GitHub Releases](https://github.com/Greek4Sea/production-life-os/releases)**:

| Platform | File |
|---|---|
| macOS (Apple Silicon) | `LifeOS-<version>-mac-arm64.dmg` |
| macOS (Intel) | `LifeOS-<version>-mac-x64.dmg` |
| Windows | `LifeOS-<version>-win-x64.exe` (NSIS installer) |
| Linux | `LifeOS-<version>-linux-x86_64.AppImage` or `.deb` |

The builds are **not code-signed yet**, so your OS will warn you once:

- **macOS:** right-click `Life OS.app` → **Open** → **Open**. Or in a terminal: `xattr -dr com.apple.quarantine "/Applications/Life OS.app"`
- **Windows:** SmartScreen → **More info** → **Run anyway**.

## First run in 5 minutes

On first launch Life OS opens a setup wizard in the app window. Only the Google step is required; everything else can be skipped and enabled later from **Settings → Integrations**.

1. **Welcome** — confirm your timezone and (optionally) write a line "about me" that the AI features use for context.
2. **Install tools** — pick **Install everything** (Ollama + local models, tmux, Claude Code CLI) for fully local AI, or **Anthropic only** if you'd rather not run models on your machine.
3. **Google** *(required)* — create a free Google Cloud OAuth client, paste its Client ID and Secret, and sign in. Step-by-step with screenshots-in-words: **[docs/SETUP-GOOGLE.md](docs/SETUP-GOOGLE.md)**. Short version:
   - Redirect URI: `http://localhost:3210/api/auth/callback/google`
   - Add yourself as a **test user**, then **Publish** the app so your login doesn't expire every 7 days.
   - The first Google account that signs in **owns this install** — nobody else can log in.
4. **AI** — paste an Anthropic API key. Required for the Gmail AI inbox and Calendar chat; also required for Tasks/Recipes/Passwords if you skipped Ollama.
5. **School / Canvas** — your school's Canvas URL + a personal access token.
6. **Spotify** — a Spotify Developer app (Client ID/Secret).
7. **Notes / Obsidian** — point at an existing vault folder (and, separately, a folder for the password vault).
8. **Fencing & Fitness** — home states for competition filtering; the fitness ingest key is generated for you.
9. **Kairos** — enable the embedded Claude Code terminal (macOS/Linux; needs tmux + `claude`).
10. **Quick links** — shortcuts for the dashboard sidebar.
11. **Finish** — you land on the dashboard. Syncs start ~20 seconds later.

## Modules

| Module | What it does | Needs | Optional? |
|---|---|---|---|
| **Calendar** | Google Calendar agenda, multi-calendar, add-to-calendar, natural-language calendar chat | Google sign-in; Anthropic key for chat | Core |
| **Gmail AI inbox** | Triages and summarises new mail, labels it, lets you reply | Google sign-in + Anthropic key | Yes |
| **Tasks** | Todos with due-time notifications and repeats; freeform text → tasks via AI | Local Ollama *or* Anthropic | Yes |
| **Recipes** | Describe a dish → structured recipe with kcal estimate and lighter swaps | Local Ollama *or* Anthropic | Yes |
| **Passwords** | Paste messy credentials → tidy markdown entries in a separate vault folder | A folder; local Ollama *or* Anthropic | Yes |
| **Notes** | Browse, search and edit an Obsidian vault (works without Obsidian running) | A vault folder | Yes |
| **Vault mirror** | Writes your Life OS data into the vault as markdown (`LifeOS/`) every 30 min | Notes configured | Yes |
| **Canvas** | Courses, grades, assignments, announcements from any Canvas LMS school | Canvas URL + access token | Yes |
| **Spotify** | Now playing, recents, top tracks, in-app playback | Spotify Developer app | Yes |
| **Fitness** | Daily eaten/burned/streak pushed from any app via a tiny HTTP endpoint | Something that POSTs JSON | Yes |
| **Fencing** | Upcoming askFRED + USA Fencing regional events filtered to your home states; results/ratings via a scraper script | Nothing (script needs python3) | Yes |
| **Farm** | A pixel farming game, saved locally | Nothing | Yes |
| **Kairos** | Claude Code running inside the app in its own workspace folder | tmux + Claude Code CLI (mac/linux) | Yes |

Details, settings and the "how to add a module" guide: **[docs/MODULES.md](docs/MODULES.md)**. Fitness/fencing/Canvas/Spotify/Obsidian/Kairos wiring: **[docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)**.

## Privacy & data

- **Everything is local.** The database (PGlite), `config.json`, and the Kairos workspace live in the app data folder:
  - macOS: `~/Library/Application Support/Life OS`
  - Windows: `%APPDATA%/Life OS`
  - Linux: `~/.config/Life OS`
  - Running from source: `~/.life-os` (override with `LIFEOS_DATA_DIR`)
- **Secrets** (OAuth client secret, API keys, tokens) are in `config.json`, written with `0600` permissions.
- **Network:** the server binds to `127.0.0.1` only. The only outbound traffic is to the services you configure: Google, Anthropic, your Canvas instance, Spotify, askFRED / USA Fencing, and your own Ollama URL.
- **Local AI stays local.** With Ollama, Tasks/Recipes/Passwords text never leaves your machine. If you chose *Anthropic only*, those prompts go to Anthropic instead — your call.
- **No telemetry, no analytics, no update pings.** Updates are manual downloads from Releases.
- **Single owner.** The first Google account that signs in is bound to the install; every other account is refused.
- **Reset:** quit the app and delete the data folder. Threat model and rotation steps: **[docs/SECURITY.md](docs/SECURITY.md)**.

## Run from source

Requires **Node 22+**.

```bash
git clone https://github.com/Greek4Sea/production-life-os.git
cd production-life-os
npm install
npm run dev            # http://localhost:3210 (setup wizard on first visit)
```

```bash
npm run build && npm start   # production server (server.js, port 3210)
npm run dist                 # package installers into release/
npm run typecheck
npm run db:generate          # after editing src/db/schema.ts → new migration in drizzle/
```

`config.json` is the real configuration; environment variables are only dev-time overrides (see [`.env.example`](.env.example)).

## Architecture in 30 seconds

- **Modules** — `src/modules/<id>/index.ts` exports a `ModuleManifest` (`id`, `name`, `tileSize`, optional `sync`, `syncEveryMin`, `api`, `dashboardData`, `defaultSettings`). Register it with one line in `src/modules/registry.ts`. The manifest is server-only; the tile and page UI live next to it and are wired into `src/ui/Dashboard.tsx` and `src/app/(app)/m/<id>/page.tsx`.
- **`day_items` is the spine** — every module writes its date-relevant items (events, tasks, metrics, notes) into one table, which is what the dashboard's "today" view and notifications are built on.
- **`/api/mod/<id>/<path...>`** — each module's API namespace, dispatched to its `api()` handler. Auth is the session cookie *or* a bearer API token.
- **Scheduler** — an in-process heartbeat (`src/lib/scheduler.ts`) ticks every 5 minutes: runs each module's `sync()` if its `syncEveryMin` has elapsed, then sends due notifications (native desktop + web push). No cron, no external pinger.
- **Storage** — PGlite (embedded Postgres) via Drizzle ORM; module tables are prefixed `mod_<id>_`. Config in `config.json` (`src/lib/config.ts`), paths in `src/lib/paths.ts`.
- **Shell** — `server.js` serves Next.js plus the Kairos PTY WebSocket; Electron wraps it and drains the notification queue into native notifications.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). New modules are the easiest way to contribute; the recipe is in [docs/MODULES.md](docs/MODULES.md#adding-a-module).

## License

[MIT](LICENSE) © 2026 Greek4Sea
