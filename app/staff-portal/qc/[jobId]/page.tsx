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
import { QualityCheckForm } from '@/components/staff-portal/quality-check-form';
import { PackingChecklistForm } from '@/components/staff-portal/packing-checklist-form';
import { ReturnQualityCheckForm } from '@/components/staff-portal/return-quality-check-form';

export const dynamic = 'force-dynamic';

const ISSUE_LABEL: Record<string, string> = {
  none: 'No issue',
  stain: 'Stain',
  tear: 'Tear',
  missing_part: 'Missing part',
  other: 'Other',
};

export default async function QcJobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const session = await requireDepartment('qc');
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();

  const qcStage = job.stages.find((stage) => stage.key === 'quality_check');
  const packingStage = job.stages.find((stage) => stage.key === 'packing');
  const returnQcStage = job.stages.find((stage) => stage.key === 'return_quality_check');
  if (!qcStage || !packingStage || !returnQcStage) notFound();

  const hasWork =
    qcStage.status === 'open' ||
    qcStage.status === 'in_progress' ||
    packingStage.status === 'open' ||
    packingStage.status === 'in_progress' ||
    returnQcStage.status === 'open' ||
    returnQcStage.status === 'in_progress' ||
    Boolean(job.qualityCheck) ||
    Boolean(job.packingChecklist) ||
    Boolean(job.returnQualityCheck);
  if (!hasWork) redirect('/staff-portal/qc');

  const returnQcOpen = returnQcStage.status === 'open' || returnQcStage.status === 'in_progress';
  const returnQcItems = (job.collectionCheck?.items ?? []).map((item) => ({
    itemName: item.itemName,
    returnedQuantity: item.returnedQuantity ?? 0,
  }));

  return (
    <StaffPortalShell name={session.name} departments={session.departments} permissions={session.permissions} isMainId={session.isMainId}>
      <div className="mx-auto max-w-[900px] space-y-6">
        <div>
          <Link
            href="/staff-portal/qc"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to QC &amp; Packing
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

        {!job.warehousePrep ? (
          <Card className="border-amber-200 bg-amber-50/60">
            <CardContent className="p-4 text-sm text-amber-800">
              Warehouse preparation details are not available for this job, but the stage has reached QC — you can
              still record the quality check below.
            </CardContent>
          </Card>
        ) : null}

        {job.qualityCheck ? (
          <Card className="border-emerald-200 bg-emerald-50/60">
            <CardHeader>
              <CardTitle className="text-emerald-800">Quality check completed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-emerald-800">
                Completed by {job.qualityCheck.completedBy} on {friendlyDate(job.qualityCheck.completedAt ?? '')}.
              </p>
              <ul className="space-y-2">
                {job.qualityCheck.items.map((item, index) => (
                  <li key={index} className="rounded-lg border border-emerald-200 bg-white p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{item.itemName}</p>
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        {item.goodQuantity ?? 0} / {item.checkedQuantity ?? 0} good
                      </Badge>
                    </div>
                    {item.issueType !== 'none' ? (
                      <p className="mt-1 text-xs text-amber-700">Issue: {ISSUE_LABEL[item.issueType]}</p>
                    ) : null}
                    {item.remarks ? <p className="mt-1 text-xs text-muted-foreground">{item.remarks}</p> : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <QualityCheckForm jobId={job.id} items={job.requiredItems} />
        )}

        {job.qualityCheck && !job.packingChecklist ? <PackingChecklistForm jobId={job.id} /> : null}

        {job.packingChecklist ? (
          <Card className="border-emerald-200 bg-emerald-50/60">
            <CardHeader>
              <CardTitle className="text-emerald-800">Packing completed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-emerald-800">
                Completed by {job.packingChecklist.completedBy} on{' '}
                {friendlyDate(job.packingChecklist.completedAt ?? '')}. Products are ready for the event.
              </p>
              {job.packingChecklist.remarks ? (
                <p className="mt-1 text-xs text-muted-foreground">{job.packingChecklist.remarks}</p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {job.returnQualityCheck ? (
          <Card className="border-emerald-200 bg-emerald-50/60">
            <CardHeader>
              <CardTitle className="text-emerald-800">Return QC completed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-emerald-800">
                Completed by {job.returnQualityCheck.completedBy} on{' '}
                {friendlyDate(job.returnQualityCheck.completedAt ?? '')}. Job has moved to Return Warehouse.
              </p>
              <ul className="space-y-2">
                {job.returnQualityCheck.items.map((item, index) => (
                  <li key={index} className="rounded-lg border border-emerald-200 bg-white p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{item.itemName}</p>
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        {item.goodQuantity ?? 0} good / {item.damagedQuantity ?? 0} damaged
                      </Badge>
                    </div>
                    {item.repairRequired || item.unusable ? (
                      <p className="mt-1 text-xs text-amber-700">
                        {[item.repairRequired && 'Repair required', item.unusable && 'Unusable']
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
        ) : returnQcOpen ? (
          <ReturnQualityCheckForm jobId={job.id} items={returnQcItems} />
        ) : null}
      </div>
    </StaffPortalShell>
  );
}
