import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarClock, ClipboardList, MapPin } from 'lucide-react';
import { BookingPortalShell } from '@/components/bookings/booking-portal-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { friendlyDate } from '@/lib/bookings';
import { currentStageSummary, listJobs, syncEventJobs } from '@/lib/event-jobs/store';
import type { ConfirmedBookingSummary } from '@/lib/event-jobs/types';
import { getStaffSession } from '@/lib/staff-portal/session';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type JobListBookingRow = {
  id: number;
  booking_number: string;
  booking_type: string;
  status: string;
  event_name: string;
  event_date: string;
  event_time: string | null;
  event_location: string | null;
  customers: { name: string; phone: string } | null;
  total: number;
  paid_amount: number;
  balance_amount: number;
  security_deposit: number;
  payment_status: string;
};

type BookingItemRow = {
  booking_id: number;
  item_name: string;
  quantity: number;
};

export default async function EventJobsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const staffSession = await getStaffSession();

  if (staffSession) {
    const staffJobs = await listJobs();
    return (
      <BookingPortalShell email={auth.user.email ?? 'Safawala user'}>
        <div className="mx-auto max-w-[1440px] space-y-6">
          <DashboardHeader title="Event Jobs" subtitle="Confirmed booking jobs and live department progress" />
          <Card className="gap-0 overflow-hidden border-border py-0 shadow-level-1 ring-0">
            <CardContent className="p-0">
              {staffJobs.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b bg-[#f7f4ef] text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Job</th><th className="px-5 py-3 font-medium">Booking</th><th className="px-5 py-3 font-medium">Event</th><th className="px-5 py-3 font-medium">Current stage</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody>{staffJobs.map((job) => <tr key={job.id} className="border-b last:border-0 hover:bg-[#fcfaf7]"><td className="px-5 py-4"><Link href={`/event-jobs/${job.id}`} className="font-semibold text-primary hover:underline">{job.id}</Link></td><td className="px-5 py-4 text-muted-foreground">{job.bookingNumber}</td><td className="px-5 py-4"><p>{job.eventSummary.eventName}</p><p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock className="size-3.5" />{friendlyDate(job.eventSummary.eventDate)}{job.eventSummary.venue ? ` · ${job.eventSummary.venue}` : ''}</p></td><td className="px-5 py-4">{currentStageSummary(job)}</td><td className="px-5 py-4"><Badge variant="outline" className={job.status === 'closed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}>{job.status === 'closed' ? 'Closed' : 'Active'}</Badge></td></tr>)}</tbody></table></div> : <div className="grid min-h-56 place-items-center p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-primary"><ClipboardList /></span><h3 className="mt-4 font-semibold">No Central Event Jobs yet</h3><p className="mt-1 text-sm text-muted-foreground">Confirmed bookings appear here automatically.</p></div></div>}
            </CardContent>
          </Card>
        </div>
      </BookingPortalShell>
    );
  }

  // A Central Event Job is created only for a real, confirmed booking — never a
  // quote (is_quote = false) and never a draft/cancelled one. This mirrors the
  // "Booking Confirmed" trigger point decided during the Step 1 audit.
  const { data: bookingsRaw, error } = await supabase
    .from('bookings')
    .select(
      'id,booking_number,booking_type,status,event_name,event_date,event_time,event_location,customers(name,phone),total,paid_amount,balance_amount,security_deposit,payment_status',
    )
    .eq('is_quote', false)
    .not('status', 'in', '(draft,cancelled)')
    .order('event_date', { ascending: false });
  const bookings = bookingsRaw as unknown as JobListBookingRow[] | null;
  const bookingIds = (bookings ?? []).map((booking) => booking.id);

  // Required items per job come from booking_items — fetched in one batched query for
  // every confirmed booking on this page rather than one query per booking.
  const { data: itemsRaw } = bookingIds.length
    ? await supabase.from('booking_items').select('booking_id,item_name,quantity').in('booking_id', bookingIds)
    : { data: [] as BookingItemRow[] };
  const items = (itemsRaw ?? []) as unknown as BookingItemRow[];
  const itemsByBookingId = new Map<number, { itemName: string; quantity: number }[]>();
  for (const item of items) {
    const list = itemsByBookingId.get(item.booking_id) ?? [];
    list.push({ itemName: item.item_name, quantity: item.quantity });
    itemsByBookingId.set(item.booking_id, list);
  }

  const summaries: ConfirmedBookingSummary[] = (bookings ?? []).map((booking) => ({
    bookingId: booking.id,
    bookingNumber: booking.booking_number,
    bookingType: booking.booking_type,
    status: booking.status,
    eventName: booking.event_name,
    eventDate: booking.event_date,
    eventTime: booking.event_time,
    eventLocation: booking.event_location,
    items: itemsByBookingId.get(booking.id) ?? [],
    payment: {
      totalAmount: booking.total,
      amountReceived: booking.paid_amount,
      pendingBalance: booking.balance_amount,
      depositAmount: booking.security_deposit,
      paymentStatus: booking.payment_status,
    },
  }));

  // Refreshes the Supabase-backed state for every confirmed booking. New confirmed
  // bookings are also opened by the database trigger, so this remains duplicate-safe.
  const jobs = await syncEventJobs(summaries);
  const bookingById = new Map((bookings ?? []).map((booking) => [booking.id, booking]));

  const rows = jobs
    .map((job) => ({ job, booking: bookingById.get(job.bookingId) }))
    .filter((row): row is { job: (typeof jobs)[number]; booking: NonNullable<typeof row.booking> } =>
      Boolean(row.booking),
    )
    .sort((a, b) => (a.booking.event_date < b.booking.event_date ? 1 : -1));

  return (
    <BookingPortalShell email={auth.user.email ?? 'Safawala user'}>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <DashboardHeader
          title="Event Jobs"
          subtitle="One Central Event Job per confirmed booking — tracked across every department"
        />

        {error ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-5 text-sm text-destructive">{error.message}</CardContent>
          </Card>
        ) : null}

        <Card className="gap-0 overflow-hidden border-border py-0 shadow-level-1 ring-0">
          <CardContent className="p-0">
            {rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b bg-[#f7f4ef] text-xs text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">Job</th>
                      <th className="px-5 py-3 font-medium">Booking</th>
                      <th className="px-5 py-3 font-medium">Customer</th>
                      <th className="px-5 py-3 font-medium">Event</th>
                      <th className="px-5 py-3 font-medium">Current stage</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ job, booking }) => (
                      <tr key={job.id} className="border-b last:border-0 hover:bg-[#fcfaf7]">
                        <td className="px-5 py-4">
                          <Link href={`/event-jobs/${job.id}`} className="font-semibold text-primary hover:underline">
                            {job.id}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">{booking.booking_number}</td>
                        <td className="px-5 py-4">{booking.customers?.name ?? 'Walk-in'}</td>
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <CalendarClock className="size-3.5" /> {friendlyDate(booking.event_date)}
                          </span>
                          {booking.event_location ? (
                            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="size-3.5" /> {booking.event_location}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-5 py-4">{currentStageSummary(job)}</td>
                        <td className="px-5 py-4">
                          <Badge
                            variant="outline"
                            className={
                              job.status === 'closed'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-amber-200 bg-amber-50 text-amber-800'
                            }
                          >
                            {job.status === 'closed' ? 'Closed' : 'Active'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid min-h-56 place-items-center p-8 text-center">
                <div>
                  <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-primary">
                    <ClipboardList />
                  </span>
                  <h3 className="mt-4 font-semibold">No Central Event Jobs yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Confirm a booking to see it appear here automatically.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </BookingPortalShell>
  );
}
