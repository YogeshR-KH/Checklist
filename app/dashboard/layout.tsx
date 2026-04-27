import { requireAuth } from '@/lib/auth';
import Link from 'next/link';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuth();
  return (
    <div className="min-h-screen bg-neutral">
      <header className="bg-primary text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg">CheckFlow</Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:block opacity-80">{ctx.profile.fullName}</span>
            <span className="px-2 py-0.5 rounded bg-accent text-primary text-xs font-semibold uppercase">
              {ctx.profile.role.replace('_', ' ')}
            </span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="text-xs underline opacity-90 hover:opacity-100">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
