import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CalendarClock, MapPin } from 'lucide-react';
import { requireDepartment } from '@/lib/staff-portal/guard';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { friendlyDate, friendlyTime } from '@/lib/bookings';
import { getJob } from '@/lib/event-jobs/store';
import { WarehousePrepForm } from '@/components/staff-portal/warehouse-prep-form';
import { ReturnWarehouseForm } from '@/components/staff-portal/return-warehouse-form';

export const dynamic = 'force-dynamic';

export default async function WarehouseJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const session = await requireDepartment('warehouse');
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();

  const stage = job.stages.find((item) => item.key === 'warehouse_pick');
  const returnStage = job.stages.find((item) => item.key === 'return_warehouse');
  if (!stage || !returnStage) notFound();
  const isOpen = stage.status === 'open' || stage.status === 'in_progress';
  const returnIsOpen = returnStage.status === 'open' || returnStage.status === 'in_progress';

  if (!isOpen && !job.warehousePrep && !returnIsOpen && !job.returnWarehouseCheck) {
    // Nothing to do here yet and nothing was ever submitted — send the staff member
    // back to the list rather than showing a broken/empty screen.
    redirect('/staff-portal/warehouse');
  }

  // Pre-fill Return Warehouse from Return QC's good/damaged split, and missing/lost
  // from Collection's sent-vs-returned gap — staff confirm rather than re-type.
  const returnItems = (job.returnQualityCheck?.items ?? []).map((item) => {
    const collected = job.collectionCheck?.items.find((entry) => entry.itemName === item.itemName);
    const missingLostQuantity = collected ? Math.max(collected.sentQuantity - (collected.returnedQuantity ?? 0), 0) : 0;
    return {
      itemName: item.itemName,
      usableQuantity: item.goodQuantity ?? 0,
      damagedRepairQuantity: item.damagedQuantity ?? 0,
      missingLostQuantity,
    };
  });

  return (
    <StaffPortalShell name={session.name} departments={session.departments} permissions={session.permissions} isMainId={session.isMainId}>
      <div className="mx-auto max-w-[900px] space-y-6">
        <div>
          <Link
            href="/staff-portal/warehouse"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to Warehouse
          </Link>
        </div>
        <DashboardHeader title={job.id} subtitle={`${job.eventSummary.eventName} · ${job.bookingNumber}`} />

        <Card className="border-border shadow-level-1">
          <CardHeader>
            <CardTitle>Event details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarClock className="size-4" /> {friendlyDate(job.eventSummary.eventDate)} ·{' '}
              {friendlyTime(job.eventSummary.eventTime)}
            </p>
            {job.eventSummary.venue ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4" /> {job.eventSummary.venue}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {job.warehousePrep ? (
          <Card className="border-emerald-200 bg-emerald-50/60">
            <CardHeader>
              <CardTitle className="text-emerald-800">Preparation completed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-emerald-800">
                Completed by {job.warehousePrep.completedBy} on {friendlyDate(job.warehousePrep.completedAt ?? '')}.
                This job has moved to QC &amp; Packing.
              </p>
              <ul className="space-y-2">
                {job.warehousePrep.items.map((item, index) => (
                  <li key={index} className="rounded-lg border border-emerald-200 bg-white p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{item.itemName}</p>
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        {item.preparedQuantity ?? 0} / {item.requiredQuantity} prepared
                      </Badge>
                    </div>
                    {item.unavailable || item.damaged || item.otherIssue ? (
                      <p className="mt-1 text-xs text-amber-700">
                        {[item.unavailable && 'Unavailable', item.damaged && 'Damaged', item.otherIssue]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    ) : null}
                    {item.remarks ? <p className="mt-1 text-xs text-muted-foreground">{item.remarks}</p> : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <WarehousePrepForm jobId={job.id} items={job.requiredItems} />
        )}

        {job.returnWarehouseCheck ? (
          <Card className="border-emerald-200 bg-emerald-50/60">
            <CardHeader>
              <CardTitle className="text-emerald-800">Return Warehouse completed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-emerald-800">
                Completed by {job.returnWarehouseCheck.completedBy} on{' '}
                {friendlyDate(job.returnWarehouseCheck.completedAt ?? '')}. Job has moved to Booking Final Check.
              </p>
              <ul className="space-y-2">
                {job.returnWarehouseCheck.items.map((item, index) => (
                  <li key={index} className="rounded-lg border border-emerald-200 bg-white p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{item.itemName}</p>
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        {item.usableQuantity} usable
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.damagedRepairQuantity} damaged/repair · {item.missingLostQuantity} missing/lost
                    </p>
                    {item.remarks ? <p className="mt-1 text-xs text-muted-foreground">{item.remarks}</p> : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : returnIsOpen && job.returnQualityCheck ? (
          <ReturnWarehouseForm jobId={job.id} items={returnItems} />
        ) : null}
      </div>
    </StaffPortalShell>
  );
}
