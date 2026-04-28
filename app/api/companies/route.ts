import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  name: z.string().min(1),
  adminName: z.string().min(1),
  adminEmail: z.string().email()
});

export async function POST(req: NextRequest) {
  await requireRole(['super_admin']);
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { name, adminName, adminEmail } = parsed.data;

  const company = await prisma.company.create({ data: { name } });

  const admin = createSupabaseAdminClient();
  const origin = req.nextUrl.origin;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(adminEmail, {
    data: { full_name: adminName },
    redirectTo: `${origin}/auth/callback?next=/auth/setup-password`
  });
  if (error || !data.user) {
    // roll back
    await prisma.company.delete({ where: { id: company.id } });
    return NextResponse.json({ error: error?.message ?? 'invite failed' }, { status: 400 });
  }

  await prisma.profile.create({
    data: {
      id: data.user.id,
      fullName: adminName,
      email: adminEmail,
      role: 'admin',
      companyId: company.id
    }
  });

  return NextResponse.json({ company });
}
