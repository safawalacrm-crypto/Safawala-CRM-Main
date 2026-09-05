'use client';

import { useActionState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { submitPackingChecklistAction, type QcFormState } from '@/app/staff-portal/qc/actions';

const initialState: QcFormState = { error: '' };

const CHECKS: { name: string; label: string }[] = [
  { name: 'correctQuantityPacked', label: 'Correct quantity packed' },
  { name: 'correctBoxes', label: 'Correct boxes used' },
  { name: 'properLabels', label: 'Proper labels attached' },
  { name: 'accessoriesIncluded', label: 'Accessories included' },
  { name: 'itemsSecured', label: 'Items secured' },
  { name: 'correctEventIdentification', label: 'Correct event identification' },
];

export function PackingChecklistForm({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState(submitPackingChecklistAction, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="jobId" value={jobId} />
      <Card className="border-border shadow-level-1">
        <CardHeader>
          <CardTitle>Packing check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state?.error ? (
            <Alert variant="destructive" className="px-3 py-3" aria-live="polite">
              <AlertCircle aria-hidden="true" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            {CHECKS.map((check) => (
              <label
                key={check.name}
                className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"
              >
                <input type="checkbox" name={check.name} className="size-4 rounded border-input accent-primary" />
                {check.label}
              </label>
            ))}
          </div>

          <label className="block text-sm">
            <span className="mb-1.5 block text-muted-foreground">Remarks (optional)</span>
            <textarea
              name="remarks"
              rows={2}
              placeholder="Anything the Event team should know before pickup…"
              className="w-full resize-y rounded-lg border border-input bg-white p-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </label>

          <p className="text-xs text-muted-foreground">
            All six checks must be confirmed before packing can be marked complete.
          </p>

          <Button type="submit" disabled={pending} className="h-11 w-full sm:w-auto">
            {pending ? (
              <>
                <LoaderCircle aria-hidden="true" className="animate-spin" /> Submitting...
              </>
            ) : (
              'Complete packing'
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
