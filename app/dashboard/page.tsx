import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Plus,
} from 'lucide-react';
import { BookingPortalShell } from '@/components/bookings/booking-portal-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { friendlyDate, money, statusLabel, statusTone } from '@/lib/bookings';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [
    { count: total },
    { count: upcoming },
    { count: completed },
    { data: revenue },
    { data: recent, error },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .or(
        'is_quote.eq.false,and(is_quote.eq.true,status.not.in.(draft,cancelled))',
      ),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .or(
        'is_quote.eq.false,and(is_quote.eq.true,status.not.in.(draft,cancelled))',
      )
      .gte('event_date', today)
      .not('status', 'in', '(completed,cancelled)'),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .or(
        'is_quote.eq.false,and(is_quote.eq.true,status.not.in.(draft,cancelled))',
      )
      .eq('status', 'completed')
      .gte('event_date', monthStart),
    supabase
      .from('bookings')
      .select('paid_amount')
      .or(
        'is_quote.eq.false,and(is_quote.eq.true,status.not.in.(draft,cancelled))',
      )
      .gte('created_at', `${monthStart}T00:00:00`),
    supabase
      .from('bookings')
      .select(
        'id,booking_number,booking_type,status,payment_status,event_name,event_date,total,customers(name)',
      )
      .or(
        'is_quote.eq.false,and(is_quote.eq.true,status.not.in.(draft,cancelled))',
      )
      .order('created_at', { ascending: false })
      .limit(6),
  ]);
  const paidThisMonth = (revenue ?? []).reduce(
    (sum, row) => sum + Number(row.paid_amount),
    0,
  );
  const recentBookings = (recent ?? []) as unknown as Array<{
    id: number;
    booking_number: string;
    booking_type: string;
    status: string;
    payment_status: string;
    event_name: string;
    event_date: string;
    total: number;
    customers: { name: string } | null;
  }>;
  const cards = [
    {
      label: 'Total bookings',
      value: String(total ?? 0),
      note: 'All live records',
      icon: ClipboardList,
    },
    {
      label: 'Upcoming events',
      value: String(upcoming ?? 0),
      note: 'Confirmed and active',
      icon: CalendarClock,
    },
    {
      label: 'Completed this month',
      value: String(completed ?? 0),
      note: 'Closed operations',
      icon: CheckCircle2,
    },
    {
      label: 'Collected this month',
      value: money(paidThisMonth),
      note: 'Recorded payments',
      icon: CircleDollarSign,
    },
  ];
  return (
    <BookingPortalShell email={auth.user.email ?? 'Safawala user'}>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <DashboardHeader
          title="Booking command center"
          subtitle="Live sales, rentals, events and collections"
          actions={
            <Button size="sm" render={<Link href="/bookings/new" />}>
              <Plus />
              <span className="hidden sm:inline">Create booking</span>
            </Button>
          }
        />
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, note, icon: Icon }) => (
            <Card key={label} className="border-border shadow-level-1 ring-0">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {label}
                  </p>
                  <CardTitle className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
                    {value}
                  </CardTitle>
                </div>
                <span className="grid size-11 place-items-center rounded-xl bg-accent text-primary">
                  <Icon className="size-5" />
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{note}</p>
              </CardContent>
            </Card>
          ))}
        </section>
        <Card className="gap-0 border-border py-0 shadow-level-1 ring-0">
          <CardHeader className="flex-row items-center justify-between border-b py-5">
            <div>
              <CardTitle>Recent bookings</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Most recently created records from Supabase
              </p>
            </div>
            <Button variant="outline" render={<Link href="/bookings" />}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {error ? (
              <p className="p-6 text-sm text-destructive">{error.message}</p>
            ) : recentBookings.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="border-b bg-[#fcfaf7] text-xs text-muted-foreground">
                    <tr>
                      {[
                        'Booking',
                        'Customer',
                        'Event',
                        'Status',
                        'Payment',
                        'Total',
                      ].map((h) => (
                        <th key={h} className="px-5 py-3 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b last:border-0 hover:bg-[#fcfaf7]"
                      >
                        <td className="px-5 py-4">
                          <Link
                            href={`/bookings/${row.id}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            {row.booking_number}
                          </Link>
                          <p className="text-xs capitalize text-muted-foreground">
                            {row.booking_type}
                          </p>
                        </td>
                        <td className="px-5 py-4 font-medium">
                          {row.customers?.name ?? '—'}
                        </td>
                        <td className="px-5 py-4">
                          {row.event_name}
                          <p className="text-xs text-muted-foreground">
                            {friendlyDate(row.event_date)}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <Badge
                            variant="outline"
                            className={statusTone(row.status)}
                          >
                            {statusLabel(row.status)}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          <Badge
                            variant="outline"
                            className={statusTone(row.payment_status)}
                          >
                            {statusLabel(row.payment_status)}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 font-semibold">
                          {money(row.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid min-h-64 place-items-center p-8 text-center">
                <div>
                  <h3 className="font-semibold">
                    Your booking workspace is ready
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create the first live booking to begin tracking operations.
                  </p>
                  <Button
                    render={<Link href="/bookings/new" />}
                    className="mt-5"
                  >
                    <Plus />
                    Create booking
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </BookingPortalShell>
  );
}
