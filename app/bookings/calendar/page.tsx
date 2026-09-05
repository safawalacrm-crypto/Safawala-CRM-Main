import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BookingPortalShell } from '@/components/bookings/booking-portal-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Button } from '@/components/ui/button';
import {
  CalendarDayGrid,
  type CalendarBooking,
} from '@/components/bookings/calendar-day-grid';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const BOOKING_FIELDS =
  'id,booking_number,booking_type,status,payment_status,is_quote,event_name,event_date,event_time,event_location,pickup_date,due_date,subtotal,discount,tax,security_deposit,total,paid_amount,balance_amount,notes,customers(name,phone),booking_items(item_name,quantity,unit_price,line_total,product_id,products(image_urls,barcode))';

export default async function BookingCalendar({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const requested = (await searchParams).month;
  const base =
    requested && /^\d{4}-\d{2}$/.test(requested)
      ? new Date(`${requested}-01T00:00:00`)
      : new Date();
  const year = base.getFullYear();
  const month = base.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${year}-${pad(month + 1)}-01`;
  const end = `${year}-${pad(month + 1)}-${pad(last.getDate())}`;

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(BOOKING_FIELDS)
    .or(
      'is_quote.eq.false,and(is_quote.eq.true,status.not.in.(draft,cancelled))',
    )
    .gte('event_date', start)
    .lte('event_date', end)
    .order('event_date');

  // A "sale modification" request carries its own dispatch date inside the
  // booking's notes (independent of the event date), so it's fetched
  // separately — same source the Modifications queue already uses.
  const { data: modificationBookings } = await supabase
    .from('bookings')
    .select(BOOKING_FIELDS)
    .eq('booking_type', 'sale')
    .or(
      'is_quote.eq.false,and(is_quote.eq.true,status.not.in.(draft,cancelled))',
    )
    .ilike('notes', '%SALE MODIFICATION REQUIRED%');

  const cells = Array.from(
    { length: first.getDay() + last.getDate() },
    (_, i) => (i < first.getDay() ? null : i - first.getDay() + 1),
  );
  const move = (amount: number) => {
    const d = new Date(year, month + amount, 1);
    return `/bookings/calendar?month=${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };

  return (
    <BookingPortalShell email={auth.user.email ?? 'Safawala user'}>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <DashboardHeader
          title="Event calendar"
          subtitle={base.toLocaleDateString('en-IN', {
            month: 'long',
            year: 'numeric',
          })}
          actions={
            <>
              <Button
                variant="outline"
                size="icon-sm"
                render={<Link href={move(-1)} aria-label="Previous month" />}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                render={<Link href={move(1)} aria-label="Next month" />}
              >
                <ChevronRight />
              </Button>
            </>
          }
        />
        {error ? (
          <p className="text-sm text-destructive">{error.message}</p>
        ) : (
          <CalendarDayGrid
            year={year}
            month={month}
            cells={cells}
            bookings={(bookings ?? []) as unknown as CalendarBooking[]}
            modificationBookings={
              (modificationBookings ?? []) as unknown as CalendarBooking[]
            }
          />
        )}
      </div>
    </BookingPortalShell>
  );
}
