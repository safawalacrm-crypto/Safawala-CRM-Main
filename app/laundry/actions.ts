'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function text(form: FormData, key: string) { return String(form.get(key) ?? '').trim(); }
function ownerError(error: { code?: string; message?: string }) {
  if (error.code === '42P01' || error.message?.includes('laundry_batches')) return 'Laundry database tables are not installed. Apply the Laundry Supabase migration, then try again.';
  return error.message || 'Unable to save laundry batch.';
}
async function owner() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Your session has expired. Please sign in again.');
  return { supabase, ownerId: data.user.id };
}
function batchNumber() { return `LB${Math.floor(100000 + Math.random() * 900000)}`; }

export async function createLaundryBatchAction(form: FormData) {
  const { supabase, ownerId } = await owner();
  const vendorId = Number(text(form, 'vendor_id'));
  const items = JSON.parse(String(form.get('items_json') ?? '[]')) as Array<{ product_id?: number | null; product_name: string; quantity: number; condition_before: string; unit_cost: number; notes?: string }>;
  if (!vendorId || !items.length) throw new Error(!vendorId ? 'Select a laundry vendor.' : 'Add at least one item to the batch.');
  const payload = { owner_id: ownerId, batch_number: batchNumber(), vendor_id: vendorId, sent_date: text(form, 'sent_date'), expected_return_date: text(form, 'expected_return_date'), notes: text(form, 'notes') || null, total_cost: items.reduce((sum, item) => sum + Number(item.unit_cost || 0) * Number(item.quantity || 0), 0) };
  const { data: batch, error } = await supabase.from('laundry_batches').insert(payload).select('id').single();
  if (error || !batch) throw new Error(ownerError(error ?? { message: 'Unable to create batch.' }));
  const { error: itemError } = await supabase.from('laundry_batch_items').insert(items.map((item) => ({ batch_id: batch.id, product_id: item.product_id || null, product_name: item.product_name, quantity: Number(item.quantity), condition_before: item.condition_before, unit_cost: Number(item.unit_cost || 0), notes: item.notes || null })));
  if (itemError) { await supabase.from('laundry_batches').delete().eq('id', batch.id).eq('owner_id', ownerId); throw new Error(ownerError(itemError)); }
  revalidatePath('/laundry');
}

export async function updateLaundryBatchAction(form: FormData) {
  const { supabase, ownerId } = await owner();
  const id = Number(text(form, 'id'));
  const items = JSON.parse(String(form.get('items_json') ?? '[]')) as Array<{ product_id?: number | null; product_name: string; quantity: number; condition_before: string; unit_cost: number; notes?: string }>;
  if (!id || !items.length) throw new Error('Add at least one item to the batch.');
  const { error } = await supabase.from('laundry_batches').update({ vendor_id: Number(text(form, 'vendor_id')), sent_date: text(form, 'sent_date'), expected_return_date: text(form, 'expected_return_date'), notes: text(form, 'notes') || null, total_cost: items.reduce((sum, item) => sum + Number(item.unit_cost || 0) * Number(item.quantity || 0), 0), updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', ownerId);
  if (error) throw new Error(ownerError(error));
  await supabase.from('laundry_batch_items').delete().eq('batch_id', id);
  const { error: itemError } = await supabase.from('laundry_batch_items').insert(items.map((item) => ({ batch_id: id, product_id: item.product_id || null, product_name: item.product_name, quantity: Number(item.quantity), condition_before: item.condition_before, unit_cost: Number(item.unit_cost || 0), notes: item.notes || null })));
  if (itemError) throw new Error(ownerError(itemError));
  revalidatePath('/laundry');
}

export async function updateLaundryStatusAction(id: number, status: 'returned' | 'cancelled') {
  const { supabase, ownerId } = await owner();
  const { error } = await supabase.from('laundry_batches').update({ status, updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', ownerId);
  if (error) throw new Error(ownerError(error));
  revalidatePath('/laundry');
}

export async function addLaundryNoteAction(id: number, note: string) {
  const { supabase, ownerId } = await owner();
  if (!note.trim()) throw new Error('Enter a note first.');
  const { error } = await supabase.from('laundry_batch_notes').insert({ batch_id: id, owner_id: ownerId, note: note.trim() });
  if (error) throw new Error(ownerError(error));
  revalidatePath('/laundry');
}
