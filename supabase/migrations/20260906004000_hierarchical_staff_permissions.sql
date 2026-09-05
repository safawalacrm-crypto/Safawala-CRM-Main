-- Safawala CRM hierarchical permissions.
-- Admin -> one department Main ID -> individually assigned staff.

begin;

create table if not exists public.department_main_ids (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  department text not null check (department in ('booking','warehouse','qc','stylist','collection','modification')),
  main_staff_id bigint not null references public.staff_members(id) on delete cascade,
  main_code text not null check (length(trim(main_code)) >= 3),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, department),
  unique(owner_id, main_staff_id),
  unique(owner_id, main_code)
);

create table if not exists public.department_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  department text not null check (department in ('booking','warehouse','qc','stylist','collection','modification')),
  main_id uuid not null references public.department_main_ids(id) on delete cascade,
  staff_id bigint not null references public.staff_members(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, department, staff_id)
);

create table if not exists public.staff_module_permissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  target_staff_id bigint not null references public.staff_members(id) on delete cascade,
  department text not null check (department in ('booking','warehouse','qc','stylist','collection','modification')),
  module text not null check (module in (
    'booking_overview','quotations','leads','bookings','customers','event_jobs','event_tracking','calendar',
    'warehouse_tasks','qc_tasks','stylist_opportunities','assigned_events','collection_tasks','modification_tasks',
    'my_tasks','attendance','performance','leave_management','agreements','invoices'
  )),
  enabled boolean not null default false,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(target_staff_id, module)
);

create table if not exists public.permission_activity_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_staff_id bigint references public.staff_members(id) on delete set null,
  target_staff_id bigint references public.staff_members(id) on delete set null,
  department text not null check (department in ('booking','warehouse','qc','stylist','collection','modification')),
  module text,
  action text not null,
  old_value boolean,
  new_value boolean,
  created_at timestamptz not null default now()
);

create index if not exists department_main_ids_owner_idx on public.department_main_ids(owner_id, department);
create index if not exists department_staff_assignments_main_idx on public.department_staff_assignments(main_id, active);
create index if not exists staff_module_permissions_target_idx on public.staff_module_permissions(target_staff_id, enabled);
create index if not exists permission_activity_log_owner_idx on public.permission_activity_log(owner_id, created_at desc);

alter table public.department_main_ids enable row level security;
alter table public.department_staff_assignments enable row level security;
alter table public.staff_module_permissions enable row level security;
alter table public.permission_activity_log enable row level security;

create or replace function public.permission_allowed_for_department(p_department text, p_module text)
returns boolean language sql immutable set search_path = '' as $$
  select case p_department
    when 'booking' then p_module = any(array['booking_overview','quotations','leads','bookings','customers','event_jobs','event_tracking','calendar','my_tasks','attendance','performance','leave_management','agreements','invoices'])
    when 'warehouse' then p_module = any(array['warehouse_tasks','event_jobs','my_tasks','attendance','performance','leave_management'])
    when 'qc' then p_module = any(array['qc_tasks','event_jobs','my_tasks','attendance','performance','leave_management'])
    when 'stylist' then p_module = any(array['stylist_opportunities','assigned_events','my_tasks','attendance','performance','leave_management'])
    when 'collection' then p_module = any(array['collection_tasks','event_jobs','my_tasks','attendance','performance','leave_management'])
    when 'modification' then p_module = any(array['modification_tasks','event_jobs','my_tasks','attendance','performance','leave_management'])
    else false end
$$;

create or replace function public.current_staff_member_id()
returns bigint language sql stable security definer set search_path = '' as $$
  select sm.id from public.staff_members sm
  where sm.user_id = (select auth.uid()) and sm.portal_active and sm.is_active
  limit 1
$$;

