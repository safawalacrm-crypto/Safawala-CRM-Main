'use client';

import { useActionState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import {
  expressInterestAction,
  withdrawInterestAction,
  type StylistInterestActionState,
} from '@/app/staff-portal/stylist/actions';
import { Button } from '@/components/ui/button';

const INITIAL_STATE: StylistInterestActionState = { error: '', saved: false };

export function StylistInterestButton({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState(
    expressInterestAction,
    INITIAL_STATE,
  );
  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="jobId" value={jobId} />
        <Button type="submit" size="sm" disabled={pending || state.saved}>
          {pending ? (
            <LoaderCircle className="animate-spin" />
          ) : state.saved ? (
            <Check />
          ) : null}
          {pending ? 'Saving…' : state.saved ? 'Interested' : "I'm Interested"}
        </Button>
      </form>
      {state.error ? (
        <p className="max-w-64 text-xs text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

export function WithdrawInterestButton({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState(
    withdrawInterestAction,
    INITIAL_STATE,
  );
  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="jobId" value={jobId} />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={pending || state.saved}
        >
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          {pending
            ? 'Withdrawing…'
            : state.saved
              ? 'Withdrawn'
              : 'Withdraw interest'}
        </Button>
      </form>
      {state.error ? (
        <p className="max-w-64 text-xs text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
