# Security & threat model

Life OS is a single-user app that runs entirely on your computer. This page explains, in plain words, what that means for your data, what could go wrong, and how to rotate or wipe things.

## The model in one paragraph

A local web server (`server.js` → Next.js) listens on **`127.0.0.1:3210`** — it is not reachable from other machines on your network unless you deliberately change `HOST`. The Electron window is just a browser pointed at it. One Google account owns the install. Secrets sit in one JSON file with owner-only permissions. The app never phones home; it only talks to the third-party services you connected, using credentials you supplied.

## What lives where

| Thing | Where | Protection |
|---|---|---|
| Database (PGlite / embedded Postgres): calendar events, mail summaries, tasks, tokens, caches | `<data dir>/db/` | Filesystem permissions; data dir created `0700` |
| `config.json`: Google client secret, Anthropic key, Canvas token, Spotify secret, ingest keys, generated auth/cron/VAPID secrets | `<data dir>/config.json` | Written atomically with mode `0600` (owner read/write only; best-effort on Windows) |
| Google refresh token, Spotify tokens, API tokens (hashed) | Database | As above |
| Kairos workspace (files Claude Code creates) | `<data dir>/kairos/` | Plain files |
| Obsidian vault and password vault | Wherever you pointed them | Plain markdown files — **not encrypted by Life OS** |

`<data dir>` is `~/Library/Application Support/Life OS` (macOS), `%APPDATA%/Life OS` (Windows), `~/.config/Life OS` (Linux), or `~/.life-os` when running from source. `LIFEOS_DATA_DIR` overrides it.

## Who can get in

- **Network:** bound to loopback only. Nothing else on your LAN can reach it. If you set `HOST=0.0.0.0` to use it from your phone, you are exposing it to your network — put it behind Tailscale or similar and understand the trade-off.
- **Login:** Google OAuth. The first account to sign in is written to `config.core.allowedEmail`; every later sign-in attempt by a different account is refused (`src/lib/auth.ts`).
- **API routes:** `/api/mod/*` and friends require the session cookie **or** a bearer API token (stored as SHA-256 hashes). `/api/fencing/ingest` and `/api/cron/*` require `x-cron-secret`; `/api/fitness/ingest` requires `x-fitness-key`. Both secrets are random, generated at first boot.
- **Anyone with your OS user account** can read everything. Life OS does not add a master password or encryption at rest; use full-disk encryption (FileVault / BitLocker / LUKS) and a locked screen.

## What leaves the machine

Only what you configure, and only to the service that owns it:

| Service | Sent | When |
|---|---|---|
| Google | OAuth tokens; calendar and Gmail API calls | Sign-in; every sync (Calendar 5 min, Gmail 1 min) |
| Anthropic | Email subjects/bodies for triage, calendar chat messages, and — **only if AI provider is "anthropic"** — Tasks/Recipes/Passwords text | On sync / on use |
| Ollama (your URL, default `http://localhost:11434`) | Tasks/Recipes/Passwords text | On use |
| Canvas (your school's URL) | Your access token | Every 5 min |
| Spotify | OAuth tokens; playback calls | On use / tile refresh |
| askFRED, USA Fencing | Unauthenticated public requests | Twice a day |
| fencingtracker.com | Public profile fetch by the optional Python script | When you run it |

Nothing is sent to the Life OS authors. There is no telemetry, crash reporting, or auto-update check.

**Passwords module:** with Ollama configured (the default), credential text is parsed by a model on your own machine and written to your vault folder; it never leaves the computer. If you chose *Anthropic only* during setup, the text you paste is sent to Anthropic for parsing — the UI says so; switch provider under Settings → Integrations → AI if that is not what you want.

## Things to be aware of

- **Kairos runs Claude Code with bypass-permissions** inside the Kairos workspace folder. It is a real shell with your user's privileges; the folder jail applies to the file panel, not to what a shell can do. Treat it like opening a terminal.
- **Obsidian vault editing** is confined to the configured vault path (path traversal is rejected), but the app can modify files inside it. Keep the vault in version control or backed up.
- **Web push / PWA** (if you open the app in a browser): push payloads (titles, short bodies) go through the browser vendor's push service. Desktop notifications in the Electron app do not.
- **Unsigned binaries:** current releases are not code-signed. Verify you downloaded from `github.com/Greek4Sea/production-life-os/releases`, or build from source.

## Rotating secrets

Everything is editable under **Settings → Integrations** without restarting; the wizard steps are the same forms.

| Secret | How to rotate |
|---|---|
| Google client secret | Reset it in Google Cloud → paste new value in Settings → Google → sign in again |
| Google refresh token | Settings → Google → Sign in again (or revoke at <https://myaccount.google.com/permissions>) |
| Anthropic key | Create new key at console.anthropic.com → paste in Settings → AI → delete the old key |
| Canvas token | Canvas → Account → Settings → delete old token, create new → paste |
| Spotify secret | Spotify Developer dashboard → rotate → paste → reconnect |
| Fitness ingest key, cron secret, auth secret, VAPID keys | Quit the app, delete the corresponding key from `config.json` (e.g. `fitness.ingestKey`, `core.cronSecret`); a fresh random value is generated on next launch. Changing `core.authSecret` logs you out; changing VAPID keys invalidates browser push subscriptions. |

Manual edits: `config.json` is plain JSON; quit the app first, edit, relaunch. Keep its permissions at `0600`.

## Reset everything

1. Quit Life OS.
2. Delete the data folder (see paths above).
3. Optionally revoke the app at <https://myaccount.google.com/permissions> and delete the OAuth client in Google Cloud.
4. Relaunch — the setup wizard starts from scratch.

Your Obsidian vault and password vault are outside the data folder and are left untouched.

## Reporting a vulnerability

Open a GitHub issue at <https://github.com/Greek4Sea/production-life-os/issues> titled `[security]`, or, if it is sensitive, use GitHub's private vulnerability reporting on the repository. Please include steps to reproduce.
