-- Admin HR records. All records are isolated to the authenticated owner.
create table if not exists public.hr_attendance (
  id bigint generated always as identity primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  staff_id bigint not null references public.staff_members(id) on delete cascade, attendance_date date not null default current_date,
  status text not null default 'present' check (status in ('present','late','absent','half_day','on_leave')), check_in timestamptz, check_out timestamptz, notes text,
  unique(owner_id, staff_id, attendance_date)
);
create table if not exists public.hr_payroll (
  id bigint generated always as identity primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  staff_id bigint not null references public.staff_members(id) on delete cascade, period date not null,
  base_salary numeric(12,2) not null default 0 check (base_salary >= 0), allowances numeric(12,2) not null default 0 check (allowances >= 0), deductions numeric(12,2) not null default 0 check (deductions >= 0), status text not null default 'pending' check (status in ('pending','processed','paid')),
  unique(owner_id, staff_id, period)
);
create table if not exists public.hr_letters (
  id bigint generated always as identity primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  staff_id bigint not null references public.staff_members(id) on delete cascade, letter_type text not null, title text not null, issued_on date not null default current_date, notes text
);
create table if not exists public.hr_kyc_documents (
  id bigint generated always as identity primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  staff_id bigint not null references public.staff_members(id) on delete cascade, document_type text not null, document_number text, status text not null default 'pending' check (status in ('pending','verified','rejected')), document_url text
);
create table if not exists public.hr_work_orders (
  id bigint generated always as identity primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null, department text not null, assigned_staff_id bigint references public.staff_members(id) on delete set null, status text not null default 'open' check (status in ('open','in_progress','completed','cancelled')), due_date date, notes text
);
create index if not exists hr_attendance_owner_date_idx on public.hr_attendance(owner_id, attendance_date desc);
create index if not exists hr_payroll_owner_period_idx on public.hr_payroll(owner_id, period desc);
create index if not exists hr_letters_owner_date_idx on public.hr_letters(owner_id, issued_on desc);
create index if not exists hr_kyc_owner_status_idx on public.hr_kyc_documents(owner_id, status);
create index if not exists hr_work_orders_owner_status_idx on public.hr_work_orders(owner_id, status);
do $$ declare t text; begin foreach t in array array['hr_attendance','hr_payroll','hr_letters','hr_kyc_documents','hr_work_orders'] loop execute format('alter table public.%I enable row level security', t); execute format('drop policy if exists %I on public.%I', t || '_owner', t); execute format('create policy %I on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t || '_owner', t); execute format('grant select, insert, update, delete on public.%I to authenticated', t); end loop; end $$;
grant usage, select on all sequences in schema public to authenticated;

alter table public.hr_attendance add column if not exists working_hours numeric(5,2) not null default 0 check (working_hours >= 0), add column if not exists overtime numeric(5,2) not null default 0 check (overtime >= 0);
alter table public.hr_payroll add column if not exists advances numeric(12,2) not null default 0 check (advances >= 0), add column if not exists net_salary numeric(12,2) generated always as (base_salary + allowances - deductions - advances) stored;
alter table public.hr_kyc_documents add column if not exists address_proof text, add column if not exists bank_details_status text not null default 'pending' check (bank_details_status in ('pending','verified','not_provided')), add column if not exists admin_notes text, add column if not exists verified_by uuid references auth.users(id), add column if not exists verified_at timestamptz;
insert into storage.buckets (id, name, public) values ('staff-kyc', 'staff-kyc', false) on conflict (id) do nothing;
drop policy if exists staff_kyc_upload on storage.objects;
create policy staff_kyc_upload on storage.objects for insert to authenticated with check (bucket_id = 'staff-kyc' and owner_id = (select auth.uid())::text);
drop policy if exists staff_kyc_read on storage.objects;
create policy staff_kyc_read on storage.objects for select to authenticated using (bucket_id = 'staff-kyc' and owner_id = (select auth.uid())::text);
drop policy if exists staff_kyc_update on storage.objects;
create policy staff_kyc_update on storage.objects for update to authenticated using (bucket_id = 'staff-kyc' and owner_id = (select auth.uid())::text);
