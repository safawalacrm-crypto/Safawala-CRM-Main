import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CalendarClock, CheckCircle2, MapPin, MessageCircle, Phone, UserRound } from 'lucide-react';
import { confirmTicketSentAction } from '@/app/travel/actions';
import { BookingPortalShell } from '@/components/bookings/booking-portal-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { friendlyDate, friendlyTime } from '@/lib/bookings';
import { getJob } from '@/lib/event-jobs/store';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function TravelPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string; interestId: string }>;
  searchParams: Promise<{ confirmed?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const { jobId, interestId } = await params;
  const job = await getJob(jobId);
  if (!job || job.bookingType !== 'rental') notFound();
  const interest = job.stylistInterests.find((entry) => entry.id === interestId);
  if (!interest || interest.status !== 'approved') notFound();
  const plan = job.travelPlans.find((entry) => entry.interestId === interestId);
  const { confirmed, error } = await searchParams;
  const admin = createAdminClient();
  const { data: selectedStaff } = await admin
    .from('staff_members')
    .select('name,phone,login_id')
    .eq('user_id', interest.stylistAccountId)
    .maybeSingle();

  return (
    <BookingPortalShell email={auth.user.email ?? 'Safawala user'}>
      <div className="mx-auto max-w-[1000px] space-y-5">
        <div>
          <Link
            href="/travel"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> All travel &amp; accommodation
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#d9c7ad] bg-gradient-to-r from-[#5d422a] to-[#8d602b] p-5 text-white shadow-level-1 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><Badge variant="outline" className="border-white/30 bg-white/10 text-white">Rental event</Badge><h1 className="mt-3 text-2xl font-semibold">Travel &amp; Accommodation</h1><p className="mt-1 text-sm text-white/75">{job.id} · {job.bookingNumber}</p></div><p className="flex items-center gap-1.5 text-sm text-white/85"><CalendarClock className="size-4" />{friendlyDate(job.eventSummary.eventDate)} · {friendlyTime(job.eventSummary.eventTime)}</p></div></div>

        {confirmed ? <Card className="border-emerald-200 bg-emerald-50"><CardContent className="flex items-center gap-2 p-4 text-sm text-emerald-700"><CheckCircle2 className="size-4" /> Ticket confirmation saved and the selected staff member was notified.</CardContent></Card> : null}
        {error ? <Card className="border-destructive/30 bg-destructive/5"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="gap-0 overflow-hidden border-border py-0 shadow-level-1">
            <CardHeader className="border-b bg-[#fcfaf7] px-5 py-4"><CardTitle className="flex items-center gap-2 text-base"><span className="grid size-8 place-items-center rounded-lg bg-[#f5ead8]"><UserRound className="size-4 text-primary" /></span> Selected staff</CardTitle></CardHeader>
            <CardContent className="space-y-2 p-5">
              <p className="text-lg font-semibold">{selectedStaff?.name ?? interest.stylistName}</p>
              <p className="text-sm text-muted-foreground">Staff ID: {selectedStaff?.login_id ?? 'Staff account'}</p>
              {selectedStaff?.phone ? <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Phone className="size-4" /> {selectedStaff.phone}</p> : null}
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Selected for event</Badge>
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden border-border py-0 shadow-level-1">
            <CardHeader className="border-b bg-[#fcfaf7] px-5 py-4"><CardTitle className="flex items-center gap-2 text-base"><span className="grid size-8 place-items-center rounded-lg bg-[#f5ead8]"><MapPin className="size-4 text-primary" /></span> Event destination</CardTitle></CardHeader>
            <CardContent className="space-y-2 p-5">
              <p className="text-lg font-semibold">{job.eventSummary.eventName}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><CalendarClock className="size-4" /> {friendlyDate(job.eventSummary.eventDate)} · {friendlyTime(job.eventSummary.eventTime)}</p>
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" /> {job.eventSummary.venue || 'Venue not added'}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-[#dfc6a4] bg-[#fcfaf7] shadow-level-1">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f5ead8] text-primary"><MessageCircle className="size-5" /></span><div><p className="font-semibold">Ticket confirmation</p><p className="mt-1 max-w-xl text-sm text-muted-foreground">After sending the ticket to {selectedStaff?.name ?? interest.stylistName} on WhatsApp, confirm it here. Only this selected staff account receives the notification.</p></div></div>
            {plan?.ticketConfirmedAt ? <div className="text-left sm:text-right"><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><CheckCircle2 /> Confirmed & sent</Badge><p className="mt-1 text-xs text-muted-foreground">{friendlyDate(plan.ticketConfirmedAt)}</p></div> : <form action={confirmTicketSentAction}><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="interestId" value={interest.id} /><Button type="submit" className="w-full sm:w-auto"><MessageCircle /> Ticket confirmed & sent on WhatsApp</Button></form>}
          </CardContent>
        </Card>
      </div>
    </BookingPortalShell>
  );
}
