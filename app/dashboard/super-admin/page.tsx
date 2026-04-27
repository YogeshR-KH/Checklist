import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import SuperAdminBoard from './SuperAdminBoard';

export default async function SuperAdminPage() {
  await requireRole(['super_admin']);

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { profiles: true, tasks: true } }
    }
  });

  return (
    <SuperAdminBoard
      companies={companies.map((c) => ({
        id: c.id,
        name: c.name,
        isActive: c.isActive,
        createdAt: c.createdAt.toISOString(),
        userCount: c._count.profiles,
        taskCount: c._count.tasks
      }))}
    />
  );
}
