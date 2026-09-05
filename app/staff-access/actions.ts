'use server';

import { revalidatePath } from 'next/cache';
import type { AccessModule } from '@/lib/staff-portal/access-modules';
import type { StaffDepartment } from '@/lib/staff-portal/constants';
import type { StaffAccessType } from '@/lib/staff-portal/types';
import { createAccount, resetAccountPassword, setAccountActive, setAccountModule } from '@/lib/staff-portal/store';
import { createClient } from '@/lib/supabase/server';

async function requireAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Admin session required.');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
  if (profile?.role !== 'admin') throw new Error('Only an administrator can manage staff access.');
  return data.user.id;
}

export async function createStaffAccessAction(input: {
  staffMemberId: number | null;
  name: string;
  loginId: string;
  password: string;
  department: StaffDepartment;
  accessType: StaffAccessType;
  modules: AccessModule[];
}) {
  try {
    const result = await createAccount(await requireAdmin(), {
      ...input,
      departments: [input.department],
      modules: input.accessType === 'staff' ? ['quotations', 'create_booking'] : input.modules,
    });
    revalidatePath('/staff-access');
    return result;
  } catch (error) {
    return {
      error: error instanceof Error && error.message.includes('environment variables')
        ? 'Staff credential service is not configured on this deployment.'
        : error instanceof Error ? error.message : 'Could not create this ID.',
    };
  }
}

export async function setStaffAccessActiveAction(userId: string, active: boolean) {
  await setAccountActive(await requireAdmin(), userId, active);
  revalidatePath('/staff-access');
}

export async function setStaffAccessModuleAction(userId: string, module: AccessModule, enabled: boolean) {
  await setAccountModule(await requireAdmin(), userId, module, enabled);
  revalidatePath('/staff-access');
}

export async function resetStaffAccessPasswordAction(userId: string, password: string) {
  await resetAccountPassword(await requireAdmin(), userId, password);
  revalidatePath('/staff-access');
}
