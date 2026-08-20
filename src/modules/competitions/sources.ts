// Ported from ~/fencing_competition_tracker (Python) — the two healthy sources,
import { TZ } from '@/lib/dates';
// with the askFRED state-name bug fixed (CSV uses full state names, not codes).
import { createHash } from 'crypto';

export type Comp = {
  uid: string; name: string; kind: string; ageCategory: string;
  city: string; state: string; startDate: string; endDate: string;
  regCloses: Date | null; url: string; source: string;
};

// Which US states to keep. Empty = everywhere. Set in Settings → Fencing.
let HOME_STATES = new Set<string>();
export function setHomeStates(states: string[]) { HOME_STATES = new Set(states.map((s) => s.toUpperCase())); }
const inHome = (st: string) => HOME_STATES.size === 0 || HOME_STATES.has(st);

const STATE_ABBR: Record<string, string> = {
  california: 'CA', nevada: 'NV', arizona: 'AZ', oregon: 'OR', washington: 'WA',
  utah: 'UT', idaho: 'ID', 'new jersey': 'NJ', 'new york': 'NY', texas: 'TX',
  florida: 'FL', illinois: 'IL', colorado: 'CO', georgia: 'GA', ohio: 'OH',
  pennsylvania: 'PA', massachusetts: 'MA', virginia: 'VA', maryland: 'MD',
  'north carolina': 'NC', 'south carolina': 'SC', michigan: 'MI', minnesota: 'MN',
  wisconsin: 'WI', missouri: 'MO', tennessee: 'TN', indiana: 'IN', kentucky: 'KY',
  alabama: 'AL', louisiana: 'LA', oklahoma: 'OK', kansas: 'KS', iowa: 'IA',
  arkansas: 'AR', mississippi: 'MS', nebraska: 'NE', 'new mexico': 'NM',
  hawaii: 'HI', alaska: 'AK', montana: 'MT', wyoming: 'WY', 'north dakota': 'ND',
  'south dakota': 'SD', delaware: 'DE', connecticut: 'CT', 'rhode island': 'RI',
  vermont: 'VT', 'new hampshire': 'NH', maine: 'ME', 'west virginia': 'WV',
  'district of columbia': 'DC',
};

const uid = (source: string, key: string) =>
  createHash('sha1').update(`${source}:${key}`).digest('hex').slice(0, 16);

const unescapeHtml = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// Minimal CSV parser that handles quoted fields.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '', row: string[] = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (field || row.length) { row.push(field); rows.push(row); field = ''; row = []; }
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...rest] = rows;
  if (!header) return [];
  return rest.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}

// ---------- source 1: askFRED CSV export (ROC/RJCC regionals) ----------

const ROC_RE = /\bROC\b|regional open circuit/i;
const RJCC_RE = /\bRJCC\b|regional junior/i;

function stateOf(location: string): string | null {
  const abbr = location.match(/,\s*([A-Z]{2})\s+\d{5}/);
  if (abbr) return abbr[1];
  const full = location.match(/,\s*([A-Za-z ]+?)\s+\d{5}/);
  return full ? STATE_ABBR[full[1].trim().toLowerCase()] ?? null : null;
}

