import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'pc', 'doer'])
});

export async function POST(req: NextRequest) {
  const ctx = await requireRole(['admin']);
  if (!ctx.profile.companyId) {
    return NextResponse.json({ error: 'no company' }, { status: 400 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { fullName, email, role } = parsed.data;

  const admin = createSupabaseAdminClient();
  // Invite user — Supabase emails them a sign-up link.
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName }
  });
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? 'invite failed' }, { status: 400 });
  }

  await prisma.profile.create({
    data: {
      id: data.user.id,
      fullName,
      email,
      role,
      companyId: ctx.profile.companyId
    }
  });

  return NextResponse.json({ ok: true, userId: data.user.id });
}
