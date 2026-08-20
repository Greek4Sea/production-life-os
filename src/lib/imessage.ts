import { execFile } from 'child_process';
import { getSettings } from '@/lib/settings';

// Task reminders as texts, sent through Messages.app on this Mac (macOS only).
// Number lives in Settings → Life OS → "Text me task reminders".
const SCRIPT = `
on run argv
  set phone to item 1 of argv
  set msg to item 2 of argv
  tell application "Messages"
    set svc to 1st account whose service type = iMessage
    set who to participant phone of svc
    send msg to who
  end tell
end run`;

export async function imessageTarget(): Promise<string> {
  const s = await getSettings<{ imessageTo?: string }>('system');
  return (s.imessageTo ?? '').trim();
}

export function imessageAvailable() {
  return process.platform === 'darwin';
}

export function sendIMessage(to: string, body: string): Promise<void> {
  if (!imessageAvailable()) return Promise.reject(new Error('iMessage texts only work on macOS'));
  if (!/^[+\d][\d\s().-]{5,}$|^[^@\s]+@[^@\s]+$/.test(to)) return Promise.reject(new Error('bad phone number / Apple ID'));
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/osascript', ['-e', SCRIPT, to, body], { timeout: 20_000 }, (err, _out, stderr) =>
      err ? reject(new Error((stderr || String(err)).trim().slice(0, 300))) : resolve());
  });
}

// Fire-and-forget from the notification loop: never fails the notification.
export async function textTaskReminder(title: string, body?: string | null) {
  const to = await imessageTarget().catch(() => '');
  if (!to || !imessageAvailable()) return;
  try {
    await sendIMessage(to, body ? `${title}\n${body}` : title);
  } catch (e) {
    console.log(`[life-os] iMessage reminder failed: ${String(e).slice(0, 200)}`);
  }
}
