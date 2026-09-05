import Link from 'next/link';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { CalendarClock, CheckCircle2, Clock3, MapPin, PlaneTakeoff, UserCheck, UsersRound } from 'lucide-react';
import { decideInterestAction, setStylistsRequiredAction } from '@/app/stylist-approvals/actions';
import { BookingPortalShell } from '@/components/bookings/booking-portal-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { friendlyDate, friendlyTime } from '@/lib/bookings';
import { listJobs } from '@/lib/event-jobs/store';
import type { StylistInterestStatus } from '@/lib/event-jobs/types';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<StylistInterestStatus, string> = {
  interested: 'border-amber-200 bg-amber-50 text-amber-800',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-stone-200 bg-stone-50 text-stone-600',
  backup: 'border-sky-200 bg-sky-50 text-sky-700',
};

export default async function StylistApprovalsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const jobs = (await listJobs())
    .filter((job) => job.status === 'active' && job.bookingType === 'rental' && job.stylistsRequired)
    .sort((a, b) => a.eventSummary.eventDate.localeCompare(b.eventSummary.eventDate));
  const interests = jobs.flatMap((job) => job.stylistInterests);
  const awaiting = interests.filter((interest) => interest.status === 'interested').length;
  const approved = interests.filter((interest) => interest.status === 'approved').length;

  return <BookingPortalShell email={auth.user.email ?? 'Safawala user'}>
    <div className="mx-auto max-w-[1180px] space-y-5">
      <DashboardHeader title="Stylist Approvals" subtitle="Select stylists for rental events and arrange their travel" />

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary icon={<CalendarClock />} label="Rental events" value={jobs.length} />
        <Summary icon={<Clock3 />} label="Awaiting decision" value={awaiting} />
        <Summary icon={<UserCheck />} label="Selected stylists" value={approved} />
      </div>

      {jobs.length ? <div className="space-y-5">{jobs.map((job) => {
        const approvedCount = job.stylistInterests.filter((interest) => interest.status === 'approved').length;
        const filled = approvedCount >= job.stylistsRequiredCount;
        return <Card key={job.id} className="gap-0 overflow-hidden border-border py-0 shadow-level-1">
          <CardHeader className="border-b border-[#e8dccb] bg-[#fcfaf7] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-[#dfc6a4] bg-[#f5ead8] text-[#70481c]">Rental</Badge><Link href={`/event-jobs/${job.id}`} className="font-semibold text-primary hover:underline">{job.id}</Link><span className="text-sm text-muted-foreground">{job.bookingNumber}</span></div>
                <CardTitle className="mt-2 text-lg">{job.eventSummary.eventName}</CardTitle>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"><span className="flex items-center gap-1.5"><CalendarClock className="size-4" />{friendlyDate(job.eventSummary.eventDate)} · {friendlyTime(job.eventSummary.eventTime)}</span>{job.eventSummary.venue ? <span className="flex items-center gap-1.5"><MapPin className="size-4" />{job.eventSummary.venue}</span> : null}</p>
              </div>
              <form action={setStylistsRequiredAction} className="flex w-full items-end gap-2 rounded-xl border border-border bg-white p-2.5 lg:w-auto">
                <input type="hidden" name="jobId" value={job.id} />
                <label className="flex-1 text-xs font-medium text-muted-foreground lg:w-32">Stylists needed<input name="count" type="number" min={0} defaultValue={job.stylistsRequiredCount} className="mt-1 h-9 w-full rounded-lg border border-input bg-white px-3 text-sm font-medium outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" /></label>
                <Button type="submit" variant="outline" size="sm">Update</Button>
              </form>
            </div>
          </CardHeader>
          <CardContent className="p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">Selection progress</p><p className="text-xs text-muted-foreground">{approvedCount} of {job.stylistsRequiredCount} stylists selected</p></div><Badge variant="outline" className={filled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}>{filled ? <CheckCircle2 /> : <Clock3 />}{filled ? 'Requirement filled' : 'Selection pending'}</Badge></div>
            <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-[#eee9e2]"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, job.stylistsRequiredCount ? (approvedCount / job.stylistsRequiredCount) * 100 : 100)}%` }} /></div>
            {approvedCount > job.stylistsRequiredCount ? <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">More stylists are selected than required. This is recorded in the event history.</p> : null}
            {job.stylistInterests.length ? <ul className="grid gap-3 lg:grid-cols-2">{job.stylistInterests.map((interest) => <li key={interest.id} className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-white p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f5ead8] font-semibold text-primary">{interest.stylistName.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate font-semibold">{interest.stylistName}</p><p className="mt-0.5 text-xs text-muted-foreground">Applied {friendlyDate(interest.expressedAt)}</p></div></div>
              {interest.status === 'interested' ? <div className="flex flex-wrap gap-2 sm:justify-end"><DecisionForm jobId={job.id} interestId={interest.id} decision="approved" label="Select" /><DecisionForm jobId={job.id} interestId={interest.id} decision="backup" label="Backup" variant="outline" /><DecisionForm jobId={job.id} interestId={interest.id} decision="rejected" label="Reject" variant="ghost" /></div> : <div className="flex items-center gap-2"><Badge variant="outline" className={`${STATUS_TONE[interest.status]} capitalize`}>{interest.status}</Badge>{interest.status === 'approved' ? <Button variant="outline" size="sm" render={<Link href={`/travel/${job.id}/${interest.id}`} />}><PlaneTakeoff /> Travel</Button> : null}</div>}
            </li>)}</ul> : <div className="rounded-xl border border-dashed border-border p-8 text-center"><UsersRound className="mx-auto size-8 text-primary" /><p className="mt-3 font-medium">No stylist applications yet</p><p className="mt-1 text-sm text-muted-foreground">Interested rental stylists will appear here.</p></div>}
          </CardContent>
        </Card>;
      })}</div> : <Card className="border-border shadow-level-1"><CardContent className="grid min-h-64 place-items-center p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-primary"><UserCheck /></span><h3 className="mt-4 font-semibold">No rental events need stylist approval</h3><p className="mt-1 text-sm text-muted-foreground">Only confirmed rental Event Jobs appear in this module.</p></div></CardContent></Card>}
    </div>
  </BookingPortalShell>;
}

function Summary({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <Card className="border-border shadow-level-1"><CardContent className="flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-xl bg-[#f5ead8] text-primary [&_svg]:size-5">{icon}</span><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p></div></CardContent></Card>;
}

function DecisionForm({ jobId, interestId, decision, label, variant }: { jobId: string; interestId: string; decision: StylistInterestStatus; label: string; variant?: 'outline' | 'ghost' }) {
  return <form action={decideInterestAction}><input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="interestId" value={interestId} /><input type="hidden" name="decision" value={decision} /><Button type="submit" size="sm" variant={variant}>{label}</Button></form>;
}
