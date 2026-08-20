import { getConfig } from '@/lib/config';

export type OllamaStatus = { reachable: boolean; url: string; models: string[] };

export async function ollamaStatus(): Promise<OllamaStatus> {
  const url = getConfig().ollama.url;
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return { reachable: false, url, models: [] };
    const data = await res.json();
    return { reachable: true, url, models: (data.models ?? []).map((m: { name: string }) => m.name) };
  } catch {
    return { reachable: false, url, models: [] };
  }
}

// Streams Ollama's pull progress lines straight through (NDJSON).
export async function ollamaPull(model: string): Promise<Response> {
  const url = getConfig().ollama.url;
  const res = await fetch(`${url}/api/pull`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: model, stream: true }),
  });
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' },
  });
}
