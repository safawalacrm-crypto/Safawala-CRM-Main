import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { BookingForm } from '@/components/bookings/booking-form';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewBookingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const [
    { data: customers },
    { data: products },
    { data: packages },
    { data: staff },
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('id,name,phone,email,address')
      .order('name'),
    supabase
      .from('products')
      .select(
        'id,sku,barcode,name,sale_price,rental_price,security_deposit,stock_quantity,image_urls',
      )
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('packages')
      .select('id,name,sale_price,rental_price,security_deposit')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('staff_members')
      .select('id,name')
      .eq('is_active', true)
      .order('name'),
  ]);
  return (
    <DashboardShell email={auth.user.email ?? 'Safawala user'}>
      <BookingForm
        customers={customers ?? []}
        products={products ?? []}
        packages={packages ?? []}
        staff={staff ?? []}
      />
    </DashboardShell>
  );
}
