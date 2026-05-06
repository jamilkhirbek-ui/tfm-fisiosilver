-- Fisiosilver
-- Migracion segura e idempotente para alinear el proyecto con el TFM.
-- Recomendacion: ejecutar primero en un entorno de pruebas de Supabase.
-- Si tu proyecto ya tiene politicas RLS mas estrictas, revisalas antes de aplicar esta version.

create extension if not exists pgcrypto;

alter table if exists public.users add column if not exists role text default 'patient';
alter table if exists public.users add column if not exists active boolean default true;
alter table if exists public.users add column if not exists updated_at timestamptz default now();
alter table if exists public.users add column if not exists created_by uuid null;
alter table if exists public.users add column if not exists updated_by uuid null;
alter table if exists public.users add column if not exists points numeric default 0;
alter table if exists public.users add column if not exists level integer default 1;

update public.users set role = 'patient' where role is null;
update public.users set active = true where active is null;
update public.users set updated_at = coalesce(updated_at, created_at, now()) where updated_at is null;
update public.users set points = 0 where points is null;
update public.users set level = 1 where level is null;

alter table if exists public.users alter column role set default 'patient';
alter table if exists public.users alter column active set default true;
alter table if exists public.users alter column updated_at set default now();
alter table if exists public.users alter column points set default 0;
alter table if exists public.users alter column level set default 1;

alter table if exists public.daily_logs add column if not exists updated_at timestamptz default now();
update public.daily_logs set updated_at = coalesce(updated_at, created_at, now()) where updated_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_created_by_fkey'
  ) then
    alter table public.users
      add constraint users_created_by_fkey
      foreign key (created_by) references public.users(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_updated_by_fkey'
  ) then
    alter table public.users
      add constraint users_updated_by_fkey
      foreign key (updated_by) references public.users(id);
  end if;
end $$;

create table if not exists public.user_action_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  action_type text not null,
  description text,
  created_at timestamptz default now()
);

create table if not exists public.user_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  modified_by uuid references public.users(id),
  field_name text,
  old_value text,
  new_value text,
  modified_at timestamptz default now()
);

create table if not exists public.daily_logs_audit (
  id uuid primary key default gen_random_uuid(),
  daily_log_id uuid references public.daily_logs(id) on delete cascade,
  modified_by uuid references public.users(id),
  field_name text,
  old_value text,
  new_value text,
  modified_at timestamptz default now()
);

create table if not exists public.vigs_assessment_audit (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references public.vigs_assessments(id) on delete cascade,
  modified_by uuid references public.users(id),
  field_name text,
  old_value text,
  new_value text,
  modified_at timestamptz default now()
);

create table if not exists public.clinical_reports_audit (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.clinical_reports(id) on delete cascade,
  modified_by uuid references public.users(id),
  field_name text,
  old_value text,
  new_value text,
  modified_at timestamptz default now()
);

create table if not exists public.nutrition_logs_audit (
  id uuid primary key default gen_random_uuid(),
  nutrition_log_id uuid references public.nutrition_logs(id) on delete cascade,
  modified_by uuid references public.users(id),
  field_name text,
  old_value text,
  new_value text,
  modified_at timestamptz default now()
);

create table if not exists public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.vigs_assessments(id) on delete cascade,
  question_key text not null,
  answer_value numeric,
  created_at timestamptz default now()
);

create index if not exists idx_user_action_log_user_id on public.user_action_log(user_id);
create index if not exists idx_user_action_log_created_at on public.user_action_log(created_at desc);
create index if not exists idx_user_audit_user_id on public.user_audit(user_id);
create index if not exists idx_daily_logs_audit_daily_log_id on public.daily_logs_audit(daily_log_id);
create index if not exists idx_vigs_audit_assessment_id on public.vigs_assessment_audit(assessment_id);
create index if not exists idx_clinical_reports_audit_report_id on public.clinical_reports_audit(report_id);
create index if not exists idx_nutrition_logs_audit_log_id on public.nutrition_logs_audit(nutrition_log_id);
create index if not exists idx_assessment_answers_assessment_id on public.assessment_answers(assessment_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'admin'
      and active = true
  );
$$;

grant execute on function public.is_admin() to authenticated;

