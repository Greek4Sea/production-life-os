import { redirect } from 'next/navigation';
import { isSetupDone } from '@/lib/config';

// Everything under (app) requires the first-run wizard to be finished.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSetupDone()) redirect('/setup');
  return <>{children}</>;
}
