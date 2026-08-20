import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient } from "@/lib/llm";
import { userName, aboutMeLine } from './index';
import { TZ } from '@/lib/dates';
import { gfetch } from '@/lib/google';
import { emit } from '@/lib/events';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const MODEL = 'claude-sonnet-5'; // smarter model for drafting/explaining (triage uses Haiku)

type GPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GPart[];
};
type GFull = {
  id: string; threadId: string;
  payload?: GPart & { headers?: { name: string; value: string }[] };
};

const b64urlDecode = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
const b64urlEncode = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function findPart(part: GPart | undefined, mime: string): string | null {
  if (!part) return null;
  if (part.mimeType === mime && part.body?.data) return b64urlDecode(part.body.data);
  for (const p of part.parts ?? []) {
    const found = findPart(p, mime);
    if (found) return found;
  }
  return null;
}

export async function getFullMessage(id: string) {
  const m: GFull = await gfetch(`${GMAIL}/messages/${id}?format=full`);
  const h = (name: string) =>
    m.payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value ?? '';
  let body = findPart(m.payload, 'text/plain');
  if (!body) {
    const html = findPart(m.payload, 'text/html');
    body = html ? html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') : '';
  }
  return {
    id: m.id,
    threadId: m.threadId,
    from: h('From'),
    to: h('To'),
    subject: h('Subject'),
    messageId: h('Message-ID'),
    body: (body ?? '').slice(0, 8000),
  };
}

function anthropic() {
  return anthropicClient();
}

const textOf = (r: Anthropic.Message) => {
  const b = r.content.find((x) => x.type === 'text');
  return b?.type === 'text' ? b.text : '';
};

// "Explain this email to me."
export async function explain(id: string) {
  const m = await getFullMessage(id);
  const r = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      'You explain emails to a busy high-school student in plain language. Say what it is, what it means ' +
      'for them, and what (if anything) they need to do and by when. Short paragraphs, no fluff.',
    messages: [{ role: 'user', content: `From: ${m.from}\nSubject: ${m.subject}\n\n${m.body}` }],
  });
  return { explanation: textOf(r) };
}

// Draft a reply (never sends — user approves first).
export async function draftReply(id: string, instructions?: string) {
  const m = await getFullMessage(id);
  const r = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      `You draft email replies for ${userName()}.${aboutMeLine()} Write the reply body ` +
      'only — no subject line, no commentary, no placeholders like [Name]. Match the formality of the ' +
      `incoming email; friendly and brief by default. Sign off as "${userName()}".`,
    messages: [{
      role: 'user',
      content:
        `Email to reply to:\nFrom: ${m.from}\nSubject: ${m.subject}\n\n${m.body}\n\n` +
        (instructions ? `Instructions for the reply: ${instructions}` : 'Write an appropriate reply.'),
    }],
  });
  return { draft: textOf(r), to: m.from, subject: m.subject.startsWith('Re:') ? m.subject : `Re: ${m.subject}` };
}

// Extract a calendar event proposal from the email (user confirms before it's created).
export async function extractEvent(id: string) {
  const m = await getFullMessage(id);
  const now = new Date().toLocaleString('en-US', { timeZone: TZ });
  const schema = {
    type: 'object',
    properties: {
      found: { type: 'boolean' },
      title: { type: 'string' },
      start: { type: 'string', description: 'ISO 8601 with timezone offset, e.g. 2026-08-20T15:00:00-07:00' },
      end: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['found', 'title', 'start', 'end', 'description'],
    additionalProperties: false,
  } as const;
  const r = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 512,
    system:
      `Extract the single most relevant calendar event from the email (meeting, deadline, appointment, ` +
      `practice, exam...). Current date/time in the user's timezone (${TZ}): ${now}. ` +
      `Return found=false if there is no concrete event. Times are in ${TZ}; if only a date is ` +
      `known, use 09:00-10:00. description = one line saying where this came from.`,
    messages: [{ role: 'user', content: `From: ${m.from}\nSubject: ${m.subject}\n\n${m.body}` }],
    output_config: { format: { type: 'json_schema', schema } },
  });
  return JSON.parse(textOf(r) || '{"found":false}');
}

// Send a reply the user approved.
export async function sendReply(id: string, body: string) {
  const m = await getFullMessage(id);
  const to = m.from;
  const subject = m.subject.startsWith('Re:') ? m.subject : `Re: ${m.subject}`;
  const raw = [
    `To: ${to}`,
    `Subject: ${subject}`,
    m.messageId ? `In-Reply-To: ${m.messageId}` : '',
    m.messageId ? `References: ${m.messageId}` : '',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].filter((l, i) => l !== '' || i >= 4).join('\r\n');

  const sent = await gfetch(`${GMAIL}/messages/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ raw: b64urlEncode(raw), threadId: m.threadId }),
  });
  await emit('gmail', 'gmail.reply_sent', { to, subject, inReplyTo: id });
  return { ok: true, id: sent.id };
}