alter table if exists public.users enable row level security;
alter table if exists public.daily_logs enable row level security;
alter table if exists public.vigs_assessments enable row level security;
alter table if exists public.assessment_answers enable row level security;
alter table if exists public.clinical_reports enable row level security;
alter table if exists public.nutrition_logs enable row level security;
alter table if exists public.user_action_log enable row level security;
alter table if exists public.user_audit enable row level security;
alter table if exists public.daily_logs_audit enable row level security;
alter table if exists public.vigs_assessment_audit enable row level security;
alter table if exists public.clinical_reports_audit enable row level security;
alter table if exists public.nutrition_logs_audit enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'users' and policyname = 'users_select_own_or_admin'
  ) then
    create policy users_select_own_or_admin on public.users
      for select using (auth.uid() = id or public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'users' and policyname = 'users_update_own_or_admin'
  ) then
    create policy users_update_own_or_admin on public.users
      for update using (auth.uid() = id or public.is_admin())
      with check (auth.uid() = id or public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'users' and policyname = 'users_insert_own_or_admin'
  ) then
    create policy users_insert_own_or_admin on public.users
      for insert with check (auth.uid() = id or public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'daily_logs' and policyname = 'daily_logs_own_or_admin'
  ) then
    create policy daily_logs_own_or_admin on public.daily_logs
      for all using (auth.uid() = user_id or public.is_admin())
      with check (auth.uid() = user_id or public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'vigs_assessments' and policyname = 'vigs_assessments_own_or_admin'
  ) then
    create policy vigs_assessments_own_or_admin on public.vigs_assessments
      for all using (auth.uid() = user_id or public.is_admin())
      with check (auth.uid() = user_id or public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clinical_reports' and policyname = 'clinical_reports_own_or_admin'
  ) then
    create policy clinical_reports_own_or_admin on public.clinical_reports
      for all using (auth.uid() = user_id or public.is_admin())
      with check (auth.uid() = user_id or public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'nutrition_logs' and policyname = 'nutrition_logs_own_or_admin'
  ) then
    create policy nutrition_logs_own_or_admin on public.nutrition_logs
      for all using (auth.uid() = user_id or public.is_admin())
      with check (auth.uid() = user_id or public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_action_log' and policyname = 'user_action_log_own_or_admin'
  ) then
    create policy user_action_log_own_or_admin on public.user_action_log
      for all using (auth.uid() = user_id or public.is_admin())
      with check (auth.uid() = user_id or public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'assessment_answers' and policyname = 'assessment_answers_own_or_admin'
  ) then
    create policy assessment_answers_own_or_admin on public.assessment_answers
      for all using (
        exists (
          select 1
          from public.vigs_assessments va
          where va.id = assessment_id
            and (va.user_id = auth.uid() or public.is_admin())
        )
      )
      with check (
        exists (
          select 1
          from public.vigs_assessments va
          where va.id = assessment_id
            and (va.user_id = auth.uid() or public.is_admin())
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_audit' and policyname = 'user_audit_read_own_or_admin'
  ) then
    create policy user_audit_read_own_or_admin on public.user_audit
      for select using (auth.uid() = user_id or auth.uid() = modified_by or public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_audit' and policyname = 'user_audit_insert_own_or_admin'
  ) then
    create policy user_audit_insert_own_or_admin on public.user_audit
      for insert with check (auth.uid() = modified_by or public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'daily_logs_audit' and policyname = 'daily_logs_audit_admin_or_modifier'
  ) then
    create policy daily_logs_audit_admin_or_modifier on public.daily_logs_audit
      for select using (auth.uid() = modified_by or public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'daily_logs_audit' and policyname = 'daily_logs_audit_insert_admin_or_modifier'
  ) then
    create policy daily_logs_audit_insert_admin_or_modifier on public.daily_logs_audit
      for insert with check (auth.uid() = modified_by or public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'vigs_assessment_audit' and policyname = 'vigs_audit_admin_or_modifier'
  ) then
    create policy vigs_audit_admin_or_modifier on public.vigs_assessment_audit
      for select using (auth.uid() = modified_by or public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'vigs_assessment_audit' and policyname = 'vigs_audit_insert_admin_or_modifier'
  ) then
    create policy vigs_audit_insert_admin_or_modifier on public.vigs_assessment_audit
      for insert with check (auth.uid() = modified_by or public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clinical_reports_audit' and policyname = 'clinical_reports_audit_admin_or_modifier'
  ) then
    create policy clinical_reports_audit_admin_or_modifier on public.clinical_reports_audit
      for select using (auth.uid() = modified_by or public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clinical_reports_audit' and policyname = 'clinical_reports_audit_insert_admin_or_modifier'
  ) then
    create policy clinical_reports_audit_insert_admin_or_modifier on public.clinical_reports_audit
      for insert with check (auth.uid() = modified_by or public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'nutrition_logs_audit' and policyname = 'nutrition_logs_audit_admin_or_modifier'
  ) then
    create policy nutrition_logs_audit_admin_or_modifier on public.nutrition_logs_audit
      for select using (auth.uid() = modified_by or public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'nutrition_logs_audit' and policyname = 'nutrition_logs_audit_insert_admin_or_modifier'
  ) then
    create policy nutrition_logs_audit_insert_admin_or_modifier on public.nutrition_logs_audit
      for insert with check (auth.uid() = modified_by or public.is_admin());
  end if;
end $$;

-- Promocion manual de un usuario a administrador:
-- update public.users set role = 'admin', active = true where email = 'tu-email@ejemplo.com';
