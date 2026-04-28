import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * TEMPORARY debug endpoint — gated by CRON_SECRET. Remove after verifying.
 * GET /api/debug-db?secret=<CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = process.env.DATABASE_URL ?? '(unset)';
  // Mask password but show host + length so we can detect typos.
  const masked = url.replace(/:\/\/([^:]+):([^@]+)@/, (_, u, p) => {
    const head = p.slice(0, 2);
    const tail = p.slice(-2);
    return `://${u}:${head}…${tail}(len=${p.length})@`;
  });

  const probes: Record<string, any> = {};

  async function probe(name: string, fn: () => Promise<any>) {
    try {
      const res = await fn();
      probes[name] = { ok: true, sample: typeof res === 'number' ? res : Array.isArray(res) ? `count=${res.length}` : 'ok' };
    } catch (e: any) {
      probes[name] = { ok: false, error: String(e?.message ?? e).slice(0, 800) };
    }
  }

  await probe('select1', async () => {
    const r = await prisma.$queryRawUnsafe<{ ok: number }[]>(`select 1 as ok`);
    return r[0]?.ok;
  });
  await probe('countCompanies', () => prisma.company.count());
  await probe('countProfiles', () => prisma.profile.count());
  await probe('findFirstAdmin', () => prisma.profile.findFirst({ where: { role: 'admin' } }));
  await probe('listProfiles', () =>
    prisma.profile.findMany({
      where: { companyId: '00000000-0000-0000-0000-000000000001' },
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }]
    })
  );
  await probe('listTasks', () =>
    prisma.task.findMany({
      where: { companyId: '00000000-0000-0000-0000-000000000001' },
      include: {
        doer: { select: { id: true, fullName: true } },
        backupDoer: { select: { id: true, fullName: true } },
        pc: { select: { id: true, fullName: true } }
      }
    })
  );
  await probe('listInstancesWithTaskFilter', () =>
    prisma.taskInstance.findMany({
      where: {
        companyId: '00000000-0000-0000-0000-000000000001',
        task: { isActive: true }
      },
      take: 5
    })
  );

  return NextResponse.json({
    DATABASE_URL_set: !!process.env.DATABASE_URL,
    DATABASE_URL_masked: masked,
    DATABASE_URL_endsWithNewline: url.endsWith('\n'),
    DIRECT_URL_set: !!process.env.DIRECT_URL,
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(unset)',
    SUPABASE_ANON_KEY_set: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SERVICE_ROLE_KEY_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET_set: !!process.env.CRON_SECRET,
    probes
  });
}
