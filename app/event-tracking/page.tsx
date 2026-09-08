import { redirect } from 'next/navigation';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { EventTrackingList } from '@/components/staff-portal/event-tracking-list';
import { createClient } from '@/lib/supabase/server';
import { listJobs } from '@/lib/event-jobs/store';

export const dynamic = 'force-dynamic';

export default async function AdminJobTrackingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const jobs = await listJobs();

  return (
    <DashboardShell email={auth.user.email ?? 'Safawala user'}>
      <div className="mx-auto max-w-[1440px] space-y-5">
        <DashboardHeader
          title="Job Tracking"
          subtitle="Monitor the current progress of every confirmed event"
          backHref="/dashboard"
        />
        <EventTrackingList jobs={jobs} />
      </div>
    </DashboardShell>
  );
}
