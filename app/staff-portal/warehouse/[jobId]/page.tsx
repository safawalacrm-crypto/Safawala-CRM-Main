import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CalendarDays, MapPin, UserRound } from 'lucide-react';
import { requireDepartment } from '@/lib/staff-portal/guard';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Badge } from '@/components/ui/badge';
import { friendlyDate, friendlyTime } from '@/lib/bookings';
import { getJob } from '@/lib/event-jobs/store';
import { JobTracker } from '@/components/staff-portal/job-tracker';
import { WarehousePrepForm } from '@/components/staff-portal/warehouse-prep-form';
import { WarehousePickSlipButton } from '@/components/staff-portal/warehouse-pick-slip-button';
import { ReturnWarehouseForm } from '@/components/staff-portal/return-warehouse-form';
import { ReturnWarehouseSlipButton } from '@/components/staff-portal/return-slips';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type BookingContext = {
  booking_number: string;
  event_name: string;
  event_date: string;
  event_time: string | null;
  event_location: string | null;
  pickup_date: string | null;
  due_date: string | null;
  contact_name: string | null;
  alternate_mobile: string | null;
  customers: { name: string; phone: string } | { name: string; phone: string }[] | null;
  booking_items: {
    item_name: string;
    quantity: number;
    products: { barcode: string | null } | { barcode: string | null }[] | null;
  }[];
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function WarehouseJobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const [session, job] = await Promise.all([requireDepartment('warehouse'), getJob(jobId)]);
  if (!job) notFound();
  if (job.bookingType !== 'rental') redirect('/staff-portal/warehouse');

  const stage = job.stages.find((item) => item.key === 'warehouse_pick');
  const returnStage = job.stages.find((item) => item.key === 'return_warehouse');
  if (!stage || !returnStage) notFound();
  const isOpen = stage.status === 'open' || stage.status === 'in_progress';
  const returnIsOpen = returnStage.status === 'open' || returnStage.status === 'in_progress';
  if (!isOpen && !job.warehousePrep && !returnIsOpen && !job.returnWarehouseCheck) {
    redirect('/staff-portal/warehouse');
  }

  const admin = createAdminClient();
  const { data: bookingData } = await admin
    .from('bookings')
    .select('booking_number,event_name,event_date,event_time,event_location,pickup_date,due_date,contact_name,alternate_mobile,customers(name,phone),booking_items(item_name,quantity,products(barcode))')
    .eq('id', job.bookingId)
    .single();
  const booking = bookingData as BookingContext | null;
  const customer = firstRelation(booking?.customers);
  const pickItems = booking?.booking_items?.length
    ? booking.booking_items.map((item) => {
        const product = firstRelation(item.products);
        return {
          itemName: item.item_name,
          quantity: Number(item.quantity),
          barcode: product?.barcode ?? null,
        };
      })
    : job.requiredItems.map((item) => ({ ...item, barcode: null }));
  const slipDetails = {
    jobId: job.id,
    bookingNumber: job.bookingNumber,
    customerName: customer?.name ?? booking?.contact_name ?? 'Customer',
    customerPhone: booking?.alternate_mobile ?? customer?.phone ?? '',
    eventName: booking?.event_name ?? job.eventSummary.eventName,
    eventDate: booking?.event_date ?? job.eventSummary.eventDate,
    eventTime: booking?.event_time ?? job.eventSummary.eventTime,
    venue: booking?.event_location ?? job.eventSummary.venue,
  };

  const returnItems = (job.returnQualityCheck?.items ?? []).map((item) => {
    const collected = job.collectionCheck?.items.find((entry) => entry.itemName === item.itemName);
    return {
      itemName: item.itemName,
      usableQuantity: item.goodQuantity ?? 0,
      damagedRepairQuantity: item.damagedQuantity ?? 0,
      missingLostQuantity: collected ? Math.max(collected.sentQuantity - (collected.returnedQuantity ?? 0), 0) : 0,
    };
  });

  return (
    <StaffPortalShell
      name={session.name}
      departments={session.departments}
      permissions={session.permissions}
      accessModules={session.accessModules}
      isMainId={session.isMainId}
    >
      <div className="mx-auto max-w-[900px] space-y-5">
        <DashboardHeader title="Warehouse job" subtitle={`${job.id} · ${slipDetails.customerName}`} />
        <Link href="/staff-portal/warehouse" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to warehouse
        </Link>

        <section className="rounded-2xl border border-[#dfd3c3] bg-white p-5 shadow-level-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">{slipDetails.customerName}</h1>
                <Badge variant="outline" className="border-[#e4d2b6] bg-[#f5ead8] text-[#70481c]">Rental picking</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{job.id} · {job.bookingNumber}</p>
            </div>
            <p className="text-sm font-medium text-[#70481c]">{pickItems.length} item{pickItems.length === 1 ? '' : 's'}</p>
          </div>
          <div className="mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
            <p className="flex items-start gap-2"><UserRound className="mt-0.5 size-4 text-[#9a6a2f]" /><span><strong className="block font-medium">{slipDetails.eventName}</strong><span className="text-muted-foreground">{slipDetails.customerPhone || 'No alternate number'}</span></span></p>
            <p className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-4 text-[#9a6a2f]" /><span><strong className="block font-medium">{friendlyDate(slipDetails.eventDate)}</strong><span className="text-muted-foreground">{slipDetails.eventTime ? friendlyTime(slipDetails.eventTime) : 'Time not added'}</span></span></p>
            {slipDetails.venue ? <p className="flex items-center gap-2 text-muted-foreground sm:col-span-2"><MapPin className="size-4 text-[#9a6a2f]" /> {slipDetails.venue}</p> : null}
          </div>
        </section>

        <JobTracker stages={job.stages} />

        {job.warehousePrep ? (
          <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-level-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-semibold text-emerald-800">Picking completed</h2><p className="mt-1 text-sm text-muted-foreground">Completed by {job.warehousePrep.completedBy} on {friendlyDate(job.warehousePrep.completedAt ?? '')}</p></div>
              <WarehousePickSlipButton
                details={slipDetails}
                items={job.warehousePrep.items.map((item) => ({ itemName: item.itemName, quantity: item.requiredQuantity, barcode: pickItems.find((entry) => entry.itemName === item.itemName)?.barcode ?? null, picked: (item.preparedQuantity ?? 0) > 0 }))}
              />
            </div>
            <ul className="mt-4 divide-y rounded-xl border">
              {job.warehousePrep.items.map((item) => (
                <li key={item.itemName} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
                  <span className="font-medium">{item.itemName}</span>
                  <Badge variant="outline" className={(item.preparedQuantity ?? 0) > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}>
                    {(item.preparedQuantity ?? 0) > 0 ? 'Picked' : 'Not picked'}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        ) : isOpen ? (
          <WarehousePrepForm jobId={job.id} items={pickItems} details={slipDetails} />
        ) : null}

        {job.returnWarehouseCheck ? (
          <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-level-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-semibold text-emerald-800">Return receiving completed</h2><p className="mt-1 text-sm text-muted-foreground">Received from {job.returnWarehouseCheck.receivedFrom ?? 'QC'} by {job.returnWarehouseCheck.completedBy} on {friendlyDate(job.returnWarehouseCheck.completedAt ?? '')}. Sent to Booking Final Check.</p></div>
              <ReturnWarehouseSlipButton
                details={{ ...slipDetails, completedBy: job.returnWarehouseCheck.completedBy ?? session.name, completedAt: job.returnWarehouseCheck.completedAt ?? job.updatedAt }}
                items={job.returnWarehouseCheck.items.map((item) => ({ ...item, storageLocation: item.storageLocation ?? '' }))}
              />
            </div>
            <ul className="mt-4 divide-y rounded-xl border">
              {job.returnWarehouseCheck.items.map((item) => (
                <li key={item.itemName} className="flex flex-col gap-1 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium">{item.itemName}</span>
                  <span className="text-muted-foreground">{item.usableQuantity} usable · {item.damagedRepairQuantity} repair · {item.missingLostQuantity} missing · {item.storageLocation || 'No location'}</span>
                </li>
              ))}
            </ul>
            {job.returnWarehouseCheck.receivingNotes ? <p className="mt-3 rounded-lg bg-[#fcfaf7] p-3 text-sm text-muted-foreground">{job.returnWarehouseCheck.receivingNotes}</p> : null}
          </section>
        ) : returnIsOpen && job.returnQualityCheck ? (
          <ReturnWarehouseForm jobId={job.id} items={returnItems} />
        ) : null}
      </div>
    </StaffPortalShell>
  );
}
