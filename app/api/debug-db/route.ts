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

  let queryOk = false;
  let queryError: string | null = null;
  try {
    const rows = await prisma.$queryRawUnsafe<{ ok: number }[]>(`select 1 as ok`);
    queryOk = Array.isArray(rows) && rows[0]?.ok === 1;
  } catch (e: any) {
    queryError = String(e?.message ?? e).slice(0, 600);
  }

  return NextResponse.json({
    DATABASE_URL_set: process.env.DATABASE_URL ? true : false,
    DATABASE_URL_masked: masked,
    DIRECT_URL_set: process.env.DIRECT_URL ? true : false,
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(unset)',
    SUPABASE_ANON_KEY_set: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SERVICE_ROLE_KEY_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET_set: !!process.env.CRON_SECRET,
    queryOk,
    queryError
  });
}
