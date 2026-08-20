import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { BottomNav } from '@/ui/Shell';
import { TasksView } from '@/modules/tasks/TasksView';

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  return (
    <main className="app">
      <TasksView />
      <BottomNav />
    </main>
  );
}
