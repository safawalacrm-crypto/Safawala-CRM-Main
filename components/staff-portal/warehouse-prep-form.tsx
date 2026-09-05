'use client';

import { useActionState, useState } from 'react';
import { AlertCircle, Check, LoaderCircle, PackageCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { submitWarehousePrepAction, type WarehousePrepFormState } from '@/app/staff-portal/warehouse/actions';
import {
  WarehousePickSlipButton,
  type WarehousePickSlipDetails,
} from '@/components/staff-portal/warehouse-pick-slip-button';

const initialState: WarehousePrepFormState = { error: '' };

export type WarehousePickItem = {
  itemName: string;
  quantity: number;
  barcode: string | null;
};

export function WarehousePrepForm({
  jobId,
  items,
  details,
}: {
  jobId: string;
  items: WarehousePickItem[];
  details: WarehousePickSlipDetails;
}) {
  const [state, formAction, pending] = useActionState(submitWarehousePrepAction, initialState);
  const [picked, setPicked] = useState(() => items.map(() => false));
  const pickedCount = picked.filter(Boolean).length;

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border bg-white p-5 text-sm text-muted-foreground shadow-level-1">
        This rental booking has no products to pick.
      </section>
    );
  }

  return (
    <form action={formAction} className="rounded-2xl border bg-white shadow-level-1">
      <input type="hidden" name="jobId" value={jobId} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
        <div>
          <div className="flex items-center gap-2">
            <PackageCheck className="size-5 text-[#9a6a2f]" />
            <h2 className="font-semibold">Products to pick</h2>
            <Badge variant="outline">{pickedCount}/{items.length}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Mark each product after it is picked from the warehouse.</p>
        </div>
        <WarehousePickSlipButton
          details={details}
          disabled={pickedCount === 0}
          items={items.map((item, index) => ({ ...item, picked: picked[index] }))}
        />
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {state?.error ? (
          <Alert variant="destructive" className="px-3 py-3" aria-live="polite">
            <AlertCircle aria-hidden="true" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <ul className="divide-y overflow-hidden rounded-xl border">
          {items.map((item, index) => (
            <li key={`${item.itemName}-${index}`}>
              <input type="hidden" name="itemName" value={item.itemName} />
              <input type="hidden" name={`requiredQuantity-${index}`} value={item.quantity} />
              <label className={`flex cursor-pointer items-center gap-3 px-3 py-3.5 transition sm:px-4 ${picked[index] ? 'bg-emerald-50/70' : 'hover:bg-[#fcfaf7]'}`}>
                <input
                  type="checkbox"
                  name={`picked-${index}`}
                  checked={picked[index]}
                  onChange={(event) => setPicked((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))}
                  className="peer sr-only"
                />
                <span className={`grid size-6 shrink-0 place-items-center rounded-md border transition ${picked[index] ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-[#cfc4b5] bg-white text-transparent'}`}>
                  <Check className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm font-medium">{item.itemName}</strong>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{item.barcode ? `Barcode: ${item.barcode}` : 'No barcode'} · Quantity {item.quantity}</span>
                </span>
                <span className={`text-xs font-medium ${picked[index] ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                  {picked[index] ? 'Picked' : 'Not picked'}
                </span>
              </label>
            </li>
          ))}
        </ul>

        <Button type="submit" disabled={pending || pickedCount === 0} className="h-11 w-full">
          {pending ? <><LoaderCircle className="animate-spin" /> Submitting…</> : <><Check /> Complete picking &amp; send to QC</>}
        </Button>
        {pickedCount === 0 ? <p className="text-center text-xs text-muted-foreground">Select at least one picked product to continue.</p> : null}
      </div>
    </form>
  );
}
