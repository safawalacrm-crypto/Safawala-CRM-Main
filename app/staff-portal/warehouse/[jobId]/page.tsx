import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CalendarDays, Check, Circle, MapPin, Route, UserRound } from 'lucide-react';
import { requireDepartment } from '@/lib/staff-portal/guard';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { Badge } from '@/components/ui/badge';
import { friendlyDate, friendlyTime } from '@/lib/bookings';
import { getJob } from '@/lib/event-jobs/store';
import { STAGE_LABEL } from '@/lib/event-jobs/constants';
import { WarehousePrepForm } from '@/components/staff-portal/warehouse-prep-form';
import { WarehousePickSlipButton } from '@/components/staff-portal/warehouse-pick-slip-button';
import { ReturnWarehouseForm } from '@/components/staff-portal/return-warehouse-form';
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
  const session = await requireDepartment('warehouse');
  const { jobId } = await params;
  const job = await getJob(jobId);
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

        <details className="group rounded-xl border bg-white shadow-level-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium">
            <span className="flex items-center gap-2"><Route className="size-4 text-[#9a6a2f]" /> Track this job</span>
            <span className="text-xs text-muted-foreground group-open:hidden">View workflow</span>
          </summary>
          <ol className="space-y-0 border-t px-5 py-3">
            {job.stages.map((jobStage, index) => {
              const done = jobStage.status === 'done';
              const current = jobStage.status === 'open' || jobStage.status === 'in_progress';
              return (
                <li key={jobStage.key} className="relative flex gap-3 pb-4 last:pb-1">
                  {index < job.stages.length - 1 ? <span className="absolute left-[9px] top-5 h-full w-px bg-border" /> : null}
                  <span className={`relative z-10 mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${done ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : current ? 'border-[#a86f2c] bg-[#f5ead8] text-[#70481c]' : 'border-border bg-white text-muted-foreground'}`}>
                    {done ? <Check className="size-3" /> : <Circle className="size-2 fill-current" />}
                  </span>
                  <span><strong className="block text-sm font-medium">{STAGE_LABEL[jobStage.key]}</strong><span className={`text-xs ${current ? 'text-[#9a6a2f]' : 'text-muted-foreground'}`}>{done ? 'Completed' : current ? 'In progress' : 'Waiting'}</span></span>
                </li>
              );
            })}
          </ol>
        </details>

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
            <h2 className="font-semibold text-emerald-800">Return receiving completed</h2>
            <p className="mt-1 text-sm text-muted-foreground">Completed by {job.returnWarehouseCheck.completedBy} on {friendlyDate(job.returnWarehouseCheck.completedAt ?? '')}</p>
          </section>
        ) : returnIsOpen && job.returnQualityCheck ? (
          <ReturnWarehouseForm jobId={job.id} items={returnItems} />
        ) : null}
      </div>
    </StaffPortalShell>
  );
}
