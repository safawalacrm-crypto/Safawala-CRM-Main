import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { ArrowDownRight, ArrowUpRight, Clock3, FileCheck2, IndianRupee, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

// Demo-only dashboard data. Replace with organization-scoped Supabase queries in a future CRM release.
const SUMMARY = [
  { label: 'Active contracts', value: '24', note: '3 this month', trend: 'up', icon: FileCheck2 },
  { label: 'Client records', value: '186', note: '12 this month', trend: 'up', icon: Users },
  { label: 'Pending follow-ups', value: '8', note: '2 overdue', trend: 'down', icon: Clock3 },
  { label: 'Contract value', value: '₹8.4L', note: '11% this month', trend: 'up', icon: IndianRupee },
] as const;

const RECENT_CONTRACTS = [
  { id: 'SW-1048', client: 'Mehta Family', event: 'Wedding Ceremony', date: '18 Sep 2026', status: 'Confirmed' },
  { id: 'SW-1047', client: 'Kapoor Events', event: 'Corporate Celebration', date: '22 Sep 2026', status: 'Pending' },
  { id: 'SW-1046', client: 'Shah Family', event: 'Reception', date: '28 Sep 2026', status: 'Confirmed' },
  { id: 'SW-1045', client: 'Royal Occasions', event: 'Destination Wedding', date: '04 Oct 2026', status: 'Draft' },
] as const;

export default async function DashboardPage() {
  if (!hasSupabaseEnv()) redirect('/login');
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  const email = data.user.email ?? 'Safawala user';

  return (
    <DashboardShell email={email}>
      <div className="mx-auto max-w-[1440px] space-y-6 sm:space-y-8">
        <section>
          <p className="text-sm text-muted-foreground">Tuesday, 1 September</p>
          <h2 className="mt-1 text-[22px] font-semibold leading-8 tracking-[-0.03em]">Welcome back</h2>
          <p className="mt-1 text-sm text-muted-foreground">Here is a clear view of your CRM activity.</p>
        </section>

        <section aria-label="CRM summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {SUMMARY.map(({ label, value, note, trend, icon: Icon }) => (
            <Card key={label} className="gap-5 rounded-lg py-5 shadow-none ring-border">
              <CardHeader className="grid grid-cols-[1fr_auto] items-center px-5">
                <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
                <span className="grid size-9 place-items-center rounded-md bg-muted"><Icon aria-hidden="true" className="size-[18px]" /></span>
              </CardHeader>
              <CardContent className="px-5">
                <p className="text-[28px] font-semibold leading-8 tracking-[-0.03em]">{value}</p>
                <p className={`mt-2 flex items-center gap-1 text-xs ${trend === 'up' ? 'text-success' : 'text-warning'}`}>
                  {trend === 'up' ? <ArrowUpRight aria-hidden="true" className="size-3.5" /> : <ArrowDownRight aria-hidden="true" className="size-3.5" />}{note}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.7fr)]">
          <Card className="rounded-lg py-0 shadow-none ring-border">
            <CardHeader className="border-b px-5 py-5 sm:px-6">
              <CardTitle className="text-base font-semibold">Recent contracts</CardTitle>
              <p className="text-xs text-muted-foreground">Demo data for the dashboard preview</p>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b bg-muted/60 text-xs font-medium text-muted-foreground">
                  <tr><th className="px-6 py-3 font-medium">Contract</th><th className="px-4 py-3 font-medium">Client</th><th className="px-4 py-3 font-medium">Event</th><th className="px-4 py-3 font-medium">Date</th><th className="px-6 py-3 font-medium">Status</th></tr>
                </thead>
                <tbody>
                  {RECENT_CONTRACTS.map((contract) => (
                    <tr key={contract.id} className="border-b last:border-0">
                      <td className="px-6 py-4 font-medium">{contract.id}</td><td className="px-4 py-4">{contract.client}</td><td className="px-4 py-4 text-muted-foreground">{contract.event}</td><td className="px-4 py-4 text-muted-foreground">{contract.date}</td>
                      <td className="px-6 py-4"><Badge variant="outline" className={`rounded-full px-2 py-0.5 font-normal ${contract.status === 'Confirmed' ? 'border-success/30 text-success' : contract.status === 'Pending' ? 'border-warning/30 text-warning' : 'text-muted-foreground'}`}>{contract.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="rounded-lg py-0 shadow-none ring-border">
            <CardHeader className="border-b px-5 py-5 sm:px-6">
              <CardTitle className="text-base font-semibold">Contract activity</CardTitle>
              <p className="text-xs text-muted-foreground">Last 6 months · Demo data</p>
            </CardHeader>
            <CardContent className="px-5 py-6 sm:px-6">
              <figure className="flex h-48 items-end justify-between gap-3 border-b border-l px-3 pt-4" aria-label="Contract activity increased from April through September">
                {[36, 52, 45, 64, 74, 88].map((height, index) => (
                  <div key={height} className="flex h-full flex-1 items-end"><div className="w-full rounded-t-sm bg-primary/85 transition hover:bg-primary" style={{ height: `${height}%` }}><span className="sr-only">{['April', 'May', 'June', 'July', 'August', 'September'][index]}: {height}</span></div></div>
                ))}
              </figure>
              <div className="mt-3 grid grid-cols-6 text-center text-[11px] text-muted-foreground"><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span></div>
              <div className="mt-6 flex items-center justify-between rounded-md bg-muted p-4"><div><p className="text-xs text-muted-foreground">Total contracts</p><p className="mt-1 text-lg font-semibold">73</p></div><Badge className="bg-background text-foreground ring-1 ring-border">+14.2%</Badge></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
