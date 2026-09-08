import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PackageCheck, Plus, ReceiptText, Users, Wrench } from 'lucide-react';
import { requireDepartment } from '@/lib/staff-portal/guard';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { friendlyDate, money, statusLabel, statusTone } from '@/lib/bookings';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const LIVE_BOOKINGS =
  'is_quote.eq.false,and(is_quote.eq.true,status.not.in.(draft,cancelled))';

export default async function StaffBookingPage() {
  const session = await requireDepartment('booking');
  if (!session.isMainId) redirect('/staff-portal');
  const supabase = await createClient();
  const [
    bookingCount,
    modificationCount,
    activeCustomerCount,
    closeCount,
    recentResult,
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .or(LIVE_BOOKINGS),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('booking_type', 'sale')
      .or(LIVE_BOOKINGS)
      .ilike('notes', '%SALE MODIFICATION REQUIRED%'),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase
      .from('event_job_stages')
      .select('id', { count: 'exact', head: true })
      .eq('stage', 'booking_final_check')
      .in('status', ['open', 'in_progress']),
    supabase
      .from('bookings')
      .select(
        'id,booking_number,booking_type,status,payment_status,event_name,event_date,total,customers(name)',
      )
      .or(LIVE_BOOKINGS)
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  const recent = (recentResult.data ?? []) as unknown as Array<{
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
  const kpis = [
    [
      'All bookings',
      bookingCount.count ?? 0,
      'Sales and rental records',
      '/bookings',
      ReceiptText,
      'bg-[#f5ead8] text-[#8a5b24]',
    ],
    [
      'Jobs to close',
      closeCount.count ?? 0,
      'Final payment check',
      '/staff-portal/booking/close-jobs',
      PackageCheck,
      'bg-amber-50 text-amber-700',
    ],
    [
      'Modifications pending',
      modificationCount.count ?? 0,
      'Sale changes waiting',
      '/modifications',
      Wrench,
      'bg-orange-50 text-orange-700',
    ],
    [
      'Customers',
      activeCustomerCount.count ?? 0,
      'Customer directory',
      '/customers',
      Users,
      'bg-cyan-50 text-cyan-700',
    ],
  ] as const;

  return (
    <StaffPortalShell
      name={session.name}
      departments={session.departments}
      permissions={session.permissions}
      isMainId={session.isMainId}
    >
      <div className="mx-auto max-w-[1440px] space-y-6">
        <DashboardHeader
          title="Booking Dashboard"
          subtitle="Bookings, quotations and jobs waiting for closure"
          actions={
            <Button size="sm" render={<Link href="/bookings/new" />}>
              <Plus /> New Booking
            </Button>
          }
        />
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map(([label, value, note, href, Icon, tone]) => (
            <Link key={label} href={href} className="group">
              <Card className="h-full border-border shadow-level-1 ring-0 transition group-hover:-translate-y-0.5 group-hover:border-primary/35 group-hover:shadow-level-2">
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {label}
                    </p>
                    <CardTitle className="mt-2 text-2xl tracking-[-0.03em]">
                      {value}
                    </CardTitle>
                  </div>
                  <span
                    className={`grid size-11 place-items-center rounded-xl ${tone}`}
                  >
                    <Icon className="size-5" />
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{note}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
        <section>
          <Card className="border-border shadow-level-1 ring-0">
            <CardHeader className="border-b py-4">
              <CardTitle className="text-base">Quick actions</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Open the modules you manage most often.
              </p>
            </CardHeader>
            <CardContent className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-4">
              <Link
                href="/bookings"
                className="flex items-center gap-3 rounded-lg border border-border/80 px-3 py-3 text-sm font-medium hover:border-primary/35 hover:bg-accent/35"
              >
                <ReceiptText className="size-4 text-primary" /> All bookings
              </Link>
              <Link
                href="/modifications"
                className="flex items-center gap-3 rounded-lg border border-border/80 px-3 py-3 text-sm font-medium hover:border-primary/35 hover:bg-accent/35"
              >
                <Wrench className="size-4 text-primary" /> Modifications pending
              </Link>
              <Link
                href="/customers"
                className="flex items-center gap-3 rounded-lg border border-border/80 px-3 py-3 text-sm font-medium hover:border-primary/35 hover:bg-accent/35"
              >
                <Users className="size-4 text-primary" /> Customers
              </Link>
              <Link
                href="/staff-portal/booking/close-jobs"
                className="flex items-center gap-3 rounded-lg border border-border/80 px-3 py-3 text-sm font-medium hover:border-primary/35 hover:bg-accent/35"
              >
                <PackageCheck className="size-4 text-primary" /> Jobs to close
              </Link>
            </CardContent>
          </Card>
        </section>
        <Card className="gap-0 border-border py-0 shadow-level-1 ring-0">
          <CardHeader className="flex-row items-center justify-between border-b py-5">
            <div>
              <CardTitle>Recent bookings</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Latest records from Supabase.
              </p>
            </div>
            <Button variant="outline" render={<Link href="/bookings" />}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length ? (
              <div className="divide-y divide-border">
                {recent.map((booking) => (
                  <Link
                    key={booking.id}
                    href={`/bookings/${booking.id}`}
                    className="flex flex-col gap-2 px-4 py-3 transition hover:bg-[#fcfaf7] dark:hover:bg-[#241e17] sm:flex-row sm:items-center"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-primary">
                        {booking.booking_number}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {booking.customers?.name ?? 'Customer'} ·{' '}
                        {booking.event_name}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {friendlyDate(booking.event_date)}
                    </span>
                    <Badge
                      variant="outline"
                      className={statusTone(booking.status)}
                    >
                      {statusLabel(booking.status)}
                    </Badge>
                    <span className="text-sm font-semibold sm:w-28 sm:text-right">
                      {money(booking.total)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-6 text-sm text-muted-foreground">
                No bookings available.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </StaffPortalShell>
  );
}
