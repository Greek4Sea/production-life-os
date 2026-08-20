import { randomUUID } from 'crypto';
import { anthropicClient } from "@/lib/llm";
import { getConfig } from '@/lib/config';

// Name + optional self-description for the AI prompts (Settings → AI → About me).
export const userName = () => getConfig().core.allowedEmail.split('@')[0] || 'the user';
export const aboutMeLine = () => (getConfig().core.aboutMe ? ` About them: ${getConfig().core.aboutMe}.` : '');
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db, t } from '@/db';
import { gfetch } from '@/lib/google';
import { getSettings } from '@/lib/settings';
import { emit } from '@/lib/events';
import type { ModuleManifest } from '../types';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

type GHeader = { name: string; value: string };
type GPart = { mimeType?: string; body?: { data?: string }; parts?: GPart[]; headers?: GHeader[] };
type GMessage = {
  id: string; threadId: string; snippet: string; internalDate: string;
  labelIds?: string[];
  payload?: GPart;
};

const header = (m: GMessage, name: string) =>
  m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

// Depth-first hunt for the first body part of a given mime type (text/html or text/plain).
function findBody(p: GPart | undefined, want: string): string | null {
  if (!p) return null;
  if (p.mimeType?.startsWith(want) && p.body?.data) {
    return Buffer.from(p.body.data, 'base64url').toString('utf8');
  }
  for (const child of p.parts ?? []) {
    const hit = findBody(child, want);
    if (hit) return hit;
  }
  return null;
}

// Batch-classify with Claude: category + one-line summary per email.
async function triage(
  emails: { id: string; from: string; subject: string; snippet: string }[],
  keepSenders: string[],
  importantSenders: string[],
  aboutMe = '',
) {
  const anthropic = anthropicClient();
  const schema = {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            category: { type: 'string', enum: ['important', 'normal', 'newsletter', 'noise'] },
            summary: { type: 'string' },
          },
          required: ['id', 'category', 'summary'],
          additionalProperties: false,
        },
      },
    },
    required: ['results'],
    additionalProperties: false,
  } as const;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    system:
      'You triage a personal inbox.' +
      (aboutMe ? ` About the owner: ${aboutMe}.` : '') +
      ' For each ' +
      'email: category "important" = needs their attention or action — their school/work and teachers or colleagues, ' +
      'collaborators' +
      (importantSenders.length ? ` (especially ${importantSenders.join(', ')})` : '') +
      ', SAT/College Board and standardized testing, deadlines, real people writing to them personally, ' +
      'appointments, money. "normal" = real non-advertisement mail worth seeing but not urgent, "newsletter" = ' +
      'subscriptions/updates/digests they signed up for, "noise" = promotions, spam, automated junk — ' +
      'and ALWAYS "noise" for college/university recruitment and advertising mail ("apply now", ' +
      '"you\'ve been selected", campus visit invites, admissions marketing, scholarship-mill spam from ' +
      'any university they do not actually attend) and for ALL other advertising/marketing mail. ' +
      (keepSenders.length
        ? `Exception — they explicitly want mail from these senders/brands, never mark it noise ` +
          `(use "newsletter" or "normal"): ${keepSenders.join(', ')}. `
        : '') +
      'Be aggressive about noise: if it is automated marketing, a promotion, a sale, a product ' +
      'announcement, or anything trying to sell or recruit, it is "noise" — when torn between ' +
      '"normal" and "noise" for automated mail, pick "noise". ' +
      'summary = one short plain sentence saying what it is and any action/deadline. Return JSON only.',
    messages: [{
      role: 'user',
      content: JSON.stringify(emails.map((e) => ({
        id: e.id, from: e.from, subject: e.subject, snippet: e.snippet.slice(0, 300),
      }))),
    }],
    output_config: { format: { type: 'json_schema', schema } },
  });

  const text = response.content.find((b) => b.type === 'text');
  const parsed = JSON.parse(text?.type === 'text' ? text.text : '{"results":[]}');
  return new Map<string, { category: string; summary: string }>(
    (parsed.results as { id: string; category: string; summary: string }[])
      .map((r) => [r.id, { category: r.category, summary: r.summary }]),
  );
}

