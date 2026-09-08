import Link from 'next/link';
import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CalendarDays, MapPin, PackageCheck, UserRound } from 'lucide-react';
import { requireDepartment } from '@/lib/staff-portal/guard';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Badge } from '@/components/ui/badge';
import { friendlyDate, friendlyTime } from '@/lib/bookings';
import { getJob } from '@/lib/event-jobs/store';
import { JobTracker } from '@/components/staff-portal/job-tracker';
import { QualityCheckForm } from '@/components/staff-portal/quality-check-form';
import { PackingChecklistForm } from '@/components/staff-portal/packing-checklist-form';
import { PackingSlipButton } from '@/components/staff-portal/packing-slip-button';
import { ReturnQualityCheckForm } from '@/components/staff-portal/return-quality-check-form';
import { ReturnQcSlipButton } from '@/components/staff-portal/return-slips';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type Relation<T> = T | T[] | null;
type BookingContext = {
  event_name: string;
  event_date: string;
  event_time: string | null;
  event_location: string | null;
  contact_name: string | null;
  alternate_mobile: string | null;
  customers: Relation<{ name: string; phone: string }>;
  booking_items: {
    item_name: string;
    quantity: number;
    products: Relation<{ barcode: string | null }>;
  }[];
};

function firstRelation<T>(value: Relation<T> | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function QcJobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const [session, job] = await Promise.all([requireDepartment('qc'), getJob(jobId)]);
  if (!job) notFound();
  if (job.bookingType !== 'rental') redirect('/staff-portal/qc');

  const qcStage = job.stages.find((stage) => stage.key === 'quality_check');
  const packingStage = job.stages.find((stage) => stage.key === 'packing');
  const returnQcStage = job.stages.find((stage) => stage.key === 'return_quality_check');
  if (!qcStage || !packingStage || !returnQcStage) notFound();

  const qcOpen = qcStage.status === 'open' || qcStage.status === 'in_progress';
  const packingOpen = packingStage.status === 'open' || packingStage.status === 'in_progress';
  const returnQcOpen = returnQcStage.status === 'open' || returnQcStage.status === 'in_progress';
  if (!qcOpen && !packingOpen && !returnQcOpen && !job.qualityCheck && !job.packingChecklist && !job.returnQualityCheck) {
    redirect('/staff-portal/qc');
  }

  const admin = createAdminClient();
  const { data: bookingData } = await admin
    .from('bookings')
    .select('event_name,event_date,event_time,event_location,contact_name,alternate_mobile,customers(name,phone),booking_items(item_name,quantity,products(barcode))')
    .eq('id', job.bookingId)
    .single();
  const booking = bookingData as BookingContext | null;
  const customer = firstRelation(booking?.customers);
  const barcodeByItem = new Map(
    (booking?.booking_items ?? []).map((item) => [item.item_name, firstRelation(item.products)?.barcode ?? null]),
  );
  const qcItems = (job.warehousePrep?.items ?? job.requiredItems.map((item) => ({
    itemName: item.itemName,
    requiredQuantity: item.quantity,
    preparedQuantity: item.quantity,
  })))
    .filter((item) => (item.preparedQuantity ?? 0) > 0)
    .map((item) => ({
      itemName: item.itemName,
      quantity: item.preparedQuantity ?? 0,
      barcode: barcodeByItem.get(item.itemName) ?? null,
    }));
  const packedItems = (job.qualityCheck?.items ?? [])
    .filter((item) => (item.goodQuantity ?? 0) > 0)
    .map((item) => ({
      itemName: item.itemName,
      quantity: item.goodQuantity ?? 0,
      barcode: barcodeByItem.get(item.itemName) ?? null,
    }));
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
  const proofPaths = job.packingChecklist?.proofPhotoPaths ?? [];
  const proofPhotoUrls = proofPaths.length
    ? (await admin.storage.from('event-operation-files').createSignedUrls(proofPaths, 60 * 60)).data
        ?.map((item) => item.signedUrl)
        .filter((url): url is string => typeof url === 'string' && url.length > 0) ?? []
    : [];
  const returnProofPaths = job.returnQualityCheck?.proofPhotoPaths ?? [];
  const returnProofPhotoUrls = returnProofPaths.length
    ? (await admin.storage.from('event-operation-files').createSignedUrls(returnProofPaths, 60 * 60)).data
        ?.map((item) => item.signedUrl)
        .filter((url): url is string => typeof url === 'string' && url.length > 0) ?? []
    : [];
  const returnQcItems = (job.collectionCheck?.items ?? []).map((item) => ({
    itemName: item.itemName,
    returnedQuantity: item.returnedQuantity ?? 0,
  }));

  return (
    <StaffPortalShell
      name={session.name}
      departments={session.departments}
      permissions={session.permissions}
      accessModules={session.accessModules}
      isMainId={session.isMainId}
    >
      <div className="mx-auto max-w-[900px] space-y-5">
        <DashboardHeader title="QC & Packing job" subtitle={`${job.id} · ${slipDetails.customerName}`} />
        <Link href="/staff-portal/qc" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to QC &amp; Packing
        </Link>

        <section className="rounded-2xl border border-[#dfd3c3] bg-white dark:bg-card p-5 shadow-level-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">{slipDetails.customerName}</h1>
                <Badge variant="outline" className="border-[#e4d2b6] bg-[#f5ead8] text-[#70481c]">Rental QC</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{job.id} · {job.bookingNumber}</p>
            </div>
            <p className="text-sm font-medium text-[#70481c]">{qcItems.length} product{qcItems.length === 1 ? '' : 's'}</p>
          </div>
          <div className="mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
            <p className="flex items-start gap-2"><UserRound className="mt-0.5 size-4 text-[#9a6a2f]" /><span><strong className="block font-medium">{slipDetails.eventName}</strong><span className="text-muted-foreground">{slipDetails.customerPhone || 'No alternate number'}</span></span></p>
            <p className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-4 text-[#9a6a2f]" /><span><strong className="block font-medium">{friendlyDate(slipDetails.eventDate)}</strong><span className="text-muted-foreground">{slipDetails.eventTime ? friendlyTime(slipDetails.eventTime) : 'Time not added'}</span></span></p>
            {slipDetails.venue ? <p className="flex items-center gap-2 text-muted-foreground sm:col-span-2"><MapPin className="size-4 text-[#9a6a2f]" /> {slipDetails.venue}</p> : null}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2 rounded-xl border bg-white dark:bg-card p-2 shadow-level-1">
          <div className={`rounded-lg px-3 py-2.5 text-center text-sm font-medium ${job.qualityCheck ? 'bg-emerald-50 text-emerald-700' : qcOpen ? 'bg-[#a86f2c] text-white' : 'bg-muted text-muted-foreground'}`}>
            {job.qualityCheck ? '✓ QC passed' : 'Quality check'}
          </div>
          <div className={`rounded-lg px-3 py-2.5 text-center text-sm font-medium ${job.packingChecklist ? 'bg-emerald-50 text-emerald-700' : packingOpen ? 'bg-[#a86f2c] text-white' : 'bg-muted text-muted-foreground'}`}>
            {job.packingChecklist ? '✓ Packed' : 'Packing'}
          </div>
        </div>

        <JobTracker stages={job.stages} />

        {job.qualityCheck ? (
          <section className="rounded-2xl border border-emerald-200 bg-white dark:bg-card p-5 shadow-level-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-semibold text-emerald-800">Quality check completed</h2><p className="mt-1 text-sm text-muted-foreground">Completed by {job.qualityCheck.completedBy} on {friendlyDate(job.qualityCheck.completedAt ?? '')}</p></div>
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{packedItems.length} passed</Badge>
            </div>
          </section>
        ) : qcOpen ? <QualityCheckForm jobId={job.id} items={qcItems} /> : null}

        {job.qualityCheck && !job.packingChecklist && packingOpen ? <PackingChecklistForm jobId={job.id} details={slipDetails} items={packedItems} /> : null}

        {job.packingChecklist ? (
          <section className="rounded-2xl border border-emerald-200 bg-white dark:bg-card p-5 shadow-level-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-semibold text-emerald-800">Packing completed</h2><p className="mt-1 text-sm text-muted-foreground">Completed by {job.packingChecklist.completedBy} on {friendlyDate(job.packingChecklist.completedAt ?? '')}</p></div>
              <PackingSlipButton details={slipDetails} items={packedItems} />
            </div>
            {proofPhotoUrls.length ? (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium">Packing proof</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {proofPhotoUrls.map((url, index) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border bg-muted">
                      <span className="relative block aspect-square">
                        <Image src={url} alt={`Packing proof ${index + 1}`} fill sizes="(max-width: 640px) 50vw, 240px" className="object-cover" />
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {job.returnQualityCheck ? (
          <section className="rounded-2xl border border-emerald-200 bg-white dark:bg-card p-5 shadow-level-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-semibold text-emerald-800">Return QC completed</h2><p className="mt-1 text-sm text-muted-foreground">Completed by {job.returnQualityCheck.completedBy} on {friendlyDate(job.returnQualityCheck.completedAt ?? '')}. Sent to Return Warehouse.</p></div>
              <ReturnQcSlipButton
                details={{ ...slipDetails, completedBy: job.returnQualityCheck.completedBy ?? session.name, completedAt: job.returnQualityCheck.completedAt ?? job.updatedAt }}
                items={job.returnQualityCheck.items.map((item) => ({ itemName: item.itemName, returnedQuantity: item.returnedQuantity, goodQuantity: item.goodQuantity ?? 0, damagedQuantity: item.damagedQuantity ?? 0, remarks: item.remarks }))}
              />
            </div>
            {returnProofPhotoUrls.length ? (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {returnProofPhotoUrls.map((url, index) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border bg-muted">
                    <span className="relative block aspect-square"><Image src={url} alt={`Return QC issue proof ${index + 1}`} fill sizes="(max-width: 640px) 50vw, 240px" className="object-cover" /></span>
                  </a>
                ))}
              </div>
            ) : null}
          </section>
        ) : returnQcOpen ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1"><PackageCheck className="size-5 text-[#9a6a2f]" /><h2 className="font-semibold">Return quality check</h2></div>
            <ReturnQualityCheckForm jobId={job.id} items={returnQcItems} />
          </section>
        ) : null}
      </div>
    </StaffPortalShell>
  );
}
