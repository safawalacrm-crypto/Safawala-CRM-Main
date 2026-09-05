import { redirect } from 'next/navigation';
import {
  PackageManagement,
  type PackageCategory,
} from '@/components/packages/package-management';
import { BookingPortalShell } from '@/components/bookings/booking-portal-shell';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const packageFields =
  'id,name,is_active,created_at,updated_at,package_variants(id,category_id,name,base_price,inclusions,extra_safa_price,missing_safa_penalty,security_deposit,image_url,created_at,updated_at)';

export default async function PackagesPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const { data, error } = await supabase
    .from('package_categories')
    .select(packageFields)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  const categories = ((data ?? []) as PackageCategory[]).map((category) => ({
    ...category,
    package_variants: [...(category.package_variants ?? [])].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    ),
  }));

  return (
    <BookingPortalShell email={auth.user.email ?? 'Safawala user'}>
      <PackageManagement
        initialCategories={categories}
        loadError={error?.message ?? ''}
      />
    </BookingPortalShell>
  );
}
