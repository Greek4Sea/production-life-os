import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { SignInButton } from '@/ui/SignInButton';
import { isSetupDone } from '@/lib/config';

export default async function SignIn() {
  const session = await auth();
  if (session?.user) redirect('/');
  if (!isSetupDone()) redirect('/setup');
  return (
    <main className="signin">
      <h1>Life OS</h1>
      <p>One dashboard that runs your life. Sign in with your Google account to continue.</p>
      <SignInButton callbackUrl="/" />
    </main>
  );
}
