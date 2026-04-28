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
  const tempPassword = generateTempPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: adminName }
  });
  if (error || !data.user) {
    await prisma.company.delete({ where: { id: company.id } });
    return NextResponse.json({ error: error?.message ?? 'create failed' }, { status: 400 });
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

  return NextResponse.json({
    company,
    adminEmail,
    tempPassword
  });
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw + '!1';
}
