// Tiny markdown renderer shared by the Obsidian and Kairos views:
// escape everything, then re-introduce a safe subset.
export function mdToHtml(src: string): string {
  const esc = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = esc.split('\n');
  const out: string[] = [];
  let inCode = false, inList = false;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  for (const raw of lines) {
    if (raw.trimStart().startsWith('```')) {
      closeList();
      out.push(inCode ? '</code></pre>' : '<pre class="ob-code"><code>');
      inCode = !inCode;
      continue;
    }
    if (inCode) { out.push(raw + '\n'); continue; }
    const line = raw
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\*(.+?)\*/g, '<i>$1</i>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) =>
        `<a class="ob-wiki" data-note="${target}">${label ?? target}</a>`)
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { closeList(); out.push(`<h${h[1].length + 1}>${h[2]}</h${h[1].length + 1}>`); continue; }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${li[1].replace(/^\[ \]\s*/, '☐ ').replace(/^\[x\]\s*/i, '☑ ')}</li>`);
      continue;
    }
    closeList();
    out.push(line.trim() === '' ? '' : `<p>${line}</p>`);
  }
  closeList();
  if (inCode) out.push('</code></pre>');
  return out.join('\n');
}
