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
  // Provision the user with a generated temp password — admin shares it with
  // the user out-of-band. Avoids the invite-email round-trip, which is fragile
  // across the Supabase /verify redirect (implicit hash-params don't survive
  // an SSR cookie session). User can change password later via account UI.
  const tempPassword = generateTempPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? 'create failed' }, { status: 400 });
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

  return NextResponse.json({
    ok: true,
    userId: data.user.id,
    email,
    tempPassword
  });
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw + '!1';
}
