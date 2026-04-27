import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({ remarks: z.string().nullable().optional() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAuth();
  const inst = await prisma.taskInstance.findUnique({
    where: { id: params.id },
    include: { task: true }
  });
  if (!inst) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Only the assigned doer (or admins/super_admin) can complete.
  const allowed =
    ctx.userId === inst.doerId ||
    ctx.profile.role === 'admin' && inst.companyId === ctx.profile.companyId ||
    ctx.profile.role === 'super_admin';
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (inst.task.remarksRequired && !parsed.data.remarks?.trim()) {
    return NextResponse.json({ error: 'remarks required' }, { status: 400 });
  }

  const updated = await prisma.taskInstance.update({
    where: { id: inst.id },
    data: {
      status: 'done',
      completedAt: new Date(),
      remarks: parsed.data.remarks ?? null
    }
  });

  return NextResponse.json({ instance: updated });
}
