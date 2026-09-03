import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Pencil,
  Plus,
  Search,
} from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import {
  BookingPdfButton,
  type PdfBooking,
} from '@/components/bookings/booking-pdf-button';
import { BookingsListToolbar } from '@/components/bookings/bookings-list-toolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  BookingRow,
  friendlyDate,
  money,
  statusLabel,
  statusTone,
} from '@/lib/bookings';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const PAGE_SIZES = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 10;

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BookingsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const requestedPageSize = Number(params.perPage ?? DEFAULT_PAGE_SIZE);
  const pageSize = PAGE_SIZES.includes(
    requestedPageSize as (typeof PAGE_SIZES)[number],
  )
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE;
  const search = typeof params.q === 'string' ? params.q.trim() : '';
  const type = params.type === 'rental' ? 'rental' : 'sale';
  const status = typeof params.status === 'string' ? params.status : '';
  const payment = typeof params.payment === 'string' ? params.payment : '';
  const created = typeof params.created === 'string' ? params.created : '';
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  let customerIds: number[] = [];
  if (search) {
    const { data } = await supabase
      .from('customers')
      .select('id')
      .or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
      .limit(50);
    customerIds = (data ?? []).map((row) => row.id);
  }
  let query = supabase
    .from('bookings')
    .select(
      'id,booking_number,booking_type,status,payment_status,is_quote,event_name,event_date,event_time,event_location,pickup_date,due_date,subtotal,discount,tax,total,paid_amount,balance_amount,security_deposit,created_at,customers(name,phone,address),staff_members(name),booking_items(item_name,quantity,unit_price,line_total,product_id,products(image_urls))',
      { count: 'exact' },
    )
    // Quotes stay exclusively in the Quotes module, even after conversion.
    .eq('is_quote', false);
  if (search) {
    const clauses = [
      `booking_number.ilike.%${search}%`,
      `event_name.ilike.%${search}%`,
      `event_location.ilike.%${search}%`,
    ];
    if (customerIds.length)
      clauses.push(`customer_id.in.(${customerIds.join(',')})`);
    query = query.or(clauses.join(','));
  }
  query = query.eq('booking_type', type);
  if (status) query = query.eq('status', status);
  if (payment) query = query.eq('payment_status', payment);
  const from = (page - 1) * pageSize;
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  const bookings = (data ?? []) as unknown as (BookingRow & PdfBooking)[];
  const pageCount = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const queryString = (nextPage: number) => {
    const copy = new URLSearchParams();
    if (search) copy.set('q', search);
    copy.set('type', type);
    if (status) copy.set('status', status);
    if (payment) copy.set('payment', payment);
    copy.set('perPage', String(pageSize));
    copy.set('page', String(nextPage));
    return `/bookings?${copy}`;
  };

  return (
    <DashboardShell email={auth.user.email ?? 'Safawala user'}>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <DashboardHeader
          title="All bookings"
          subtitle="Sales, rentals, payments and events"
          actions={
            <Button size="sm" render={<Link href="/bookings/new" />}>
              <Plus />
              <span className="hidden sm:inline">Create booking</span>
            </Button>
          }
        />

        {created ? (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
            <AlertTitle>Booking created successfully</AlertTitle>
            <AlertDescription>
              {created} is saved. Use Preview to open its complete record.
            </AlertDescription>
          </Alert>
        ) : null}

        <Card className="gap-0 border-border py-0 shadow-level-1 ring-0">
          <BookingsListToolbar
            mode={type}
            count={count ?? 0}
            from={(count ?? 0) === 0 ? 0 : from + 1}
            to={Math.min(from + bookings.length, count ?? 0)}
            pageSize={pageSize}
          />
          <form className="grid gap-3 border-b bg-[#fcfaf7] p-4 md:grid-cols-[minmax(220px,1fr)_repeat(2,170px)_auto]">
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="perPage" value={pageSize} />
            <label className="relative">
              <span className="sr-only">Search bookings</span>
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <input
                name="q"
                defaultValue={search}
                placeholder="Search ID, customer, event or location"
                className="h-10 w-full rounded-lg border bg-white pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </label>
            <Filter
              name="status"
              label="All statuses"
              value={status}
              options={[
                ['confirmed', 'Confirmed'],
                ['ready', 'Ready'],
                ['out_for_delivery', 'Out for delivery'],
                ['active', 'Active'],
                ['completed', 'Completed'],
                ['cancelled', 'Cancelled'],
              ]}
            />
            <Filter
              name="payment"
              label="All payments"
              value={payment}
              options={[
                ['unpaid', 'Unpaid'],
                ['partial', 'Partial'],
                ['paid', 'Paid'],
                ['refunded', 'Refunded'],
              ]}
            />
            <Button variant="outline" className="h-10 bg-white">
              Apply
            </Button>
          </form>
          <CardContent className="p-0">
            {error ? (
              <State
                title="Bookings could not be loaded"
                description={error.message}
              />
            ) : bookings.length === 0 ? (
              <State
                title="No bookings found"
                description={`No ${type} bookings match the current filters.`}
                action
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1260px] text-left text-sm">
                  <thead className="border-b bg-white text-xs text-muted-foreground">
                    <tr>
                      {[
                        'Booking',
                        'Customer',
                        'Event',
                        'Type',
                        'Status',
                        'Payment',
                        'Total',
                        'Balance',
                        'Actions',
                      ].map((h) => (
                        <th key={h} className="px-5 py-3 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((booking) => (
                      <tr
                        key={booking.id}
                        className="border-b last:border-0 hover:bg-[#fcfaf7]"
                      >
                        <td className="px-5 py-4">
                          <Link
                            href={`/bookings/${booking.id}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            {booking.booking_number}
                          </Link>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {friendlyDate(booking.created_at.slice(0, 10))}
                          </p>
                        </td>
                        <td className="px-5 py-4 font-medium">
                          {booking.customers?.name ?? '—'}
                          <p className="mt-1 text-xs font-normal text-muted-foreground">
                            {booking.customers?.phone}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          {booking.event_name}
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="size-3" />
                            {friendlyDate(booking.event_date)}
                          </p>
                        </td>
                        <td className="px-5 py-4 capitalize">
                          {booking.booking_type}
                        </td>
                        <td className="px-5 py-4">
                          <Badge
                            variant="outline"
                            className={statusTone(booking.status)}
                          >
                            {statusLabel(booking.status)}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          <Badge
                            variant="outline"
                            className={statusTone(booking.payment_status)}
                          >
                            {statusLabel(booking.payment_status)}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 font-semibold">
                          {money(booking.total)}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {money(booking.balance_amount)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              render={
                                <Link
                                  href={`/bookings/${booking.id}`}
                                  aria-label={`Preview ${booking.booking_number}`}
                                />
                              }
                              title="Preview booking"
                            >
                              <Eye />
                              <span className="hidden 2xl:inline">Preview</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              render={
                                <Link
                                  href={`/bookings/${booking.id}/edit`}
                                  aria-label={`Edit ${booking.booking_number}`}
                                />
                              }
                              title="Edit booking"
                            >
                              <Pencil />
                              <span className="hidden 2xl:inline">Edit</span>
                            </Button>
                            <BookingPdfButton booking={booking} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
          <div className="flex items-center justify-between border-t px-5 py-4 text-sm">
            <p className="text-muted-foreground">
              {count ?? 0} booking{count === 1 ? '' : 's'}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={page <= 1}
                render={
                  page > 1 ? (
                    <Link
                      href={queryString(page - 1)}
                      aria-label="Previous page"
                    />
                  ) : undefined
                }
              >
                <ChevronLeft />
              </Button>
              <span className="min-w-20 text-center text-xs text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={page >= pageCount}
                render={
                  page < pageCount ? (
                    <Link href={queryString(page + 1)} aria-label="Next page" />
                  ) : undefined
                }
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}

function Filter({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: string[][];
}) {
  return (
    <select
      name={name}
      defaultValue={value}
      aria-label={label}
      className="h-10 rounded-lg border bg-white px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
    >
      <option value="">{label}</option>
      {options.map(([key, text]) => (
        <option key={key} value={key}>
          {text}
        </option>
      ))}
    </select>
  );
}

function State({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: boolean;
}) {
  return (
    <div className="grid min-h-72 place-items-center p-8 text-center">
      <div>
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-primary">
          <ClipboardList className="size-5" />
        </div>
        <h3 className="mt-4 font-semibold">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
        {action && (
          <Button render={<Link href="/bookings/new" />} className="mt-5">
            <Plus />
            Create booking
          </Button>
        )}
      </div>
    </div>
  );
}
