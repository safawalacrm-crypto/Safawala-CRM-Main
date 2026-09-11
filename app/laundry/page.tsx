import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LaundryManager } from '@/components/laundry/laundry-manager';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const batchFields = 'id,batch_number,vendor_id,status,sent_date,expected_return_date,total_cost,notes,created_at,updated_at,vendors(name,contact_person,phone,email),laundry_batch_items(id,product_id,product_name,quantity,condition_before,condition_after,unit_cost,notes),laundry_batch_notes(id,note,created_at)';
export default async function LaundryPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const [{ data: batches, error }, { data: vendors }, { data: products }] = await Promise.all([
    supabase.from('laundry_batches').select(batchFields).order('sent_date', { ascending: false }),
    supabase.from('vendors').select('id,name,contact_person,phone,email').eq('is_active', true).order('name'),
    supabase.from('products').select('id,name,category,stock_quantity').eq('is_active', true).order('name'),
  ]);
  return <DashboardShell email={auth.user.email ?? 'Safawala user'}><LaundryManager initialBatches={(batches ?? []) as never[]} vendors={vendors ?? []} products={products ?? []} loadError={error?.message ?? ''} /></DashboardShell>;
}
