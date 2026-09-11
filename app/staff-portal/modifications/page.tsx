import { requireDepartment } from '@/lib/staff-portal/guard';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { ModificationQueue, type ModificationBooking } from '@/components/modifications/modification-queue';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function StaffModificationPage() {
  const session = await requireDepartment('modification');
  const admin = createAdminClient();
  const { data, error } = await admin.from('bookings').select('id,booking_number,status,event_name,event_date,event_time,event_location,notes,created_at,customers(name,phone,address),staff_members:staff_members!bookings_assigned_staff_id_fkey(name),booking_items(id,item_name,quantity),booking_activity(id,action,details,created_at)').eq('booking_type', 'sale').ilike('notes', '%SALE MODIFICATION REQUIRED%').order('event_date');
  return <StaffPortalShell name={session.name} departments={session.departments} permissions={session.permissions} accessModules={session.accessModules} isMainId={session.isMainId}><ModificationQueue initialBookings={(data ?? []) as unknown as ModificationBooking[]} loadError={error?.message ?? ''} staffMode /></StaffPortalShell>;
}
