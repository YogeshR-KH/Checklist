-- CheckFlow initial migration
-- Apply via: supabase db push  OR  paste into Supabase SQL editor.
-- Mirrors prisma/schema.prisma. Add RLS policies at the end.

create extension if not exists "uuid-ossp";

-- Enums
do $$ begin
  create type user_role as enum ('super_admin','admin','pc','doer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_frequency as enum (
    'daily','weekly','fortnightly','monthly',
    'first_sunday','second_sunday','half_yearly','yearly','custom'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type instance_status as enum ('pending','done','overdue');
exception when duplicate_object then null; end $$;

-- Tables
create table if not exists companies (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text unique,
  role        user_role not null,
  company_id  uuid references companies(id) on delete cascade,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists profiles_company_idx on profiles(company_id);

create table if not exists tasks (
  id                uuid primary key default uuid_generate_v4(),
  company_id        uuid not null references companies(id) on delete cascade,
  title             text not null,
  doer_id           uuid not null references profiles(id),
  backup_doer_id    uuid references profiles(id),
  pc_id             uuid not null references profiles(id),
  deadline_time     text not null,
  frequency         task_frequency not null,
  frequency_config  jsonb not null default '{}'::jsonb,
  remarks_required  boolean not null default false,
  is_critical       boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);
create index if not exists tasks_company_active_idx on tasks(company_id, is_active);

create table if not exists task_instances (
  id              uuid primary key default uuid_generate_v4(),
  task_id         uuid not null references tasks(id) on delete cascade,
  company_id      uuid not null references companies(id) on delete cascade,
  doer_id         uuid not null references profiles(id),
  pc_id           uuid not null references profiles(id),
  due_date        date not null,
  due_datetime    timestamptz not null,
  status          instance_status not null default 'pending',
  completed_at    timestamptz,
  remarks         text,
  follow_up_notes jsonb not null default '[]'::jsonb,
  is_absent_swap  boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (task_id, due_date)
);
create index if not exists ti_company_date_idx on task_instances(company_id, due_date);
create index if not exists ti_doer_date_idx    on task_instances(doer_id, due_date);
create index if not exists ti_pc_date_idx      on task_instances(pc_id, due_date);
create index if not exists ti_status_due_idx   on task_instances(status, due_datetime);

create table if not exists absent_log (
  id           uuid primary key default uuid_generate_v4(),
  company_id   uuid not null references companies(id) on delete cascade,
  doer_id      uuid not null references profiles(id),
  absent_date  date not null,
  marked_by    uuid not null references profiles(id),
  created_at   timestamptz not null default now(),
  unique (doer_id, absent_date)
);
create index if not exists absent_company_date_idx on absent_log(company_id, absent_date);

-- Helper functions for RLS — security definer to bypass recursion on profiles.
-- Named app_current_* to avoid clashing with the built-in current_role/current_user keywords.
create or replace function public.app_current_role()
returns user_role
language sql stable security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function public.app_current_company()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select company_id from profiles where id = auth.uid();
$$;

-- Enable RLS
alter table companies      enable row level security;
alter table profiles       enable row level security;
alter table tasks          enable row level security;
alter table task_instances enable row level security;
alter table absent_log     enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS Policies
-- super_admin: full access to everything
-- admin:       full access to their own company
-- pc:          read instances where pc_id = self; update follow_up_notes/status; insert absent_log
-- doer:        read/update own instances
-- ─────────────────────────────────────────────────────────────────────────────

-- COMPANIES
drop policy if exists companies_super on companies;
create policy companies_super on companies
  for all to authenticated
  using (app_current_role() = 'super_admin')
  with check (app_current_role() = 'super_admin');

drop policy if exists companies_admin_read on companies;
create policy companies_admin_read on companies
  for select to authenticated
  using (id = app_current_company());

-- PROFILES
drop policy if exists profiles_self_read on profiles;
create policy profiles_self_read on profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_super on profiles;
create policy profiles_super on profiles
  for all to authenticated
  using (app_current_role() = 'super_admin')
  with check (app_current_role() = 'super_admin');

drop policy if exists profiles_admin on profiles;
create policy profiles_admin on profiles
  for all to authenticated
  using (app_current_role() = 'admin' and company_id = app_current_company())
  with check (app_current_role() = 'admin' and company_id = app_current_company());

drop policy if exists profiles_company_read on profiles;
create policy profiles_company_read on profiles
  for select to authenticated
  using (company_id = app_current_company());

-- TASKS
drop policy if exists tasks_super on tasks;
create policy tasks_super on tasks
  for all to authenticated
  using (app_current_role() = 'super_admin')
  with check (app_current_role() = 'super_admin');

drop policy if exists tasks_admin on tasks;
create policy tasks_admin on tasks
  for all to authenticated
  using (app_current_role() = 'admin' and company_id = app_current_company())
  with check (app_current_role() = 'admin' and company_id = app_current_company());

drop policy if exists tasks_company_read on tasks;
create policy tasks_company_read on tasks
  for select to authenticated
  using (company_id = app_current_company());

-- TASK INSTANCES
drop policy if exists ti_super on task_instances;
create policy ti_super on task_instances
  for all to authenticated
  using (app_current_role() = 'super_admin')
  with check (app_current_role() = 'super_admin');

drop policy if exists ti_admin on task_instances;
create policy ti_admin on task_instances
  for all to authenticated
  using (app_current_role() = 'admin' and company_id = app_current_company())
  with check (app_current_role() = 'admin' and company_id = app_current_company());

drop policy if exists ti_pc_read on task_instances;
create policy ti_pc_read on task_instances
  for select to authenticated
  using (app_current_role() = 'pc' and pc_id = auth.uid());

drop policy if exists ti_pc_update on task_instances;
create policy ti_pc_update on task_instances
  for update to authenticated
  using (app_current_role() = 'pc' and pc_id = auth.uid())
  with check (app_current_role() = 'pc' and pc_id = auth.uid());

drop policy if exists ti_doer_read on task_instances;
create policy ti_doer_read on task_instances
  for select to authenticated
  using (app_current_role() = 'doer' and doer_id = auth.uid());

drop policy if exists ti_doer_update on task_instances;
create policy ti_doer_update on task_instances
  for update to authenticated
  using (app_current_role() = 'doer' and doer_id = auth.uid())
  with check (app_current_role() = 'doer' and doer_id = auth.uid());

-- ABSENT LOG
drop policy if exists absent_super on absent_log;
create policy absent_super on absent_log
  for all to authenticated
  using (app_current_role() = 'super_admin')
  with check (app_current_role() = 'super_admin');

drop policy if exists absent_admin on absent_log;
create policy absent_admin on absent_log
  for all to authenticated
  using (app_current_role() = 'admin' and company_id = app_current_company())
  with check (app_current_role() = 'admin' and company_id = app_current_company());

drop policy if exists absent_pc_insert on absent_log;
create policy absent_pc_insert on absent_log
  for insert to authenticated
  with check (app_current_role() = 'pc' and company_id = app_current_company());

drop policy if exists absent_company_read on absent_log;
create policy absent_company_read on absent_log
  for select to authenticated
  using (company_id = app_current_company());
