import type { StaffDepartment } from './constants';
import type { StaffSession } from './types';
import { DEPARTMENT_STAFF_MODULES } from './modules';
import type { AccessModule } from './access-modules';
import { createClient } from '@/lib/supabase/server';

export async function getStaffSession(): Promise<StaffSession | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).maybeSingle();
  if (profile?.role !== 'staff') return null;
  const { data: account } = await supabase
    .from('staff_members')
    .select('id,name,login_id,portal_active,is_active,access_type,staff_departments(department),staff_access_modules(module,enabled)')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (!account?.portal_active || !account.is_active) return null;
  const departments = (account.staff_departments ?? []).map(({ department }) => department as StaffDepartment);
  const permissions = [...new Set(departments.flatMap((department) => DEPARTMENT_STAFF_MODULES[department]))];
  const accessType = account.access_type === 'main' ? 'main' : 'staff';
  const configuredModules = (account.staff_access_modules ?? [])
    .filter((item) => item.enabled)
    .map((item) => item.module as AccessModule);
  const accessModules: AccessModule[] = accessType === 'staff'
    ? departments.includes('booking') ? ['quotations', 'create_booking'] : []
    : [...new Set(configuredModules)];
  return {
    id: auth.user.id,
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
    accessModules,
    isMainId: accessType === 'main',
    managedDepartment: departments[0] ?? null,
    mainId: null,
  };
}

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
