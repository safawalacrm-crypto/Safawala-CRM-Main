'use server';

import { revalidatePath } from 'next/cache';
import { requireStylistSession } from '@/lib/staff-portal/guard';
import { recordStylistExecution, type ExecutionAction } from '@/lib/event-jobs/store';

const ACTIONS: ExecutionAction[] = ['reached_venue', 'start_work', 'complete_work'];

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export async function recordExecutionAction(formData: FormData) {
  const session = await requireStylistSession();
  const jobId = formText(formData, 'jobId');
  const actionRaw = formText(formData, 'action');
  const remarks = formText(formData, 'remarks').trim();
  if (!jobId || !ACTIONS.includes(actionRaw as ExecutionAction)) return;
  await recordStylistExecution(jobId, session.id, session.name, actionRaw as ExecutionAction, remarks);
  revalidatePath('/staff-portal/stylist/assigned');
  revalidatePath(`/event-jobs/${jobId}`);
}