async function sync() {
  const settings = await getSettings<{
    notifyImportant: boolean; keepSenders: string[]; importantSenders: string[];
  }>('gmail');

  // Latest inbox messages + the current unread set.
  const inbox = await gfetch(`${GMAIL}/messages?labelIds=INBOX&maxResults=30`);
  const unreadList = await gfetch(`${GMAIL}/messages?labelIds=INBOX&labelIds=UNREAD&maxResults=100`);
  const unreadIds = new Set<string>((unreadList.messages ?? []).map((m: { id: string }) => m.id));
  const ids: string[] = (inbox.messages ?? []).map((m: { id: string }) => m.id);
  if (!ids.length) return;

  const known = ids.length
    ? await db().select({ id: t.gmailMessages.id }).from(t.gmailMessages)
      .where(inArray(t.gmailMessages.id, ids))
    : [];
  const knownIds = new Set(known.map((k) => k.id));
  const newIds = ids.filter((id) => !knownIds.has(id));

  // Fetch metadata for new messages.
  const fresh: (GMessage & { from: string; subject: string })[] = [];
  for (const id of newIds) {
    const m: GMessage = await gfetch(
      `${GMAIL}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
    );
    fresh.push({ ...m, from: header(m, 'From'), subject: header(m, 'Subject') });
  }

  // AI triage (one batched call), then store.
  if (fresh.length) {
    const verdicts = await triage(
      fresh.map((m) => ({ id: m.id, from: m.from, subject: m.subject, snippet: m.snippet })),
      settings.keepSenders ?? [],
      settings.importantSenders ?? [],
      getConfig().core.aboutMe,
    );
    for (const m of fresh) {
      const v = verdicts.get(m.id) ?? { category: 'normal', summary: m.subject || '(no subject)' };
      await db().insert(t.gmailMessages).values({
        id: m.id,
        threadId: m.threadId,
        fromAddr: m.from,
        subject: m.subject || '(no subject)',
        snippet: m.snippet,
        category: v.category,
        summary: v.summary,
        unread: m.labelIds?.includes('UNREAD') ?? true,
        receivedAt: m.internalDate ? new Date(Number(m.internalDate)) : new Date(),
      }).onConflictDoNothing();

      if (v.category === 'important' && (settings.notifyImportant ?? true)) {
        await db().insert(t.notifications).values({
          id: randomUUID(),
          moduleId: 'gmail',
          title: `📧 ${m.from.replace(/<.*>/, '').trim() || m.from}`,
          body: v.summary,
          url: `/m/gmail/${m.id}`,
          scheduledFor: new Date(),
          dedupeKey: `gmail:${m.id}`,
        }).onConflictDoNothing();
      }
    }
    await emit('gmail', 'gmail.synced', { new: fresh.length });
  }

  // Keep unread flags in step with Gmail.
  const nowUnread = ids.filter((id) => unreadIds.has(id));
  const nowRead = ids.filter((id) => !unreadIds.has(id));
  if (nowUnread.length) {
    await db().update(t.gmailMessages).set({ unread: true })
      .where(inArray(t.gmailMessages.id, nowUnread));
  }
  if (nowRead.length) {
    await db().update(t.gmailMessages).set({ unread: false })
      .where(inArray(t.gmailMessages.id, nowRead));
  }
}

// Re-run the AI over everything already stored (after the user changes filter rules).
async function retriageAll() {
  const settings = await getSettings<{ keepSenders: string[]; importantSenders: string[] }>('gmail');
  const rows = await db().select().from(t.gmailMessages)
    .orderBy(desc(t.gmailMessages.receivedAt)).limit(120);
  for (let i = 0; i < rows.length; i += 30) {
    const batch = rows.slice(i, i + 30);
    const verdicts = await triage(
      batch.map((m) => ({
        id: m.id, from: m.fromAddr, subject: m.subject ?? '', snippet: m.snippet ?? '',
      })),
      settings.keepSenders ?? [],
      settings.importantSenders ?? [],
      getConfig().core.aboutMe,
    );
    for (const m of batch) {
      const v = verdicts.get(m.id);
      if (v) {
        await db().update(t.gmailMessages)
          .set({ category: v.category, summary: v.summary })
          .where(inArray(t.gmailMessages.id, [m.id]));
      }
    }
  }
  return rows.length;
}

async function api(req: Request, path: string[]): Promise<Response | null> {
  // Manual refresh from the inbox header: sync Gmail right now.
  if (req.method === 'POST' && path[0] === 'sync') {
    try {
      await sync();
      return Response.json({ ok: true });
    } catch (e) {
      return Response.json({ ok: false, error: String(e).slice(0, 300) }, { status: 502 });
    }
  }
  if (req.method === 'POST' && path[0] === 'retriage') {
    return Response.json({ retriaged: await retriageAll() });
  }
  // Mark one message read (in Gmail itself + locally).
  if (req.method === 'POST' && path[0] === 'read' && path[1]) {
    await gfetch(`${GMAIL}/messages/${path[1]}/modify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
    });
    await db().update(t.gmailMessages).set({ unread: false })
      .where(inArray(t.gmailMessages.id, [path[1]]));
    return Response.json({ ok: true });
  }
  // Full message for the in-app reader — opening it reads it everywhere:
  // Gmail itself, the inbox list, and the notification bell.
  if (req.method === 'GET' && path[0] === 'message' && path[1]) {
    const id = path[1];
    const m: GMessage = await gfetch(`${GMAIL}/messages/${id}?format=full`);
    if (m.labelIds?.includes('UNREAD')) {
      await gfetch(`${GMAIL}/messages/${id}/modify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
      }).catch(() => {});
    }
    await db().update(t.gmailMessages).set({ unread: false })
      .where(eq(t.gmailMessages.id, id));
    await db().update(t.notifications).set({ readAt: new Date() })
      .where(and(eq(t.notifications.dedupeKey, `gmail:${id}`), isNull(t.notifications.readAt)));
    return Response.json({
      id: m.id,
      threadId: m.threadId,
      from: header(m, 'From'),
      to: header(m, 'To'),
      date: header(m, 'Date'),
      subject: header(m, 'Subject') || '(no subject)',
      html: findBody(m.payload, 'text/html'),
      text: findBody(m.payload, 'text/plain') ?? m.snippet ?? '',
    });
  }
  // AI reply drafting: writes a fresh draft, or revises the user's current one.
  if (req.method === 'POST' && path[0] === 'ai-draft') {
    const { id, instruction, current } = await req.json();
    const m: GMessage = await gfetch(`${GMAIL}/messages/${id}?format=full`);
    const plain = findBody(m.payload, 'text/plain');
    const html = findBody(m.payload, 'text/html');
    const bodyText = (plain ?? html?.replace(/<[^>]+>/g, ' ') ?? m.snippet ?? '')
      .replace(/[ \t]+/g, ' ').slice(0, 8000);
    const anthropic = anthropicClient();
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1000,
      system:
        `You draft email replies for ${userName()}.${aboutMeLine()} ` +
        'Write ONLY the reply body as plain text — no subject line, no quoting the original, ' +
        'no markdown, no explanations around it. Match the formality of the sender (teachers ' +
        'and professors get polite and proper, friends get casual). Keep it as short as ' +
        'politeness allows. Never invent facts, commitments, or availability he did not state — ' +
        'leave a [bracketed placeholder] where a detail is needed. Sign off with just ' +
        `"${userName()}" when a sign-off fits.`,
      messages: [{
        role: 'user',
        content:
          `Email from: ${header(m, 'From')}\nSubject: ${header(m, 'Subject')}\n\n${bodyText}\n\n---\n` +
          (current
            ? `Here is my current draft — revise it${instruction ? ` (${instruction})` : ''}:\n${current}`
            : `Draft a reply.${instruction ? ` Instructions: ${instruction}` : ''}`),
      }],
    });
    const text = res.content.find((b) => b.type === 'text');
    return Response.json({ draft: text?.type === 'text' ? text.text.trim() : '' });
  }
  // Save a reply as a real Gmail draft on the thread, then hand off to Gmail to send.
  if (req.method === 'POST' && path[0] === 'draft') {
    const { id, body } = await req.json();
    const m: GMessage = await gfetch(
      `${GMAIL}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Reply-To` +
      '&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=References',
    );
    const origSubject = header(m, 'Subject');
    const subject = /^re:/i.test(origSubject) ? origSubject : `Re: ${origSubject}`;
    const msgId = header(m, 'Message-ID');
    const refs = [header(m, 'References'), msgId].filter(Boolean).join(' ');
    const headers = [
      `To: ${header(m, 'Reply-To') || header(m, 'From')}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      ...(msgId ? [`In-Reply-To: ${msgId}`, `References: ${refs}`] : []),
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
    ];
    const mime = headers.join('\r\n') + '\r\n\r\n' + Buffer.from(String(body)).toString('base64');
    await gfetch(`${GMAIL}/drafts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: { raw: Buffer.from(mime).toString('base64url'), threadId: m.threadId },
      }),
    });
    return Response.json({ ok: true, url: `https://mail.google.com/mail/u/0/#inbox/${m.threadId}` });
  }
  if (req.method === 'GET' && path[0] === 'messages') {
    const rows = await db().select().from(t.gmailMessages)
      .orderBy(desc(t.gmailMessages.receivedAt)).limit(60);
    return Response.json(rows);
  }
  if (req.method === 'POST' && path[0] === 'sync') {
    await sync();
    return Response.json({ ok: true });
  }
  return null;
}

async function dashboardData() {
  const rows = await db().select().from(t.gmailMessages)
    .orderBy(desc(t.gmailMessages.receivedAt)).limit(30);
  const unread = rows.filter((r) => r.unread && r.category !== 'noise').length;
  const important = rows.filter((r) => r.category === 'important').slice(0, 3);
  // Latest mail regardless of category — the tile always shows real inbox state.
  const latest = rows.slice(0, 4).map((r) => ({
    id: r.id, fromAddr: r.fromAddr, subject: r.subject,
    summary: r.summary, unread: r.unread, category: r.category,
  }));
  return { unread, important, latest };
}

export const gmail: ModuleManifest = {
  enabled: () => Boolean(getConfig().core.allowedEmail && getConfig().anthropic.apiKey),
  id: 'gmail',
  name: 'Gmail',
  tileSize: 'sm',
  syncEveryMin: 1,
  sync,
  api,
  dashboardData,
  defaultSettings: {
    notifyImportant: true,
    keepSenders: [],
    importantSenders: [],
  },
};
