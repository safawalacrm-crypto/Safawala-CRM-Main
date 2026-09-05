'use server';

import { revalidatePath } from 'next/cache';
import { requireDepartment } from '@/lib/staff-portal/guard';
import { submitQualityCheck, submitPackingChecklist, submitReturnQualityCheck } from '@/lib/event-jobs/store';
import type { PackingChecklist, QcIssueType, QcItemCheck, ReturnQcItemCheck } from '@/lib/event-jobs/types';

export type QcFormState = { error: string; success?: boolean };

const QC_ISSUE_TYPES: QcIssueType[] = ['none', 'stain', 'tear', 'missing_part', 'other'];

function revalidateJob(jobId: string) {
  revalidatePath('/staff-portal/qc');
  revalidatePath(`/staff-portal/qc/${jobId}`);
  revalidatePath('/staff-portal/warehouse');
  revalidatePath('/event-jobs');
  revalidatePath(`/event-jobs/${jobId}`);
}

export async function submitQualityCheckAction(
  _prevState: QcFormState,
  formData: FormData,
): Promise<QcFormState> {
  const session = await requireDepartment('qc');
  const jobId = String(formData.get('jobId') ?? '');
  const itemNamesRaw = formData.getAll('itemName');
  if (!jobId || itemNamesRaw.length === 0) {
    return { error: 'This job has no items to check.' };
  }

  const items: QcItemCheck[] = itemNamesRaw.map((itemNameValue, index) => {
    const checkedRaw = String(formData.get(`checkedQuantity-${index}`) ?? '').trim();
    const goodRaw = String(formData.get(`goodQuantity-${index}`) ?? '').trim();
    const issueTypeRaw = String(formData.get(`issueType-${index}`) ?? 'none');
    return {
      itemName: String(itemNameValue),
      checkedQuantity: checkedRaw === '' ? null : Number(checkedRaw),
      goodQuantity: goodRaw === '' ? null : Number(goodRaw),
      issueType: QC_ISSUE_TYPES.includes(issueTypeRaw as QcIssueType) ? (issueTypeRaw as QcIssueType) : 'none',
      remarks: String(formData.get(`remarks-${index}`) ?? '').trim(),
      evidenceNote: String(formData.get(`evidenceNote-${index}`) ?? '').trim(),
    };
  });

  const result = await submitQualityCheck(jobId, items, session.name);
  if (result.error) return { error: result.error };

  revalidateJob(jobId);
  return { error: '', success: true };
}

export async function submitPackingChecklistAction(
  _prevState: QcFormState,
  formData: FormData,
): Promise<QcFormState> {
  const session = await requireDepartment('qc');
  const jobId = String(formData.get('jobId') ?? '');
  if (!jobId) return { error: 'Missing job.' };

  const checklist: Omit<PackingChecklist, 'completedAt' | 'completedBy'> = {
    correctQuantityPacked: formData.get('correctQuantityPacked') === 'on',
    correctBoxes: formData.get('correctBoxes') === 'on',
    properLabels: formData.get('properLabels') === 'on',
    accessoriesIncluded: formData.get('accessoriesIncluded') === 'on',
    itemsSecured: formData.get('itemsSecured') === 'on',
    correctEventIdentification: formData.get('correctEventIdentification') === 'on',
    remarks: String(formData.get('remarks') ?? '').trim(),
  };

  const result = await submitPackingChecklist(jobId, checklist, session.name);
  if (result.error) return { error: result.error };

  revalidateJob(jobId);
  return { error: '', success: true };
}

export async function submitReturnQualityCheckAction(
  _prevState: QcFormState,
  formData: FormData,
): Promise<QcFormState> {
  const session = await requireDepartment('qc');
  const jobId = String(formData.get('jobId') ?? '');
  const itemNamesRaw = formData.getAll('itemName');
  if (!jobId || itemNamesRaw.length === 0) {
    return { error: 'This job has no returned items to check.' };
  }

  const items: ReturnQcItemCheck[] = itemNamesRaw.map((itemNameValue, index) => {
    const returnedQuantity = Number(formData.get(`returnedQuantity-${index}`) ?? 0);
    const goodRaw = String(formData.get(`goodQuantity-${index}`) ?? '').trim();
    const damagedRaw = String(formData.get(`damagedQuantity-${index}`) ?? '').trim();
    return {
      itemName: String(itemNameValue),
      returnedQuantity,
      goodQuantity: goodRaw === '' ? null : Number(goodRaw),
      damagedQuantity: damagedRaw === '' ? null : Number(damagedRaw),
      repairRequired: formData.get(`repairRequired-${index}`) === 'on',
      unusable: formData.get(`unusable-${index}`) === 'on',
      remarks: String(formData.get(`remarks-${index}`) ?? '').trim(),
      evidenceNote: String(formData.get(`evidenceNote-${index}`) ?? '').trim(),
    };
  });

  const result = await submitReturnQualityCheck(jobId, items, session.name);
  if (result.error) return { error: result.error };

  revalidateJob(jobId);
  return { error: '', success: true };
}
