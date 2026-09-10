'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function owner() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Admin session required.');
  return { supabase, ownerId: data.user.id };
}

function databaseError(error: { message?: string; code?: string }, fallback: string) {
  if (error.code === 'PGRST205' || error.message?.includes("Could not find the table")) {
    return 'Leads database tables are not installed. Apply the Leads Center Supabase migration, then try again.';
  }
  return error.message || fallback;
}

export async function createLeadAction(formData: FormData) {
  const { supabase, ownerId } = await owner();
  const text = (name: string) => String(formData.get(name) ?? '').trim();
  if (!/^\d{10}$/.test(text('phone'))) throw new Error('WhatsApp / Phone must contain exactly 10 digits.');
  const { error } = await supabase.from('leads').insert({
    owner_id: ownerId, full_name: text('full_name'), phone: text('phone'), email: text('email') || null,
    event_date: text('event_date'), location: text('location') || null, package_interest: text('package_interest') || null,
    source: text('source') || 'Manual Entry', status: text('status') || 'new', assigned_staff_id: text('assigned_staff_id') ? Number(text('assigned_staff_id')) : null,
    requirements: text('requirements') || null, internal_notes: text('internal_notes') || null,
  });
  if (error) throw new Error(databaseError(error, 'Unable to save lead.'));
  await supabase.from('admin_notifications').insert({ owner_id: ownerId, title: 'New Lead Added', message: `${text('full_name')} has been added to the leads center.`, href: '/leads' });
  revalidatePath('/leads');
}

export async function createLockedDateAction(formData: FormData) {
  const { supabase, ownerId } = await owner();
  const date = String(formData.get('locked_date') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();
  const { error } = await supabase.from('lead_locked_dates').insert({ owner_id: ownerId, locked_date: date, label, notes: String(formData.get('notes') ?? '').trim() || null });
  if (error) throw new Error(error.code === '23505' ? 'That date is already locked.' : databaseError(error, 'Unable to lock date.'));
  await supabase.from('admin_notifications').insert({ owner_id: ownerId, title: 'Date Locked', message: `${label} · ${date}`, href: '/leads?view=locked-dates' });
  revalidatePath('/leads');
}

export async function deleteLockedDateAction(formData: FormData) {
  const { supabase, ownerId } = await owner();
  await supabase.from('lead_locked_dates').delete().eq('id', Number(formData.get('id'))).eq('owner_id', ownerId);
  revalidatePath('/leads');
}