create or replace function public.staff_has_module(p_module text)
returns boolean language sql stable security definer set search_path = '' as $$
  with me as (
    select sm.id from public.staff_members sm
    where sm.user_id=(select auth.uid()) and sm.portal_active and sm.is_active limit 1
  )
  select exists (
    select 1
    from me
    join public.department_main_ids dm on dm.main_staff_id=me.id and dm.active
    join public.staff_module_permissions mp on mp.target_staff_id=me.id and mp.module=p_module and mp.enabled
  ) or exists (
    select 1
    from me
    join public.department_staff_assignments sa on sa.staff_id=me.id and sa.active
    join public.department_main_ids dm on dm.id=sa.main_id and dm.active
    join public.staff_module_permissions mine on mine.target_staff_id=me.id and mine.module=p_module and mine.enabled
    join public.staff_module_permissions parent on parent.target_staff_id=dm.main_staff_id and parent.module=p_module and parent.enabled
  )
$$;

create or replace function public.staff_has_any_module(p_modules text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from unnest(p_modules) m where public.staff_has_module(m))
$$;

create policy department_main_ids_read on public.department_main_ids for select to authenticated using (
  owner_id=(select auth.uid()) or main_staff_id=public.current_staff_member_id()
  or exists(select 1 from public.department_staff_assignments a where a.main_id=id and a.staff_id=public.current_staff_member_id() and a.active)
);
create policy department_staff_assignments_read on public.department_staff_assignments for select to authenticated using (
  owner_id=(select auth.uid()) or staff_id=public.current_staff_member_id()
  or exists(select 1 from public.department_main_ids m where m.id=main_id and m.main_staff_id=public.current_staff_member_id() and m.active)
);
create policy staff_module_permissions_read on public.staff_module_permissions for select to authenticated using (
  owner_id=(select auth.uid()) or target_staff_id=public.current_staff_member_id()
  or exists(
    select 1 from public.department_main_ids m
    join public.department_staff_assignments a on a.main_id=m.id and a.staff_id=target_staff_id and a.active
    where m.main_staff_id=public.current_staff_member_id() and m.active
  )
);
create policy permission_activity_log_read on public.permission_activity_log for select to authenticated using (
  owner_id=(select auth.uid()) or actor_staff_id=public.current_staff_member_id()
  or exists(select 1 from public.department_main_ids m where m.owner_id=permission_activity_log.owner_id and m.department=permission_activity_log.department and m.main_staff_id=public.current_staff_member_id() and m.active)
);