export async function fetchAskfred(deadlineMs: number): Promise<Comp[]> {
  const base = 'https://askfred.net/tournaments.csv?action=index&controller=tournaments&weapon=Epee&gender=Men+or+Mixed';
  const agg = new Map<string, Comp & { reg: Date | null }>();
  for (let page = 1; page <= 25; page++) {
    if (Date.now() > deadlineMs) break;
    const res = await fetch(`${base}&page=${page}`, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        accept: 'text/csv,text/plain,*/*',
      },
    });
    if (!res.ok) break;
    const body = unescapeHtml(await res.text());
    if (!body.split('\n')[0]?.includes(',')) break;
    const rows = parseCsv(body);
    if (!rows.length) break;

    for (const r of rows) {
      if ((r.Weapon ?? '').toLowerCase() !== 'epee') continue;
      const gender = (r.Gender ?? '').toLowerCase();
      if (!['men', 'mixed'].includes(gender)) continue;
      const blob = `${r.Tournament} ${r.Event}`;
      const kind = RJCC_RE.test(blob) ? 'RJCC' : ROC_RE.test(blob) ? 'ROC' : null;
      if (!kind) continue;
      const st = stateOf(r.Location ?? '');
      if (!st || !inHome(st)) continue;
      const age = (r['Age Limit'] ?? '').toLowerCase();
      // Profile: men's épée, junior (RJCC) + senior/Div I (ROC).
      let ageCategory: string | null = null;
      if (kind === 'RJCC' && (age.includes('junior') || !age)) ageCategory = 'junior';
      else if (kind === 'ROC' && (age.includes('senior') || age.includes('none') || !age || age.includes('open'))) ageCategory = 'senior';
      if (!ageCategory) continue;

      const closeRaw = r['Close of Reg'] ?? '';
      const d = closeRaw.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      const cityM = (r.Location ?? '').match(/([A-Za-z .'-]+),\s*[A-Za-z ]+\s+\d{5}/);
      const city = cityM ? cityM[1].split(',').pop()!.trim() : '';
      const key = `${r.Tournament}|${ageCategory}|${st}`;
      const cur = agg.get(key);
      const reg = Number.isNaN(Date.parse(closeRaw)) ? null : new Date(closeRaw);
      if (cur) {
        if (d < cur.startDate) cur.startDate = d;
        if (d > cur.endDate) cur.endDate = d;
        if (reg && (!cur.reg || reg < cur.reg)) cur.reg = reg;
      } else {
        agg.set(key, {
          uid: uid('askfred', key),
          name: RJCC_RE.test(r.Tournament) || ROC_RE.test(r.Tournament) ? r.Tournament : `${kind}: ${r.Tournament}`,
          kind, ageCategory, city, state: st,
          startDate: d, endDate: d, reg, regCloses: null,
          url: 'https://askfred.net/tournaments', source: 'askfred',
        });
      }
    }
    if (rows.length < 5) break;
  }
  return [...agg.values()].map((c) => ({ ...c, regCloses: c.reg }));
}

// ---------- source 2: USA Fencing regional Airtable (public share) ----------

const AIRTABLE_APP = 'appxKNz6tPo9tirzc';
const AIRTABLE_SHARE = `https://airtable.com/${AIRTABLE_APP}/shr1ISwdEeBsrAhmf`;

// (circuit regex, contested-events code, age category) — from profiles.py regional_rules
const REGIONAL_RULES: [RegExp, string, string][] = [
  [/RJCC?/i, 'JNR', 'junior'],
  [/ROC/i, 'D1A', 'senior'],
];

type AtChoice = { id: string; name: string };
type AtColumn = { id: string; name: string; typeOptions?: { choices?: Record<string, AtChoice> } };
type AtRow = { id: string; cellValuesByColumnId: Record<string, unknown> };

export async function fetchUsafRegional(): Promise<Comp[]> {
  const ua = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' };
  const shareHtml = await (await fetch(AIRTABLE_SHARE, { headers: ua })).text();
  const m = shareHtml.match(/urlWithParams["']?\s*:\s*["']([^"']+)["']/);
  if (!m) throw new Error('Airtable share: signed URL not found');
  let dataUrl = m[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/');
  if (dataUrl.startsWith('/')) dataUrl = 'https://airtable.com' + dataUrl;

  const res = await fetch(dataUrl, {
    headers: {
      ...ua,
      'x-airtable-application-id': AIRTABLE_APP,
      'x-requested-with': 'XMLHttpRequest',
      'x-time-zone': TZ,
      referer: AIRTABLE_SHARE,
    },
  });
  if (!res.ok) throw new Error(`Airtable data ${res.status}`);
  const data = await res.json();
  const table = data?.data?.table;
  if (!table) throw new Error('Airtable: no table in response');

  const cols = new Map<string, AtColumn>((table.columns as AtColumn[]).map((c) => [c.id, c]));
  // Some column names carry stray whitespace ("Contested Events ") — trim on both sides.
  const colByName = new Map<string, AtColumn>(
    (table.columns as AtColumn[]).map((c) => [c.name.trim().toLowerCase(), c]),
  );

  const cellText = (row: AtRow, name: string): string => {
    const col = colByName.get(name.trim().toLowerCase());
    if (!col) return '';
    const v = row.cellValuesByColumnId?.[col.id];
    if (v == null) return '';
    const choices = cols.get(col.id)?.typeOptions?.choices ?? {};
    const resolve = (x: unknown): string => {
      if (typeof x === 'string') return choices[x]?.name ?? x;
      if (typeof x === 'number') return String(x);
      if (Array.isArray(x)) return x.map(resolve).filter(Boolean).join(', ');
      if (typeof x === 'object' && x && 'name' in x) return String((x as { name: unknown }).name);
      return '';
    };
    return resolve(v);
  };

  const out: Comp[] = [];
  for (const row of table.rows as AtRow[]) {
    const name = cellText(row, 'Tournament');
    const circuit = cellText(row, 'Circuit(s)') || cellText(row, 'Circuits') || cellText(row, 'Circuit');
    const contested = cellText(row, 'Contested Events');
    const start = cellText(row, 'Start Date').slice(0, 10);
    const end = (cellText(row, 'End Date') || start).slice(0, 10);
    const city = cellText(row, 'City');
    const state = cellText(row, 'State');
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(start)) continue;
    if (state && state.length === 2 && !inHome(state)) continue;

    for (const [circuitRe, code, ageCategory] of REGIONAL_RULES) {
      if (circuitRe.test(circuit) && contested.toUpperCase().includes(code)) {
        const kind = /RJCC/i.test(circuit) ? 'RJCC' : 'ROC';
        out.push({
          uid: uid('usaf-regional', `${name}|${ageCategory}|${start}`),
          name, kind, ageCategory, city, state,
          startDate: start, endDate: end >= start ? end : start,
          regCloses: null,
          url: 'https://www.usafencing.org/regional-tournaments',
          source: 'usaf',
        });
        break;
      }
    }
  }
  return out;
}
