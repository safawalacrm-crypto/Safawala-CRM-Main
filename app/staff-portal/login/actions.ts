'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isValidStaffLoginId, staffAuthEmail } from '@/lib/staff-portal/credentials';

export type StaffLoginState = { error: string };

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export async function staffLogin(
  _prevState: StaffLoginState,
  formData: FormData,
): Promise<StaffLoginState> {
  const loginId = formText(formData, 'loginId').trim();
  const password = formText(formData, 'password');
  if (!loginId || !password) {
    return { error: 'Enter your login ID and password.' };
  }
  if (!isValidStaffLoginId(loginId)) {
    return { error: 'Enter the Login ID exactly as provided by your admin.' };
  }
  const supabase = await createClient();
  const email = staffAuthEmail(loginId);
  const { data: auth, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !auth.user) {
    return { error: 'Invalid login ID or password, or your access has been disabled.' };
  }
  // The signed-in staff member may read their own account through RLS.
  // Login must not depend on a deployment-only service-role secret.
  const { data: account } = await supabase
    .from('staff_members')
    .select('portal_active,is_active')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (!account?.portal_active || !account.is_active) {
    await supabase.auth.signOut();
    return { error: 'Your Login ID and password are correct, but portal access is disabled. Ask your admin to enable it.' };
  }
  redirect('/staff-portal');
}
