'use client';

import { useActionState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  submitCollectionCheckAction,
  type CollectionFormState,
} from '@/app/staff-portal/collection/actions';

const initialState: CollectionFormState = { error: '' };
const inputClass =
  'h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20';

export function CollectionCheckForm({
  jobId,
  items,
}: {
  jobId: string;
  items: { itemName: string; sentQuantity: number }[];
}) {
  const [state, formAction, pending] = useActionState(submitCollectionCheckAction, initialState);

  if (items.length === 0) {
    return (
      <Card className="border-border shadow-level-1">
        <CardContent className="p-5 text-sm text-muted-foreground">
          This job has no items recorded, so there is nothing to check in here.
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="jobId" value={jobId} />
      <Card className="border-border shadow-level-1">
        <CardHeader>
          <CardTitle>Check in returned items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {state?.error ? (
            <Alert variant="destructive" className="px-3 py-3" aria-live="polite">
              <AlertCircle aria-hidden="true" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          {items.map((item, index) => (
            <div key={`${item.itemName}-${index}`} className="rounded-xl border border-border p-4">
              <input type="hidden" name="itemName" value={item.itemName} />
              <input type="hidden" name={`sentQuantity-${index}`} value={item.sentQuantity} />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{item.itemName}</p>
                <p className="text-xs text-muted-foreground">Sent: {item.sentQuantity}</p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1.5 block text-muted-foreground">Returned quantity</span>
                  <input
                    name={`returnedQuantity-${index}`}
                    type="number"
                    min={0}
                    required
                    defaultValue={item.sentQuantity}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm">
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
                    name={`visibleDamage-${index}`}
                    className="size-4 rounded border-input accent-primary"
                  />
                  Visible damage
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={`wrongProduct-${index}`}
                    className="size-4 rounded border-input accent-primary"
                  />
                  Wrong product
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={`clientHoldingItem-${index}`}
                    className="size-4 rounded border-input accent-primary"
                  />
                  Client holding item
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={`shortQuantity-${index}`}
                    className="size-4 rounded border-input accent-primary"
                  />
                  Short quantity
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1.5 block text-muted-foreground">Remarks (optional)</span>
                  <textarea
                    name={`remarks-${index}`}
                    rows={2}
                    placeholder="Any additional notes for this item…"
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
              'Complete collection'
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
