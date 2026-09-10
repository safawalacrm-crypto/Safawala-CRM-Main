'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function owner() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Admin session required.');
  return { supabase, ownerId: data.user.id };
}

function text(form: FormData, key: string) {
  return String(form.get(key) ?? '').trim();
}

function databaseError(error: { message?: string; code?: string }, fallback: string) {
  if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
    return 'Vendors database table is not installed. Apply the vendor management Supabase migration, then try again.';
  }
  return error.message || fallback;
}

function parseVendor(form: FormData) {
  const name = text(form, 'name');
  const phone = text(form, 'phone');
  if (name.length < 2) throw new Error('Vendor name is required.');
  if (!/^\d{10}$/.test(phone)) throw new Error('Phone must contain exactly 10 digits.');
  return {
    name,
    phone,
    contact_person: text(form, 'contact_person') || null,
    email: text(form, 'email') || null,
    address: text(form, 'address') || null,
    notes: text(form, 'notes') || null,
  };
}

export async function createVendorAction(form: FormData) {
  const { supabase, ownerId } = await owner();
  const { error } = await supabase.from('vendors').insert({ owner_id: ownerId, ...parseVendor(form), is_active: true });
  if (error) throw new Error(databaseError(error, 'Unable to save vendor.'));
  revalidatePath('/vendors');
}

export async function updateVendorAction(form: FormData) {
  const id = Number(text(form, 'id'));
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid vendor.');
  const { supabase, ownerId } = await owner();
  const { error } = await supabase
    .from('vendors')
    .update({ ...parseVendor(form), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', ownerId);
  if (error) throw new Error(databaseError(error, 'Unable to update vendor.'));
  revalidatePath('/vendors');
}

export async function toggleVendorStatusAction(form: FormData) {
  const id = Number(text(form, 'id'));
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid vendor.');
  const active = text(form, 'is_active') === 'true';
  const { supabase, ownerId } = await owner();
  const { error } = await supabase
    .from('vendors')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', ownerId);
  if (error) throw new Error(databaseError(error, 'Unable to update vendor status.'));
  revalidatePath('/vendors');
}

export async function deleteVendorAction(form: FormData) {
  const id = Number(text(form, 'id'));
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid vendor.');
  const { supabase, ownerId } = await owner();
  const { error } = await supabase.from('vendors').delete().eq('id', id).eq('owner_id', ownerId);
  if (error) throw new Error(databaseError(error, 'Unable to delete vendor.'));
  revalidatePath('/vendors');
}
