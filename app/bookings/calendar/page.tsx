import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { statusTone } from '@/lib/bookings';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
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
    .select('id,booking_number,event_name,event_date,booking_type,status')
    .or(
      'is_quote.eq.false,and(is_quote.eq.true,status.not.in.(draft,cancelled))',
    )
    .gte('event_date', start)
    .lte('event_date', end)
    .order('event_date');
  const cells = Array.from(
    { length: first.getDay() + last.getDate() },
    (_, i) => (i < first.getDay() ? null : i - first.getDay() + 1),
  );
  const move = (amount: number) => {
    const d = new Date(year, month + amount, 1);
    return `/bookings/calendar?month=${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };
  return (
    <DashboardShell email={auth.user.email ?? 'Safawala user'}>
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
          <Card className="gap-0 overflow-x-auto border-border py-0 shadow-level-1 ring-0">
            <div className="grid min-w-[840px] grid-cols-7 border-b bg-[#fcfaf7]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="px-3 py-3 text-xs font-semibold text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid min-w-[840px] grid-cols-7">
              {cells.map((day, index) => (
                <div key={index} className="min-h-32 border-b border-r p-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {day}
                  </p>
                  {day &&
                    bookings
                      ?.filter((b) => Number(b.event_date.slice(-2)) === day)
                      .map((b) => (
                        <Link
                          key={b.id}
                          href={`/bookings/${b.id}`}
                          className="mt-2 block rounded-lg border border-[#e4d2b6] bg-accent p-2 text-xs hover:border-primary"
                        >
                          <span className="block truncate font-semibold">
                            {b.event_name}
                          </span>
                          <span className="mt-1 flex items-center justify-between gap-1 text-muted-foreground">
                            <span>{b.booking_number}</span>
                            <Badge
                              variant="outline"
                              className={`px-1 py-0 text-[10px] ${statusTone(b.status)}`}
                            >
                              {b.booking_type}
                            </Badge>
                          </span>
                        </Link>
                      ))}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
