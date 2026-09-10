'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function owner() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Admin session required.');
  return { supabase, ownerId: data.user.id };
}

function value(form: FormData, key: string) {
  return String(form.get(key) ?? '').trim();
}

function databaseError(error: { message?: string; code?: string }) {
  if (error.code === 'PGRST205' || error.message?.includes("Could not find the table")) {
    return 'Coupons database table is not installed. Apply the coupon offers Supabase migration, then try again.';
  }
  if (error.code === '23505') return 'That coupon code already exists.';
  return error.message || 'Unable to save coupon offer.';
}

function parseOffer(form: FormData) {
  const code = value(form, 'code').toUpperCase().replace(/\s+/g, '');
  const name = value(form, 'name');
  const discountType = value(form, 'discount_type');
  const amount = Number(value(form, 'value'));
  if (!/^[A-Z0-9_-]{2,32}$/.test(code)) throw new Error('Code must contain 2–32 letters, numbers, hyphens, or underscores.');
  if (!name) throw new Error('Offer name is required.');
  if (!['percentage', 'fixed'].includes(discountType)) throw new Error('Choose a valid discount type.');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Value must be greater than zero.');
  return { code, name, discount_type: discountType, value: amount, is_active: form.get('is_active') === 'on' };
}

export async function createCouponAction(form: FormData) {
  const { supabase, ownerId } = await owner();
  const { error } = await supabase.from('coupon_offers').insert({ owner_id: ownerId, ...parseOffer(form) });
  if (error) throw new Error(databaseError(error));
  revalidatePath('/coupons');
}

export async function updateCouponAction(form: FormData) {
  const id = Number(value(form, 'id'));
  if (!Number.isInteger(id)) throw new Error('Invalid coupon offer.');
  const { supabase, ownerId } = await owner();
  const { error } = await supabase.from('coupon_offers').update({ ...parseOffer(form), updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', ownerId);
  if (error) throw new Error(databaseError(error));
  revalidatePath('/coupons');
}

export async function toggleCouponAction(form: FormData) {
  const id = Number(value(form, 'id'));
  const active = value(form, 'is_active') === 'true';
  const { supabase, ownerId } = await owner();
  const { error } = await supabase.from('coupon_offers').update({ is_active: active, updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', ownerId);
  if (error) throw new Error(databaseError(error));
  revalidatePath('/coupons');
}

export async function deleteCouponAction(form: FormData) {
  const id = Number(value(form, 'id'));
  const { supabase, ownerId } = await owner();
  const { error } = await supabase.from('coupon_offers').delete().eq('id', id).eq('owner_id', ownerId);
  if (error) throw new Error(databaseError(error));
  revalidatePath('/coupons');
}

export async function validateCouponAction(codeInput: string, subtotalInput: number) {
  const code = codeInput.trim().toUpperCase().replace(/\s+/g, '');
  const subtotal = Number(subtotalInput);
  if (!code || !Number.isFinite(subtotal) || subtotal <= 0) throw new Error('Enter a coupon code after adding items.');
  const { supabase, ownerId } = await owner();
  const { data, error } = await supabase.from('coupon_offers').select('code,name,discount_type,value').eq('owner_id', ownerId).eq('code', code).eq('is_active', true).maybeSingle();
  if (error) throw new Error(databaseError(error));
  if (!data) throw new Error('That coupon code is invalid or inactive.');
  const discount = data.discount_type === 'percentage' ? Math.min(subtotal, subtotal * Number(data.value) / 100) : Math.min(subtotal, Number(data.value));
  return { code: data.code, name: data.name, discount };
}
