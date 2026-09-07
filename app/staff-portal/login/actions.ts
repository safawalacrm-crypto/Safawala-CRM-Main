'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  isValidStaffLoginId,
  staffAuthEmail,
} from '@/lib/staff-portal/credentials';

export type StaffLoginState = { error: string };

function isSupabaseConnectionError(
  error: { message?: string } | null | undefined,
) {
  const message = error?.message?.toLowerCase() ?? '';
  return (
    message.includes('fetch failed') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network error') ||
    message.includes('timeout') ||
    message.includes('enotfound')
  );
}

async function withSupabaseTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs = 8000,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Supabase request timeout')),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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
  let auth;
  let error;
  try {
    ({ data: auth, error } = await withSupabaseTimeout(
      supabase.auth.signInWithPassword({ email, password }),
    ));
  } catch {
    return {
      error:
        'Unable to connect to Supabase right now. Check your internet connection and try again.',
    };
  }
  // Do not run the compatibility lookups when Supabase itself is unreachable.
  // Those extra requests made a network outage look like a very slow login.
  if (isSupabaseConnectionError(error)) {
    return {
      error:
        'Unable to connect to Supabase right now. Check your internet connection and try again.',
    };
  }
  // Passwords are sometimes copied from escaped text as `\@`. Accept only
  // that presentation typo as a compatibility retry; normal passwords remain
  // unchanged and are always attempted first.
  if ((error || !auth.user) && password.includes('\\@')) {
    ({ data: auth, error } = await supabase.auth.signInWithPassword({
      email,
      password: password.replaceAll('\\@', '@'),
    }));
    if (isSupabaseConnectionError(error)) {
      return {
        error:
          'Unable to connect to Supabase right now. Check your internet connection and try again.',
      };
    }
  }
  // Older staff records may have been created with a real Supabase email while
  // retaining the same Login ID. Resolve that account once as a compatibility
  // fallback so a correct Login ID/password is not rejected after migrations.
  if (
    (error || !auth.user) &&
    !isSupabaseConnectionError(error) &&
    !loginId.includes('@')
  ) {
    try {
      const admin = createAdminClient();
      const { data: staff } = await admin
        .from('staff_members')
        .select('user_id')
        .eq('login_id', loginId)
        .not('user_id', 'is', null)
        .maybeSingle();
      if (staff?.user_id) {
        const { data: authUser } = await admin.auth.admin.getUserById(
          staff.user_id,
        );
        const legacyEmail = authUser.user?.email;
        if (legacyEmail && legacyEmail !== email) {
          ({ data: auth, error } = await supabase.auth.signInWithPassword({
            email: legacyEmail,
            password,
          }));
        }
      }
    } catch {
      // Keep the normal invalid-credentials response if fallback lookup is unavailable.
    }
  }
  if (error || !auth.user) {
    if (isSupabaseConnectionError(error)) {
      return {
        error:
          'Unable to connect to Supabase right now. Check your internet connection and try again.',
      };
    }
    return {
      error: 'Invalid login ID or password, or your access has been disabled.',
    };
  }
  // The signed-in staff member may read their own account through RLS.
  // Login must not depend on a deployment-only service-role secret.
  const { data: account, error: accountError } = await supabase
    .from('staff_members')
    .select('portal_active,is_active')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (accountError && isSupabaseConnectionError(accountError)) {
    await supabase.auth.signOut();
    return {
      error:
        'Unable to verify portal access right now. Check your internet connection and try again.',
    };
  }
  if (!account?.portal_active || !account.is_active) {
    await supabase.auth.signOut();
    return {
      error:
        'Your Login ID and password are correct, but portal access is disabled. Ask your admin to enable it.',
    };
  }
  redirect('/staff-portal');
}
