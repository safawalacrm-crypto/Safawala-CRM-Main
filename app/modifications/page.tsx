import { redirect } from 'next/navigation';
import { BookingPortalShell } from '@/components/bookings/booking-portal-shell';
import {
  ModificationQueue,
  type ModificationBooking,
} from '@/components/modifications/modification-queue';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ModificationsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id,booking_number,status,event_name,event_date,event_time,event_location,notes,created_at,customers(name,phone,address),staff_members(name),booking_items(id,item_name,quantity),booking_activity(id,action,details,created_at)',
    )
    .eq('booking_type', 'sale')
    .or(
      'is_quote.eq.false,and(is_quote.eq.true,status.not.in.(draft,cancelled))',
    )
    .ilike('notes', '%SALE MODIFICATION REQUIRED%')
    .order('event_date');

  return (
    <BookingPortalShell email={auth.user.email ?? 'Safawala user'}>
      <ModificationQueue
        initialBookings={(data ?? []) as unknown as ModificationBooking[]}
        loadError={error?.message ?? ''}
      />
    </BookingPortalShell>
  );
}
