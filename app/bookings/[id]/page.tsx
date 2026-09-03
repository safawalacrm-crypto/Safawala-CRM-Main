import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, MapPin, Phone, Printer } from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { BookingActions } from '@/components/bookings/booking-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BOOKING_TERMS,
  friendlyDate,
  friendlyDateTime,
  friendlyTime,
  money,
  statusLabel,
  statusTone,
} from '@/lib/bookings';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function BookingDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const { data: booking, error } = await supabase
    .from('bookings')
    .select(
      '*,customers(*),staff_members(name),booking_items(*),booking_payments(*),booking_activity(*)',
    )
    .eq('id', id)
    .single();
  if (error || !booking) notFound();
  const activities = [...(booking.booking_activity ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  return (
    <DashboardShell email={auth.user.email ?? 'Safawala user'}>
      <div className="mx-auto max-w-[1200px] space-y-6">
        <DashboardHeader
          title={booking.booking_number}
          subtitle={`${statusLabel(booking.booking_type)} booking · created ${friendlyDate(booking.created_at.slice(0, 10))}`}
          actions={
            <>
              <Badge
                variant="outline"
                className={`hidden md:inline-flex ${statusTone(booking.status)}`}
              >
                {statusLabel(booking.status)}
              </Badge>
              <Badge
                variant="outline"
                className={`hidden lg:inline-flex ${statusTone(booking.payment_status)}`}
              >
                {statusLabel(booking.payment_status)}
              </Badge>
              <Button
                variant="outline"
                size="icon-sm"
                render={<Link href="/bookings" aria-label="Back to bookings" />}
              >
                <ArrowLeft />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="print:hidden"
                render={
                  <button
                    type="button"
                    data-print-booking="true"
                    aria-label="Print booking"
                  />
                }
              >
                <Printer />
                <span className="hidden xl:inline">Print booking</span>
              </Button>
            </>
          }
        />
        <BookingActions
          booking={{
            id: booking.id,
            booking_type: booking.booking_type,
            status: booking.status,
            total: Number(booking.total),
            paid_amount: Number(booking.paid_amount),
            security_deposit: Number(booking.security_deposit),
          }}
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,.7fr)]">
          <div className="space-y-6">
            <Card className="border-border shadow-level-1 ring-0">
              <CardHeader className="border-b">
                <CardTitle>Event & customer</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <Info label="Customer" value={booking.customers?.name} />
                <Info
                  label="Phone"
                  value={booking.customers?.phone}
                  icon={<Phone />}
                />
                <Info label="Event" value={booking.event_name} />
                <Info
                  label="Event date"
                  value={`${friendlyDate(booking.event_date)}${booking.event_time ? ` · ${friendlyTime(booking.event_time)}` : ''}`}
                />
                <Info
                  label="Location"
                  value={booking.event_location || 'Not added'}
                  icon={<MapPin />}
                />
                <Info
                  label="Assigned staff"
                  value={booking.staff_members?.name || 'Unassigned'}
                />
                {booking.booking_type === 'rental' && (
                  <>
                    <Info
                      label="Pickup date"
                      value={friendlyDate(booking.pickup_date)}
                    />
                    <Info
                      label="Due date"
                      value={friendlyDate(booking.due_date)}
                    />
                  </>
                )}
              </CardContent>
            </Card>
            <Card className="border-border shadow-level-1 ring-0">
              <CardHeader className="border-b">
                <CardTitle>Booking items</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead className="border-b bg-[#fcfaf7] text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3 font-medium">Item</th>
                        <th className="px-5 py-3 font-medium">Qty</th>
                        <th className="px-5 py-3 font-medium">Price</th>
                        <th className="px-5 py-3 text-right font-medium">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {booking.booking_items.map(
                        (item: {
                          id: number;
                          item_name: string;
                          quantity: number;
                          unit_price: number;
                          line_total: number;
                        }) => (
                          <tr key={item.id} className="border-b last:border-0">
                            <td className="px-5 py-4 font-medium">
                              {item.item_name}
                            </td>
                            <td className="px-5 py-4">{item.quantity}</td>
                            <td className="px-5 py-4">
                              {money(item.unit_price)}
                            </td>
                            <td className="px-5 py-4 text-right font-semibold">
                              {money(item.line_total)}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border shadow-level-1 ring-0">
              <CardHeader className="border-b">
                <CardTitle>Payments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {booking.booking_payments.length ? (
                  booking.booking_payments.map(
                    (payment: {
                      id: number;
                      payment_method: string;
                      paid_at: string;
                      reference_number: string | null;
                      amount: number;
                    }) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium capitalize">
                            {payment.payment_method.replace('_', ' ')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {friendlyDateTime(payment.paid_at)}
                            {payment.reference_number
                              ? ` · ${payment.reference_number}`
                              : ''}
                          </p>
                        </div>
                        <strong>{money(payment.amount)}</strong>
                      </div>
                    ),
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No payments recorded yet.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="border-border shadow-level-1 ring-0">
              <CardHeader className="border-b">
                <CardTitle>Terms & conditions</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-5 text-muted-foreground">
                  {BOOKING_TERMS.map((term) => (
                    <li key={term}>{term}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
          <aside className="space-y-6">
            <Card className="border-[#dfc9a6] shadow-level-1 ring-0">
              <CardHeader className="border-b bg-[#fcfaf7]">
                <CardTitle>Financial summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Amount label="Subtotal" value={booking.subtotal} />
                <Amount label="Discount" value={-booking.discount} />
                <Amount label="Tax / charges" value={booking.tax} />
                {booking.booking_type === 'rental' && (
                  <Amount
                    label="Security deposit"
                    value={booking.security_deposit}
                  />
                )}
                <div className="border-t pt-3">
                  <Amount label="Total" value={booking.total} strong />
                </div>
                <Amount label="Paid" value={booking.paid_amount} />
                <div className="rounded-lg bg-accent p-3">
                  <Amount
                    label="Balance due"
                    value={booking.balance_amount}
                    strong
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="border-border shadow-level-1 ring-0">
              <CardHeader className="border-b">
                <CardTitle>Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="relative pl-5 before:absolute before:left-0 before:top-1 before:size-2 before:rounded-full before:bg-primary"
                  >
                    <p className="text-sm font-medium">
                      {statusLabel(activity.action)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {friendlyDateTime(activity.created_at)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}

function Info({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 flex items-center gap-2 font-medium">
        {icon && <span className="text-primary [&_svg]:size-4">{icon}</span>}
        {value}
      </p>
    </div>
  );
}
function Amount({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={strong ? 'text-lg font-semibold' : 'text-sm font-semibold'}
      >
        {money(value)}
      </span>
    </div>
  );
}
