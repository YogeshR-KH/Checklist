import SetupPasswordForm from './SetupPasswordForm';
import { getAuthContext } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function SetupPasswordPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">CheckFlow</h1>
          <p className="text-sm text-gray-600 mt-1">Welcome, {ctx.profile.fullName}</p>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold mb-1">Set your password</h2>
          <p className="text-xs text-gray-600 mb-4">
            You're signed in via the invite link. Pick a password to use for future logins.
          </p>
          <SetupPasswordForm />
        </div>
      </div>
    </main>
  );
}
