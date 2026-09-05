import Link from 'next/link';
import type { ReactNode } from 'react';
import { CalendarClock, ClipboardCheck, FileText, Plus, ReceiptText } from 'lucide-react';
import { requireDepartment } from '@/lib/staff-portal/guard';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { friendlyDate, friendlyTime } from '@/lib/bookings';
import { currentStageSummary, listJobs } from '@/lib/event-jobs/store';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function StaffBookingPage() {
  const session = await requireDepartment('booking');
  const supabase = await createClient();
  const [jobs, bookingCount, quoteCount] = await Promise.all([
    listJobs(),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('is_quote', false),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('is_quote', true),
  ]);
  const activeJobs = jobs.filter((job) => job.status === 'active');

  return (
    <StaffPortalShell name={session.name} departments={session.departments} permissions={session.permissions} isMainId={session.isMainId}>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <DashboardHeader
          title="Booking overview"
          subtitle="Bookings, quotations and Event Job progress"
          actions={
            <Button size="sm" render={<Link href="/bookings/new" />}>
              <Plus /> Create booking
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard href="/bookings" icon={<ReceiptText />} label="Bookings" value={bookingCount.count ?? 0} />
          <SummaryCard href="/quotes" icon={<FileText />} label="Quotes" value={quoteCount.count ?? 0} />
          <SummaryCard href="#event-jobs" icon={<ClipboardCheck />} label="Active Event Jobs" value={activeJobs.length} />
        </div>

        <Card id="event-jobs" className="border-border shadow-level-1">
          <CardContent className="p-0">
            {jobs.length ? (
              <ul className="divide-y divide-border">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <Link
                      href={`/staff-portal/booking/${job.id}`}
                      className="flex flex-col gap-1 p-4 transition hover:bg-[#fcfaf7] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">
                          {job.id} <span className="text-xs text-muted-foreground">· {job.bookingNumber}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {job.eventSummary.eventName} · {currentStageSummary(job)}
                        </p>
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
                    <ClipboardCheck />
                  </span>
                  <h3 className="mt-4 font-semibold">No Event Jobs yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Confirmed bookings appear here automatically.
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

function SummaryCard({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Link href={href} className="block">
      <Card className="border-border shadow-level-1 transition hover:shadow-level-2">
        <CardContent className="flex items-center gap-4 p-5">
          <span className="grid size-10 place-items-center rounded-xl bg-accent text-primary [&_svg]:size-5">
            {icon}
          </span>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
