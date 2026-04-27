import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { todayUTC } from '@/lib/dates';
import PCBoard from './PCBoard';

export default async function PCPage({
  searchParams
}: {
  searchParams: { doer?: string; from?: string; to?: string };
}) {
  const ctx = await requireRole(['pc']);
  const today = todayUTC();
  const now = new Date();

  const where: any = { pcId: ctx.userId };
  if (searchParams.doer) where.doerId = searchParams.doer;

  const [todays, overdue, doers] = await Promise.all([
    prisma.taskInstance.findMany({
      where: {
        ...where,
        dueDate: searchParams.from || searchParams.to
          ? {
              ...(searchParams.from ? { gte: new Date(searchParams.from + 'T00:00:00Z') } : {}),
              ...(searchParams.to   ? { lte: new Date(searchParams.to   + 'T00:00:00Z') } : {})
            }
          : today,
        status: 'pending'
      },
      include: {
        task: { select: { title: true, isCritical: true } },
        doer: { select: { fullName: true } }
      },
      orderBy: { dueDatetime: 'asc' }
    }),
    prisma.taskInstance.findMany({
      where: {
        ...where,
        dueDatetime: { lt: now },
        status: { not: 'done' },
        // for "overdue" section we exclude today's still-pending unless deadline passed (covered by lt:now)
      },
      include: {
        task: { select: { title: true, isCritical: true } },
        doer: { select: { fullName: true } }
      },
      orderBy: { dueDatetime: 'asc' }
    }),
    prisma.profile.findMany({
      where: { companyId: ctx.profile.companyId, role: 'doer', isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' }
    })
  ]);

  return (
    <PCBoard
      todays={JSON.parse(JSON.stringify(todays))}
      overdue={JSON.parse(JSON.stringify(overdue))}
      doers={doers}
      filters={{
        doer: searchParams.doer ?? '',
        from: searchParams.from ?? '',
        to: searchParams.to ?? ''
      }}
    />
  );
}
