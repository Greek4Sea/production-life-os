# Integrations

How to connect each external thing to Life OS. All of these are also reachable later from **Settings → Integrations**; the wizard just walks through them in order. Google has its own page: [SETUP-GOOGLE.md](SETUP-GOOGLE.md).

Secrets mentioned here live in `config.json` in the data folder (see [SECURITY.md](SECURITY.md)).

## AI: Ollama or Anthropic

Life OS uses AI in two ways (`src/lib/llm.ts`):

1. **Always Anthropic** — Gmail triage and Calendar chat. Needs `anthropic.apiKey` (get one at <https://console.anthropic.com/>). Without it those two features show "Anthropic API key is not set".
2. **"Text in, JSON out"** — Tasks, Recipes, Passwords. Routed to **Ollama** by default (`ai.provider = "ollama"`) or to Anthropic (`claude-haiku-4-5`) if you picked *Anthropic only* in the wizard.

Ollama defaults: URL `http://localhost:11434`, models `qwen3.5:9b` (tasks, recipes) and `llama3.2` (passwords). Change any of them in Settings → AI; the wizard's *Install everything* pulls the models for you. If a model is missing you'll see `ollama pull <model>` in the error.

## Canvas (school)

Works with any Canvas LMS instance.

1. Find your base URL — the host you log in at, e.g. `https://canvas.ucdavis.edu` or `https://yourschool.instructure.com`.
2. In Canvas: **Account → Settings → Approved Integrations → + New Access Token**. Purpose `Life OS`, leave expiry blank (or set one and remember to renew). Copy the token — Canvas shows it once.
3. Paste both in the wizard / Settings → School.

Sync runs every 5 minutes; if the token is revoked you get a "Canvas needs a re-login" notification.

## Spotify

1. <https://developer.spotify.com/dashboard> → **Create app**.
2. Redirect URI: `http://localhost:3210/api/mod/spotify/callback` (use your port if different). Tick **Web API** and **Web Playback SDK**.
3. Copy **Client ID** and **Client secret** into Settings → Spotify, then click **Connect** and approve.

Spotify apps start in *development mode*, which is fine for a single user — add your own Spotify account under *User Management* if Spotify asks. In-browser playback needs Spotify Premium.

## Notes (Obsidian) and Passwords vault

- **Notes:** pick the root folder of an existing Obsidian vault (the folder containing `.obsidian/`). Life OS reads and writes the `.md` files directly; hidden folders and `node_modules` are skipped. Enabling this also enables **Vault mirror**, which writes app data to `<vault>/LifeOS/` every 30 minutes.
- **Passwords:** pick a *separate* folder (create an empty one, e.g. `~/Vaults/Passwords`, and optionally open it as its own vault in Obsidian). Do not point it at your notes vault.

Both folders must be on the machine running Life OS (or a mounted drive).

## Fitness ingest API

Any app, shortcut or script can push daily totals to Life OS. The shared key (`fitness.ingestKey`) is generated on first launch and shown in **Settings → Fitness**.

```
POST http://localhost:3210/api/fitness/ingest
x-fitness-key: <ingest key>
content-type: application/json

{ "date": "2026-08-20", "eaten": 1850, "burned": 2400, "streak": 12 }
```

- `date` — required, `YYYY-MM-DD` (one row per day, upserted).
- `eaten`, `burned` — kcal, rounded to integers (missing → 0).
- `streak` — any integer you want on the tile (missing → 0).
- Response: `{ "ok": true }`; `401` on a bad key, `400` on a bad date.

CORS: browser-based apps can call it only from the origin set in `fitness.allowedOrigin` (Settings → Fitness); leave it empty to allow non-browser clients only. `fitness.appUrl` is a URL of your own fitness web app to embed in the Fitness page.

```bash
curl -X POST http://localhost:3210/api/fitness/ingest \
  -H "x-fitness-key: $KEY" -H "content-type: application/json" \
  -d '{"date":"2026-08-20","eaten":1850,"burned":2400,"streak":12}'
```

## Fencing

### Competitions
Set your **home states** (two-letter codes, e.g. `CA, NV`) in Settings → Fencing. askFRED and USA Fencing regional events are fetched twice a day and filtered to those states. No account needed.

### Fencing results ingest
Results and ratings come from your fencingtracker.com profile via `scripts/fencingtracker_scrape.py`, which POSTs to:

```
POST http://localhost:3210/api/fencing/ingest
x-cron-secret: <core.cronSecret from config.json>
content-type: application/json

{
  "results": [
    { "uid": "a1b2c3d4e5f60718", "date": "2026-03-14", "tournament": "Spring Open",
      "event": "Div 1A Men's Foil", "place": 12, "fieldSize": 64,
      "ratingEarned": "C2026", "eventClass": "B1" }
  ],
  "ratings": [
    { "weapon": "Foil", "rating": "C2026", "earnedAt": "2026-03-14" }
  ]
}
```

- `results[]`: `uid`, `date` (`YYYY-MM-DD`), `tournament`, `event` are required; `place`, `fieldSize`, `ratingEarned`, `eventClass` optional. Upserted by `uid`.
- `ratings[]`: `weapon`, `rating` required; `earnedAt` optional. Upserted by `weapon`.
- Auth: `x-cron-secret` header (or `Authorization: Bearer <secret>`) matching `core.cronSecret` in `config.json`.

### Running the scraper

Needs Python 3.10+ and [Scrapling](https://github.com/D4Vinci/Scrapling):

```bash
pip install scrapling
export FT_PROFILE_URL="https://fencingtracker.com/p/<id>/<Your-Name>"   # required
export APP_URL="http://localhost:3210"
export CRON_SECRET="$(python3 -c 'import json,os;print(json.load(open(os.path.expanduser("~/Library/Application Support/Life OS/config.json")))["core"]["cronSecret"])')"

python3 scripts/fencingtracker_scrape.py --dry-run   # print what was parsed, push nothing
python3 scripts/fencingtracker_scrape.py             # push to Life OS
```

Adjust the `config.json` path for your OS (see [SECURITY.md](SECURITY.md)). The script refuses to push if it parses zero results (layout change guard). Run it whenever you've fenced, or put it on a monthly cron / launchd job on the same machine.

## Kairos (embedded Claude Code)

Kairos gives you a Claude Code terminal inside Life OS, working in its own folder (`<data dir>/kairos` by default; changeable in Settings → Kairos).

Requirements (macOS / Linux only — Windows shows the tile as unavailable):

- `tmux` — `brew install tmux` / `apt install tmux`, or let the wizard install it.
- Claude Code CLI — `npm install -g @anthropic-ai/claude-code`, or let the wizard install it.

First use:

1. Enable Kairos in Settings → Kairos (the status line shows whether `tmux` and `claude` were found; you can set an explicit `tmuxPath` if it's somewhere unusual).
2. Open the Kairos tile. You get a shell in the workspace; press **▶ Claude** (or type `claude`) to start Claude Code.
3. Inside Claude Code type **`/login`** and follow the browser flow to sign in with your Anthropic/Claude account. This is stored by Claude Code itself (`~/.claude`), not by Life OS.

The tmux session is named `kairos` and survives closing the tile or the app — reopening reattaches. Kill it with `tmux kill-session -t kairos`.

## Quick links

Settings → Quick links: label + URL pairs that appear in the dashboard's app drawer. Purely cosmetic; stored in `config.json` under `quickLinks`.
