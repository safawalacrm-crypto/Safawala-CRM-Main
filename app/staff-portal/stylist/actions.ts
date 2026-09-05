'use server';

import { revalidatePath } from 'next/cache';
import { requireDepartment } from '@/lib/staff-portal/guard';
import { expressStylistInterest } from '@/lib/event-jobs/store';

export async function expressInterestAction(formData: FormData) {
  const session = await requireDepartment('stylist');
  const jobId = String(formData.get('jobId') ?? '');
  if (!jobId) return;
  await expressStylistInterest(jobId, session.id, session.name);
  revalidatePath('/staff-portal/stylist');
  revalidatePath('/stylist-approvals');
}
