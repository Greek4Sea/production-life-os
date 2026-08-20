'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BackIcon } from '@/ui/icons';

type RecipeCard = { id: string; title: string; calories: number | null; timeMin: number | null; servings: number | null; tags: string[] };
type Recipe = RecipeCard & { ingredients: string[]; steps: string[]; lighter: string[] };
type ChatMsg = { role: 'user' | 'ai'; text: string };

export function RecipesView() {
  const [list, setList] = useState<RecipeCard[] | null>(null);
  const [open, setOpen] = useState<Recipe | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');

  const load = () =>
    fetch('/api/mod/recipes/list').then((r) => r.json())
      .then((d) => Array.isArray(d) && setList(d)).catch(() => {});
  useEffect(() => { load(); }, []);

  const send = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setChat((c) => [...c, { role: 'user', text }]);
    setBusy(true);
    fetch('/api/mod/recipes/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    }).then((r) => r.json()).then((d) => {
      setChat((c) => [...c, { role: 'ai', text: d.reply ?? d.error ?? 'failed' }]);
      load();
    }).catch(() => setChat((c) => [...c, { role: 'ai', text: 'offline' }]))
      .finally(() => setBusy(false));
  };

  const openRecipe = (id: string) => {
    setChecked(new Set());
    fetch(`/api/mod/recipes/recipe/${id}`).then((r) => r.json())
      .then((d) => d.id && setOpen(d)).catch(() => {});
  };

  const del = (id: string) => {
    if (!confirm('Delete this recipe?')) return;
    fetch(`/api/mod/recipes/recipe/${id}`, { method: 'DELETE' })
      .then(() => { setOpen(null); load(); }).catch(() => {});
  };

  const toggleIng = (i: number) =>
    setChecked((cur) => {
      const next = new Set(cur);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });

  const q = query.trim().toLowerCase();
  const filtered = (list ?? []).filter((r) =>
    !q || r.title.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q)));

  return (
    <div className="tasks-page">
      <header className="page-header">
        <Link href="/" className="back-btn" aria-label="Back to dashboard"><BackIcon /></Link>
        <h1>Recipes</h1>
        <span className="pill-note" style={{ marginLeft: 'auto' }}>{list?.length ?? 0} saved</span>
      </header>

      <div className="tasks-split">
        {/* chef chat */}
        <div className="tasks-chat">
          <div className="tasks-chat-log">
            {chat.length === 0 && (
              <div className="tile-empty" style={{ padding: 20, textAlign: 'center' }}>
                Tell me a recipe any way you like —<br />
                “yiayia&apos;s chicken souvlaki: chicken, lemon,<br />oregano, yogurt marinade, grill it”<br />
                — I&apos;ll structure it, estimate calories,<br />and find ways to lighten it. 🍋
              </div>
            )}
            {chat.map((m, i) => <div className={`tchat-msg ${m.role}`} key={i}>{m.text}</div>)}
            {busy && <div className="tchat-msg ai tchat-thinking">cooking…</div>}
          </div>
          <div className="tasks-chat-input">
            <textarea className="text-input" rows={2} value={input} disabled={busy}
              placeholder="Describe a recipe…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button className="btn primary" onClick={send} disabled={busy || !input.trim()}>↑</button>
          </div>
        </div>

        <div className="tasks-list">
          {open ? (
            <div className="rcp-detail">
              <div className="rcp-head">
                <div>
                  <h2 className="rcp-title">{open.title}</h2>
                  <div className="rcp-chips">
                    {open.calories != null && <span className="rcp-chip kcal">{open.calories} kcal</span>}
                    {open.timeMin != null && <span className="rcp-chip">⏱ {open.timeMin} min</span>}
                    {open.servings != null && <span className="rcp-chip">🍽 {open.servings}</span>}
                    {open.tags.map((t) => <span className="rcp-chip tag" key={t}>{t}</span>)}
                  </div>
                </div>
                <button className="btn small" onClick={() => setOpen(null)}>← Back</button>
              </div>

              <div className="rcp-cols">
                <div className="card rcp-card">
                  <div className="h-label" style={{ padding: '12px 14px 4px' }}>Ingredients</div>
                  {open.ingredients.map((ing, i) => (
                    <button className="task-row" key={i} onClick={() => toggleIng(i)}>
                      <span className={`task-check${checked.has(i) ? ' on' : ''}`}>{checked.has(i) ? '✓' : ''}</span>
                      <div className="what"><div className={`t${checked.has(i) ? ' task-done' : ''}`}>{ing}</div></div>
                    </button>
                  ))}
                </div>
                <div>
                  <div className="card rcp-card">
                    <div className="h-label" style={{ padding: '12px 14px 4px' }}>Steps</div>
                    {open.steps.map((s, i) => (
                      <div className="rcp-step" key={i}>
                        <span className="rcp-stepnum">{i + 1}</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                  {open.lighter.length > 0 && (
                    <div className="card rcp-lighter">
                      <div className="h-label" style={{ color: 'var(--green)' }}>💡 Make it lighter</div>
                      {open.lighter.map((l, i) => <div className="rcp-tip" key={i}>{l}</div>)}
                    </div>
                  )}
                </div>
              </div>
              <button className="btn danger" style={{ marginTop: 12 }} onClick={() => del(open.id)}>Delete recipe</button>
            </div>
          ) : (
            <>
              <input className="text-input" value={query} placeholder="Search recipes or tags…"
                style={{ width: '100%', marginBottom: 12 }}
                onChange={(e) => setQuery(e.target.value)} />
              <div className="rcp-grid">
                {filtered.map((r) => (
                  <button className="rcp-tile" key={r.id} onClick={() => openRecipe(r.id)}>
                    <span className="rcp-tile-title">{r.title}</span>
                    <span className="rcp-tile-meta">
                      {r.calories != null && <span className="rcp-chip kcal">{r.calories} kcal</span>}
                      {r.timeMin != null && <span className="rcp-chip">⏱ {r.timeMin}m</span>}
                    </span>
                    {r.tags.length > 0 && (
                      <span className="rcp-tile-tags">{r.tags.slice(0, 3).join(' · ')}</span>
                    )}
                  </button>
                ))}
              </div>
              {list !== null && filtered.length === 0 && (
                <div className="card"><div className="tile-empty">
                  {q ? 'No matches' : 'No recipes yet — tell the chef'}
                </div></div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
