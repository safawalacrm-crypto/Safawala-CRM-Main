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

    const isMultipart = request.headers.get('content-type')?.includes('multipart/form-data') ?? false;
    const body = isMultipart ? await request.formData() : await request.json();
    const read = (key: string) => body instanceof FormData ? body.get(key) : body[key];
    const ownerIdValue = read('ownerId');
    const ownerId = typeof ownerIdValue === 'string' && ownerIdValue ? ownerIdValue : auth.user.id;
    const name = String(read('name') ?? '').trim();
    const category = String(read('category') ?? '').trim();
    if (!name || !category) {
      return NextResponse.json({ error: 'Product name and category are required.' }, { status: 422 });
    }

    const admin = createAdminClient();
    let imageUrls: string[] = [];
    const imageFile = isMultipart ? read('image') : null;
    if (imageFile instanceof File && imageFile.size > 0) {
      const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `${ownerId}/${Date.now()}-${safeName}`;
      const upload = await admin.storage.from('product-images').upload(path, imageFile, {
        upsert: false,
        contentType: imageFile.type || undefined,
      });
      if (upload.error) {
        return NextResponse.json({ error: `Image upload failed: ${upload.error.message}` }, { status: 400 });
      }
      const { data: publicFile } = admin.storage.from('product-images').getPublicUrl(path);
      if (publicFile.publicUrl) imageUrls = [publicFile.publicUrl];
    } else if (!isMultipart && Array.isArray(body.image_urls)) {
      imageUrls = body.image_urls;
    }

    const { data, error } = await admin
      .from('products')
      .insert({
        owner_id: ownerId,
        name,
        sku: read('sku') ? String(read('sku')).trim() : null,
        category,
        sale_price: Number(read('sale_price') ?? 0),
        rental_price: Number(read('rental_price') ?? 0),
        stock_quantity: Number(read('stock_quantity') ?? 0),
        image_urls: imageUrls,
      })
      .select('id,sku,barcode,name,category,subcategory,sale_price,rental_price,security_deposit,stock_quantity,image_urls')
      .single();

    if (error) {
      const errorMessage = error.code === '23505'
        ? 'That SKU is already used in this inventory. Enter a unique SKU.'
        : error.message;
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    return NextResponse.json({ product: data, inventoryAdded: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save the product.' },
      { status: 500 },
    );
  }
}
