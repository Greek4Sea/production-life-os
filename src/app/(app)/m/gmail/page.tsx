import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { BottomNav } from '@/ui/Shell';
import { Inbox } from '@/modules/gmail/Inbox';

export default async function GmailPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  return (
    <main className="app">
      <Inbox />
      <BottomNav />
    </main>
  );
}
