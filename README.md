# CheckFlow

Recurring task accountability for the HoReCa industry — small hotels, restaurants, and catering operations.

CheckFlow gives every recurring operational task a single owner, a deadline, and a follow-up trail. Doers see what they have to do today; Process Coordinators see what's pending and what's gone overdue; Admins see scores; the Super Admin manages tenants.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres + Auth) · Prisma · Resend · Vercel.

---

## 1. Local setup

```bash
git clone <this repo>
cd checklist
cp .env.example .env
npm install
```

Fill in `.env`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://...pooler.supabase.com:5432/postgres
RESEND_API_KEY=re_...           # optional locally
RESEND_FROM_EMAIL="CheckFlow <noreply@yourdomain.com>"
CRON_SECRET=any-long-random-string
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> Get the `DATABASE_URL` and `DIRECT_URL` from Supabase → *Project Settings → Database → Connection string → URI*. Use the **pooler** for `DATABASE_URL` and the **direct** connection for `DIRECT_URL`.

---

## 2. Database

Two ways — pick one:

**A. Apply the migration SQL (simplest):**
1. Open Supabase → *SQL Editor*.
2. Paste `supabase/migrations/0001_init.sql` and run.

**B. Use Prisma directly:**
```bash
npx prisma db push
```
Then run the SQL in `supabase/migrations/0001_init.sql` to install the RLS policies and helper functions (Prisma doesn't manage these).

---

## 3. Seed

```bash
npm run seed
```

This creates:

| Role        | Email                  | Password   |
| ----------- | ---------------------- | ---------- |
| super_admin | superadmin@demo.com    | Demo@1234  |
| admin       | admin@demo.com         | Demo@1234  |
| pc          | pc@demo.com            | Demo@1234  |
| doer        | doer1@demo.com         | Demo@1234  |
| doer        | doer2@demo.com         | Demo@1234  |

Plus 10 sample tasks, today's instances, and a few overdue ones for testing the PC dashboard.

---

## 4. Run

```bash
npm run dev
```

Visit `http://localhost:3000`. Sign in with any of the seed accounts — you're auto-routed to the right dashboard.

---

## 5. Deploy to Vercel

1. Push the repo to GitHub.
2. *Import* the repo into Vercel.
3. Add the same env vars from `.env` to *Project Settings → Environment Variables*.
4. Deploy.

Vercel Cron is wired up via `vercel.json`:

| Path                               | Schedule        | Purpose                                         |
| ---------------------------------- | --------------- | ----------------------------------------------- |
| `/api/cron/generate-instances`     | `5 0 * * *`     | Generate today's task instances                 |
| `/api/cron/notify-overdue`         | `*/15 * * * *`  | Mark expired pending tasks overdue and email PC |
| `/api/cron/daily-digest`           | `0 8 * * *`     | Email yesterday's digest to admins              |

Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically — set `CRON_SECRET` in the project's env vars and the routes will accept it.

---

## 6. Architecture notes

- **Prisma** is the only client used for DB queries — keeps the app cloud-portable. Supabase JS is used only for auth and admin tasks (creating users).
- **Row-Level Security** is enforced in Postgres; the app server still respects role-based authorization, but RLS is the last line of defense for any direct-DB clients.
- Two helper SQL functions, `current_role()` and `current_company()`, are `security definer` to avoid recursion in policies on the `profiles` table.
- Task instances are uniquely keyed on `(task_id, due_date)`, so the daily generator is idempotent — running it twice produces zero duplicates.

---

## 7. Project layout

```
app/
  api/                   API routes (RESTful)
    cron/                Cron endpoints — gated by CRON_SECRET
    tasks/               Task CRUD
    instances/[id]/      Mark-done, follow-up notes
    team/                Invite, deactivate, mark-absent
    companies/           Super-admin only
    scores/              Scoring engine
  dashboard/
    admin/               Team / Tasks / Scores tabs
    pc/                  Today + Overdue lists, follow-up notes
    doer/                Today's tasks + Mark Done
    super-admin/         Companies list
  login/                 Email + password sign-in
lib/
  prisma.ts              Singleton Prisma client
  supabase/              SSR + browser + service-role clients
  auth.ts                Server-side role guards
  frequency.ts           "Is task due on this date?" rule engine
  generateInstances.ts   Idempotent daily generator
  email.ts               Resend wrapper
  dates.ts               UTC date helpers
prisma/schema.prisma     Source of truth for the schema
supabase/migrations/     Migration SQL (mirrors Prisma + RLS)
scripts/seed.ts          npm run seed
```

---

## 8. Scoring engine

`GET /api/scores?user_id=&company_id=&period=month`

Returns:

```json
{
  "total": 30,
  "done": 27,
  "onTime": 24,
  "KRA1_completion": 90.0,
  "KRA1_missed":     10.0,
  "KRA2_timeliness": 80.0,
  "KRA2_late":       20.0
}
```

Doers see the *negative* numbers (Missed %, Late %); admins toggle between positive and negative on the Scores tab. Inactive tasks are excluded.

---

## 9. What's next (post-MVP)

- Per-company timezone (currently UTC across the board).
- Push notifications via FCM / OneSignal.
- Editable tasks (form + PATCH `/api/tasks/:id` already exists; UI is delete-only for now).
- Custom-frequency picker UI (engine already supports `dates: string[]`).
- Audit log of who completed / edited what.
