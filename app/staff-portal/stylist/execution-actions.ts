'use server';

import { revalidatePath } from 'next/cache';
import { requireDepartment } from '@/lib/staff-portal/guard';
import { recordStylistExecution, type ExecutionAction } from '@/lib/event-jobs/store';

const ACTIONS: ExecutionAction[] = ['reached_venue', 'start_work', 'complete_work'];

export async function recordExecutionAction(formData: FormData) {
  const session = await requireDepartment('stylist');
  const jobId = String(formData.get('jobId') ?? '');
  const actionRaw = String(formData.get('action') ?? '');
  const remarks = String(formData.get('remarks') ?? '').trim();
  if (!jobId || !ACTIONS.includes(actionRaw as ExecutionAction)) return;
  await recordStylistExecution(jobId, session.id, session.name, actionRaw as ExecutionAction, remarks);
  revalidatePath('/staff-portal/stylist/assigned');
  revalidatePath(`/event-jobs/${jobId}`);
}
