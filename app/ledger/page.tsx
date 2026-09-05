import { redirect } from 'next/navigation';
import { CustomerLedgerDirectory } from '@/components/ledger/customer-ledger-directory';
import { BookingPortalShell } from '@/components/bookings/booking-portal-shell';
import type { LedgerBooking, LedgerCustomer } from '@/lib/ledger';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function CustomerLedgerPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const [customerResult, bookingResult] = await Promise.all([
    supabase
      .from('customers')
      .select('id,name,phone,email,address,created_at')
      .order('name'),
    supabase
      .from('bookings')
      .select(
        'id,booking_number,booking_type,status,payment_status,customer_id,event_name,event_date,total,paid_amount,balance_amount,created_at,booking_payments(id,amount,payment_method,reference_number,notes,paid_at,created_at)',
      )
      .eq('is_quote', false)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false }),
  ]);

  return (
    <BookingPortalShell email={auth.user.email ?? 'Safawala user'}>
      <CustomerLedgerDirectory
        customers={(customerResult.data ?? []) as LedgerCustomer[]}
        bookings={(bookingResult.data ?? []) as unknown as LedgerBooking[]}
        loadError={customerResult.error?.message ?? bookingResult.error?.message ?? ''}
      />
    </BookingPortalShell>
  );
}
