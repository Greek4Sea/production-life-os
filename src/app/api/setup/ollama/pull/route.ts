import { ollamaPull } from '@/lib/ollama';
import { requireSetupAccess } from '@/lib/setupAuth';

export const maxDuration = 600;

// Streams NDJSON progress from Ollama: {"status":"pulling ...","completed":..,"total":..}
export async function POST(req: Request) {
  const denied = await requireSetupAccess(req);
  if (denied) return denied;
  const { model } = await req.json().catch(() => ({}));
  if (typeof model !== 'string' || !/^[\w.:\-\/]{1,80}$/.test(model)) {
    return Response.json({ error: 'bad model name' }, { status: 400 });
  }
  return ollamaPull(model);
}
