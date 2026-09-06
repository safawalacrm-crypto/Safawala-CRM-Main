import Link from 'next/link';
import { CalendarClock, MapPin, Sparkles } from 'lucide-react';
import { requireStylistSession } from '@/lib/staff-portal/guard';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { friendlyDate, friendlyTime } from '@/lib/bookings';
import { stylistJobsForAccount } from '@/lib/event-jobs/store';
import { unreadCountForSession } from '@/lib/notifications/store';
import type { StylistInterestStatus } from '@/lib/event-jobs/types';
import { StylistInterestButton } from '@/components/staff-portal/stylist-interest-button';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<StylistInterestStatus, string> = {
  interested: 'Interested — pending admin approval',
  approved: 'Approved',
  rejected: 'Not selected',
  backup: 'Backup',
};

const STATUS_TONE: Record<StylistInterestStatus, string> = {
  interested: 'border-amber-200 bg-amber-50 text-amber-800',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-stone-200 bg-stone-50 text-stone-600',
  backup: 'border-sky-200 bg-sky-50 text-sky-700',
};

export default async function StaffStylistPage() {
  const session = await requireStylistSession();
  const jobs = await stylistJobsForAccount(session.id);
  const activeDepartments = session.departments.filter((grant) => grant.active).map((grant) => grant.department);
  const notificationCount = await unreadCountForSession(session.id, activeDepartments);

  return (
    <StaffPortalShell name={session.name} departments={session.departments} permissions={session.permissions} accessModules={session.accessModules} isMainId={session.isMainId} notificationCount={notificationCount}>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <DashboardHeader title="Stylist" subtitle="Available events — mark yourself as interested and available" />

        <div className="flex justify-end">
          <Link href="/staff-portal/stylist/assigned" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            My Assigned Events
          </Link>
        </div>

        <Card className="border-border shadow-level-1">
          <CardContent className="p-0">
            {jobs.length ? (
              <ul className="divide-y divide-border">
                {jobs.map((job) => {
                  const myInterest = job.stylistInterests.find((interest) => interest.stylistAccountId === session.id);
                  const interestedCount = job.stylistInterests.filter((interest) => interest.status === 'interested').length;
                  const rentalQuantity = job.requiredItems.reduce((sum, item) => sum + item.quantity, 0);
                  return (
                    <li key={job.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{job.eventSummary.eventName}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <CalendarClock className="size-3.5" /> {friendlyDate(job.eventSummary.eventDate)} ·{' '}
                            {friendlyTime(job.eventSummary.eventTime)}
                          </span>
                          {job.eventSummary.venue ? (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="size-3.5" /> {job.eventSummary.venue}
                            </span>
                          ) : null}
                          <span>
                            {rentalQuantity} rental items
                          </span>
                          <span>
                            {job.stylistsRequiredCount} required · {interestedCount} interested
                          </span>
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" render={<Link href={`/staff-portal/stylist/${job.id}`} />}>View details</Button>
                        {myInterest ? <Badge variant="outline" className={STATUS_TONE[myInterest.status]}>{STATUS_LABEL[myInterest.status]}</Badge> : <StylistInterestButton jobId={job.id} />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="grid min-h-56 place-items-center p-8 text-center">
                <div>
                  <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-primary">
                    <Sparkles />
                  </span>
                  <h3 className="mt-4 font-semibold">No open styling opportunities right now</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    New confirmed bookings that need a stylist will appear here.
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
