'use client';

import { useActionState } from 'react';
import { AlertCircle, LoaderCircle, Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { closeEventJobAction, type CloseEventFormState } from '@/app/staff-portal/booking/actions';

const initialState: CloseEventFormState = { error: '' };
const inputClass =
  'h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20';

export function CloseEventForm({ jobId, canClose }: { jobId: string; canClose: boolean }) {
  const [state, formAction, pending] = useActionState(closeEventJobAction, initialState);

  if (!canClose) {
    return (
      <Card className="border-border shadow-level-1">
        <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" /> Close Event will unlock once every upstream stage is completed and all
          issues are resolved.
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="jobId" value={jobId} />
      <Card className="border-border shadow-level-1">
        <CardHeader>
          <CardTitle>Booking checks &amp; closure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state?.error ? (
            <Alert variant="destructive" className="px-3 py-3" aria-live="polite">
              <AlertCircle aria-hidden="true" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-1">
            <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
              <input type="checkbox" name="paymentComplete" className="size-4 rounded border-input accent-primary" />
              Payment is complete — nothing pending
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
              <input type="checkbox" name="depositSettled" className="size-4 rounded border-input accent-primary" />
              Security deposit has been settled
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
              <input
                type="checkbox"
                name="damageLossAcknowledged"
                className="size-4 rounded border-input accent-primary"
              />
              Damage/loss amount (if any) has been reviewed and acknowledged
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block text-muted-foreground">Additional payment collected (if any)</span>
              <input name="additionalPaymentAmount" type="number" min={0} step="0.01" defaultValue={0} className={inputClass} />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-muted-foreground">Refund issued (if any)</span>
              <input name="refundAmount" type="number" min={0} step="0.01" defaultValue={0} className={inputClass} />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1.5 block text-muted-foreground">Closure notes (optional)</span>
            <textarea
              name="notes"
              rows={3}
              placeholder="Anything worth recording about this closure…"
              className="w-full resize-y rounded-lg border border-input bg-white p-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </label>

          <Button type="submit" disabled={pending} variant="destructive" className="h-11 w-full sm:w-auto">
            {pending ? (
              <>
                <LoaderCircle aria-hidden="true" className="animate-spin" /> Closing...
              </>
            ) : (
              'Close Event'
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
