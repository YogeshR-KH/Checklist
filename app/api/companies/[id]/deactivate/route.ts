import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  await requireRole(['super_admin']);
  await prisma.company.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
