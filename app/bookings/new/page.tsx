import { redirect } from 'next/navigation';
import { BookingPortalShell } from '@/components/bookings/booking-portal-shell';
import { BookingForm } from '@/components/bookings/booking-form';
import { createClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-portal/session';

export const dynamic = 'force-dynamic';

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialType = params.type === 'rental' ? 'rental' : params.type === 'sale' ? 'sale' : undefined;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const [{ data: staffAccount }, staffSession] = await Promise.all([
    supabase
      .from('staff_members')
      .select('owner_id')
      .eq('user_id', auth.user.id)
      .maybeSingle(),
    getStaffSession(),
  ]);
  const bookingOwnerId = staffAccount?.owner_id ?? auth.user.id;
  const [
    { data: customers },
    { data: products },
    { data: packages },
    { data: packageCategories },
    { data: staff },
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('id,name,phone,email,address')
      .order('name'),
    supabase
      .from('products')
      .select(
        'id,sku,barcode,name,category,subcategory,sale_price,rental_price,security_deposit,stock_quantity,image_urls',
      )
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('packages')
      .select('id,name,sale_price,rental_price,security_deposit')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('package_categories')
      .select(
        'id,name,package_variants(id,name,base_price,inclusions,extra_safa_price,missing_safa_penalty,security_deposit)',
      )
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('staff_members')
      .select('id,name')
      .eq('is_active', true)
      .order('name'),
  ]);
  return (
    <BookingPortalShell email={auth.user.email ?? 'Safawala user'}>
      <BookingForm
        ownerId={bookingOwnerId}
        customers={customers ?? []}
        products={products ?? []}
        packages={packages ?? []}
        rentalPackages={(packageCategories ?? []).flatMap((category) =>
          (category.package_variants ?? []).map((variant) => ({
            id: variant.id,
            name: variant.name,
            category_name: category.name,
            rental_price: Number(variant.base_price),
            extra_safa_price: Number(variant.extra_safa_price),
            missing_safa_penalty: Number(variant.missing_safa_penalty),
            security_deposit: Number(variant.security_deposit),
            inclusions: variant.inclusions ?? [],
          })),
        )}
        staff={staff ?? []}
        quoteOnly={staffSession?.accessType === 'staff'}
        initialType={initialType}
        quoteCreatorStaffId={
          staffSession?.accessType === 'staff'
            ? staffSession.staffMemberId
            : undefined
        }
      />
    </BookingPortalShell>
  );
}
