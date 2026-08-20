'use client';
import { useEffect, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };

// Docked calendar assistant. Renders as a side panel on desktop and a
// half-height bottom sheet on phones — the calendar stays visible either way.
export function CalChat({ open, onClose, onCalendarChanged }: {
  open: boolean; onClose: () => void; onCalendarChanged: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [msgs, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: text }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    try {
      const r = await fetch('/api/mod/gcal/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await r.json();
      setMsgs([...next, { role: 'assistant', content: data.reply ?? data.error ?? 'Something went wrong.' }]);
      if (data.mutated) onCalendarChanged();
    } catch {
      setMsgs([...next, { role: 'assistant', content: 'Offline — try again.' }]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <aside className="calchat-panel" aria-label="Calendar assistant">
      <div className="drawer-head">
        <h2>✦ Calendar AI</h2>
        <button className="back-btn" onClick={onClose} aria-label="Close assistant">✕</button>
      </div>
      <div className="calchat-msgs">
        {msgs.length === 0 && (
          <div className="calchat-hint">
            I can edit your Google Calendar while you watch:
            <span>&ldquo;add fencing practice tomorrow 5–7pm&rdquo;</span>
            <span>&ldquo;what does my week look like?&rdquo;</span>
            <span>&ldquo;delete the dentist appointment&rdquo;</span>
          </div>
        )}
        {msgs.map((m, i) => (
          <div className={`calchat-msg ${m.role}`} key={i}>{m.content}</div>
        ))}
        {busy && <div className="calchat-msg assistant"><span className="spin" /></div>}
        <div ref={endRef} />
      </div>
      <div className="calchat-input">
        <input
          className="text-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="Add, move, or ask anything…"
          disabled={busy}
        />
        <button className="btn primary" onClick={send} disabled={busy || !input.trim()}>→</button>
      </div>
    </aside>
  );
}
