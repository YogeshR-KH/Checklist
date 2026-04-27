import { redirect } from 'next/navigation';
import { getAuthContext, roleDashboard } from '@/lib/auth';

export default async function HomePage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');
  redirect(roleDashboard(ctx.profile.role));
}
