import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Patch = z.object({
  title: z.string().min(1).optional(),
  doerId: z.string().uuid().optional(),
  backupDoerId: z.string().uuid().nullable().optional(),
  pcId: z.string().uuid().optional(),
  deadlineTime: z.string().optional(),
  frequency: z.string().optional(),
  frequencyConfig: z.record(z.any()).optional(),
  remarksRequired: z.boolean().optional(),
  isCritical: z.boolean().optional(),
  isActive: z.boolean().optional()
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireRole(['admin']);
  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task || task.companyId !== ctx.profile.companyId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const updated = await prisma.task.update({ where: { id: params.id }, data: parsed.data as any });
  return NextResponse.json({ task: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireRole(['admin']);
  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task || task.companyId !== ctx.profile.companyId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
