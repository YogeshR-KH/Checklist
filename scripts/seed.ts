/**
 * CheckFlow seed script
 *
 * Creates: 1 company, 1 super_admin, 1 admin, 1 PC, 2 doers, 10 tasks,
 * plus today's instances and a few overdue ones for testing the PC dashboard.
 *
 * Requires (in .env):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   DATABASE_URL
 *
 * Run: npm run seed
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient, type UserRole } from '@prisma/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
const prisma = new PrismaClient();

const PASSWORD = 'Demo@1234';

async function ensureUser(email: string, fullName: string): Promise<string> {
  // Look for existing.
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) return existing.id;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });
  if (error || !data.user) throw error ?? new Error('createUser failed');
  return data.user.id;
}

async function upsertProfile(args: {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  companyId: string | null;
}) {
  await prisma.profile.upsert({
    where: { id: args.id },
    create: {
      id: args.id,
      fullName: args.fullName,
      email: args.email,
      role: args.role,
      companyId: args.companyId
    },
    update: {
      fullName: args.fullName,
      email: args.email,
      role: args.role,
      companyId: args.companyId
    }
  });
}

function todayUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function combine(date: Date, hhmmss: string): Date {
  const [h, m, s] = hhmmss.split(':').map((p) => parseInt(p, 10) || 0);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h, m, s ?? 0));
}

async function main() {
  console.log('› Seeding CheckFlow…');

  // Company
  const company = await prisma.company.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    create: { id: '00000000-0000-0000-0000-000000000001', name: 'Demo HoReCa Co' },
    update: { name: 'Demo HoReCa Co' }
  });

  // Users
  const superId = await ensureUser('superadmin@demo.com', 'Super Admin');
  const adminId = await ensureUser('admin@demo.com', 'Demo Admin');
  const pcId    = await ensureUser('pc@demo.com', 'Pat the PC');
  const doer1Id = await ensureUser('doer1@demo.com', 'Diana Doer');
  const doer2Id = await ensureUser('doer2@demo.com', 'Daniel Doer');

  await upsertProfile({ id: superId, fullName: 'Super Admin', email: 'superadmin@demo.com', role: 'super_admin', companyId: null });
  await upsertProfile({ id: adminId, fullName: 'Demo Admin',  email: 'admin@demo.com',      role: 'admin',       companyId: company.id });
  await upsertProfile({ id: pcId,    fullName: 'Pat the PC',  email: 'pc@demo.com',         role: 'pc',          companyId: company.id });
  await upsertProfile({ id: doer1Id, fullName: 'Diana Doer',  email: 'doer1@demo.com',      role: 'doer',        companyId: company.id });
  await upsertProfile({ id: doer2Id, fullName: 'Daniel Doer', email: 'doer2@demo.com',      role: 'doer',        companyId: company.id });

  // Tasks
  const taskDefs = [
    { title: 'Open kitchen and check fridge temperatures', freq: 'daily',   time: '08:00', critical: true,  remarks: false, doer: doer1Id },
    { title: 'Daily inventory of perishables',             freq: 'daily',   time: '09:30', critical: false, remarks: true,  doer: doer1Id },
    { title: 'Sanitize all prep surfaces',                 freq: 'daily',   time: '10:00', critical: false, remarks: false, doer: doer2Id },
    { title: 'Lobby and reception cleanliness check',      freq: 'daily',   time: '11:00', critical: false, remarks: false, doer: doer2Id },
    { title: 'Closing checklist — kitchen',                freq: 'daily',   time: '23:00', critical: true,  remarks: true,  doer: doer1Id },
    { title: 'Weekly deep-clean — walk-in cooler',         freq: 'weekly',  time: '15:00', critical: false, remarks: false, doer: doer2Id, config: { dayOfWeek: 1 } },
    { title: 'Weekly liquor stock count',                  freq: 'weekly',  time: '17:00', critical: false, remarks: true,  doer: doer1Id, config: { dayOfWeek: 0 } },
    { title: 'Pest-control inspection log review',         freq: 'weekly',  time: '12:00', critical: true,  remarks: false, doer: doer2Id, config: { dayOfWeek: 5 } },
    { title: 'Monthly fire-extinguisher check',            freq: 'monthly', time: '10:30', critical: true,  remarks: false, doer: doer1Id, config: { dayOfMonth: 1 } },
    { title: 'Monthly utility bill review',                freq: 'monthly', time: '16:00', critical: false, remarks: true,  doer: doer2Id, config: { dayOfMonth: 5 } }
  ] as const;

  // Wipe & recreate tasks for idempotency.
  await prisma.taskInstance.deleteMany({ where: { companyId: company.id } });
  await prisma.task.deleteMany({ where: { companyId: company.id } });

  const tasks = [];
  for (const def of taskDefs) {
    tasks.push(await prisma.task.create({
      data: {
        companyId: company.id,
        title: def.title,
        doerId: def.doer,
        backupDoerId: def.doer === doer1Id ? doer2Id : doer1Id,
        pcId,
        deadlineTime: def.time + ':00',
        frequency: def.freq as any,
        frequencyConfig: ('config' in def ? def.config : {}) as any,
        remarksRequired: def.remarks,
        isCritical: def.critical
      }
    }));
  }

  // Today's instances — first 5 daily tasks
  const today = todayUTC();
  for (const t of tasks.filter((x) => x.frequency === 'daily')) {
    await prisma.taskInstance.upsert({
      where: { taskId_dueDate: { taskId: t.id, dueDate: today } },
      create: {
        taskId: t.id,
        companyId: company.id,
        doerId: t.doerId,
        pcId: t.pcId,
        dueDate: today,
        dueDatetime: combine(today, t.deadlineTime),
        status: 'pending'
      },
      update: {}
    });
  }

  // Overdue: yesterday and 3 days ago, status = overdue
  const yesterday = new Date(today.getTime() - 86_400_000);
  const threeDaysAgo = new Date(today.getTime() - 3 * 86_400_000);
  const dailyTasks = tasks.filter((x) => x.frequency === 'daily').slice(0, 3);
  for (const t of dailyTasks) {
    for (const d of [yesterday, threeDaysAgo]) {
      await prisma.taskInstance.upsert({
        where: { taskId_dueDate: { taskId: t.id, dueDate: d } },
        create: {
          taskId: t.id,
          companyId: company.id,
          doerId: t.doerId,
          pcId: t.pcId,
          dueDate: d,
          dueDatetime: combine(d, t.deadlineTime),
          status: 'overdue'
        },
        update: { status: 'overdue' }
      });
    }
  }

  console.log(`✔ Seeded company=${company.name}`);
  console.log('  Login:');
  console.log('    superadmin@demo.com / Demo@1234');
  console.log('    admin@demo.com      / Demo@1234');
  console.log('    pc@demo.com         / Demo@1234');
  console.log('    doer1@demo.com      / Demo@1234');
  console.log('    doer2@demo.com      / Demo@1234');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
