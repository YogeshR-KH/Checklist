import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  title: z.string().min(1),
  doerId: z.string().uuid(),
  backupDoerId: z.string().uuid().nullable().optional(),
  pcId: z.string().uuid(),
  deadlineTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  frequency: z.enum([
    'daily','weekly','fortnightly','monthly',
    'first_sunday','second_sunday','half_yearly','yearly','custom'
  ]),
  frequencyConfig: z.record(z.any()).optional(),
  remarksRequired: z.boolean().optional(),
  isCritical: z.boolean().optional()
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
  const data = parsed.data;

  // Verify referenced profiles belong to the same company
  const refs = await prisma.profile.findMany({
    where: {
      id: { in: [data.doerId, data.pcId, ...(data.backupDoerId ? [data.backupDoerId] : [])] }
    }
  });
  if (refs.some((p) => p.companyId !== ctx.profile.companyId)) {
    return NextResponse.json({ error: 'cross-company reference' }, { status: 400 });
  }

  const time = data.deadlineTime.length === 5 ? data.deadlineTime + ':00' : data.deadlineTime;

  const task = await prisma.task.create({
    data: {
      companyId: ctx.profile.companyId,
      title: data.title,
      doerId: data.doerId,
      backupDoerId: data.backupDoerId ?? null,
      pcId: data.pcId,
      deadlineTime: time,
      frequency: data.frequency,
      frequencyConfig: data.frequencyConfig ?? {},
      remarksRequired: !!data.remarksRequired,
      isCritical: !!data.isCritical
    }
  });

  return NextResponse.json({ task });
}
