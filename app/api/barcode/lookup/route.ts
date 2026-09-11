import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const productFields = 'id,sku,barcode,name,category,subcategory,sale_price,rental_price,security_deposit,stock_quantity,image_urls';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: 'Your session has expired.' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const barcode = String(body?.barcode ?? '').trim();
    if (!barcode) return NextResponse.json({ error: 'Barcode is required.' }, { status: 422 });

    const exact = (query: ReturnType<typeof supabase.from>) => query.select(productFields).eq('barcode', barcode).eq('is_active', true).maybeSingle();
    let { data: product } = await exact(supabase.from('products'));
    if (!product) {
      const bySku = await supabase.from('products').select(productFields).eq('sku', barcode).eq('is_active', true).maybeSingle();
      product = bySku.data;
    }
    if (!product) {
      const variant = await supabase.from('product_variants').select('product_id').eq('barcode', barcode).maybeSingle();
      if (variant.data?.product_id) {
        const byVariant = await supabase.from('products').select(productFields).eq('id', variant.data.product_id).eq('is_active', true).maybeSingle();
        product = byVariant.data;
      }
    }
    if (!product) return NextResponse.json({ error: `No product found with barcode: ${barcode}` }, { status: 404 });
    return NextResponse.json({ product });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to lookup barcode.' }, { status: 500 });
  }
}
