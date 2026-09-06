-- Personal stylist accounts and database-enforced rental-event interest rules.
begin;

alter table public.staff_members
  add column if not exists staff_type text not null default 'regular';

alter table public.staff_members drop constraint if exists staff_members_staff_type_check;
alter table public.staff_members
  add constraint staff_members_staff_type_check check (staff_type in ('regular', 'stylist'));

-- Existing personal accounts already assigned to the Stylist department become
-- stylist accounts without changing their login, status, or historical work.
update public.staff_members sm
set staff_type = 'stylist', access_type = 'staff'
where sm.user_id is not null
  and exists (
    select 1 from public.staff_departments sd
    where sd.staff_id = sm.id and sd.department = 'stylist'
  );

create index if not exists staff_members_owner_type_idx
  on public.staff_members(owner_id, staff_type, is_active)
  where user_id is not null;

-- Event Job state contains operational and customer-linked data. Personal
-- stylists receive a server-sanitized view, so direct Data API access remains
-- limited to staff whose admin explicitly granted the Event Jobs module.
drop policy if exists event_jobs_staff_select on public.event_jobs;
create policy event_jobs_staff_select on public.event_jobs for select to authenticated
using (
  owner_id = public.current_staff_owner()
  and public.staff_can_access('event_jobs')
);

-- Admin owners may inspect allocation rows. A stylist may see only their own
-- row. Mutations run through authenticated server actions with full validation.
drop policy if exists event_job_stylist_interest_owner_select on public.event_job_stylist_interest;
create policy event_job_stylist_interest_owner_select
on public.event_job_stylist_interest for select to authenticated
using (
  exists (
    select 1 from public.event_jobs j
    where j.id = event_job_id and j.owner_id = (select auth.uid())
  )
);

drop policy if exists event_job_stylist_interest_owner_update on public.event_job_stylist_interest;
create policy event_job_stylist_interest_owner_update
on public.event_job_stylist_interest for update to authenticated
using (
  exists (
    select 1 from public.event_jobs j
    where j.id = event_job_id and j.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.event_jobs j
    where j.id = event_job_id and j.owner_id = (select auth.uid())
  )
);

drop policy if exists event_job_stylist_interest_self_select on public.event_job_stylist_interest;
create policy event_job_stylist_interest_self_select
on public.event_job_stylist_interest for select to authenticated
using (
  staff_id = public.current_staff_member_id()
);

drop policy if exists event_job_stylist_interest_self_insert on public.event_job_stylist_interest;
grant select, update on public.event_job_stylist_interest to authenticated;
revoke insert, delete on public.event_job_stylist_interest from authenticated;

-- Atomic account-type switch used by Admin -> Staff. The caller must be the
-- owning admin; execute is explicitly withheld from PUBLIC and anon.
create or replace function public.configure_staff_type(staff_user_id uuid, requested_type text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_staff_id bigint;
begin
  if requested_type not in ('regular', 'stylist') then
    raise exception 'Invalid staff type';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ) then
    raise exception 'Only an administrator can manage staff types';
  end if;

  select sm.id into target_staff_id
  from public.staff_members sm
  where sm.user_id = staff_user_id and sm.owner_id = (select auth.uid());
  if target_staff_id is null then raise exception 'Staff portal account was not found'; end if;

  update public.staff_members
  set staff_type = requested_type, access_type = 'staff'
  where id = target_staff_id;
  delete from public.staff_departments where staff_id = target_staff_id;
  insert into public.staff_departments(staff_id, department, granted_by)
  values(target_staff_id, case when requested_type = 'stylist' then 'stylist' else 'booking' end, (select auth.uid()));
  delete from public.staff_access_modules where staff_id = target_staff_id;
  if requested_type = 'regular' then
    insert into public.staff_access_modules(owner_id, staff_id, module, enabled)
    values
      ((select auth.uid()), target_staff_id, 'quotations', true),
      ((select auth.uid()), target_staff_id, 'create_booking', true);
  end if;
end;
$$;

revoke all on function public.configure_staff_type(uuid, text) from public, anon;
grant execute on function public.configure_staff_type(uuid, text) to authenticated;

-- This trigger also protects service-role/admin writes: only active stylist
-- accounts may apply, only rental events may receive interest, and approvals
-- can never exceed the required count under concurrent requests.
create or replace function public.enforce_stylist_interest_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  required_count integer;
  approved_count integer;
  rental_job boolean;
  valid_stylist boolean;
begin
  if tg_op = 'UPDATE'
    and old.event_job_id is not distinct from new.event_job_id
    and old.staff_id is not distinct from new.staff_id
    and old.status is not distinct from new.status then
    return new;
  end if;

  select
    greatest(j.stylists_required_count, 0),
    j.status = 'active' and j.state->>'bookingType' = 'rental'
  into required_count, rental_job
  from public.event_jobs j
  where j.id = new.event_job_id
  for update;

  select exists (
    select 1 from public.staff_members sm
    where sm.id = new.staff_id
      and sm.staff_type = 'stylist'
      and sm.portal_active
      and sm.is_active
  ) into valid_stylist;

  if not coalesce(rental_job, false) then
    raise exception 'Stylist interest is available only for active rental events';
  end if;
  if not coalesce(valid_stylist, false) then
    raise exception 'Only an active stylist account can participate';
  end if;

  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    select count(*) into approved_count
    from public.event_job_stylist_interest i
    where i.event_job_id = new.event_job_id
      and i.status = 'approved'
      and i.id <> new.id;
    if approved_count >= required_count then
      raise exception 'The required stylist count has already been filled';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_stylist_interest_rules_trigger on public.event_job_stylist_interest;
create trigger enforce_stylist_interest_rules_trigger
before insert or update of event_job_id, staff_id, status
on public.event_job_stylist_interest
for each row execute function public.enforce_stylist_interest_rules();

commit;
