/**
 * CheckFlow seed — Supabase REST path.
 *
 * Uses only the service-role key + Supabase JS client, so it does NOT need
 * a working DATABASE_URL / DB password. Useful when the Postgres password
 * is being rejected at the pooler but PostgREST + Auth are healthy.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const PASSWORD = 'Demo@1234';
const COMPANY_ID = '00000000-0000-0000-0000-000000000001';

async function ensureUser(email: string, fullName: string): Promise<string> {
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
  id: string; fullName: string; email: string;
  role: 'super_admin' | 'admin' | 'pc' | 'doer';
  companyId: string | null;
}) {
  const { error } = await supabase.from('profiles').upsert({
    id: args.id,
    full_name: args.fullName,
    email: args.email,
    role: args.role,
    company_id: args.companyId
  }, { onConflict: 'id' });
  if (error) throw error;
}

function todayUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function combine(date: Date, hhmmss: string): string {
  const [h, m, s] = hhmmss.split(':').map((p) => parseInt(p, 10) || 0);
  const dt = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h, m, s ?? 0));
  return dt.toISOString();
}

async function main() {
  console.log('› Seeding CheckFlow via Supabase REST…');

  // Company
  const { error: cErr } = await supabase.from('companies').upsert({
    id: COMPANY_ID, name: 'Demo HoReCa Co'
  }, { onConflict: 'id' });
  if (cErr) throw cErr;

  // Users
  const superId = await ensureUser('superadmin@demo.com', 'Super Admin');
  const adminId = await ensureUser('admin@demo.com', 'Demo Admin');
  const pcId    = await ensureUser('pc@demo.com', 'Pat the PC');
  const doer1Id = await ensureUser('doer1@demo.com', 'Diana Doer');
  const doer2Id = await ensureUser('doer2@demo.com', 'Daniel Doer');

  await upsertProfile({ id: superId, fullName: 'Super Admin', email: 'superadmin@demo.com', role: 'super_admin', companyId: null });
  await upsertProfile({ id: adminId, fullName: 'Demo Admin',  email: 'admin@demo.com',      role: 'admin',       companyId: COMPANY_ID });
  await upsertProfile({ id: pcId,    fullName: 'Pat the PC',  email: 'pc@demo.com',         role: 'pc',          companyId: COMPANY_ID });
  await upsertProfile({ id: doer1Id, fullName: 'Diana Doer',  email: 'doer1@demo.com',      role: 'doer',        companyId: COMPANY_ID });
  await upsertProfile({ id: doer2Id, fullName: 'Daniel Doer', email: 'doer2@demo.com',      role: 'doer',        companyId: COMPANY_ID });

  console.log('  Users + profiles ready.');

  // Wipe old tasks/instances for this company.
  await supabase.from('task_instances').delete().eq('company_id', COMPANY_ID);
  await supabase.from('tasks').delete().eq('company_id', COMPANY_ID);

  const taskDefs = [
    { title: 'Open kitchen and check fridge temperatures', freq: 'daily',   time: '08:00', critical: true,  remarks: false, doer: doer1Id, config: {} },
    { title: 'Daily inventory of perishables',             freq: 'daily',   time: '09:30', critical: false, remarks: true,  doer: doer1Id, config: {} },
    { title: 'Sanitize all prep surfaces',                 freq: 'daily',   time: '10:00', critical: false, remarks: false, doer: doer2Id, config: {} },
    { title: 'Lobby and reception cleanliness check',      freq: 'daily',   time: '11:00', critical: false, remarks: false, doer: doer2Id, config: {} },
    { title: 'Closing checklist — kitchen',                freq: 'daily',   time: '23:00', critical: true,  remarks: true,  doer: doer1Id, config: {} },
    { title: 'Weekly deep-clean — walk-in cooler',         freq: 'weekly',  time: '15:00', critical: false, remarks: false, doer: doer2Id, config: { dayOfWeek: 1 } },
    { title: 'Weekly liquor stock count',                  freq: 'weekly',  time: '17:00', critical: false, remarks: true,  doer: doer1Id, config: { dayOfWeek: 0 } },
    { title: 'Pest-control inspection log review',         freq: 'weekly',  time: '12:00', critical: true,  remarks: false, doer: doer2Id, config: { dayOfWeek: 5 } },
    { title: 'Monthly fire-extinguisher check',            freq: 'monthly', time: '10:30', critical: true,  remarks: false, doer: doer1Id, config: { dayOfMonth: 1 } },
    { title: 'Monthly utility bill review',                freq: 'monthly', time: '16:00', critical: false, remarks: true,  doer: doer2Id, config: { dayOfMonth: 5 } }
  ];

  const taskRows = taskDefs.map((d) => ({
    company_id: COMPANY_ID,
    title: d.title,
    doer_id: d.doer,
    backup_doer_id: d.doer === doer1Id ? doer2Id : doer1Id,
    pc_id: pcId,
    deadline_time: d.time + ':00',
    frequency: d.freq,
    frequency_config: d.config,
    remarks_required: d.remarks,
    is_critical: d.critical
  }));

  const { data: insertedTasks, error: tErr } = await supabase
    .from('tasks').insert(taskRows).select('*');
  if (tErr) throw tErr;
  console.log(`  Tasks inserted: ${insertedTasks!.length}`);

  // Today's pending instances for daily tasks
  const today = todayUTC();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today.getTime() - 86_400_000);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const threeDaysAgo = new Date(today.getTime() - 3 * 86_400_000);
  const threeStr = threeDaysAgo.toISOString().slice(0, 10);

  const dailyTasks = insertedTasks!.filter((t: any) => t.frequency === 'daily');

  const instanceRows: any[] = [];
  for (const t of dailyTasks) {
    instanceRows.push({
      task_id: t.id,
      company_id: COMPANY_ID,
      doer_id: t.doer_id,
      pc_id: t.pc_id,
      due_date: todayStr,
      due_datetime: combine(today, t.deadline_time),
      status: 'pending'
    });
  }
  for (const t of dailyTasks.slice(0, 3)) {
    for (const [d, ds] of [[yesterday, yesterdayStr], [threeDaysAgo, threeStr]] as const) {
      instanceRows.push({
        task_id: t.id,
        company_id: COMPANY_ID,
        doer_id: t.doer_id,
        pc_id: t.pc_id,
        due_date: ds,
        due_datetime: combine(d, t.deadline_time),
        status: 'overdue'
      });
    }
  }

  const { error: iErr } = await supabase.from('task_instances').insert(instanceRows);
  if (iErr) throw iErr;
  console.log(`  Task instances inserted: ${instanceRows.length}`);

  console.log('\n✔ Done.');
  console.log('  Login (all use password Demo@1234):');
  console.log('    superadmin@demo.com');
  console.log('    admin@demo.com');
  console.log('    pc@demo.com');
  console.log('    doer1@demo.com');
  console.log('    doer2@demo.com');
}

main().catch((e) => { console.error(e); process.exit(1); });
