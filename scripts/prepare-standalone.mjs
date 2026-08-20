#!/usr/bin/env node
// Runs after `next build` (output: 'standalone'). Turns .next/standalone into a
// self-contained server directory that the Electron shell copies as-is:
//   - our custom server.js replaces the one Next generates
//   - static assets, public/, drizzle migrations are copied in
//   - externalised native/server packages are ensured in node_modules
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const standalone = path.join(root, '.next', 'standalone');
const summary = [];

if (!fs.existsSync(standalone)) {
  console.error(`prepare-standalone: ${standalone} not found. Run \`next build\` first (next.config.ts must have output: 'standalone').`);
  process.exit(1);
}

function copy(from, to, label) {
  if (!fs.existsSync(from)) { summary.push(`skip   ${label} (missing: ${path.relative(root, from)})`); return false; }
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true, dereference: true });
  summary.push(`copied ${label} -> ${path.relative(root, to)}`);
  return true;
}

// 1. custom server. Next's generated server.js embeds the resolved next.config
//    (the standalone bundle has no webpack, so config can't be re-loaded at
//    runtime) — extract it to standalone-config.json for our server.js to use.
{
  const generated = path.join(standalone, 'server.js');
  const src = fs.existsSync(generated) ? fs.readFileSync(generated, 'utf8') : '';
  const m = src.match(/^const nextConfig = (.*)$/m);
  if (!m) throw new Error('could not find nextConfig in the generated standalone server.js');
  fs.writeFileSync(path.join(standalone, 'standalone-config.json'), m[1]);
  console.log('  wrote  standalone-config.json');
}
copy(path.join(root, 'server.js'), path.join(standalone, 'server.js'), 'server.js');

// 2. static assets + public + migrations
copy(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'), '.next/static');
copy(path.join(root, 'public'), path.join(standalone, 'public'), 'public/');
copy(path.join(root, 'drizzle'), path.join(standalone, 'drizzle'), 'drizzle/');

// 3. externalised packages that output-file-tracing may not pick up, plus
//    their runtime dependency closure.
const required = ['ws', 'node-pty', '@electric-sql/pglite', 'web-push'];
const rootModules = path.join(root, 'node_modules');
const outModules = path.join(standalone, 'node_modules');
const seen = new Set();

function ensurePackage(name, why) {
  if (seen.has(name)) return;
  seen.add(name);
  const src = path.join(rootModules, name);
  const dst = path.join(outModules, name);
  if (!fs.existsSync(src)) {
    summary.push(`${required.includes(name) ? 'WARN  ' : 'skip  '} ${name} not installed in root node_modules${why ? ` (needed by ${why})` : ''}`);
    return;
  }
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.cpSync(src, dst, { recursive: true, dereference: true });
    summary.push(`added  node_modules/${name}${why ? ` (dep of ${why})` : ''}`);
  }
  let pkg = {};
  try { pkg = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8')); } catch { /* no manifest */ }
  for (const dep of Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.optionalDependencies ?? {}) })) {
    ensurePackage(dep, name);
  }
}
for (const name of required) ensurePackage(name, '');

// 4. report
const size = (dir) => {
  let total = 0;
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else total += fs.statSync(p).size; } };
  walk(dir);
  return (total / 1024 / 1024).toFixed(1) + ' MB';
};
console.log('prepare-standalone:');
for (const l of summary) console.log('  ' + l);
console.log(`  standalone size: ${size(standalone)}`);
