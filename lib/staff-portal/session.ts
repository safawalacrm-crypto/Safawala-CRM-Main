import { cache } from 'react';
import type { StaffDepartment } from './constants';
import type { StaffSession } from './types';
import { DEPARTMENT_STAFF_MODULES } from './modules';
import type { AccessModule } from './access-modules';
import { createClient } from '@/lib/supabase/server';

export const getStaffSession = cache(async (): Promise<StaffSession | null> => {
  const supabase = await createClient();
  const { data: auth, error: claimsError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (claimsError || !userId) return null;
  const [{ data: profile }, { data: account }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', userId).maybeSingle(),
    supabase
      .from('staff_members')
      .select('id,name,login_id,portal_active,is_active,access_type,staff_type,staff_departments(department),staff_access_modules(module,enabled)')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);
  if (profile?.role !== 'staff') return null;
  if (!account?.portal_active || !account.is_active) return null;
  const departments = (account.staff_departments ?? []).map(({ department }) => department as StaffDepartment);
  const permissions = [...new Set(departments.flatMap((department) => DEPARTMENT_STAFF_MODULES[department]))];
  const accessType = account.access_type === 'main' ? 'main' : 'staff';
  const staffType = account.staff_type === 'stylist' ? 'stylist' : 'regular';
  const configuredModules = (account.staff_access_modules ?? [])
    .filter((item) => item.enabled)
    .map((item) => item.module as AccessModule);
  const accessModules: AccessModule[] = staffType === 'stylist'
    ? []
    : accessType === 'staff'
    ? departments.includes('booking') ? ['quotations', 'create_booking'] : []
    : [...new Set(configuredModules)];
  return {
    id: userId,
    staffMemberId: account.id,
    name: account.name,
    loginId: account.login_id ?? '',
    departments: departments.map((department) => ({
      department,
      active: true,
      role: 'staff' as const,
    })),
    permissions,
    accessType,
    staffType,
    accessModules,
    isMainId: accessType === 'main',
    managedDepartment: departments[0] ?? null,
    mainId: null,
  };
});

export function hasAccessModule(session: StaffSession, module: AccessModule) {
  return session.accessModules.includes(module);
}

export function hasActiveDepartment(session: StaffSession, department: StaffDepartment) {
  return session.departments.some((grant) => grant.department === department && grant.active);
}

export function hasModule(session: StaffSession, permission: StaffSession['permissions'][number]) {
  return session.permissions.includes(permission);
}

export async function clearStaffSessionCookie() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
