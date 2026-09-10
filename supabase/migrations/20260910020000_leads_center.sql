create table if not exists public.leads (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) >= 2),
  phone text not null,
  email text,
  event_date date not null,
  location text,
  package_interest text,
  source text not null default 'Manual Entry',
  status text not null default 'new' check (status in ('new','contacted','interested','converted','lost')),
  assigned_staff_id bigint references public.staff_members(id) on delete set null,
  requirements text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_owner_status_idx on public.leads(owner_id,status,created_at desc);
create table if not exists public.lead_locked_dates (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  locked_date date not null,
  label text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique(owner_id,locked_date)
);
create table if not exists public.admin_notifications (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists admin_notifications_owner_idx on public.admin_notifications(owner_id,created_at desc);
do $$ declare t text; begin
  foreach t in array array['leads','lead_locked_dates','admin_notifications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    execute format('create policy %I on public.%I for all to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()))', t || '_owner', t);
  end loop;
end $$;
grant select,insert,update,delete on public.leads, public.lead_locked_dates, public.admin_notifications to authenticated;
grant usage,select on sequence leads_id_seq, lead_locked_dates_id_seq, admin_notifications_id_seq to authenticated;
