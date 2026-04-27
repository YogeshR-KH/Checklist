import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron';
import { generateInstancesForDate, markPastDueOverdue } from '@/lib/generateInstances';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await generateInstancesForDate();
  const overdueCount = await markPastDueOverdue();
  return NextResponse.json({ ...result, markedOverdue: overdueCount });
}
