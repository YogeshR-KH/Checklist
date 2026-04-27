import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { todayUTC } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 8 AM admin digest — counts of yesterday's done / missed and currently-overdue.
 * Schedule: 0 8 * * * (server tz).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const today = todayUTC();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const now = new Date();

  const companies = await prisma.company.findMany({ where: { isActive: true } });
  const summaries: any[] = [];

  for (const c of companies) {
    const [yDone, yMissed, currentOverdue, admins] = await Promise.all([
      prisma.taskInstance.count({
        where: { companyId: c.id, dueDate: yesterday, status: 'done' }
      }),
      prisma.taskInstance.count({
        where: { companyId: c.id, dueDate: yesterday, status: { not: 'done' } }
      }),
      prisma.taskInstance.count({
        where: { companyId: c.id, status: { not: 'done' }, dueDatetime: { lt: now } }
      }),
      prisma.profile.findMany({
        where: { companyId: c.id, role: 'admin', isActive: true, email: { not: null } }
      })
    ]);

    const recipients = admins.map((a) => a.email!).filter(Boolean);
    if (recipients.length === 0) continue;

    await sendEmail({
      to: recipients,
      subject: `[CheckFlow] Daily digest — ${c.name}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;color:#172B63">
          <h2>Daily digest — ${escapeHtml(c.name)}</h2>
          <p>Snapshot for ${yesterday.toISOString().slice(0, 10)}:</p>
          <ul>
            <li><strong>${yDone}</strong> tasks completed yesterday</li>
            <li><strong style="color:#DC2626">${yMissed}</strong> tasks missed yesterday</li>
            <li><strong style="color:#DC2626">${currentOverdue}</strong> currently overdue</li>
          </ul>
          <p style="font-size:12px;color:#666">Sent automatically by CheckFlow.</p>
        </div>
      `
    });
    summaries.push({ company: c.name, yDone, yMissed, currentOverdue });
  }

  return NextResponse.json({ digestsSent: summaries.length, summaries });
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  );
}
