import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { VendorManager, type Vendor } from '@/components/vendors/vendor-manager';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function VendorsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const { data, error } = await supabase
    .from('vendors')
    .select('id,name,contact_person,phone,email,address,notes,is_active,created_at')
    .order('created_at', { ascending: false });
  return (
    <DashboardShell email={auth.user.email ?? 'Safawala user'}>
      <VendorManager vendors={(data ?? []) as Vendor[]} loadError={error?.message ?? ''} />
    </DashboardShell>
  );
}
