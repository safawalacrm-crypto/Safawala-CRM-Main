'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { markAllReadForOwner } from '@/lib/notifications/admin-store';

export async function markAllAdminNotificationsReadAction() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  await markAllReadForOwner(auth.user.id);
  revalidatePath('/notifications');
  revalidatePath('/dashboard');
}
