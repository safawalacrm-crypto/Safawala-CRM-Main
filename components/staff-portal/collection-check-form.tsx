'use client';

import { useActionState } from 'react';
import { AlertCircle, ArrowRight, LoaderCircle, PackageCheck } from 'lucide-react';
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
          This rental job has no products recorded for collection.
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="jobId" value={jobId} />
      <Card className="border-border shadow-level-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageCheck className="size-5 text-[#9a6a2f]" /> Collect rental products
          </CardTitle>
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
                  <span className="mb-1.5 block text-muted-foreground">Collected quantity</span>
                  <input
                    name={`returnedQuantity-${index}`}
                    type="number"
                    min={0}
                    max={item.sentQuantity}
                    step={1}
                    required
                    defaultValue={item.sentQuantity}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-muted-foreground">Issue reference (optional)</span>
                  <input
                    name={`evidenceNote-${index}`}
                    placeholder="Photo name, link, or reference"
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
                  Kept by customer
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={`shortQuantity-${index}`}
                    className="size-4 rounded border-input accent-primary"
                  />
                  Missing quantity
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1.5 block text-muted-foreground">Issue remark</span>
                  <textarea
                    name={`remarks-${index}`}
                    rows={2}
                    placeholder="Required when anything is missing, damaged, held, or incorrect"
                    className="w-full resize-y rounded-lg border border-input bg-white p-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </label>
              </div>
            </div>
          ))}

          <section className="rounded-xl border border-[#e4d2b6] bg-[#fcfaf7] p-4">
            <div className="mb-4">
              <h3 className="font-semibold">Collection handover</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Record the pickup and showroom handover before sending the job to Return QC.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 block text-muted-foreground">Collected from</span>
                <input name="collectedFrom" required placeholder="Customer or venue representative" className={inputClass} />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-muted-foreground">Handed over to</span>
                <input name="handedOverTo" required placeholder="Showroom or authorized person" className={inputClass} />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1.5 block text-muted-foreground">Handover note (optional)</span>
                <textarea
                  name="handoverNotes"
                  rows={2}
                  placeholder="Box count, receiver note, or other useful detail"
                  className="w-full resize-y rounded-lg border border-input bg-white p-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>
              <label className="flex items-start gap-2 rounded-lg border bg-white p-3 text-sm sm:col-span-2">
                <input type="checkbox" name="handoverConfirmed" required className="mt-0.5 size-4 rounded border-input accent-primary" />
                <span>I confirm these products were handed over to the showroom or authorized receiver.</span>
              </label>
            </div>
          </section>

          <Button type="submit" disabled={pending} className="h-11 w-full">
            {pending ? (
              <>
                <LoaderCircle aria-hidden="true" className="animate-spin" /> Submitting...
              </>
            ) : (
              <><span>Complete collection &amp; hand over</span><ArrowRight /></>
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
