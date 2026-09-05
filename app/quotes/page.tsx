import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Pencil,
  Plus,
  XCircle,
} from 'lucide-react';
import { BookingPortalShell } from '@/components/bookings/booking-portal-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import {
  BookingPdfButton,
  type PdfBooking,
} from '@/components/bookings/booking-pdf-button';
import { QuoteActions } from '@/components/bookings/quote-actions';
import { ExportQuotesButton } from '@/components/bookings/quote-export-button';
import { RefreshQuotesButton } from '@/components/bookings/refresh-quotes-button';
import { BookingsListToolbar } from '@/components/bookings/bookings-list-toolbar';
import { ListFilterForm } from '@/components/bookings/list-filter-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  BookingRow,
  displayQuoteNumber,
  friendlyDate,
  money,
  quoteState,
  quoteStateTone,
  QUOTE_STATE_LABEL,
  type QuoteState,
} from '@/lib/bookings';
import { createClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-portal/session';

export const dynamic = 'force-dynamic';
const PAGE_SIZES = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 10;

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function QuotesPage({ searchParams }: Props) {
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
  const state = typeof params.state === 'string' ? params.state : '';
  const time = typeof params.time === 'string' ? params.time : '';
  const createdRaw = typeof params.created === 'string' ? params.created : '';
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const staffSession = await getStaffSession();
  const quoteOnly = staffSession?.accessType === 'staff';

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const timeFrom =
    time === 'today'
      ? todayStart
      : time === 'week'
        ? weekStart
        : time === 'month'
          ? monthStart
          : null;

  let customerIds: number[] = [];
  if (search) {
    const { data } = await supabase
      .from('customers')
      .select('id')
      .or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
      .limit(50);
    customerIds = (data ?? []).map((row) => row.id);
  }

  const baseFields =
    'id,booking_number,booking_type,status,payment_status,is_quote,converted_booking_id,created_by_staff_id,event_name,event_date,event_time,event_location,pickup_date,due_date,subtotal,discount,tax,total,paid_amount,balance_amount,security_deposit,created_at,customers(name,phone,address),staff_members:staff_members!bookings_assigned_staff_id_fkey(name),booking_items(item_name,quantity,unit_price,line_total,product_id,products(image_urls,barcode))';

  let query = supabase
    .from('bookings')
    .select(baseFields, { count: 'exact' })
    .eq('is_quote', true);
  if (quoteOnly && staffSession) query = query.eq('created_by_staff_id', staffSession.staffMemberId);
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
  if (state === 'generated') query = query.eq('status', 'draft');
  else if (state === 'rejected') query = query.eq('status', 'cancelled');
  else if (state === 'converted')
    query = query.not('status', 'in', '(draft,cancelled)');
  if (timeFrom) query = query.gte('created_at', timeFrom.toISOString());

  const from = (page - 1) * pageSize;
  let summaryQuery = supabase
    .from('bookings')
    .select('id,status,created_at,booking_number', { count: 'exact' })
    .eq('is_quote', true)
    .eq('booking_type', type);
  if (quoteOnly && staffSession) summaryQuery = summaryQuery.eq('created_by_staff_id', staffSession.staffMemberId);

  const [{ data, count, error }, summaryResult] = await Promise.all([
    query.order('created_at', { ascending: false }).range(from, from + pageSize - 1),
    summaryQuery.order('created_at', { ascending: true }).limit(10000),
  ]);

  const quoteSummary = summaryResult.data ?? [];
  const sequenceById = new Map<number, number>();
  const yearlyCounts = new Map<string, number>();
  quoteSummary.forEach((quote) => {
    const year = quote.created_at.slice(0, 4);
    const next = (yearlyCounts.get(year) ?? 0) + 1;
    yearlyCounts.set(year, next);
    sequenceById.set(quote.id, next);
  });
  const totalCount = summaryResult.count ?? quoteSummary.length;
  const generatedCount = quoteSummary.filter(
    (quote) => quote.status === 'draft',
  ).length;
  const rejectedCount = quoteSummary.filter(
    (quote) => quote.status === 'cancelled',
  ).length;
  const convertedCount = quoteSummary.filter(
    (quote) => !['draft', 'cancelled'].includes(quote.status),
  ).length;
  const rawQuotes = (data ?? []) as unknown as (BookingRow & PdfBooking)[];
  const quotes = rawQuotes.map((quote) => ({
    ...quote,
    booking_number: displayQuoteNumber(
      quote.booking_number,
      quote.booking_type,
      sequenceById.get(quote.id),
    ),
  }));
  const createdQuote = quoteSummary.find(
    (quote) => quote.booking_number === createdRaw,
  );
  const created = createdRaw
    ? displayQuoteNumber(
        createdRaw,
        type,
        createdQuote ? sequenceById.get(createdQuote.id) : undefined,
      )
    : '';
  const loadError = error ?? summaryResult.error;
  const pageCount = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const queryString = (nextPage: number) => {
    const copy = new URLSearchParams();
    if (search) copy.set('q', search);
    copy.set('type', type);
    if (state) copy.set('state', state);
    if (time) copy.set('time', time);
    copy.set('perPage', String(pageSize));
    copy.set('page', String(nextPage));
    return `/quotes?${copy}`;
  };

  const cards: {
    label: string;
    value: string;
    note: string;
    icon: typeof FileText;
    tone: 'default' | 'success' | 'warning' | 'danger';
  }[] = [
    {
      label: 'Total quotes',
      value: String(totalCount ?? 0),
      note: 'All saved quotes',
      icon: FileText,
      tone: 'default',
    },
    {
      label: 'Generated',
      value: String(generatedCount ?? 0),
      note: 'Awaiting a decision',
      icon: Clock,
      tone: 'warning',
    },
    {
      label: 'Converted',
      value: String(convertedCount ?? 0),
      note: 'Accepted into live bookings',
      icon: CheckCircle2,
      tone: 'success',
    },
    {
      label: 'Rejected',
      value: String(rejectedCount ?? 0),
      note: 'Declined quotes',
      icon: XCircle,
      tone: 'danger',
    },
  ];

  return (
    <BookingPortalShell email={auth.user.email ?? 'Safawala user'}>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <DashboardHeader
          title="Quote Management"
          subtitle="Generate and manage customer quotes"
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                render={<Link href="/bookings" aria-label="Back to bookings" />}
              >
                <ArrowLeft />
                <span className="hidden md:inline">Back</span>
              </Button>
              <RefreshQuotesButton />
              {!quoteOnly ? <ExportQuotesButton quotes={quotes} /> : null}
              <Button size="sm" render={<Link href="/bookings/new" />}>
                <Plus />
                <span className="hidden md:inline">New Quote</span>
              </Button>
            </>
          }
        />

        {created ? (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
            <AlertTitle>Quote saved successfully</AlertTitle>
            <AlertDescription>
              {created} is saved as a quote. Accept it once the customer
              confirms to turn it into a live booking.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, note, icon: Icon, tone }) => {
            const colors =
              tone === 'success'
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : tone === 'warning'
                  ? 'bg-amber-50 text-amber-700 ring-amber-200'
                  : tone === 'danger'
                    ? 'bg-red-50 text-red-700 ring-red-200'
                    : 'bg-accent text-primary ring-[#e4d2b6]';

            return (
              <Card
                key={label}
                className="gap-0 border-border py-0 shadow-level-1 ring-0"
              >
                <CardContent className="flex items-center justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-1 truncate text-xl font-semibold tracking-[-0.03em]">
                      {value}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {note}
                    </p>
                  </div>
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 [&_svg]:size-4 ${colors}`}
                  >
                    <Icon />
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <Card className="gap-0 border-border py-0 shadow-level-1 ring-0">
          <BookingsListToolbar
            mode={type}
            count={count ?? 0}
            from={(count ?? 0) === 0 ? 0 : from + 1}
            to={Math.min(from + quotes.length, count ?? 0)}
            pageSize={pageSize}
            itemLabel="quotes"
          />
          <ListFilterForm
            search={search}
            searchPlaceholder="Search quote, customer or event"
            filters={[
              {
                name: 'state',
                label: 'All statuses',
                value: state,
                options: [
                  ['generated', 'Generated'],
                  ['converted', 'Converted'],
                  ['rejected', 'Rejected'],
                ],
              },
              {
                name: 'time',
                label: 'All time',
                value: time,
                options: [
                  ['today', 'Today'],
                  ['week', 'This week'],
                  ['month', 'This month'],
                ],
              },
            ]}
          />
          <CardContent className="p-0">
            {loadError ? (
              <State
                title="Quotes could not be loaded"
                description={loadError.message}
              />
            ) : quotes.length === 0 ? (
              <State
                title="No quotes found"
                description={`No ${type} quotes match the current filters.`}
                action
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] text-left text-sm">
                  <thead className="border-b bg-white text-xs text-muted-foreground">
                    <tr>
                      {[
                        'Quote #',
                        'Customer',
                        'Type',
                        'Event',
                        'Amount',
                        'Status',
                        'Created',
                        'Actions',
                      ].map((h) => (
                        <th key={h} className="px-5 py-3 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((quote) => {
                      const currentState: QuoteState = quoteState(quote.status);
                      return (
                        <tr
                          key={quote.id}
                          className="border-b last:border-0 hover:bg-[#fcfaf7]"
                        >
                          <td className="px-5 py-4">
                            <Link
                              href={`/bookings/${quote.id}`}
                              className="font-semibold text-primary hover:underline"
                            >
                              {quote.booking_number}
                            </Link>
                          </td>
                          <td className="px-5 py-4 font-medium">
                            {quote.customers?.name ?? '—'}
                            <p className="mt-1 text-xs font-normal text-muted-foreground">
                              {quote.customers?.phone}
                            </p>
                          </td>
                          <td className="px-5 py-4 capitalize">
                            {quote.booking_type}
                          </td>
                          <td className="px-5 py-4">
                            {quote.event_name}
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <CalendarDays className="size-3" />
                              {friendlyDate(quote.event_date)}
                            </p>
                          </td>
                          <td className="px-5 py-4 font-semibold">
                            {money(quote.total)}
                          </td>
                          <td className="px-5 py-4">
                            <Badge
                              variant="outline"
                              className={quoteStateTone(currentState)}
                            >
                              {QUOTE_STATE_LABEL[currentState]}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">
                            {friendlyDate(quote.created_at.slice(0, 10))}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                render={
                                  <Link
                                    href={`/bookings/${quote.id}`}
                                    aria-label={`Preview ${quote.booking_number}`}
                                  />
                                }
                                title="Preview quote"
                              >
                                <Eye />
                              </Button>
                              {!quoteOnly ? <Button
                                variant="ghost"
                                size="icon-sm"
                                render={
                                  <Link
                                    href={`/bookings/${quote.id}/edit`}
                                    aria-label={`Edit ${quote.booking_number}`}
                                  />
                                }
                                title="Edit quote"
                              >
                                <Pencil />
                              </Button> : null}
                              {!quoteOnly ? <BookingPdfButton booking={quote} /> : null}
                              {!quoteOnly ? <QuoteActions
                                bookingId={quote.id}
                                state={currentState}
                                convertedBookingId={quote.converted_booking_id}
                              /> : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
          <div className="flex items-center justify-between border-t px-5 py-4 text-sm">
            <p className="text-muted-foreground">
              {count ?? 0} quote{count === 1 ? '' : 's'}
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
    </BookingPortalShell>
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
          <FileText className="size-5" />
        </div>
        <h3 className="mt-4 font-semibold">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
        {action && (
          <Button render={<Link href="/bookings/new" />} className="mt-5">
            <Plus />
            New Quote
          </Button>
        )}
      </div>
    </div>
  );
}
