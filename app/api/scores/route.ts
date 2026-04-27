import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { startOfMonth, endOfMonth } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const ctx = await requireAuth();
  const sp = req.nextUrl.searchParams;

  const userId = sp.get('user_id') ?? ctx.userId;
  const companyId = sp.get('company_id') ?? ctx.profile.companyId ?? undefined;

  // Authorization:
  // - super_admin: any user / any company
  // - admin: only their own company
  // - pc / doer: only themselves
  if (ctx.profile.role !== 'super_admin') {
    if (ctx.profile.role === 'admin') {
      if (companyId !== ctx.profile.companyId) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
    } else if (userId !== ctx.userId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const period = sp.get('period') ?? 'month';
  let from: Date, to: Date;
  if (period === 'month') {
    from = startOfMonth();
    to = endOfMonth();
  } else {
    const fromStr = sp.get('from');
    const toStr = sp.get('to');
    if (!fromStr || !toStr) {
      return NextResponse.json({ error: 'period=custom requires from & to' }, { status: 400 });
    }
    from = new Date(fromStr + 'T00:00:00Z');
    to = new Date(toStr + 'T00:00:00Z');
  }

  const instances = await prisma.taskInstance.findMany({
    where: {
      doerId: userId,
      ...(companyId ? { companyId } : {}),
      dueDate: { gte: from, lt: to },
      task: { isActive: true }
    },
    select: { status: true, completedAt: true, dueDatetime: true }
  });

  const total = instances.length;
  const done = instances.filter((i) => i.status === 'done').length;
  const onTime = instances.filter(
    (i) => i.status === 'done' && i.completedAt && i.completedAt <= i.dueDatetime
  ).length;

  const KRA1_completion = total ? (done / total) * 100 : 0;
  const KRA2_timeliness = total ? (onTime / total) * 100 : 0;

  return NextResponse.json({
    user_id: userId,
    company_id: companyId ?? null,
    period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    total,
    done,
    onTime,
    KRA1_completion: round(KRA1_completion),
    KRA1_missed: round(100 - KRA1_completion),
    KRA2_timeliness: round(KRA2_timeliness),
    KRA2_late: round(100 - KRA2_timeliness)
  });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
