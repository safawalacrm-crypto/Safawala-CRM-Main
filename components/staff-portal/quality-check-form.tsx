'use client';

import { useActionState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { submitQualityCheckAction, type QcFormState } from '@/app/staff-portal/qc/actions';
import type { RequiredItem } from '@/lib/event-jobs/types';

const initialState: QcFormState = { error: '' };
const inputClass =
  'h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20';

const ISSUE_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'No issue' },
  { value: 'stain', label: 'Stain' },
  { value: 'tear', label: 'Tear' },
  { value: 'missing_part', label: 'Missing part' },
  { value: 'other', label: 'Other' },
];

export function QualityCheckForm({ jobId, items }: { jobId: string; items: RequiredItem[] }) {
  const [state, formAction, pending] = useActionState(submitQualityCheckAction, initialState);

  if (items.length === 0) {
    return (
      <Card className="border-border shadow-level-1">
        <CardContent className="p-5 text-sm text-muted-foreground">
          This job has no required items recorded, so there is nothing to quality-check here.
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="jobId" value={jobId} />
      <Card className="border-border shadow-level-1">
        <CardHeader>
          <CardTitle>Quality check</CardTitle>
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
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{item.itemName}</p>
                <p className="text-xs text-muted-foreground">Prepared: {item.quantity}</p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1.5 block text-muted-foreground">Checked quantity</span>
                  <input
                    name={`checkedQuantity-${index}`}
                    type="number"
                    min={0}
                    required
                    defaultValue={item.quantity}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-muted-foreground">Good quantity</span>
                  <input
                    name={`goodQuantity-${index}`}
                    type="number"
                    min={0}
                    required
                    defaultValue={item.quantity}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-muted-foreground">Issue type</span>
                  <select name={`issueType-${index}`} defaultValue="none" className={inputClass}>
                    {ISSUE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-muted-foreground">Evidence note (optional)</span>
                  <input
                    name={`evidenceNote-${index}`}
                    placeholder="Photo upload isn't available yet — add a note or link"
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1.5 block text-muted-foreground">Remarks (optional)</span>
                  <textarea
                    name={`remarks-${index}`}
                    rows={2}
                    placeholder="Describe the problem, if any…"
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
              'Complete quality check'
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
