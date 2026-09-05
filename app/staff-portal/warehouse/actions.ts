'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireDepartment } from '@/lib/staff-portal/guard';
import { submitWarehousePreparation, submitReturnWarehouseCheck } from '@/lib/event-jobs/store';
import type { ReturnWarehouseItemResult, WarehouseItemPrep } from '@/lib/event-jobs/types';

export type WarehousePrepFormState = { error: string };

export async function submitWarehousePrepAction(
  _prevState: WarehousePrepFormState,
  formData: FormData,
): Promise<WarehousePrepFormState> {
  const session = await requireDepartment('warehouse');
  const jobId = String(formData.get('jobId') ?? '');
  const itemNamesRaw = formData.getAll('itemName');
  if (!jobId || itemNamesRaw.length === 0) {
    return { error: 'This job has no items to prepare.' };
  }

  const items: WarehouseItemPrep[] = itemNamesRaw.map((itemNameValue, index) => {
    const itemName = String(itemNameValue);
    const requiredQuantity = Number(formData.get(`requiredQuantity-${index}`) ?? 0);
    const preparedQuantityRaw = String(formData.get(`preparedQuantity-${index}`) ?? '').trim();
    return {
      itemName,
      requiredQuantity,
      preparedQuantity: preparedQuantityRaw === '' ? null : Number(preparedQuantityRaw),
      unavailable: formData.get(`unavailable-${index}`) === 'on',
      damaged: formData.get(`damaged-${index}`) === 'on',
      otherIssue: String(formData.get(`otherIssue-${index}`) ?? '').trim(),
      remarks: String(formData.get(`remarks-${index}`) ?? '').trim(),
    };
  });

  const result = await submitWarehousePreparation(jobId, items, session.name);
  if (result.error) return { error: result.error };

  revalidatePath('/staff-portal/warehouse');
  revalidatePath(`/staff-portal/warehouse/${jobId}`);
  revalidatePath('/event-jobs');
  revalidatePath(`/event-jobs/${jobId}`);
  redirect('/staff-portal/warehouse?completed=' + encodeURIComponent(jobId));
}

export type ReturnWarehouseFormState = { error: string; success?: boolean };

export async function submitReturnWarehouseAction(
  _prevState: ReturnWarehouseFormState,
  formData: FormData,
): Promise<ReturnWarehouseFormState> {
  const session = await requireDepartment('warehouse');
  const jobId = String(formData.get('jobId') ?? '');
  const itemNamesRaw = formData.getAll('itemName');
  if (!jobId || itemNamesRaw.length === 0) {
    return { error: 'This job has no returned items to sort.' };
  }

  const items: ReturnWarehouseItemResult[] = itemNamesRaw.map((itemNameValue, index) => ({
    itemName: String(itemNameValue),
    usableQuantity: Number(formData.get(`usableQuantity-${index}`) ?? 0),
    damagedRepairQuantity: Number(formData.get(`damagedRepairQuantity-${index}`) ?? 0),
    missingLostQuantity: Number(formData.get(`missingLostQuantity-${index}`) ?? 0),
    remarks: String(formData.get(`remarks-${index}`) ?? '').trim(),
  }));

  const result = await submitReturnWarehouseCheck(jobId, items, session.name);
  if (result.error) return { error: result.error };

  revalidatePath('/staff-portal/warehouse');
  revalidatePath(`/staff-portal/warehouse/${jobId}`);
  revalidatePath('/event-jobs');
  revalidatePath(`/event-jobs/${jobId}`);
  return { error: '', success: true };
}
