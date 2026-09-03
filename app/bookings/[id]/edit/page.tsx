import { notFound, redirect } from 'next/navigation';
import { BookingEditForm } from '@/components/bookings/booking-edit-form';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function EditBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const [
    { data: booking, error },
    { data: customers },
    { data: staff },
    { data: products },
    { data: packages },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select(
        'id,booking_number,booking_type,status,is_quote,customer_id,assigned_staff_id,event_name,event_date,event_time,event_location,pickup_date,due_date,notes,discount,tax,paid_amount,booking_items(id,product_id,package_id,item_name,quantity,unit_price,security_deposit)',
      )
      .eq('id', id)
      .single(),
    supabase.from('customers').select('id,name,phone').order('name'),
    supabase
      .from('staff_members')
      .select('id,name')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('products')
      .select('id,sku,barcode,name,sale_price,rental_price,security_deposit,stock_quantity')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('packages')
      .select('id,name,sale_price,rental_price,security_deposit')
      .eq('is_active', true)
      .order('name'),
  ]);
  if (error || !booking) notFound();
  return (
    <DashboardShell email={auth.user.email ?? 'Safawala user'}>
      <BookingEditForm
        booking={booking}
        customers={customers ?? []}
        staff={staff ?? []}
        products={products ?? []}
        packages={packages ?? []}
      />
    </DashboardShell>
  );
}
