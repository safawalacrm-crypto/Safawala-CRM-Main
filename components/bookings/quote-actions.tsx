'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleCheck, CircleX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import type { QuoteState } from '@/lib/bookings';

function StatusIcon({
  icon: Icon,
  tone,
}: {
  icon: typeof CircleCheck;
  tone: 'won' | 'lost';
}) {
  return (
    <span
      aria-hidden="true"
      className={
        tone === 'won'
          ? 'grid size-7 shrink-0 place-items-center rounded-full bg-emerald-600 text-white shadow-sm'
          : 'grid size-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground/40'
      }
    >
      <Icon className="size-4" />
    </span>
  );
}

export function QuoteActions({
  bookingId,
  state,
}: {
  bookingId: number;
  state: QuoteState;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState('');

  async function decide(
    nextStatus: 'confirmed' | 'cancelled',
    which: 'accept' | 'reject',
  ) {
    if (busy) return;
    setBusy(which);
    setError('');
    const { error: rpcError } = await createClient().rpc(
      'change_booking_status',
      { booking_key: bookingId, next_status: nextStatus },
    );
    setBusy(null);
    if (rpcError) setError(rpcError.message);
    else router.refresh();
  }

  if (state === 'converted') {
    return (
      <div className="flex items-center gap-1">
        <StatusIcon icon={CircleCheck} tone="won" />
        <StatusIcon icon={CircleX} tone="lost" />
      </div>
    );
  }

  if (state === 'rejected') {
    return (
      <div className="flex items-center gap-1">
        <StatusIcon icon={CircleCheck} tone="lost" />
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-full bg-destructive text-white shadow-sm"
        >
          <CircleX className="size-4" />
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="!rounded-full text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
          disabled={busy !== null}
          onClick={() => decide('confirmed', 'accept')}
          title="Accept quote"
          aria-label="Accept quote"
        >
          <CircleCheck />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="!rounded-full text-destructive hover:bg-red-50"
          disabled={busy !== null}
          onClick={() => decide('cancelled', 'reject')}
          title="Reject quote"
          aria-label="Reject quote"
        >
          <CircleX />
        </Button>
      </div>
      {error ? (
        <p className="max-w-40 text-right text-[10px] leading-tight text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
