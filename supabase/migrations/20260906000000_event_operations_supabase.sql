-- Safawala CRM Event Operations: real staff identity, central jobs and department workflow.
-- Existing owner policies are intentionally preserved. These policies only add staff access.

alter table public.profiles
  add column if not exists role text not null default 'admin';

do $$ begin
  alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'staff'));
exception when duplicate_object then null;
end $$;

alter table public.staff_members
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists login_id text,
  add column if not exists portal_active boolean not null default false;

create unique index if not exists staff_members_user_id_key on public.staff_members(user_id) where user_id is not null;
create unique index if not exists staff_members_owner_login_id_key on public.staff_members(owner_id, lower(login_id)) where login_id is not null;

create table if not exists public.staff_departments (
  staff_id bigint not null references public.staff_members(id) on delete cascade,
  department text not null check (department in ('booking','warehouse','qc','stylist','collection','modification')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  primary key (staff_id, department)
);

create or replace function public.current_staff_owner()
returns uuid language sql stable security definer set search_path = '' as $$
  select sm.owner_id from public.staff_members sm
  where sm.user_id = (select auth.uid()) and sm.portal_active and sm.is_active
  limit 1
$$;

create or replace function public.current_staff_has_department(required_department text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff_members sm
    join public.staff_departments sd on sd.staff_id = sm.id
    where sm.user_id = (select auth.uid()) and sm.portal_active and sm.is_active
      and sd.department = required_department
  )
$$;

create table if not exists public.event_jobs (
  id text primary key,
  booking_id bigint not null unique references public.bookings(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_number text not null,
  status text not null default 'active' check (status in ('active','closed')),
  stylists_required_count integer not null default 1 check (stylists_required_count >= 0),
  payment_summary jsonb,
  booking_final_check jsonb,
  performance_credited boolean not null default false,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null
);

create table if not exists public.event_job_stages (
  id uuid primary key default gen_random_uuid(),
  event_job_id text not null references public.event_jobs(id) on delete cascade,
  stage text not null check (stage in ('warehouse_pick','quality_check','packing','stylist_opportunity','collection','return_quality_check','return_warehouse','booking_final_check')),
  status text not null default 'not_started' check (status in ('not_started','open','in_progress','done','blocked')),
  assigned_staff_id bigint references public.staff_members(id) on delete set null,
  opened_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  notes jsonb not null default '{}'::jsonb,
  unique(event_job_id, stage)
);

create table if not exists public.event_job_pick_items (
  id uuid primary key default gen_random_uuid(), event_job_stage_id uuid not null references public.event_job_stages(id) on delete cascade,
  booking_item_id bigint references public.booking_items(id) on delete set null, item_name text not null,
  prepared_quantity integer, unavailable_quantity integer not null default 0, damaged_quantity integer not null default 0,
  usable_quantity integer, damaged_repair_quantity integer, missing_lost_quantity integer,
  issue_note text, remarks text, unique(event_job_stage_id,item_name)
);

create table if not exists public.event_job_qc_items (
  id uuid primary key default gen_random_uuid(), event_job_stage_id uuid not null references public.event_job_stages(id) on delete cascade,
  booking_item_id bigint references public.booking_items(id) on delete set null, item_name text not null,
  checked_quantity integer, good_quantity integer, damaged_quantity integer, repair_required_quantity integer,
  unusable_quantity integer, issue_type text, remarks text, evidence_photo_url text,
  unique(event_job_stage_id,item_name)
);

create table if not exists public.event_job_packing_checklist (
  event_job_stage_id uuid primary key references public.event_job_stages(id) on delete cascade,
  correct_quantity_packed boolean not null default false, correct_boxes boolean not null default false,
  proper_labels boolean not null default false, accessories_included boolean not null default false,
  items_secured boolean not null default false, correct_event_identification boolean not null default false,
  remarks text, proof_photo_url text
);

create table if not exists public.event_job_stylist_interest (
  id uuid primary key default gen_random_uuid(), event_job_id text not null references public.event_jobs(id) on delete cascade,
  staff_id bigint not null references public.staff_members(id) on delete cascade,
  status text not null default 'interested' check (status in ('interested','approved','rejected','backup')),
  expressed_at timestamptz not null default now(), decided_at timestamptz, decided_by uuid references auth.users(id) on delete set null,
  unique(event_job_id, staff_id)
);

create table if not exists public.stylist_travel_bookings (
  id uuid primary key default gen_random_uuid(), event_job_stylist_interest_id uuid not null references public.event_job_stylist_interest(id) on delete cascade,
  leg_type text not null check (leg_type in ('onward','return')), mode text, from_location text, to_location text,
  departure_at timestamptz, arrival_at timestamptz, ticket_reference text, ticket_file_url text, pickup_details text,
  accommodation_hotel text, accommodation_check_in date, accommodation_check_out date, accommodation_room_details text,
  cost numeric(12,2) not null default 0, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
  unique(event_job_stylist_interest_id, leg_type)
);

create table if not exists public.event_job_stylist_execution (
  id uuid primary key default gen_random_uuid(), event_job_stylist_interest_id uuid not null references public.event_job_stylist_interest(id) on delete cascade,
  action text not null check (action in ('reached_venue','start_work','complete_work')), recorded_at timestamptz not null default now(),
  unique(event_job_stylist_interest_id, action)
);

create table if not exists public.event_job_collection_items (
  id uuid primary key default gen_random_uuid(), event_job_stage_id uuid not null references public.event_job_stages(id) on delete cascade,
  booking_item_id bigint references public.booking_items(id) on delete set null, item_name text not null,
  sent_quantity integer not null, returned_quantity integer not null, visible_damage boolean not null default false,
  wrong_product boolean not null default false, client_holding_item boolean not null default false,
  short_quantity_flag boolean not null default false, remarks text, evidence_photo_url text,
  unique(event_job_stage_id,item_name)
);

create table if not exists public.event_job_issues (
  id uuid primary key default gen_random_uuid(), event_job_id text not null references public.event_jobs(id) on delete cascade,
  stage text, description text not null, raised_by uuid references auth.users(id) on delete set null,
  raised_by_name text not null, raised_at timestamptz not null default now(), resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create table if not exists public.event_job_activity (
  id uuid primary key default gen_random_uuid(), event_job_id text not null references public.event_jobs(id) on delete cascade,
  actor text not null, department text not null, action text not null, details text, created_at timestamptz not null default now()
);

create table if not exists public.event_job_notifications (
  id uuid primary key default gen_random_uuid(), event_job_id text not null references public.event_jobs(id) on delete cascade,
  recipient_department text, recipient_account_id uuid references auth.users(id) on delete cascade,
  message text not null, created_at timestamptz not null default now(), read_at timestamptz,
  check ((recipient_department is null) <> (recipient_account_id is null))
);

create table if not exists public.staff_performance_credits (
  id uuid primary key default gen_random_uuid(), staff_id bigint references public.staff_members(id) on delete cascade,
  identifier text not null, name text not null,
  event_job_id text not null references public.event_jobs(id) on delete cascade, department text not null,
  credited_at timestamptz not null default now(), unique(identifier, event_job_id, department)
);

create index if not exists event_jobs_owner_status_idx on public.event_jobs(owner_id,status,created_at desc);
create index if not exists event_job_stages_job_idx on public.event_job_stages(event_job_id,stage);
create index if not exists event_job_activity_job_idx on public.event_job_activity(event_job_id,created_at desc);
create index if not exists event_job_notifications_account_idx on public.event_job_notifications(recipient_account_id,read_at);

alter table public.staff_departments enable row level security;
alter table public.event_jobs enable row level security;
alter table public.event_job_stages enable row level security;
alter table public.event_job_pick_items enable row level security;
alter table public.event_job_qc_items enable row level security;
alter table public.event_job_packing_checklist enable row level security;
alter table public.event_job_stylist_interest enable row level security;
alter table public.stylist_travel_bookings enable row level security;
alter table public.event_job_stylist_execution enable row level security;
alter table public.event_job_collection_items enable row level security;
alter table public.event_job_issues enable row level security;
alter table public.event_job_activity enable row level security;
alter table public.event_job_notifications enable row level security;
alter table public.staff_performance_credits enable row level security;

do $$
declare t text;
begin
  foreach t in array array['event_jobs','event_job_stages','event_job_pick_items','event_job_qc_items','event_job_packing_checklist','event_job_stylist_interest','stylist_travel_bookings','event_job_stylist_execution','event_job_collection_items','event_job_issues','event_job_activity','event_job_notifications','staff_performance_credits']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
  end loop;
end $$;

create policy event_jobs_owner_all on public.event_jobs for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy event_jobs_staff_select on public.event_jobs for select to authenticated
  using (owner_id = public.current_staff_owner());

create policy staff_departments_owner_all on public.staff_departments for all to authenticated
  using (exists(select 1 from public.staff_members sm where sm.id=staff_id and sm.owner_id=(select auth.uid())))
  with check (exists(select 1 from public.staff_members sm where sm.id=staff_id and sm.owner_id=(select auth.uid())));
create policy staff_departments_self_select on public.staff_departments for select to authenticated
  using (exists(select 1 from public.staff_members sm where sm.id=staff_id and sm.user_id=(select auth.uid())));
create policy staff_members_self_select on public.staff_members for select to authenticated using (user_id=(select auth.uid()));

create policy event_job_stages_owner_all on public.event_job_stages for all to authenticated
  using (exists(select 1 from public.event_jobs j where j.id=event_job_id and j.owner_id=(select auth.uid())))
  with check (exists(select 1 from public.event_jobs j where j.id=event_job_id and j.owner_id=(select auth.uid())));
create policy event_job_stages_staff_select on public.event_job_stages for select to authenticated
  using (exists(select 1 from public.event_jobs j where j.id=event_job_id and j.owner_id=public.current_staff_owner()));

create policy event_job_activity_owner_select on public.event_job_activity for select to authenticated
  using (exists(select 1 from public.event_jobs j where j.id=event_job_id and j.owner_id=(select auth.uid())));
create policy event_job_activity_staff_select on public.event_job_activity for select to authenticated
  using (exists(select 1 from public.event_jobs j where j.id=event_job_id and j.owner_id=public.current_staff_owner()));

create policy event_job_notifications_owner_select on public.event_job_notifications for select to authenticated
  using (exists(select 1 from public.event_jobs j where j.id=event_job_id and j.owner_id=(select auth.uid())));
create policy event_job_notifications_staff_select on public.event_job_notifications for select to authenticated
  using (recipient_account_id=(select auth.uid()) or (recipient_department is not null and public.current_staff_has_department(recipient_department)));
create policy event_job_notifications_staff_update on public.event_job_notifications for update to authenticated
  using (recipient_account_id=(select auth.uid()) or (recipient_department is not null and public.current_staff_has_department(recipient_department)))
  with check (recipient_account_id=(select auth.uid()) or (recipient_department is not null and public.current_staff_has_department(recipient_department)));

create policy staff_performance_owner_select on public.staff_performance_credits for select to authenticated
  using (exists(select 1 from public.event_jobs j where j.id=event_job_id and j.owner_id=(select auth.uid())));
create policy staff_performance_self_select on public.staff_performance_credits for select to authenticated
  using (staff_id is not null and exists(select 1 from public.staff_members sm where sm.id=staff_id and sm.user_id=(select auth.uid())));

-- Staff can read the existing booking data for jobs owned by their business.
create policy bookings_staff_select on public.bookings for select to authenticated using (owner_id=public.current_staff_owner());
create policy booking_items_staff_select on public.booking_items for select to authenticated using (owner_id=public.current_staff_owner());
create policy customers_staff_select on public.customers for select to authenticated using (owner_id=public.current_staff_owner());

-- Create one real Event Job for a confirmed non-quote booking. Duplicate-safe.
create or replace function public.open_event_job(booking_key bigint)
returns text language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; jid text; now_at timestamptz:=now();
begin
  select * into b from public.bookings where id=booking_key;
  if b.id is null or b.is_quote or b.status <> 'confirmed' then return null; end if;
  jid := 'JOB-' || coalesce(substring(b.booking_number from '(\d{4}-\d+)$'), 'B' || b.id::text);
  insert into public.event_jobs(id,booking_id,owner_id,job_number,status,created_at,updated_at)
  values(jid,b.id,b.owner_id,jid,'active',now_at,now_at) on conflict(booking_id) do nothing;
  insert into public.event_job_stages(event_job_id,stage,status,opened_at)
  select jid, s, case when s in ('warehouse_pick','stylist_opportunity') then 'open' else 'not_started' end,
    case when s in ('warehouse_pick','stylist_opportunity') then now_at else null end
  from unnest(array['warehouse_pick','quality_check','packing','stylist_opportunity','collection','return_quality_check','return_warehouse','booking_final_check']) s
  on conflict(event_job_id,stage) do nothing;
  return jid;
end $$;

create or replace function public.booking_confirmation_opens_event_job()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='confirmed' and not new.is_quote and (tg_op='INSERT' or old.status is distinct from new.status) then
    perform public.open_event_job(new.id);
  end if;
  return new;
end $$;

drop trigger if exists bookings_open_event_job on public.bookings;
create trigger bookings_open_event_job after insert or update of status on public.bookings
for each row execute function public.booking_confirmation_opens_event_job();

-- Backfill existing confirmed bookings without changing any booking values.
select public.open_event_job(id) from public.bookings where status='confirmed' and not is_quote;

-- Evidence and ticket uploads. Owner/staff access is enforced through owner-id folders.
insert into storage.buckets(id,name,public) values('event-operation-files','event-operation-files',false)
on conflict(id) do nothing;

drop policy if exists event_operation_files_select on storage.objects;
create policy event_operation_files_select on storage.objects for select to authenticated
using (bucket_id='event-operation-files' and ((storage.foldername(name))[1]=(select auth.uid())::text or (storage.foldername(name))[1]=public.current_staff_owner()::text));
drop policy if exists event_operation_files_insert on storage.objects;
create policy event_operation_files_insert on storage.objects for insert to authenticated
with check (bucket_id='event-operation-files' and ((storage.foldername(name))[1]=(select auth.uid())::text or (storage.foldername(name))[1]=public.current_staff_owner()::text));
