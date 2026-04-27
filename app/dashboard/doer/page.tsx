import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { todayUTC, startOfMonth, endOfMonth } from '@/lib/dates';
import DoerBoard from './DoerBoard';

export default async function DoerPage() {
  const ctx = await requireRole(['doer']);
  const today = todayUTC();

  const [todayInstances, monthInstances] = await Promise.all([
    prisma.taskInstance.findMany({
      where: { doerId: ctx.userId, dueDate: today },
      include: {
        task: { select: { title: true, remarksRequired: true, isCritical: true } }
      },
      orderBy: { dueDatetime: 'asc' }
    }),
    prisma.taskInstance.findMany({
      where: {
        doerId: ctx.userId,
        dueDate: { gte: startOfMonth(), lt: endOfMonth() },
        task: { isActive: true }
      },
      select: { status: true, completedAt: true, dueDatetime: true }
    })
  ]);

  const total = monthInstances.length;
  const done = monthInstances.filter((i) => i.status === 'done').length;
  const onTime = monthInstances.filter(
    (i) => i.status === 'done' && i.completedAt && i.completedAt <= i.dueDatetime
  ).length;

  const score = {
    missed: total - done,
    late: done - onTime
  };

  return (
    <DoerBoard
      instances={JSON.parse(JSON.stringify(todayInstances))}
      score={score}
    />
  );
}
