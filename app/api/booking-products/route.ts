import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ error: 'Your session has expired.' }, { status: 401 });
    }

    const body = await request.json();
    const ownerId = typeof body.ownerId === 'string' ? body.ownerId : auth.user.id;
    const name = String(body.name ?? '').trim();
    const category = String(body.category ?? '').trim();
    if (!name || !category) {
      return NextResponse.json({ error: 'Product name and category are required.' }, { status: 422 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('products')
      .insert({
        owner_id: ownerId,
        name,
        sku: body.sku ? String(body.sku).trim() : null,
        category,
        sale_price: Number(body.sale_price ?? 0),
        rental_price: Number(body.rental_price ?? 0),
        stock_quantity: Number(body.stock_quantity ?? 0),
        image_urls: Array.isArray(body.image_urls) ? body.image_urls : [],
      })
      .select('id,sku,barcode,name,category,subcategory,sale_price,rental_price,security_deposit,stock_quantity,image_urls')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ product: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save the product.' },
      { status: 500 },
    );
  }
}
