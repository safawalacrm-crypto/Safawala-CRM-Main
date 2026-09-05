import { redirect } from 'next/navigation';
import {
  InventoryDirectory,
  type InventoryProduct,
} from '@/components/inventory/inventory-directory';
import { BookingPortalShell } from '@/components/bookings/booking-portal-shell';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const inventoryFields =
  'id,sku,barcode,name,description,category,subcategory,size,color,material,cost_price,regular_price,sale_price,rental_price,security_deposit,stock_quantity,reorder_level,image_urls,is_active,created_at,updated_at,product_variants(id,name,size,color,material,stock_quantity,barcode)';

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const { data, error } = await supabase
    .from('products')
    .select(inventoryFields)
    .order('created_at', { ascending: false });

  return (
    <BookingPortalShell email={auth.user.email ?? 'Safawala user'}>
      <InventoryDirectory
        initialProducts={(data ?? []) as InventoryProduct[]}
        loadError={error?.message ?? ''}
      />
    </BookingPortalShell>
  );
}
