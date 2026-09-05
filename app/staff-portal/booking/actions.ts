'use server';

import { revalidatePath } from 'next/cache';
import { requireDepartment } from '@/lib/staff-portal/guard';
import { closeEventJob } from '@/lib/event-jobs/store';

export type CloseEventFormState = { error: string };

export async function closeEventJobAction(
  _prevState: CloseEventFormState,
  formData: FormData,
): Promise<CloseEventFormState> {
  const session = await requireDepartment('booking');
  const jobId = String(formData.get('jobId') ?? '');
  if (!jobId) return { error: 'Missing job.' };

  const result = await closeEventJob(
    jobId,
    {
      paymentComplete: formData.get('paymentComplete') === 'on',
      depositSettled: formData.get('depositSettled') === 'on',
      damageLossAcknowledged: formData.get('damageLossAcknowledged') === 'on',
      refundAmount: Number(formData.get('refundAmount') ?? 0) || 0,
      additionalPaymentAmount: Number(formData.get('additionalPaymentAmount') ?? 0) || 0,
      notes: String(formData.get('notes') ?? '').trim(),
    },
    session.name,
  );
  if (result.error) return { error: result.error };

  revalidatePath('/staff-portal/booking');
  revalidatePath(`/staff-portal/booking/${jobId}`);
  revalidatePath('/event-jobs');
  revalidatePath(`/event-jobs/${jobId}`);
  revalidatePath('/performance');
  return { error: '' };
}
