import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth } from '@/lib/dates';
import AdminTabs from './AdminTabs';

export default async function AdminPage({
  searchParams
}: {
  searchParams: { tab?: string };
}) {
  const ctx = await requireRole(['admin']);
  if (!ctx.profile.companyId) redirect('/login');

  const tab = searchParams.tab ?? 'team';

  const [team, tasks, instancesThisMonth] = await Promise.all([
    prisma.profile.findMany({
      where: { companyId: ctx.profile.companyId },
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }]
    }),
    prisma.task.findMany({
      where: { companyId: ctx.profile.companyId },
      include: {
        doer: { select: { id: true, fullName: true } },
        backupDoer: { select: { id: true, fullName: true } },
        pc: { select: { id: true, fullName: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.taskInstance.findMany({
      where: {
        companyId: ctx.profile.companyId,
        dueDate: { gte: startOfMonth(), lt: endOfMonth() },
        task: { isActive: true }
      },
      select: {
        doerId: true, status: true, completedAt: true, dueDatetime: true
      }
    })
  ]);

  const scores = computeScores(team.filter((p) => p.role === 'doer'), instancesThisMonth);

  return (
    <AdminTabs
      tab={tab}
      team={team}
      tasks={JSON.parse(JSON.stringify(tasks))}
      scores={scores}
    />
  );
}

function computeScores(
  doers: { id: string; fullName: string }[],
  instances: { doerId: string; status: string; completedAt: Date | null; dueDatetime: Date }[]
) {
  return doers.map((d) => {
    const own = instances.filter((i) => i.doerId === d.id);
    const total = own.length;
    const done = own.filter((i) => i.status === 'done').length;
    const onTime = own.filter(
      (i) => i.status === 'done' && i.completedAt && i.completedAt <= i.dueDatetime
    ).length;
    const completion = total ? (done / total) * 100 : 0;
    const timeliness = total ? (onTime / total) * 100 : 0;
    return {
      id: d.id,
      name: d.fullName,
      total,
      kra1Completion: Math.round(completion),
      kra1Missed: Math.round(100 - completion),
      kra2Timeliness: Math.round(timeliness),
      kra2Late: Math.round(100 - timeliness)
    };
  });
}
