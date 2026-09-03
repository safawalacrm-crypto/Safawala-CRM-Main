import { redirect } from 'next/navigation';
import { CustomerDirectory, type CustomerBooking, type CustomerRecord } from '@/components/customers/customer-directory';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const [customerResult, bookingResult] = await Promise.all([
    supabase.from('customers').select('id,name,phone,email,address,notes,created_at,updated_at').order('created_at', { ascending: false }),
    supabase
      .from('bookings')
      .select('id,booking_number,booking_type,status,event_name,event_date,total,balance_amount,customer_id,created_at')
      .or('is_quote.eq.false,and(is_quote.eq.true,status.not.in.(draft,cancelled))')
      .order('created_at', { ascending: false }),
  ]);

  return <DashboardShell email={auth.user.email ?? 'Safawala user'}>
    <CustomerDirectory
      initialCustomers={(customerResult.data ?? []) as CustomerRecord[]}
      bookings={(bookingResult.data ?? []) as CustomerBooking[]}
      loadError={customerResult.error?.message ?? bookingResult.error?.message ?? ''}
    />
  </DashboardShell>;
}
