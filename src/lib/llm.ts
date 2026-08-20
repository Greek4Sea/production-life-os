import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '@/lib/config';

// One door for "give me JSON back" requests from tasks / recipes / passwords.
// Routes to local Ollama (default) or to Anthropic when the user chose to skip
// Ollama during setup (ai.provider = 'anthropic').
export type JsonChat = {
  system: string;
  user: string;
  // which Ollama model slot to use (ignored for Anthropic)
  slot: 'tasksModel' | 'recipesModel' | 'passwordsModel';
};

export class AiNotConfigured extends Error {
  status = 503;
  constructor(msg = 'AI is not set up — open Settings → Integrations → AI') { super(msg); }
}

export function aiProvider() {
  const c = getConfig();
  if (c.ai.provider === 'anthropic') return c.anthropic.apiKey ? 'anthropic' : null;
  return 'ollama';
}

export async function chatJson<T = Record<string, unknown>>(req: JsonChat): Promise<T> {
  const c = getConfig();
  const provider = aiProvider();
  if (!provider) throw new AiNotConfigured();

  if (provider === 'anthropic') {
    const anthropic = new Anthropic({ apiKey: c.anthropic.apiKey });
    const r = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: `${req.system}\n\nReply with ONLY a JSON object, no prose, no code fences.`,
      messages: [{ role: 'user', content: req.user }],
    });
    const text = r.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('');
    return parseJson<T>(text);
  }

  const model = c.ollama[req.slot];
  const res = await fetch(`${c.ollama.url}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model, stream: false, format: 'json', think: false, keep_alive: '2h',
      options: { temperature: 0 },
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
    }),
  }).catch(() => { throw new Error(`Ollama is not reachable at ${c.ollama.url} — is it running?`); });
  if (!res.ok) throw new Error(`Ollama ${res.status} — is the ${model} model pulled? (ollama pull ${model})`);
  const data = await res.json();
  return parseJson<T>(data.message?.content ?? '{}');
}

function parseJson<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* ignore */ } }
  return {} as T;
}

// Anthropic client for the modules that always use Claude (Gmail triage, Calendar chat).
export function anthropicClient(): Anthropic {
  const key = getConfig().anthropic.apiKey;
  if (!key) throw new AiNotConfigured('Anthropic API key is not set — add it in Settings → Integrations → AI');
  return new Anthropic({ apiKey: key });
}
