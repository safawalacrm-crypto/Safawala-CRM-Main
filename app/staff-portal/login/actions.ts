'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type StaffLoginState = { error: string };

export async function staffLogin(
  _prevState: StaffLoginState,
  formData: FormData,
): Promise<StaffLoginState> {
  const loginId = String(formData.get('loginId') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!loginId || !password) {
    return { error: 'Enter your login ID and password.' };
  }
  const supabase = await createClient();
  const email = `${loginId.toLowerCase().replace(/[^a-z0-9._-]/g, '')}@staff.safawala.internal`;
  const { data: auth, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !auth.user) {
    return { error: 'Invalid login ID or password, or your access has been disabled.' };
  }
  const admin = createAdminClient();
  const { data: account } = await admin
    .from('staff_members')
    .select('portal_active,is_active')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (!account?.portal_active || !account.is_active) {
    await supabase.auth.signOut();
    return { error: 'Invalid login ID or password, or your access has been disabled.' };
  }
  redirect('/staff-portal');
}
