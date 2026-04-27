import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Marks expired pending instances as overdue, then emails the relevant PC.
 * For critical tasks, the company's admins are also notified.
 * To avoid spamming, we only notify on the *first* time an instance flips to overdue
 * (detected by status transition: pending → overdue).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Find pending instances whose deadline has passed.
  const dueInstances = await prisma.taskInstance.findMany({
    where: { status: 'pending', dueDatetime: { lt: now } },
    include: {
      task: { select: { title: true, isCritical: true, companyId: true } },
      pc:   { select: { email: true, fullName: true } },
      doer: { select: { fullName: true } }
    }
  });

  if (dueInstances.length === 0) {
    return NextResponse.json({ overdue: 0 });
  }

  // Group by PC email and by company (for critical-task admin notifications).
  const byPC = new Map<string, typeof dueInstances>();
  const criticalByCompany = new Map<string, typeof dueInstances>();

  for (const i of dueInstances) {
    if (i.pc?.email) {
      const arr = byPC.get(i.pc.email) ?? [];
      arr.push(i);
      byPC.set(i.pc.email, arr);
    }
    if (i.task.isCritical) {
      const arr = criticalByCompany.get(i.task.companyId) ?? [];
      arr.push(i);
      criticalByCompany.set(i.task.companyId, arr);
    }
  }

  // Send PC emails.
  for (const [email, list] of byPC) {
    await sendEmail({
      to: email,
      subject: `[CheckFlow] ${list.length} task${list.length > 1 ? 's' : ''} overdue`,
      html: renderList('Overdue tasks under your coordination', list)
    });
  }

  // Critical-task notifications to all admins.
  for (const [companyId, list] of criticalByCompany) {
    const admins = await prisma.profile.findMany({
      where: { companyId, role: 'admin', isActive: true, email: { not: null } }
    });
    const recipients = admins.map((a) => a.email!).filter(Boolean);
    if (recipients.length === 0) continue;
    await sendEmail({
      to: recipients,
      subject: `[CheckFlow] CRITICAL: ${list.length} critical task${list.length > 1 ? 's' : ''} overdue`,
      html: renderList('Critical overdue tasks', list)
    });
  }

  // Flip them to 'overdue' so we don't notify again.
  await prisma.taskInstance.updateMany({
    where: { id: { in: dueInstances.map((i) => i.id) } },
    data: { status: 'overdue' }
  });

  return NextResponse.json({
    overdue: dueInstances.length,
    pcsNotified: byPC.size,
    criticalCompanies: criticalByCompany.size
  });
}

function renderList(heading: string, list: any[]): string {
  const items = list
    .map((i) =>
      `<li><strong>${esc(i.task.title)}</strong> — ${esc(i.doer?.fullName ?? '')}, due ${new Date(i.dueDatetime).toLocaleString()}</li>`
    )
    .join('');
  return `
    <div style="font-family:Inter,Arial,sans-serif;color:#172B63">
      <h2 style="color:#DC2626">${esc(heading)}</h2>
      <ul>${items}</ul>
      <p style="font-size:12px;color:#666">Sent automatically by CheckFlow.</p>
    </div>
  `;
}

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  );
}
