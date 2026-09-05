'use server';

import { revalidatePath } from 'next/cache';
import { requireStaffSession } from '@/lib/staff-portal/guard';
import { markAllReadForSession } from '@/lib/notifications/store';

export async function markAllNotificationsReadAction() {
  const session = await requireStaffSession();
  const activeDepartments = session.departments.filter((grant) => grant.active).map((grant) => grant.department);
  await markAllReadForSession(session.id, activeDepartments);
  revalidatePath('/staff-portal/notifications');
  revalidatePath('/staff-portal');
}
