import { promises as fs } from 'fs';
import path from 'path';
import { db } from '@/db';
import { localDate } from '@/lib/dates';
import type { ModuleManifest } from '../types';

// Continuously mirrors the meaningful app data into the Obsidian vault as
// markdown (LifeOS/ folder) — the vault is the durable, human-owned copy;
// Postgres stays the operational store (tokens, queues, caches).

import { getConfig } from "@/lib/config";
const vaultPath = () => {
  const v = getConfig().obsidian.vault;
  if (!v) throw Object.assign(new Error("Obsidian vault is not set — pick a folder in Settings"), { status: 503 });
  return v;
};
export const obsidianConfigured = () => Boolean(getConfig().obsidian.vault);
const DIR = () => path.join(vaultPath(), "LifeOS");

const stamp = () => `---\nsource: life-os\nupdated: ${new Date().toISOString()}\n---\n\n`;

async function write(name: string, body: string) {
  await fs.mkdir(DIR(), { recursive: true });
  await fs.writeFile(path.join(DIR(), name), stamp() + body, 'utf8');
}

async function mirrorFencing() {
  const [results, ratings] = await Promise.all([
    db().query.fencingResults.findMany({ orderBy: (r, { desc }) => [desc(r.date)] }),
    db().query.fencingRatings.findMany(),
  ]);
  const lines = [
    '# Fencing',
    '',
    ...ratings.map((r) => `**${r.weapon}**: ${r.rating}${r.earnedAt ? ` (earned ${r.earnedAt})` : ''}`),
    '',
    '## Results',
    '',
    '| Date | Tournament | Event | Place | Earned | Class |',
    '|---|---|---|---|---|---|',
    ...results.map((r) =>
      `| ${r.date} | ${r.tournament} | ${r.event} | ${r.place ?? '—'}${r.fieldSize ? `/${r.fieldSize}` : ''} | ${r.ratingEarned ?? ''} | ${r.eventClass ?? ''} |`),
    '',
  ];
  await write('Fencing.md', lines.join('\n'));
}

async function mirrorCompetitions() {
  const today = localDate();
  const events = await db().query.compEvents.findMany({
    orderBy: (e, { asc }) => [asc(e.startDate)],
  });
  const fmt = (list: typeof events) =>
    list.map((e) =>
      `- **${e.name}** — ${e.startDate}${e.endDate !== e.startDate ? `→${e.endDate}` : ''} · ${e.kind}${e.ageCategory ? ` ${e.ageCategory}` : ''} · ${e.city ?? '?'}${e.state ? `, ${e.state}` : ''}${e.url ? ` · [reg](${e.url})` : ''}`);
  const upcoming = events.filter((e) => e.endDate >= today);
  const past = events.filter((e) => e.endDate < today).reverse();
  await write('Competitions.md', [
    '# Competitions', '',
    '## Upcoming', '', ...(upcoming.length ? fmt(upcoming) : ['*none tracked*']), '',
    '## Past', '', ...fmt(past.slice(0, 20)), '',
  ].join('\n'));
}

async function mirrorFitness() {
  const days = await db().query.fitnessDays.findMany({
    orderBy: (d, { desc }) => [desc(d.date)],
    limit: 60,
  });
  await write('Fitness.md', [
    '# Fitness', '',
    '| Date | Eaten | Burned | Deficit | Streak |',
    '|---|---|---|---|---|',
    ...days.map((d) =>
      `| ${d.date} | ${d.eaten} | ${d.burned} | ${d.burned - d.eaten >= 0 ? '+' : ''}${d.burned - d.eaten} | ${d.streak} |`),
    '',
  ].join('\n'));
}

async function mirrorMail() {
  const mails = await db().query.gmailMessages.findMany({
    where: (m, { eq, and }) => and(eq(m.unread, true), eq(m.category, 'important')),
    orderBy: (m, { desc }) => [desc(m.receivedAt)],
    limit: 20,
  });
  await write('Mail Important.md', [
    '# Important unread mail', '',
    ...(mails.length
      ? mails.map((m) => `- **${m.fromAddr}** — ${m.subject ?? '(no subject)'}${m.summary ? `\n  - ${m.summary}` : ''}`)
      : ['*inbox zero on important mail* 🎉']),
    '',
  ].join('\n'));
}

async function sync() {
  await Promise.all([mirrorFencing(), mirrorCompetitions(), mirrorFitness(), mirrorMail()]);
}

export const vaultmirror: ModuleManifest = {
  enabled: obsidianConfigured,
  id: 'vaultmirror',
  name: 'Vault Mirror',
  tileSize: 'sm',
  syncEveryMin: 30,
  sync,
};
