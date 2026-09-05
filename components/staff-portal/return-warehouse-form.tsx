'use client';

import { useActionState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  submitReturnWarehouseAction,
  type ReturnWarehouseFormState,
} from '@/app/staff-portal/warehouse/actions';

const initialState: ReturnWarehouseFormState = { error: '' };
const inputClass =
  'h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20';

export function ReturnWarehouseForm({
  jobId,
  items,
}: {
  jobId: string;
  items: { itemName: string; usableQuantity: number; damagedRepairQuantity: number; missingLostQuantity: number }[];
}) {
  const [state, formAction, pending] = useActionState(submitReturnWarehouseAction, initialState);

  if (items.length === 0) {
    return (
      <Card className="border-border shadow-level-1">
        <CardContent className="p-5 text-sm text-muted-foreground">
          No Return QC results were found for this job yet, so there is nothing to sort here.
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="jobId" value={jobId} />
      <Card className="border-border shadow-level-1">
        <CardHeader>
          <CardTitle>Return Warehouse — inventory disposition</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {state?.error ? (
            <Alert variant="destructive" className="px-3 py-3" aria-live="polite">
              <AlertCircle aria-hidden="true" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Pre-filled from Return QC — confirm before completing. Only the usable quantity is meant to go back into
            usable stock, not the full quantity originally sent.
          </p>

          {items.map((item, index) => (
            <div key={`${item.itemName}-${index}`} className="rounded-xl border border-border p-4">
              <input type="hidden" name="itemName" value={item.itemName} />
              <p className="mb-3 font-medium">{item.itemName}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm">
                  <span className="mb-1.5 block text-muted-foreground">Usable</span>
                  <input
                    name={`usableQuantity-${index}`}
                    type="number"
                    min={0}
                    required
                    defaultValue={item.usableQuantity}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-muted-foreground">Damaged / repair</span>
                  <input
                    name={`damagedRepairQuantity-${index}`}
                    type="number"
                    min={0}
                    required
                    defaultValue={item.damagedRepairQuantity}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-muted-foreground">Missing / lost</span>
                  <input
                    name={`missingLostQuantity-${index}`}
                    type="number"
                    min={0}
                    required
                    defaultValue={item.missingLostQuantity}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm sm:col-span-3">
                  <span className="mb-1.5 block text-muted-foreground">Remarks (optional)</span>
                  <textarea
                    name={`remarks-${index}`}
                    rows={2}
                    placeholder="Any additional notes…"
                    className="w-full resize-y rounded-lg border border-input bg-white p-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </label>
              </div>
            </div>
          ))}

          <Button type="submit" disabled={pending} className="h-11 w-full sm:w-auto">
            {pending ? (
              <>
                <LoaderCircle aria-hidden="true" className="animate-spin" /> Submitting...
              </>
            ) : (
              'Complete Return Warehouse'
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
