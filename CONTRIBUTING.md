# Contributing

Thanks for helping make Life OS better. It is a small project; keep it simple.

## Setup

```bash
git clone https://github.com/Greek4Sea/production-life-os.git
cd production-life-os
npm install
npm run dev          # http://localhost:3210
```

Data for a source checkout lives in `~/.life-os` (set `LIFEOS_DATA_DIR` to use a scratch folder). Run the setup wizard once; you need your own Google OAuth client ([docs/SETUP-GOOGLE.md](docs/SETUP-GOOGLE.md)).

## Before you open a PR

- `npm run typecheck` passes.
- `npm run build` succeeds.
- If you changed `src/db/schema.ts`, run `npm run db:generate` and commit the new migration in `drizzle/`.
- Keep files under ~500 lines; prefer editing existing files over adding new ones.
- No secrets, `.env.local`, `config.json`, or personal data in commits. Nothing in the repo should contain your name, school, or profile URLs — configuration belongs in `config.json`.
- Module work: follow [docs/MODULES.md](docs/MODULES.md#adding-a-module) (manifest → registry → `mod_<id>_` tables → page → tile).

## Pull requests

- One change per PR, with a short description of *why*.
- Screenshots for UI changes.
- Add a line to `CHANGELOG.md` under *Unreleased*.

## Reporting bugs

Open an issue with your OS, app version (Settings → About, or the release file name), what you did, what happened, and anything from the sync report (Settings → Sync status). Security issues: see [docs/SECURITY.md](docs/SECURITY.md#reporting-a-vulnerability).

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
