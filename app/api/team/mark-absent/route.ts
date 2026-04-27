import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { todayUTC } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  doerId: z.string().uuid(),
  date: z.string().optional() // ISO yyyy-mm-dd
});

export async function POST(req: NextRequest) {
  const ctx = await requireRole(['admin', 'pc']);
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const target = await prisma.profile.findUnique({ where: { id: parsed.data.doerId } });
  if (!target || target.companyId !== ctx.profile.companyId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const date = parsed.data.date ? new Date(parsed.data.date + 'T00:00:00Z') : todayUTC();

  await prisma.absentLog.upsert({
    where: { doerId_absentDate: { doerId: target.id, absentDate: date } },
    create: {
      companyId: ctx.profile.companyId!,
      doerId: target.id,
      absentDate: date,
      markedBy: ctx.userId
    },
    update: { markedBy: ctx.userId }
  });

  // Re-route any of today's still-pending instances to backup doer if available.
  if (date.getTime() === todayUTC().getTime()) {
    const todays = await prisma.taskInstance.findMany({
      where: { doerId: target.id, dueDate: date, status: 'pending' },
      include: { task: true }
    });
    for (const inst of todays) {
      if (inst.task.backupDoerId) {
        await prisma.taskInstance.update({
          where: { id: inst.id },
          data: { doerId: inst.task.backupDoerId, isAbsentSwap: true }
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
