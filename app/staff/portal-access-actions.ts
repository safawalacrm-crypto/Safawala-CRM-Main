'use server';

import { revalidatePath } from 'next/cache';
import type { StaffDepartment } from '@/lib/staff-portal/constants';
import {
  createAccount,
  setDepartmentGrant,
  setAccountActive,
  resetAccountPassword,
} from '@/lib/staff-portal/store';
import { createClient } from '@/lib/supabase/server';

async function requireOwnerId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Admin session required.');
  return data.user.id;
}

export async function createPortalAccountAction(input: {
  staffMemberId: number | null;
  name: string;
  loginId: string;
  password: string;
  departments: StaffDepartment[];
}) {
  const ownerId = await requireOwnerId();
  const result = await createAccount(ownerId, {
    staffMemberId: input.staffMemberId,
    name: input.name,
    loginId: input.loginId,
    password: input.password,
    departments: input.departments,
  });
  revalidatePath('/staff');
  return result;
}

export async function setAccountActiveAction(id: string, active: boolean) {
  await setAccountActive(await requireOwnerId(), id, active);
  revalidatePath('/staff');
}

export async function setAccountDepartmentAction(
  id: string,
  department: StaffDepartment,
  active: boolean,
) {
  await setDepartmentGrant(await requireOwnerId(), id, department, active);
  revalidatePath('/staff');
}

export async function resetAccountPasswordAction(id: string, password: string) {
  await resetAccountPassword(await requireOwnerId(), id, password);
  revalidatePath('/staff');
}
