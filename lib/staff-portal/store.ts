import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfig } from '@/lib/supabase/config';
import type { StaffDepartment } from './constants';
import type { StaffPortalAccount } from './types';
import type { AccessModule } from './access-modules';
import type { StaffAccessType } from './types';
import { normalizeStaffLoginId, staffAuthEmail } from './credentials';

type StaffRow = {
  id: number;
  user_id: string | null;
  name: string;
  login_id: string | null;
  portal_active: boolean;
  access_type: StaffAccessType;
  created_at: string;
  updated_at: string;
  staff_departments: { department: StaffDepartment }[] | null;
  staff_access_modules: { module: AccessModule; enabled: boolean }[] | null;
};

function toAccount(row: StaffRow): StaffPortalAccount {
  return {
    id: row.user_id ?? String(row.id),
    staffMemberId: row.id,
    name: row.name,
    loginId: row.login_id ?? '',
    active: row.portal_active,
    accessType: row.access_type ?? 'staff',
    modules: (row.staff_access_modules ?? []).filter((item) => item.enabled).map((item) => item.module),
    departments: (row.staff_departments ?? []).map(({ department }) => ({
      department,
      active: true,
      role: 'staff' as const,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAccounts(ownerId: string): Promise<StaffPortalAccount[]> {
  // Listing is an owner-scoped read and must not require the service-role secret.
  // This keeps the page available in hosted environments while RLS enforces ownership.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('staff_members')
    .select('id,user_id,name,login_id,portal_active,access_type,created_at,updated_at,staff_departments(department),staff_access_modules(module,enabled)')
    .eq('owner_id', ownerId)
    .not('user_id', 'is', null)
    .order('name');
  if (error) throw new Error(error.message);
  return ((data ?? []) as StaffRow[]).map(toAccount);
}

export async function createAccount(ownerId: string, input: {
  staffMemberId: number | null;
  name: string;
  loginId: string;
  password: string;
  departments: StaffDepartment[];
  accessType?: StaffAccessType;
  modules?: AccessModule[];
}): Promise<{ account?: StaffPortalAccount; error?: string }> {
  const admin = createAdminClient();
  const loginId = normalizeStaffLoginId(input.loginId);
  const email = staffAuthEmail(loginId);
  const accessType = input.accessType ?? 'staff';
  if (input.name.trim().length < 2) return { error: 'Enter the staff member’s name.' };
  if (input.password.length < 6) return { error: 'Password must be at least 6 characters.' };
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { display_name: input.name.trim(), login_id: loginId },
  });
  if (authError || !created.user) return { error: authError?.message ?? 'Could not create staff login.' };

  const userId = created.user.id;
  const { error: profileError } = await admin.from('profiles').upsert({ id: userId, full_name: input.name.trim(), role: 'staff' });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return { error: profileError.message };
  }

  let staffId = input.staffMemberId;
  if (staffId) {
    const { data, error } = await admin.from('staff_members').update({
      user_id: userId, login_id: loginId, portal_active: true, is_active: true,
      name: input.name.trim(), access_type: accessType,
    }).eq('id', staffId).eq('owner_id', ownerId).select('id').single();
    if (error || !data) {
      await admin.auth.admin.deleteUser(userId);
      return { error: error?.message ?? 'Could not link the staff directory record.' };
    }
  } else {
    const { data, error } = await admin.from('staff_members').insert({
      owner_id: ownerId, user_id: userId, login_id: loginId, portal_active: true,
      name: input.name.trim(), is_active: true, access_type: accessType,
    }).select('id').single();
    if (error || !data) {
      await admin.auth.admin.deleteUser(userId);
      return { error: error?.message ?? 'Could not link staff directory record.' };
    }
    staffId = Number(data.id);
  }

  const departments: StaffDepartment[] = accessType === 'staff' ? ['booking'] : input.departments;
  if (accessType === 'staff') {
    const { error } = await admin.from('staff_departments').delete().eq('staff_id', staffId);
    if (error) return { error: error.message };
  }
  if (departments.length) {
    const { error } = await admin.from('staff_departments').upsert(
      departments.map((department) => ({ staff_id: staffId, department, granted_by: ownerId })),
      { onConflict: 'staff_id,department' },
    );
    if (error) return { error: error.message };
  }

  const modules = accessType === 'staff' ? ['quotations', 'create_booking'] : (input.modules ?? []);
  if (modules.length) {
    const { error } = await admin.from('staff_access_modules').upsert(
      modules.map((module) => ({ owner_id: ownerId, staff_id: staffId, module, enabled: true })),
      { onConflict: 'staff_id,module' },
    );
    if (error) return { error: error.message };
  }

  // Verify the exact credentials before reporting success. A separate,
  // non-persistent client keeps the service-role client untouched.
  const verifier = createSupabaseClient(supabaseConfig.url, supabaseConfig.key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: verificationError } = await verifier.auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (verificationError) {
    await admin.from('staff_access_modules').delete().eq('staff_id', staffId);
    await admin.from('staff_departments').delete().eq('staff_id', staffId);
    if (input.staffMemberId) {
      await admin.from('staff_members').update({
        user_id: null,
        login_id: null,
        portal_active: false,
      }).eq('id', staffId).eq('owner_id', ownerId);
    } else {
      await admin.from('staff_members').delete().eq('id', staffId).eq('owner_id', ownerId);
    }
    await admin.auth.admin.deleteUser(userId);
    return { error: `The login could not be verified: ${verificationError.message}` };
  }

  const { data: accountRow, error: accountError } = await admin
    .from('staff_members')
    .select('id,user_id,name,login_id,portal_active,access_type,created_at,updated_at,staff_departments(department),staff_access_modules(module,enabled)')
    .eq('id', staffId)
    .eq('owner_id', ownerId)
    .single();
  if (accountError || !accountRow) {
    return { error: accountError?.message ?? 'The staff login was created but could not be loaded.' };
  }
  return { account: toAccount(accountRow as StaffRow) };
}

async function getOwnedStaff(ownerId: string, userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from('staff_members').select('id').eq('owner_id', ownerId).eq('user_id', userId).single();
  if (error || !data) throw new Error('Staff portal account was not found.');
  return { admin, staffId: Number(data.id) };
}

export async function setAccountActive(ownerId: string, userId: string, active: boolean) {
  const { admin } = await getOwnedStaff(ownerId, userId);
  const { error } = await admin.from('staff_members').update(
    active ? { portal_active: true, is_active: true } : { portal_active: false },
  ).eq('owner_id', ownerId).eq('user_id', userId);
  if (error) throw new Error(error.message);
  const { error: authError } = await admin.auth.admin.updateUserById(userId, { ban_duration: active ? 'none' : '876000h' });
  if (authError) throw new Error(authError.message);
}

export async function setDepartmentGrant(ownerId: string, userId: string, department: StaffDepartment, active: boolean) {
  const { admin, staffId } = await getOwnedStaff(ownerId, userId);
  const { data: account, error: accountError } = await admin
    .from('staff_members')
    .select('access_type')
    .eq('id', staffId)
    .eq('owner_id', ownerId)
    .single();
  if (accountError) throw new Error(accountError.message);
  if (account.access_type === 'staff') {
    if (department !== 'booking' || !active) {
      throw new Error('Staff IDs are fixed to the Booking department for quote creation.');
    }
  }
  const query = active
    ? admin.from('staff_departments').upsert({ staff_id: staffId, department, granted_by: ownerId })
    : admin.from('staff_departments').delete().eq('staff_id', staffId).eq('department', department);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function resetAccountPassword(ownerId: string, userId: string, password: string) {
  const { admin } = await getOwnedStaff(ownerId, userId);
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(error.message);
}

export async function setAccountModule(ownerId: string, userId: string, module: AccessModule, enabled: boolean) {
  const { admin, staffId } = await getOwnedStaff(ownerId, userId);
  const { error } = await admin.from('staff_access_modules').upsert(
    { owner_id: ownerId, staff_id: staffId, module, enabled },
    { onConflict: 'staff_id,module' },
  );
  if (error) throw new Error(error.message);
}
