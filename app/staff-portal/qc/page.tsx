import Link from 'next/link';
import { CalendarClock, ClipboardCheck } from 'lucide-react';
import { requireDepartment } from '@/lib/staff-portal/guard';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { friendlyDate, friendlyTime } from '@/lib/bookings';
import { jobsForDepartment } from '@/lib/event-jobs/store';

export const dynamic = 'force-dynamic';

export default async function StaffQcPage() {
  const session = await requireDepartment('qc');

  // Step 5 (pre-event QC + Packing). Return QC belongs to this department too but is a
  // later build step, so this list is scoped to the pre-event quality_check/packing
  // stages for now.
  const entries = (await jobsForDepartment('qc')).filter((entry) =>
    entry.stages.some(
      (stage) => stage.key === 'quality_check' || stage.key === 'packing' || stage.key === 'return_quality_check',
    ),
  );

  return (
    <StaffPortalShell name={session.name} departments={session.departments} permissions={session.permissions} isMainId={session.isMainId}>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <DashboardHeader title="QC & Packing" subtitle="Quality-check and pack items after Warehouse preparation" />

        <Card className="border-border shadow-level-1">
          <CardContent className="p-0">
            {entries.length ? (
              <ul className="divide-y divide-border">
                {entries.map(({ job, stages }) => {
                  const onReturnQc = stages.some((stage) => stage.key === 'return_quality_check');
                  const onPacking = stages.some((stage) => stage.key === 'packing');
                  return (
                    <li key={job.id}>
                      <Link
                        href={`/staff-portal/qc/${job.id}`}
                        className="flex flex-col gap-1 p-4 transition hover:bg-[#fcfaf7] sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-medium">
                            {job.id} <span className="text-xs text-muted-foreground">· {job.bookingNumber}</span>
                          </p>
                          <p className="text-sm text-muted-foreground">{job.eventSummary.eventName}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarClock className="size-3.5" /> {friendlyDate(job.eventSummary.eventDate)} ·{' '}
                            {friendlyTime(job.eventSummary.eventTime)}
                          </p>
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                            {onReturnQc ? 'Return QC' : onPacking ? 'Packing' : 'Quality check'}
                          </Badge>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="grid min-h-56 place-items-center p-8 text-center">
                <div>
                  <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-primary">
                    <ClipboardCheck />
                  </span>
                  <h3 className="mt-4 font-semibold">No jobs waiting on QC &amp; Packing</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Jobs will appear here once Warehouse completes preparation.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </StaffPortalShell>
  );
}
