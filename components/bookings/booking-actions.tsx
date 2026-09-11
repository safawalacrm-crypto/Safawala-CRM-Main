'use client';

import { useState, type SyntheticEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

type Booking = {
  id: number;
  booking_type: string;
  status: string;
  total: number;
  paid_amount: number;
  security_deposit: number;
};
export function BookingActions({ booking }: { booking: Booking }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function invoke(name: string, args: Record<string, unknown>) {
    setBusy(true);
    setError('');
    const result = await createClient().rpc(name, args);
    if (result.error) setError(result.error.message);
    else router.refresh();
    setBusy(false);
  }
  async function payment(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const requested = Number(form.get('amount'));
    const remaining = Math.max(booking.total - booking.paid_amount, 0);
    if (!Number.isFinite(requested) || requested <= 0) {
      setError('Enter a valid payment amount.');
      return;
    }
    await invoke('record_booking_payment', {
      booking_key: booking.id,
      payment_amount:
        requested >= remaining || requested === Math.round(remaining)
          ? remaining
          : requested,
      method: form.get('method'),
      reference: form.get('reference') || null,
    });
  }
  async function returned(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await invoke('process_rental_return', {
      booking_key: booking.id,
      damage: Number(form.get('damage')),
      late: Number(form.get('late')),
      condition_text: form.get('condition') || null,
    });
  }
  if (
    booking.paid_amount >= booking.total &&
    !(booking.booking_type === 'rental' && booking.status === 'active')
  )
    return null;
  return (
    <div className="space-y-3 print:hidden">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4">
        {booking.paid_amount < booking.total && (
          <Card className="border-border py-0 shadow-level-1 ring-0">
            <CardContent className="p-4">
              <form
                onSubmit={payment}
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]"
              >
                <label className="text-xs text-muted-foreground">
                  Payment amount
                  <input
                    name="amount"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue={Math.round(
                      booking.total - booking.paid_amount,
                    )}
                    required
                    className="mt-1 h-9 w-full rounded-lg border px-3 text-sm text-foreground"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Method
                  <select
                    name="method"
                    className="mt-1 h-9 w-full rounded-lg border px-3 text-sm text-foreground"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  Reference (optional)
                  <input
                    name="reference"
                    placeholder="UPI / bank / receipt reference"
                    className="mt-1 h-9 w-full rounded-lg border px-3 text-sm text-foreground"
                  />
                </label>
                <Button type="submit" className="self-end" disabled={busy}>
                  <Banknote />
                  Record
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
        {booking.booking_type === 'rental' && booking.status === 'active' && (
          <Card className="border-[#dfc9a6] py-0 shadow-level-1 ring-0 lg:col-span-3">
            <CardContent className="p-4">
              <form
                onSubmit={returned}
                className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto]"
              >
                <label className="text-xs text-muted-foreground">
                  Damage charge
                  <input
                    name="damage"
                    type="number"
                    min="0"
                    defaultValue="0"
                    step="1"
                    className="mt-1 h-9 w-full rounded-lg border px-3 text-sm text-foreground"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Late charge
                  <input
                    name="late"
                    type="number"
                    min="0"
                    defaultValue="0"
                    step="1"
                    className="mt-1 h-9 w-full rounded-lg border px-3 text-sm text-foreground"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Condition notes
                  <input
                    name="condition"
                    className="mt-1 h-9 w-full rounded-lg border px-3 text-sm text-foreground"
                  />
                </label>
                <Button type="submit" className="self-end" disabled={busy}>
                  <RotateCcw />
                  Process return
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