create or replace function public.assign_department_main(p_department text, p_main_staff_id bigint, p_main_code text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=(select auth.uid()); v_id uuid; v_old_staff bigint;
begin
  if not exists(select 1 from public.profiles p where p.id=v_owner and p.role='admin') then raise exception 'Only an administrator can assign a Main ID.'; end if;
  if not exists(select 1 from public.staff_members s join public.staff_departments d on d.staff_id=s.id and d.department=p_department where s.id=p_main_staff_id and s.owner_id=v_owner and s.portal_active and s.is_active) then raise exception 'Select an active staff account from this department.'; end if;
  select main_staff_id into v_old_staff from public.department_main_ids where owner_id=v_owner and department=p_department;
  insert into public.department_main_ids(owner_id,department,main_staff_id,main_code,active,updated_at)
  values(v_owner,p_department,p_main_staff_id,upper(trim(p_main_code)),true,now())
  on conflict(owner_id,department) do update set main_staff_id=excluded.main_staff_id,main_code=excluded.main_code,active=true,updated_at=now()
  returning id into v_id;
  insert into public.permission_activity_log(owner_id,actor_user_id,target_staff_id,department,action,new_value)
  values(v_owner,v_owner,p_main_staff_id,p_department,'main_id_assigned',true);
  return v_id;
end $$;

create or replace function public.set_department_main_active(p_main_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=(select auth.uid()); v_department text; v_staff bigint; v_old boolean;
begin
  if not exists(select 1 from public.profiles p where p.id=v_owner and p.role='admin') then raise exception 'Only an administrator can change a Main ID.'; end if;
  select department,main_staff_id,active into v_department,v_staff,v_old from public.department_main_ids where id=p_main_id and owner_id=v_owner for update;
  if v_department is null then raise exception 'Main ID was not found.'; end if;
  update public.department_main_ids set active=p_active,updated_at=now() where id=p_main_id;
  insert into public.permission_activity_log(owner_id,actor_user_id,target_staff_id,department,action,old_value,new_value)
  values(v_owner,v_owner,v_staff,v_department,'main_id_status_changed',v_old,p_active);
end $$;

create or replace function public.set_main_module_permission(p_main_id uuid, p_module text, p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=(select auth.uid()); v_department text; v_staff bigint; v_old boolean:=false;
begin
  if not exists(select 1 from public.profiles p where p.id=v_owner and p.role='admin') then raise exception 'Only an administrator can edit Main ID permissions.'; end if;
  select department,main_staff_id into v_department,v_staff from public.department_main_ids where id=p_main_id and owner_id=v_owner and active;
  if v_department is null then raise exception 'Active Main ID was not found.'; end if;
  if not public.permission_allowed_for_department(v_department,p_module) then raise exception 'This module does not belong to the selected department.'; end if;
  select enabled into v_old from public.staff_module_permissions where target_staff_id=v_staff and module=p_module;
  insert into public.staff_module_permissions(owner_id,target_staff_id,department,module,enabled,granted_by,updated_at)
  values(v_owner,v_staff,v_department,p_module,p_enabled,v_owner,now())
  on conflict(target_staff_id,module) do update set enabled=excluded.enabled,granted_by=v_owner,updated_at=now();
  if not p_enabled then
    update public.staff_module_permissions child set enabled=false,granted_by=v_owner,updated_at=now()
    where child.module=p_module and child.enabled and exists(
      select 1 from public.department_staff_assignments a where a.main_id=p_main_id and a.staff_id=child.target_staff_id and a.active
    );
  end if;
  insert into public.permission_activity_log(owner_id,actor_user_id,target_staff_id,department,module,action,old_value,new_value)
  values(v_owner,v_owner,v_staff,v_department,p_module,'main_permission_changed',coalesce(v_old,false),p_enabled);
end $$;

create or replace function public.assign_staff_to_department_main(p_main_id uuid, p_staff_id bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=(select auth.uid()); v_department text; v_main_staff bigint; v_id uuid;
begin
  if not exists(select 1 from public.profiles p where p.id=v_owner and p.role='admin') then raise exception 'Only an administrator can assign staff.'; end if;
  select department,main_staff_id into v_department,v_main_staff from public.department_main_ids where id=p_main_id and owner_id=v_owner and active;
  if v_department is null then raise exception 'Active Main ID was not found.'; end if;
  if p_staff_id=v_main_staff then raise exception 'A Main ID cannot be assigned as its own child account.'; end if;
  if not exists(select 1 from public.staff_members s join public.staff_departments d on d.staff_id=s.id and d.department=v_department where s.id=p_staff_id and s.owner_id=v_owner and s.portal_active and s.is_active) then raise exception 'Select an active staff account from the same department.'; end if;
  insert into public.department_staff_assignments(owner_id,department,main_id,staff_id,active,updated_at)
  values(v_owner,v_department,p_main_id,p_staff_id,true,now())
  on conflict(owner_id,department,staff_id) do update set main_id=excluded.main_id,active=true,updated_at=now()
  returning id into v_id;
  insert into public.permission_activity_log(owner_id,actor_user_id,target_staff_id,department,action,new_value)
  values(v_owner,v_owner,p_staff_id,v_department,'staff_assigned',true);
  return v_id;
end $$;

create or replace function public.set_staff_module_permission(p_target_staff_id bigint, p_module text, p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_actor bigint; v_owner uuid; v_department text; v_main_staff bigint; v_old boolean:=false; v_admin boolean:=false;
begin
  select id,owner_id into v_actor,v_owner from public.staff_members where user_id=v_user and portal_active and is_active;
  if v_actor is null then
    select p.id into v_owner from public.profiles p where p.id=v_user and p.role='admin';
    v_admin:=v_owner is not null;
  end if;
  select a.department,m.main_staff_id into v_department,v_main_staff
  from public.department_staff_assignments a join public.department_main_ids m on m.id=a.main_id and m.active
  where a.staff_id=p_target_staff_id and a.active and (a.owner_id=v_owner or v_admin) limit 1;
  if v_department is null then raise exception 'This staff account is not assigned to an active Main ID.'; end if;
  if not v_admin and v_actor<>v_main_staff then raise exception 'You can manage only staff assigned to your Main ID.'; end if;
  if not public.permission_allowed_for_department(v_department,p_module) then raise exception 'This module does not belong to the selected department.'; end if;
  if p_enabled and not exists(select 1 from public.staff_module_permissions where target_staff_id=v_main_staff and module=p_module and enabled) then raise exception 'A Main ID cannot grant a permission it does not have.'; end if;
  select enabled into v_old from public.staff_module_permissions where target_staff_id=p_target_staff_id and module=p_module;
  insert into public.staff_module_permissions(owner_id,target_staff_id,department,module,enabled,granted_by,updated_at)
  values(v_owner,p_target_staff_id,v_department,p_module,p_enabled,v_user,now())
  on conflict(target_staff_id,module) do update set enabled=excluded.enabled,granted_by=v_user,updated_at=now();
  insert into public.permission_activity_log(owner_id,actor_user_id,actor_staff_id,target_staff_id,department,module,action,old_value,new_value)
  values(v_owner,v_user,v_actor,p_target_staff_id,v_department,p_module,'staff_permission_changed',coalesce(v_old,false),p_enabled);
end $$;

revoke all on function public.assign_department_main(text,bigint,text) from public;
revoke all on function public.set_department_main_active(uuid,boolean) from public;
revoke all on function public.set_main_module_permission(uuid,text,boolean) from public;
revoke all on function public.assign_staff_to_department_main(uuid,bigint) from public;
revoke all on function public.set_staff_module_permission(bigint,text,boolean) from public;
grant execute on function public.assign_department_main(text,bigint,text) to authenticated;
grant execute on function public.set_department_main_active(uuid,boolean) to authenticated;
grant execute on function public.set_main_module_permission(uuid,text,boolean) to authenticated;
grant execute on function public.assign_staff_to_department_main(uuid,bigint) to authenticated;
grant execute on function public.set_staff_module_permission(bigint,text,boolean) to authenticated;
grant execute on function public.staff_has_module(text) to authenticated;
grant execute on function public.staff_has_any_module(text[]) to authenticated;

create or replace function public.current_booking_owner()
returns uuid language sql stable security definer set search_path = '' as $$
  select case
    when p.role='admin' then p.id
    when p.role='staff' and public.staff_has_any_module(array['quotations','bookings']) then public.current_staff_owner()
    else null end
  from public.profiles p where p.id=(select auth.uid()) limit 1
$$;

-- Existing department accounts become Main IDs so the current portal keeps working.
insert into public.department_main_ids(owner_id,department,main_staff_id,main_code)
select s.owner_id,d.department,s.id,
  case d.department when 'booking' then 'BOOK-MAIN-01' when 'warehouse' then 'WH-MAIN-01'
    when 'qc' then 'QC-MAIN-01' when 'stylist' then 'STY-MAIN-01'
    when 'collection' then 'COL-MAIN-01' else 'MOD-MAIN-01' end
from public.staff_members s join public.staff_departments d on d.staff_id=s.id
where s.portal_active and s.is_active
  and lower(coalesce(s.login_id,'')) in ('booking.staff','warehouse.staff','qc.staff','stylist.staff','collection.staff','modification.staff')
on conflict(owner_id,department) do update set main_staff_id=excluded.main_staff_id,main_code=excluded.main_code,active=true,updated_at=now();

insert into public.staff_module_permissions(owner_id,target_staff_id,department,module,enabled,granted_by)
select m.owner_id,m.main_staff_id,m.department,modules.module,true,m.owner_id
from public.department_main_ids m
cross join lateral unnest(
  case m.department
    when 'booking' then array['booking_overview','quotations','leads','bookings','customers','event_jobs','event_tracking','calendar','my_tasks','attendance','performance','leave_management','agreements','invoices']
    when 'warehouse' then array['warehouse_tasks','event_jobs','my_tasks','attendance','performance','leave_management']
    when 'qc' then array['qc_tasks','event_jobs','my_tasks','attendance','performance','leave_management']
    when 'stylist' then array['stylist_opportunities','assigned_events','my_tasks','attendance','performance','leave_management']
    when 'collection' then array['collection_tasks','event_jobs','my_tasks','attendance','performance','leave_management']
    else array['modification_tasks','event_jobs','my_tasks','attendance','performance','leave_management'] end
) modules(module)
on conflict(target_staff_id,module) do update set enabled=true,updated_at=now();

-- Replace broad booking-department policies with effective module checks.
drop policy if exists bookings_staff_select on public.bookings;
drop policy if exists bookings_booking_staff_insert on public.bookings;
drop policy if exists bookings_booking_staff_update on public.bookings;
create policy bookings_staff_select on public.bookings for select to authenticated using (
  owner_id=public.current_staff_owner() and ((is_quote and public.staff_has_module('quotations')) or (not is_quote and public.staff_has_module('bookings')))
);
create policy bookings_booking_staff_insert on public.bookings for insert to authenticated with check (
  owner_id=public.current_staff_owner() and ((is_quote and public.staff_has_module('quotations')) or (not is_quote and public.staff_has_module('bookings')))
);
create policy bookings_booking_staff_update on public.bookings for update to authenticated using (
  owner_id=public.current_staff_owner() and ((is_quote and public.staff_has_module('quotations')) or (not is_quote and public.staff_has_module('bookings')))
) with check (
  owner_id=public.current_staff_owner() and ((is_quote and public.staff_has_module('quotations')) or (not is_quote and public.staff_has_module('bookings')))
);

drop policy if exists customers_staff_select on public.customers;
drop policy if exists customers_booking_staff_insert on public.customers;
drop policy if exists customers_booking_staff_update on public.customers;
create policy customers_staff_select on public.customers for select to authenticated using (owner_id=public.current_staff_owner() and public.staff_has_any_module(array['customers','quotations','bookings']));
create policy customers_booking_staff_insert on public.customers for insert to authenticated with check (owner_id=public.current_staff_owner() and public.staff_has_any_module(array['customers','quotations','bookings']));
create policy customers_booking_staff_update on public.customers for update to authenticated using (owner_id=public.current_staff_owner() and public.staff_has_any_module(array['customers','quotations','bookings'])) with check (owner_id=public.current_staff_owner() and public.staff_has_any_module(array['customers','quotations','bookings']));

drop policy if exists staff_members_booking_staff_select on public.staff_members;
create policy staff_members_booking_staff_select on public.staff_members for select to authenticated using (owner_id=public.current_booking_owner() and public.staff_has_module('bookings'));

drop policy if exists products_booking_staff_select on public.products;
create policy products_booking_staff_select on public.products for select to authenticated using (owner_id=public.current_booking_owner() and public.staff_has_any_module(array['quotations','bookings']));
drop policy if exists product_variants_booking_staff_select on public.product_variants;
create policy product_variants_booking_staff_select on public.product_variants for select to authenticated using (owner_id=public.current_booking_owner() and public.staff_has_any_module(array['quotations','bookings']));
drop policy if exists packages_booking_staff_select on public.packages;
create policy packages_booking_staff_select on public.packages for select to authenticated using (owner_id=public.current_booking_owner() and public.staff_has_any_module(array['quotations','bookings']));
drop policy if exists package_items_booking_staff_select on public.package_items;
create policy package_items_booking_staff_select on public.package_items for select to authenticated using (owner_id=public.current_booking_owner() and public.staff_has_any_module(array['quotations','bookings']));
drop policy if exists package_categories_booking_staff_select on public.package_categories;
create policy package_categories_booking_staff_select on public.package_categories for select to authenticated using (owner_id=public.current_booking_owner() and public.staff_has_any_module(array['quotations','bookings']));
drop policy if exists package_variants_booking_staff_select on public.package_variants;
create policy package_variants_booking_staff_select on public.package_variants for select to authenticated using (owner_id=public.current_booking_owner() and public.staff_has_any_module(array['quotations','bookings']));

drop policy if exists booking_items_staff_select on public.booking_items;
drop policy if exists booking_items_booking_staff_insert on public.booking_items;
drop policy if exists booking_items_booking_staff_update on public.booking_items;
drop policy if exists booking_items_booking_staff_delete on public.booking_items;
create policy booking_items_staff_select on public.booking_items for select to authenticated using (
  owner_id=public.current_staff_owner() and exists(select 1 from public.bookings b where b.id=booking_id and ((b.is_quote and public.staff_has_module('quotations')) or (not b.is_quote and public.staff_has_module('bookings'))))
);
create policy booking_items_booking_staff_insert on public.booking_items for insert to authenticated with check (
  owner_id=public.current_staff_owner() and exists(select 1 from public.bookings b where b.id=booking_id and ((b.is_quote and public.staff_has_module('quotations')) or (not b.is_quote and public.staff_has_module('bookings'))))
);
create policy booking_items_booking_staff_update on public.booking_items for update to authenticated using (
  owner_id=public.current_staff_owner() and exists(select 1 from public.bookings b where b.id=booking_id and ((b.is_quote and public.staff_has_module('quotations')) or (not b.is_quote and public.staff_has_module('bookings'))))
) with check (
  owner_id=public.current_staff_owner() and exists(select 1 from public.bookings b where b.id=booking_id and ((b.is_quote and public.staff_has_module('quotations')) or (not b.is_quote and public.staff_has_module('bookings'))))
);
create policy booking_items_booking_staff_delete on public.booking_items for delete to authenticated using (
  owner_id=public.current_staff_owner() and exists(select 1 from public.bookings b where b.id=booking_id and ((b.is_quote and public.staff_has_module('quotations')) or (not b.is_quote and public.staff_has_module('bookings'))))
);

drop policy if exists booking_payments_booking_staff_select on public.booking_payments;
drop policy if exists booking_payments_booking_staff_insert on public.booking_payments;
create policy booking_payments_booking_staff_select on public.booking_payments for select to authenticated using (owner_id=public.current_staff_owner() and public.staff_has_module('bookings'));
create policy booking_payments_booking_staff_insert on public.booking_payments for insert to authenticated with check (owner_id=public.current_staff_owner() and public.staff_has_module('bookings'));
drop policy if exists rental_returns_booking_staff_select on public.rental_returns;
drop policy if exists rental_returns_booking_staff_insert on public.rental_returns;
create policy rental_returns_booking_staff_select on public.rental_returns for select to authenticated using (owner_id=public.current_staff_owner() and public.staff_has_module('bookings'));
create policy rental_returns_booking_staff_insert on public.rental_returns for insert to authenticated with check (owner_id=public.current_staff_owner() and public.staff_has_module('bookings'));
drop policy if exists booking_activity_booking_staff_select on public.booking_activity;
drop policy if exists booking_activity_booking_staff_insert on public.booking_activity;
create policy booking_activity_booking_staff_select on public.booking_activity for select to authenticated using (owner_id=public.current_staff_owner() and public.staff_has_any_module(array['quotations','bookings']));
create policy booking_activity_booking_staff_insert on public.booking_activity for insert to authenticated with check (owner_id=public.current_staff_owner() and public.staff_has_any_module(array['quotations','bookings']));

drop policy if exists event_jobs_staff_select on public.event_jobs;
create policy event_jobs_staff_select on public.event_jobs for select to authenticated using (owner_id=public.current_staff_owner() and public.staff_has_module('event_jobs'));

commit;
