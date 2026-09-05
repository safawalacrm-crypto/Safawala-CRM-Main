import Link from 'next/link';
import { ArrowLeft, CalendarClock, CheckCircle2, MapPin } from 'lucide-react';
import { requireDepartment } from '@/lib/staff-portal/guard';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { friendlyDate, friendlyTime } from '@/lib/bookings';
import { assignedJobsForStylist } from '@/lib/event-jobs/store';
import type { ExecutionAction } from '@/lib/event-jobs/store';
import type { StylistExecutionStatus } from '@/lib/event-jobs/types';
import { recordExecutionAction } from '@/app/staff-portal/stylist/execution-actions';

export const dynamic = 'force-dynamic';

const NEXT_ACTION: Record<StylistExecutionStatus, { action: ExecutionAction; label: string } | null> = {
  not_started: { action: 'reached_venue', label: 'Reached Venue' },
  reached_venue: { action: 'start_work', label: 'Start Work' },
  work_started: { action: 'complete_work', label: 'Complete Work' },
  work_completed: null,
};

const STATUS_LABEL: Record<StylistExecutionStatus, string> = {
  not_started: 'Not started',
  reached_venue: 'Reached venue',
  work_started: 'Work in progress',
  work_completed: 'Work completed',
};

export default async function StylistAssignedEventsPage() {
  const session = await requireDepartment('stylist');
  const jobs = await assignedJobsForStylist(session.id);

  return (
    <StaffPortalShell name={session.name} departments={session.departments} permissions={session.permissions} isMainId={session.isMainId}>
      <div className="mx-auto max-w-[1080px] space-y-6">
        <div>
          <Link
            href="/staff-portal/stylist"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to opportunities
          </Link>
        </div>
        <DashboardHeader title="My Assigned Events" subtitle="Approved assignments and clearly marked backup events" />

        {jobs.length ? (
          <div className="space-y-6">
            {jobs.map((job) => {
              const interest = job.stylistInterests.find((entry) => entry.stylistAccountId === session.id);
              const isBackup = interest?.status === 'backup';
              const plan = job.travelPlans.find((entry) => entry.interestId === interest?.id);
              const execution = job.stylistExecutions.find((entry) => entry.stylistAccountId === session.id);
              const status: StylistExecutionStatus = execution?.status ?? 'not_started';
              const next = NEXT_ACTION[status];

              return (
                <Card key={job.id} className="border-border shadow-level-1">
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{job.eventSummary.eventName}</CardTitle>
                      {isBackup ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Backup stylist</Badge> : null}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <CalendarClock className="size-3.5" /> {friendlyDate(job.eventSummary.eventDate)} ·{' '}
                        {friendlyTime(job.eventSummary.eventTime)}
                      </span>
                      {job.eventSummary.venue ? (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="size-3.5" /> {job.eventSummary.venue}
                        </span>
                      ) : null}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {plan?.ticketConfirmedAt ? (
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                        <CheckCircle2 className="size-4" /> Your ticket is confirmed and has been sent to you on WhatsApp.
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Ticket confirmation is pending. You will receive a private notification when it is confirmed.
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Event-day status</p>
                        <Badge
                          variant="outline"
                          className={
                            status === 'work_completed'
                              ? 'mt-1 border-emerald-200 bg-emerald-50 text-emerald-700'
                              : status === 'not_started'
                                ? 'mt-1 border-stone-200 bg-stone-50 text-stone-600'
                                : 'mt-1 border-amber-200 bg-amber-50 text-amber-800'
                          }
                        >
                          {isBackup ? 'Backup — awaiting activation' : STATUS_LABEL[status]}
                        </Badge>
                      </div>
                      {next && !isBackup ? (
                        <form action={recordExecutionAction} className="flex items-center gap-2">
                          <input type="hidden" name="jobId" value={job.id} />
                          <input type="hidden" name="action" value={next.action} />
                          <Button type="submit" size="sm">
                            {next.label}
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-border shadow-level-1">
            <CardContent className="grid min-h-56 place-items-center p-8 text-center">
              <div>
                <p className="font-semibold">No approved assignments yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Once admin approves your interest in an event, it will appear here.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </StaffPortalShell>
  );
}
