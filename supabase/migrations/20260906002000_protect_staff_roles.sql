-- Authenticated users may not promote themselves by updating profiles.role.
create or replace function public.protect_profile_role()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.role is distinct from new.role and (select auth.uid()) is not null and (select auth.uid()) = old.id then
    raise exception 'Profile roles can only be changed by the server administrator';
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update of role on public.profiles
for each row execute function public.protect_profile_role();
