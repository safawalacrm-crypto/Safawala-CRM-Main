import { notFound, redirect } from 'next/navigation';
import { CustomerLedgerDetail } from '@/components/ledger/customer-ledger-detail';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import type { LedgerBooking, LedgerCustomer } from '@/lib/ledger';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function CustomerLedgerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  if (!/^\d+$/.test(customerId)) notFound();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const [customerResult, bookingResult] = await Promise.all([
    supabase
      .from('customers')
      .select('id,name,phone,email,address,created_at')
      .eq('id', Number(customerId))
      .single(),
    supabase
      .from('bookings')
      .select(
        'id,booking_number,booking_type,status,payment_status,customer_id,event_name,event_date,total,paid_amount,balance_amount,created_at,booking_payments(id,amount,payment_method,reference_number,notes,paid_at,created_at)',
      )
      .eq('customer_id', Number(customerId))
      .eq('is_quote', false)
      .neq('status', 'cancelled')
      .order('created_at'),
  ]);
  if (customerResult.error || !customerResult.data) notFound();

  return (
    <DashboardShell email={auth.user.email ?? 'Safawala user'}>
      <CustomerLedgerDetail
        customer={customerResult.data as LedgerCustomer}
        bookings={(bookingResult.data ?? []) as unknown as LedgerBooking[]}
        loadError={bookingResult.error?.message ?? ''}
      />
    </DashboardShell>
  );
}
