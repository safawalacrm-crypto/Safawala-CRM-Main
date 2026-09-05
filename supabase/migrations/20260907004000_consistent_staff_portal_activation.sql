-- A portal login must never appear enabled while its linked staff record is
-- inactive. Repair existing contradictions and keep future writes consistent.
begin;

update public.staff_members
set is_active = true
where user_id is not null
  and portal_active
  and not is_active;

create or replace function public.keep_staff_portal_state_consistent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.portal_active then
      new.is_active := true;
    end if;
    return new;
  end if;

  if new.portal_active is distinct from old.portal_active and new.portal_active then
    new.is_active := true;
  elsif new.is_active is distinct from old.is_active and not new.is_active then
    new.portal_active := false;
  end if;
  return new;
end;
$$;

drop trigger if exists keep_staff_portal_state_consistent_trigger on public.staff_members;
create trigger keep_staff_portal_state_consistent_trigger
before insert or update of portal_active, is_active on public.staff_members
for each row execute function public.keep_staff_portal_state_consistent();

commit;
