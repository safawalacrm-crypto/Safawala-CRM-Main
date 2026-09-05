-- Sale and rental document sequences overlap, so include their type in the Event Job key.
-- Existing references are changed to cascade key corrections safely.

alter table public.event_job_stages drop constraint if exists event_job_stages_event_job_id_fkey;
alter table public.event_job_pick_items drop constraint if exists event_job_pick_items_event_job_stage_id_fkey;
alter table public.event_job_qc_items drop constraint if exists event_job_qc_items_event_job_stage_id_fkey;
alter table public.event_job_packing_checklist drop constraint if exists event_job_packing_checklist_event_job_stage_id_fkey;
alter table public.event_job_stylist_interest drop constraint if exists event_job_stylist_interest_event_job_id_fkey;
alter table public.event_job_collection_items drop constraint if exists event_job_collection_items_event_job_stage_id_fkey;
alter table public.event_job_issues drop constraint if exists event_job_issues_event_job_id_fkey;
alter table public.event_job_activity drop constraint if exists event_job_activity_event_job_id_fkey;
alter table public.event_job_notifications drop constraint if exists event_job_notifications_event_job_id_fkey;
alter table public.staff_performance_credits drop constraint if exists staff_performance_credits_event_job_id_fkey;

alter table public.event_job_stages add constraint event_job_stages_event_job_id_fkey foreign key(event_job_id) references public.event_jobs(id) on update cascade on delete cascade;
alter table public.event_job_pick_items add constraint event_job_pick_items_event_job_stage_id_fkey foreign key(event_job_stage_id) references public.event_job_stages(id) on delete cascade;
alter table public.event_job_qc_items add constraint event_job_qc_items_event_job_stage_id_fkey foreign key(event_job_stage_id) references public.event_job_stages(id) on delete cascade;
alter table public.event_job_packing_checklist add constraint event_job_packing_checklist_event_job_stage_id_fkey foreign key(event_job_stage_id) references public.event_job_stages(id) on delete cascade;
alter table public.event_job_stylist_interest add constraint event_job_stylist_interest_event_job_id_fkey foreign key(event_job_id) references public.event_jobs(id) on update cascade on delete cascade;
alter table public.event_job_collection_items add constraint event_job_collection_items_event_job_stage_id_fkey foreign key(event_job_stage_id) references public.event_job_stages(id) on delete cascade;
alter table public.event_job_issues add constraint event_job_issues_event_job_id_fkey foreign key(event_job_id) references public.event_jobs(id) on update cascade on delete cascade;
alter table public.event_job_activity add constraint event_job_activity_event_job_id_fkey foreign key(event_job_id) references public.event_jobs(id) on update cascade on delete cascade;
alter table public.event_job_notifications add constraint event_job_notifications_event_job_id_fkey foreign key(event_job_id) references public.event_jobs(id) on update cascade on delete cascade;
alter table public.staff_performance_credits add constraint staff_performance_credits_event_job_id_fkey foreign key(event_job_id) references public.event_jobs(id) on update cascade on delete cascade;

update public.event_jobs j
set id = 'JOB-' || case when b.booking_type='sale' then 'S' else 'R' end || '-' ||
  coalesce(substring(b.booking_number from '(\d{4}-\d+)$'), 'B' || b.id::text),
  job_number = 'JOB-' || case when b.booking_type='sale' then 'S' else 'R' end || '-' ||
  coalesce(substring(b.booking_number from '(\d{4}-\d+)$'), 'B' || b.id::text)
from public.bookings b where b.id=j.booking_id;

create or replace function public.open_event_job(booking_key bigint)
returns text language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; jid text; now_at timestamptz:=now();
begin
  select * into b from public.bookings where id=booking_key;
  if b.id is null or b.is_quote or b.status <> 'confirmed' then return null; end if;
  jid := 'JOB-' || case when b.booking_type='sale' then 'S' else 'R' end || '-' ||
    coalesce(substring(b.booking_number from '(\d{4}-\d+)$'), 'B' || b.id::text);
  insert into public.event_jobs(id,booking_id,owner_id,job_number,status,created_at,updated_at)
  values(jid,b.id,b.owner_id,jid,'active',now_at,now_at) on conflict(booking_id) do nothing;
  insert into public.event_job_stages(event_job_id,stage,status,opened_at)
  select jid, s,
    case when b.booking_type='sale' and s in ('collection','return_quality_check','return_warehouse') then 'done'
         when s in ('warehouse_pick','stylist_opportunity') then 'open' else 'not_started' end,
    case when s in ('warehouse_pick','stylist_opportunity') then now_at else null end
  from unnest(array['warehouse_pick','quality_check','packing','stylist_opportunity','collection','return_quality_check','return_warehouse','booking_final_check']) s
  on conflict(event_job_id,stage) do nothing;
  return jid;
end $$;
