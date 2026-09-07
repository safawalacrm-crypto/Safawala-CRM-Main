import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  AlertTriangle,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  FileText,
  ListChecks,
  MapPin,
  PackageCheck,
  Plus,
  Users,
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
  const [
    { count: total },
    { count: quoteTotal },
    { count: upcoming },
    { count: todayEvents },
    { count: confirmed },
    { count: completed },
    { data: upcomingRows },
    { count: modificationCount },
    { data: eventJobs },
    { data: paymentRows },
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
      .eq('is_quote', true)
      .eq('status', 'draft'),
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
      .gte('event_date', today)
      .eq('event_date', today)
      .not('status', 'in', '(completed,cancelled)'),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .or(
        'is_quote.eq.false,and(is_quote.eq.true,status.not.in.(draft,cancelled))',
      )
      .eq('status', 'confirmed'),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .or(
        'is_quote.eq.false,and(is_quote.eq.true,status.not.in.(draft,cancelled))',
      )
      .eq('status', 'completed'),
    supabase
      .from('bookings')
      .select(
        'id,booking_number,booking_type,status,payment_status,event_name,event_date,event_time,event_location,total,customers(name)',
      )
      .or(
        'is_quote.eq.false,and(is_quote.eq.true,status.not.in.(draft,cancelled))',
      )
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(8),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('booking_type', 'sale')
      .or(
        'is_quote.eq.false,and(is_quote.eq.true,status.not.in.(draft,cancelled))',
      )
      .ilike('notes', '%SALE MODIFICATION REQUIRED%'),
    supabase.from('event_jobs').select('state'),
    supabase
      .from('bookings')
      .select('customer_id,total,paid_amount,payment_status')
      .or(
        'is_quote.eq.false,and(is_quote.eq.true,status.not.in.(draft,cancelled))',
      ),
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
  const jobsToClose = (eventJobs ?? []).filter((row) => {
    const state = row.state as {
      bookingType?: string;
      stages?: Array<{ key?: string; status?: string }>;
    } | null;
    const finalStage = state?.stages?.find(
      (stage) => stage.key === 'booking_final_check',
    );
    return (
      state?.bookingType === 'rental' &&
      (finalStage?.status === 'open' || finalStage?.status === 'in_progress')
    );
  }).length;
  const activeEventJobs = (eventJobs ?? []).filter((row) => {
    const state = row.state as { stages?: Array<{ status?: string }> } | null;
    return state?.stages?.some(
      (stage) => stage.status === 'open' || stage.status === 'in_progress',
    );
  }).length;
  const pendingPaymentBookings = (paymentRows ?? []).filter((row) => {
    const pending = Number(row.total ?? 0) - Number(row.paid_amount ?? 0);
    return pending > 0 && row.payment_status !== 'paid';
  });
  const pendingPaymentAmount = pendingPaymentBookings.reduce(
    (sum, row) =>
      sum + Math.max(Number(row.total ?? 0) - Number(row.paid_amount ?? 0), 0),
    0,
  );
  const activeCustomers = new Set(
    (paymentRows ?? [])
      .map((row) => row.customer_id)
      .filter((customerId) => customerId !== null && customerId !== undefined),
  ).size;
  const upcomingBookings = (upcomingRows ?? []) as unknown as Array<{
    id: number;
    booking_number: string;
    booking_type: string;
    status: string;
    event_name: string;
    event_date: string;
    event_time: string | null;
    event_location: string | null;
    customers: { name: string } | null;
  }>;
  const todayBookings = upcomingBookings.filter(
    (booking) => booking.event_date === today,
  );
  const attentionCount =
    jobsToClose +
    pendingPaymentBookings.length +
    Number(modificationCount ?? 0);
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
  const priorityItems = [
    todayBookings.length
      ? {
          label: "Today's events",
          detail: `${todayBookings[0].event_name}${todayBookings.length > 1 ? ` + ${todayBookings.length - 1} more` : ''}`,
          note: 'Event date is today',
          href: '/bookings/calendar',
          tone: 'text-rose-700 bg-rose-50',
        }
      : null,
    quoteTotal
      ? {
          label: 'Quotation awaiting action',
          detail: `${quoteTotal} quotation${quoteTotal === 1 ? '' : 's'} need review`,
          note: 'Review and convert when ready',
          href: '/quotes',
          tone: 'text-blue-700 bg-blue-50',
        }
      : null,
    activeEventJobs
      ? {
          label: 'Client jobs in progress',
          detail: `${activeEventJobs} operational job${activeEventJobs === 1 ? '' : 's'} open`,
          note: 'Check warehouse, QC and collection',
          href: '/staff-portal/event-tracking',
          tone: 'text-emerald-700 bg-emerald-50',
        }
      : null,
    modificationCount
      ? {
          label: 'Modification request',
          detail: `${modificationCount} change${modificationCount === 1 ? '' : 's'} waiting`,
          note: 'Review before the event date',
          href: '/modifications',
          tone: 'text-amber-700 bg-amber-50',
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    detail: string;
    note: string;
    href: string;
    tone: string;
  }>;
  const pipeline = [
    { label: 'Quotations', value: quoteTotal ?? 0 },
    { label: 'Confirmed', value: confirmed ?? 0 },
    { label: 'In progress', value: activeEventJobs },
    { label: 'Completed', value: completed ?? 0 },
  ];
  const recentActivity = (eventJobs ?? [])
    .flatMap((row) => {
      const state = row.state as {
        activity?: Array<{
          id?: string;
          at?: string;
          action?: string;
          actor?: string;
          details?: string;
        }>;
      } | null;
      return state?.activity ?? [];
    })
    .filter((activity) => activity.at)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 5);
  const cards = [
    {
      label: 'All bookings',
      value: String(total ?? 0),
      note: 'Sales and rental bookings',
      icon: ClipboardList,
      href: '/bookings',
      tone: 'bg-[#f5ead8] text-[#8a5b24]',
    },
    {
      label: 'Upcoming events',
      value: String(upcoming ?? 0),
      note: 'Next 30 days',
      icon: CalendarClock,
      href: '/bookings/calendar',
      tone: 'bg-violet-50 text-violet-700',
    },
    {
      label: "Today's events",
      value: String(todayEvents ?? 0),
      note: 'Requires attention today',
      icon: CalendarClock,
      href: '/bookings/calendar',
      tone: 'bg-rose-50 text-rose-700',
    },
    {
      label: 'Pending quotations',
      value: String(quoteTotal ?? 0),
      note: 'Awaiting review or conversion',
      icon: FileText,
      href: '/quotes',
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Pending client jobs',
      value: String(activeEventJobs),
      note: 'Warehouse, QC and collection flow',
      icon: ListChecks,
      href: '/staff-portal/event-tracking',
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Modifications pending',
      value: String(modificationCount ?? 0),
      note: 'Sale changes waiting for action',
      icon: PackageCheck,
      href: '/modifications',
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Active customers',
      value: String(activeCustomers ?? 0),
      note: 'Customers with live bookings',
      icon: Users,
      href: '/customers',
      tone: 'bg-cyan-50 text-cyan-700',
    },
    {
      label: 'Attention required',
      value: String(attentionCount),
      note: `${money(pendingPaymentAmount)} pending payment balance`,
      icon: CircleDollarSign,
      href: '/staff-portal/booking/close-jobs',
      tone: 'bg-orange-50 text-orange-700',
    },
  ];
  return (
    <BookingPortalShell email={auth.user.email ?? 'Safawala user'}>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <DashboardHeader
          title="Booking Dashboard"
          subtitle="Bookings, quotations and jobs waiting for closure"
          actions={
            <Button size="sm" render={<Link href="/bookings/new" />}>
              <Plus />
              <span className="hidden sm:inline">Create booking</span>
            </Button>
          }
        />
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, note, href, icon: Icon, tone }) => (
            <Link key={label} href={href} className="group">
              <Card className="h-full border-border shadow-level-1 ring-0 transition group-hover:-translate-y-0.5 group-hover:border-primary/35 group-hover:shadow-level-2">
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {label}
                    </p>
                    <CardTitle className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
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
        <section className="grid gap-4 xl:grid-cols-[1fr_1.35fr]">
          <Card className="border-border shadow-level-1 ring-0">
            <CardHeader className="flex-row items-center justify-between border-b py-4">
              <div>
                <CardTitle className="text-base">
                  Today&apos;s priorities
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Work that may need attention first.
                </p>
              </div>
              <AlertTriangle className="size-5 text-primary" />
            </CardHeader>
            <CardContent className="p-3">
              {priorityItems.length ? (
                <div className="space-y-2">
                  {priorityItems.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="flex items-center gap-3 rounded-lg border border-border/80 p-3 transition hover:border-primary/35 hover:bg-accent/35"
                    >
                      <span
                        className={`grid size-9 shrink-0 place-items-center rounded-full ${item.tone}`}
                      >
                        <AlertTriangle className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {item.label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.detail}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {item.note}
                        </span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-40 place-items-center p-5 text-center">
                  <div>
                    <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
                    <p className="mt-2 text-sm font-medium">
                      Nothing urgent today
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Your booking work is up to date.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-border shadow-level-1 ring-0">
            <CardHeader className="flex-row items-center justify-between border-b py-4">
              <div>
                <CardTitle className="text-base">Upcoming events</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Next events from the booking calendar.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/bookings/calendar" />}
              >
                View calendar
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {upcomingBookings.length ? (
                <div className="divide-y divide-border">
                  {upcomingBookings.slice(0, 6).map((booking) => (
                    <Link
                      key={booking.id}
                      href={`/bookings/${booking.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-[#fcfaf7]"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                        <CalendarDays className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {booking.event_name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {booking.customers?.name ?? 'Customer'} ·{' '}
                          {booking.event_location ?? 'Location not added'}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs font-medium text-primary">
                          {friendlyDate(booking.event_date)}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {statusLabel(booking.status)}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-40 place-items-center p-5 text-center text-sm text-muted-foreground">
                  No upcoming events.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border shadow-level-1 ring-0">
            <CardHeader className="border-b py-4">
              <CardTitle className="text-base">Booking pipeline</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Live totals by the current workflow stage.
              </p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
              {pipeline.map((stage) => (
                <div
                  key={stage.label}
                  className="rounded-lg bg-[#fcfaf7] p-3 text-center"
                >
                  <p className="text-xl font-semibold tracking-[-0.03em]">
                    {stage.value}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {stage.label}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-border shadow-level-1 ring-0">
            <CardHeader className="border-b py-4">
              <CardTitle className="text-base">Pending work</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Open items from the connected modules.
              </p>
            </CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {[
                ['Pending quotations', quoteTotal ?? 0, '/quotes'],
                [
                  'Client jobs in progress',
                  activeEventJobs,
                  '/staff-portal/event-tracking',
                ],
                [
                  'Modifications pending',
                  modificationCount ?? 0,
                  '/modifications',
                ],
                [
                  'Jobs to close',
                  jobsToClose,
                  '/staff-portal/booking/close-jobs',
                ],
              ].map(([label, value, href]) => (
                <Link
                  key={String(label)}
                  href={String(href)}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-[#fcfaf7]"
                >
                  <span className="flex-1 text-sm">{label}</span>
                  <Badge variant="outline">{String(value)}</Badge>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
        <Card className="border-border shadow-level-1 ring-0">
          <CardHeader className="border-b py-4">
            <CardTitle className="text-base">Quick access</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Open the next part of the booking workflow.
            </p>
          </CardHeader>
          <CardContent className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: 'All bookings',
                href: '/bookings',
                icon: ClipboardList,
              },
              {
                title: 'Quotes',
                href: '/quotes',
                icon: FileText,
              },
              {
                title: 'Calendar',
                href: '/bookings/calendar',
                icon: CalendarClock,
              },
              {
                title: 'Event tracking',
                href: '/staff-portal/event-tracking',
                icon: ListChecks,
              },
              {
                title: 'Jobs to close',
                href: '/staff-portal/booking/close-jobs',
                icon: PackageCheck,
              },
              {
                title: 'Modifications',
                href: '/modifications',
                icon: CheckCircle2,
              },
              {
                title: 'Customers',
                href: '/customers',
                icon: Users,
              },
            ].map(({ title, href, icon: Icon }) => (
              <Link
                key={title}
                href={href}
                className="group flex items-center gap-3 rounded-lg border border-border/80 px-3 py-3 transition hover:border-primary/35 hover:bg-accent/45"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                  <Icon className="size-4" />
                </span>
                <p className="flex-1 text-sm font-medium">{title}</p>
                <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
          </CardContent>
        </Card>
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
        <Card className="border-border shadow-level-1 ring-0">
          <CardHeader className="border-b py-4">
            <CardTitle className="text-base">Recent activity</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Latest updates recorded by the event workflow.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivity.length ? (
              <div className="divide-y divide-border">
                {recentActivity.map((activity, index) => (
                  <div
                    key={activity.id ?? `${activity.at}-${index}`}
                    className="flex items-start gap-3 px-4 py-3"
                  >
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-accent text-primary">
                      <Clock3 className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {statusLabel(activity.action ?? 'updated')}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {activity.details ??
                          activity.actor ??
                          'Workflow update'}
                      </p>
                    </div>
                    <time className="shrink-0 text-[11px] text-muted-foreground">
                      {new Date(String(activity.at)).toLocaleDateString(
                        'en-IN',
                        { day: '2-digit', month: 'short' },
                      )}
                    </time>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 text-sm text-muted-foreground">
                No workflow activity recorded yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </BookingPortalShell>
  );
}
