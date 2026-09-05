'use client';

import { useActionState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  submitReturnQualityCheckAction,
  type QcFormState,
} from '@/app/staff-portal/qc/actions';

const initialState: QcFormState = { error: '' };
const inputClass =
  'h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20';

export function ReturnQualityCheckForm({
  jobId,
  items,
}: {
  jobId: string;
  items: { itemName: string; returnedQuantity: number }[];
}) {
  const [state, formAction, pending] = useActionState(submitReturnQualityCheckAction, initialState);

  if (items.length === 0) {
    return (
      <Card className="border-border shadow-level-1">
        <CardContent className="p-5 text-sm text-muted-foreground">
          No returned items were recorded at Collection, so there is nothing to check here.
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="jobId" value={jobId} />
      <Card className="border-border shadow-level-1">
        <CardHeader>
          <CardTitle>Return QC</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {state?.error ? (
            <Alert variant="destructive" className="px-3 py-3" aria-live="polite">
              <AlertCircle aria-hidden="true" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <p className="text-xs text-muted-foreground">
            This determines product condition only — it does not decide the client&apos;s final charges.
          </p>

          {items.map((item, index) => (
            <div key={`${item.itemName}-${index}`} className="rounded-xl border border-border p-4">
              <input type="hidden" name="itemName" value={item.itemName} />
              <input type="hidden" name={`returnedQuantity-${index}`} value={item.returnedQuantity} />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{item.itemName}</p>
                <p className="text-xs text-muted-foreground">Returned: {item.returnedQuantity}</p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1.5 block text-muted-foreground">Good quantity</span>
                  <input
                    name={`goodQuantity-${index}`}
                    type="number"
                    min={0}
                    required
                    defaultValue={item.returnedQuantity}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-muted-foreground">Damaged quantity</span>
                  <input
                    name={`damagedQuantity-${index}`}
                    type="number"
                    min={0}
                    required
                    defaultValue={0}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1.5 block text-muted-foreground">Evidence note (optional)</span>
                  <input
                    name={`evidenceNote-${index}`}
                    placeholder="Photo upload isn't available yet — add a note or link"
                    className={inputClass}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={`repairRequired-${index}`}
                    className="size-4 rounded border-input accent-primary"
                  />
                  Repair required
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={`unusable-${index}`}
                    className="size-4 rounded border-input accent-primary"
                  />
                  Unusable
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1.5 block text-muted-foreground">Remarks (optional)</span>
                  <textarea
                    name={`remarks-${index}`}
                    rows={2}
                    placeholder="Describe the damage or condition…"
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
              'Complete Return QC'
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
