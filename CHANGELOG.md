# Changelog

All notable changes to Life OS are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

## [0.1.0] — 2026-08-20

First public release.

### Added
- Desktop app for macOS (Apple Silicon + Intel), Windows and Linux, built with Electron; installers published on GitHub Releases.
- Local-first storage: embedded PGlite database and `config.json` in the per-user app data folder; no server, no telemetry.
- First-run setup wizard: timezone / about-me, optional tool install (Ollama + models, tmux, Claude Code CLI), Google OAuth, AI provider, Canvas, Spotify, Obsidian + password vaults, Fencing & Fitness, Kairos, quick links.
- Single-owner sign-in: the first Google account to log in is bound to the install.
- In-process scheduler (every 5 min) replacing external cron; per-module sync intervals; native desktop notifications plus optional web push.
- Modules: Calendar (Google, with AI chat), Gmail AI inbox, Tasks, Recipes, Passwords, Notes (Obsidian), Vault mirror, Canvas (any school), Spotify, Fitness (ingest API + embedded app), Fencing competitions (askFRED + USA Fencing, home-state filter) and results ingest, Farm game, Kairos (embedded Claude Code terminal).
- Local AI via Ollama for Tasks / Recipes / Passwords, with Anthropic as an opt-in alternative.
- Settings → Integrations for editing every credential after setup.
- Documentation: README, Google setup guide, security/threat model, module authoring guide, integrations reference.

### Changed
- `scripts/fencingtracker_scrape.py` now requires `FT_PROFILE_URL` (no built-in default profile).

[Unreleased]: https://github.com/Greek4Sea/production-life-os/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Greek4Sea/production-life-os/releases/tag/v0.1.0
