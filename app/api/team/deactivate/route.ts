import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({ userId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const ctx = await requireRole(['admin']);
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const target = await prisma.profile.findUnique({ where: { id: parsed.data.userId } });
  if (!target || target.companyId !== ctx.profile.companyId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  await prisma.profile.update({ where: { id: target.id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
