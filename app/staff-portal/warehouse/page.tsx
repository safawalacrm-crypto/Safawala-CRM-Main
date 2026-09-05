import Link from 'next/link';
import { Boxes, CalendarClock, CheckCircle2 } from 'lucide-react';
import { requireDepartment } from '@/lib/staff-portal/guard';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { friendlyDate, friendlyTime } from '@/lib/bookings';
import { jobsForDepartment } from '@/lib/event-jobs/store';

export const dynamic = 'force-dynamic';

export default async function StaffWarehousePage({
  searchParams,
}: {
  searchParams: Promise<{ completed?: string }>;
}) {
  const session = await requireDepartment('warehouse');
  const { completed } = await searchParams;

  // Both the pre-event picking stage (Step 4) and post-event Return Warehouse
  // (Step 12) live in this same list — the badge below tells them apart.
  const entries = (await jobsForDepartment('warehouse')).filter((entry) =>
    entry.stages.some((stage) => stage.key === 'warehouse_pick' || stage.key === 'return_warehouse'),
  );

  return (
    <StaffPortalShell name={session.name} departments={session.departments} permissions={session.permissions} isMainId={session.isMainId}>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <DashboardHeader title="Warehouse" subtitle="Pick and prepare items for upcoming events" />

        {completed ? (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="flex items-center gap-2 p-4 text-sm text-emerald-700">
              <CheckCircle2 className="size-4" /> {completed} preparation submitted — moved to QC & Packing.
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-border shadow-level-1">
          <CardContent className="p-0">
            {entries.length ? (
              <ul className="divide-y divide-border">
                {entries.map(({ job, stages }) => {
                  const isReturn = stages.some((stage) => stage.key === 'return_warehouse');
                  return (
                    <li key={job.id}>
                      <Link
                        href={`/staff-portal/warehouse/${job.id}`}
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
                            {isReturn ? 'Return' : 'Pick'}
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
                    <Boxes />
                  </span>
                  <h3 className="mt-4 font-semibold">No jobs waiting on Warehouse</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Newly confirmed bookings will appear here for picking.
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
