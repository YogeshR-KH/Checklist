import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from './supabase/server';
import { prisma } from './prisma';
import type { Profile, UserRole } from '@prisma/client';

export type AuthContext = {
  userId: string;
  email: string | null;
  profile: Profile;
};

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) return null;

  return { userId: user.id, email: user.email ?? null, profile };
}

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');
  return ctx;
}

export async function requireRole(roles: UserRole[]): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!roles.includes(ctx.profile.role)) {
    redirect(roleDashboard(ctx.profile.role));
  }
  return ctx;
}

export function roleDashboard(role: UserRole): string {
  switch (role) {
    case 'super_admin': return '/dashboard/super-admin';
    case 'admin':       return '/dashboard/admin';
    case 'pc':          return '/dashboard/pc';
    case 'doer':        return '/dashboard/doer';
  }
}
