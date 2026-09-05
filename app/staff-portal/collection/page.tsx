import Link from 'next/link';
import { CalendarClock, PackageCheck } from 'lucide-react';
import { requireDepartment } from '@/lib/staff-portal/guard';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Card, CardContent } from '@/components/ui/card';
import { friendlyDate, friendlyTime } from '@/lib/bookings';
import { jobsForDepartment } from '@/lib/event-jobs/store';

export const dynamic = 'force-dynamic';

export default async function StaffCollectionPage() {
  const session = await requireDepartment('collection');
  const entries = (await jobsForDepartment('collection')).filter((entry) =>
    entry.stages.some((stage) => stage.key === 'collection'),
  );

  return (
    <StaffPortalShell name={session.name} departments={session.departments} permissions={session.permissions} isMainId={session.isMainId}>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <DashboardHeader title="Collection" subtitle="Confirm what physically came back after the event" />

        <Card className="border-border shadow-level-1">
          <CardContent className="p-0">
            {entries.length ? (
              <ul className="divide-y divide-border">
                {entries.map(({ job }) => (
                  <li key={job.id}>
                    <Link
                      href={`/staff-portal/collection/${job.id}`}
                      className="flex flex-col gap-1 p-4 transition hover:bg-[#fcfaf7] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">
                          {job.id} <span className="text-xs text-muted-foreground">· {job.bookingNumber}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">{job.eventSummary.eventName}</p>
                      </div>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarClock className="size-3.5" /> {friendlyDate(job.eventSummary.eventDate)} ·{' '}
                        {friendlyTime(job.eventSummary.eventTime)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid min-h-56 place-items-center p-8 text-center">
                <div>
                  <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-primary">
                    <PackageCheck />
                  </span>
                  <h3 className="mt-4 font-semibold">No jobs waiting on Collection</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Jobs appear here once products are packed and ready for the event.
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
