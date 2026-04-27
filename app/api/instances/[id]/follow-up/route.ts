import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({ note: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAuth();

  const inst = await prisma.taskInstance.findUnique({ where: { id: params.id } });
  if (!inst) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const allowed =
    ctx.userId === inst.pcId ||
    (ctx.profile.role === 'admin' && inst.companyId === ctx.profile.companyId) ||
    ctx.profile.role === 'super_admin';
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = (inst.followUpNotes as any[]) ?? [];
  const next = [
    ...existing,
    { note: parsed.data.note, created_by: ctx.userId, created_at: new Date().toISOString() }
  ];

  await prisma.taskInstance.update({
    where: { id: inst.id },
    data: { followUpNotes: next as any }
  });

  return NextResponse.json({ ok: true });
}
