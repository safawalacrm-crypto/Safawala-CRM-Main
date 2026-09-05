import { Activity, CalendarClock } from 'lucide-react';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { friendlyDate } from '@/lib/bookings';
import { currentStageSummary, listJobs } from '@/lib/event-jobs/store';
import { requirePermission } from '@/lib/staff-portal/guard';

export const dynamic = 'force-dynamic';

export default async function EventTrackingPage() {
  const session = await requirePermission('event_tracking');
  const jobs = await listJobs();
  return <StaffPortalShell name={session.name} departments={session.departments} permissions={session.permissions} isMainId={session.isMainId}>
    <div className="mx-auto max-w-[1440px] space-y-6">
      <DashboardHeader title="Event Tracking" subtitle="Follow every confirmed event through its operational stages" />
      <div className="grid gap-4 lg:grid-cols-2">
        {jobs.map((job) => <Card key={job.id} className="border-border shadow-level-1"><CardContent className="p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-primary">{job.id}</p><p className="text-sm text-muted-foreground">{job.bookingNumber}</p></div><Badge variant="outline" className={job.status === 'closed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}>{job.status === 'closed' ? 'Closed' : 'Active'}</Badge></div>
          <h3 className="mt-4 font-semibold">{job.eventSummary.eventName}</h3><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock className="size-3.5" />{friendlyDate(job.eventSummary.eventDate)}{job.eventSummary.venue ? ` · ${job.eventSummary.venue}` : ''}</p>
          <div className="mt-4 rounded-lg border border-border bg-[#fcfaf7] p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Current progress</p><p className="mt-1 text-sm font-medium">{currentStageSummary(job)}</p></div>
        </CardContent></Card>)}
      </div>
      {!jobs.length ? <Card className="border-border shadow-level-1"><CardContent className="grid min-h-52 place-items-center text-center"><div><Activity className="mx-auto size-9 text-primary" /><h3 className="mt-3 font-semibold">No events to track</h3><p className="mt-1 text-sm text-muted-foreground">Confirmed booking jobs will appear here automatically.</p></div></CardContent></Card> : null}
    </div>
  </StaffPortalShell>;
}
