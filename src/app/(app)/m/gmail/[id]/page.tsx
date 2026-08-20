import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { BottomNav } from '@/ui/Shell';
import { Reader } from '@/modules/gmail/Reader';

export default async function GmailMessagePage(
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const { id } = await params;
  return (
    <main className="app">
      <Reader id={id} />
      <BottomNav />
    </main>
  );
}
