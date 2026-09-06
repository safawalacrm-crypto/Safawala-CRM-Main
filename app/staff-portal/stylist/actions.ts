'use server';

import { revalidatePath } from 'next/cache';
import { requireStylistSession } from '@/lib/staff-portal/guard';
import { expressStylistInterest } from '@/lib/event-jobs/store';

export type StylistInterestActionState = { error: string; saved: boolean };

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export async function expressInterestAction(
  _previous: StylistInterestActionState,
  formData: FormData,
): Promise<StylistInterestActionState> {
  try {
    const session = await requireStylistSession();
    const jobId = formText(formData, 'jobId');
    if (!jobId) return { error: 'Event was not found.', saved: false };
    const result = await expressStylistInterest(jobId, session.id, session.name);
    if (result.error) return { error: result.error, saved: false };
    revalidatePath('/staff-portal/stylist');
    revalidatePath(`/staff-portal/stylist/${jobId}`);
    revalidatePath('/stylist-approvals');
    return { error: '', saved: true };
  } catch (error) {
    console.error('[stylist-interest] Failed to save interest', error);
    return {
      error: 'Interest could not be saved. Please refresh and try again.',
      saved: false,
    };
  }
}
