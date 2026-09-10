import { redirect } from 'next/navigation';
import { BookingPortalShell } from '@/components/bookings/booking-portal-shell';
import { LeadsCenter } from '@/components/leads/leads-center';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const [{ data: leads, error: leadsError }, { data: lockedDates, error: lockedDatesError }, { data: staff, error: staffError }] = await Promise.all([
    supabase.from('leads').select('id,full_name,phone,email,event_date,location,package_interest,source,status,requirements,assigned_staff_id').order('created_at', { ascending: false }),
    supabase.from('lead_locked_dates').select('id,locked_date,label,notes').gte('locked_date', new Date().toISOString().slice(0, 10)).order('locked_date'),
    supabase.from('staff_members').select('id,name').eq('is_active', true).order('name'),
  ]);
  const loadError = leadsError?.message ?? lockedDatesError?.message ?? staffError?.message ?? '';
  return <BookingPortalShell email={auth.user.email ?? 'Safawala user'}><LeadsCenter leads={leads ?? []} lockedDates={lockedDates ?? []} staff={staff ?? []} loadError={loadError} /></BookingPortalShell>;
}
