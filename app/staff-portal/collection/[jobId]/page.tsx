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
import { CollectionCheckForm } from '@/components/staff-portal/collection-check-form';

export const dynamic = 'force-dynamic';

export default async function CollectionJobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const session = await requireDepartment('collection');
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();

  const stage = job.stages.find((item) => item.key === 'collection');
  if (!stage) notFound();
  const isOpen = stage.status === 'open' || stage.status === 'in_progress';
  if (!isOpen && !job.collectionCheck) redirect('/staff-portal/collection');

  // Sent quantity should reflect what Warehouse actually prepared, not just what the
  // booking originally required — falls back to requiredItems if warehousePrep is
  // missing (shouldn't normally happen by the time a job reaches Collection).
  const items = job.requiredItems.map((item) => {
    const prepared = job.warehousePrep?.items.find((prep) => prep.itemName === item.itemName);
    return { itemName: item.itemName, sentQuantity: prepared?.preparedQuantity ?? item.quantity };
  });

  return (
    <StaffPortalShell name={session.name} departments={session.departments} permissions={session.permissions} isMainId={session.isMainId}>
      <div className="mx-auto max-w-[900px] space-y-6">
        <div>
          <Link
            href="/staff-portal/collection"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to Collection
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

        {job.collectionCheck ? (
          <Card className="border-emerald-200 bg-emerald-50/60">
            <CardHeader>
              <CardTitle className="text-emerald-800">Collection completed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-emerald-800">
                Completed by {job.collectionCheck.completedBy} on {friendlyDate(job.collectionCheck.completedAt ?? '')}.
                Job has moved to Return QC.
              </p>
              <ul className="space-y-2">
                {job.collectionCheck.items.map((item, index) => (
                  <li key={index} className="rounded-lg border border-emerald-200 bg-white p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{item.itemName}</p>
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        {item.returnedQuantity ?? 0} / {item.sentQuantity} returned
                      </Badge>
                    </div>
                    {item.visibleDamage || item.wrongProduct || item.clientHoldingItem || item.shortQuantity ? (
                      <p className="mt-1 text-xs text-amber-700">
                        {[
                          item.visibleDamage && 'Visible damage',
                          item.wrongProduct && 'Wrong product',
                          item.clientHoldingItem && 'Client holding item',
                          item.shortQuantity && 'Short quantity',
                        ]
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
          <CollectionCheckForm jobId={job.id} items={items} />
        )}
      </div>
    </StaffPortalShell>
  );
}
