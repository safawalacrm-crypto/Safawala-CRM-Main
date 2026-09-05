'use server';

import { revalidatePath } from 'next/cache';
import type { AccessModule } from '@/lib/staff-portal/access-modules';
import type { StaffDepartment } from '@/lib/staff-portal/constants';
import type { StaffAccessType } from '@/lib/staff-portal/types';
import {
  createAccount,
  resetAccountPassword,
  setAccountActive,
  setAccountModule,
  setDepartmentGrant,
} from '@/lib/staff-portal/store';
import { createClient } from '@/lib/supabase/server';

async function requireAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Admin session required.');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
  if (profile?.role !== 'admin') throw new Error('Only an administrator can manage staff access.');
  return data.user.id;
}

export async function createStaffLoginAction(input: {
  staffMemberId: number;
  name: string;
  loginId: string;
  password: string;
  departments: StaffDepartment[];
  accessType: StaffAccessType;
  modules: AccessModule[];
}) {
  try {
    const result = await createAccount(await requireAdmin(), {
      staffMemberId: input.staffMemberId,
      name: input.name,
      loginId: input.loginId,
      password: input.password,
      departments: input.departments,
      accessType: input.accessType,
      modules: input.accessType === 'staff' ? ['quotations', 'create_booking'] : input.modules,
    });
    revalidatePath('/staff');
    return result;
  } catch (error) {
    return {
      error: error instanceof Error && error.message.includes('environment variables')
        ? 'Staff credential service is not configured on this deployment.'
        : error instanceof Error ? error.message : 'Could not create this login.',
    };
  }
}

export async function setStaffLoginActiveAction(userId: string, active: boolean) {
  await setAccountActive(await requireAdmin(), userId, active);
  revalidatePath('/staff');
}

export async function setStaffDepartmentAction(userId: string, department: StaffDepartment, active: boolean) {
  await setDepartmentGrant(await requireAdmin(), userId, department, active);
  revalidatePath('/staff');
}

export async function setStaffModuleAction(userId: string, module: AccessModule, enabled: boolean) {
  await setAccountModule(await requireAdmin(), userId, module, enabled);
  revalidatePath('/staff');
}

export async function resetStaffLoginPasswordAction(userId: string, password: string) {
  await resetAccountPassword(await requireAdmin(), userId, password);
  revalidatePath('/staff');
}
