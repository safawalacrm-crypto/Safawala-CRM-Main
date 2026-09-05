'use server';

import { revalidatePath } from 'next/cache';
import { requireDepartment } from '@/lib/staff-portal/guard';
import { submitCollectionCheck } from '@/lib/event-jobs/store';
import type { CollectionItemCheck } from '@/lib/event-jobs/types';

export type CollectionFormState = { error: string };

export async function submitCollectionCheckAction(
  _prevState: CollectionFormState,
  formData: FormData,
): Promise<CollectionFormState> {
  const session = await requireDepartment('collection');
  const jobId = String(formData.get('jobId') ?? '');
  const itemNamesRaw = formData.getAll('itemName');
  if (!jobId || itemNamesRaw.length === 0) {
    return { error: 'This job has no items to check in.' };
  }

  const items: CollectionItemCheck[] = itemNamesRaw.map((itemNameValue, index) => {
    const sentQuantity = Number(formData.get(`sentQuantity-${index}`) ?? 0);
    const returnedRaw = String(formData.get(`returnedQuantity-${index}`) ?? '').trim();
    return {
      itemName: String(itemNameValue),
      sentQuantity,
      returnedQuantity: returnedRaw === '' ? null : Number(returnedRaw),
      visibleDamage: formData.get(`visibleDamage-${index}`) === 'on',
      wrongProduct: formData.get(`wrongProduct-${index}`) === 'on',
      clientHoldingItem: formData.get(`clientHoldingItem-${index}`) === 'on',
      shortQuantity: formData.get(`shortQuantity-${index}`) === 'on',
      remarks: String(formData.get(`remarks-${index}`) ?? '').trim(),
      evidenceNote: String(formData.get(`evidenceNote-${index}`) ?? '').trim(),
    };
  });

  const result = await submitCollectionCheck(jobId, items, session.name);
  if (result.error) return { error: result.error };

  revalidatePath('/staff-portal/collection');
  revalidatePath(`/staff-portal/collection/${jobId}`);
  revalidatePath('/staff-portal/qc');
  revalidatePath('/event-jobs');
  revalidatePath(`/event-jobs/${jobId}`);
  return { error: '' };
}
