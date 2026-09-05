'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CircleCheck, CircleX } from 'lucide-react';
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
  convertedBookingId,
}: {
  bookingId: number;
  state: QuoteState;
  convertedBookingId?: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState('');

  async function decide(
    nextStatus: 'cancelled',
    which: 'reject',
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

  async function convert() {
    if (busy) return;
    setBusy('accept');
    setError('');
    const { data, error: rpcError } = await createClient().rpc(
      'convert_quote_to_booking',
      { quote_key: bookingId },
    );
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const convertedId = Number((data as { id?: number } | null)?.id);
    if (Number.isFinite(convertedId)) router.push(`/bookings/${convertedId}`);
    else router.refresh();
  }

  if (state === 'converted') {
    return (
      <div className="flex items-center gap-1">
        <StatusIcon icon={CircleCheck} tone="won" />
        {convertedBookingId ? (
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/bookings/${convertedBookingId}`} />}
          >
            Open booking
            <ArrowRight />
          </Button>
        ) : null}
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
          size="sm"
          disabled={busy !== null}
          onClick={convert}
          title="Create a booking from this quote"
        >
          <CircleCheck />
          {busy === 'accept' ? 'Converting…' : 'Convert to booking'}
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
