import Link from 'next/link';
import { ArrowRight, Boxes, CalendarDays, CheckCircle2, Clock3 } from 'lucide-react';
import { requireDepartment } from '@/lib/staff-portal/guard';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { friendlyDate, friendlyTime } from '@/lib/bookings';
import { listJobs } from '@/lib/event-jobs/store';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type QueueView = 'open' | 'closed';

export default async function StaffWarehousePage({
  searchParams,
}: {
  searchParams: Promise<{ completed?: string; view?: string }>;
}) {
  const session = await requireDepartment('warehouse');
  const { completed, view: requestedView } = await searchParams;
  const view: QueueView = requestedView === 'closed' ? 'closed' : 'open';
  const rentalJobs = (await listJobs()).filter((job) => job.bookingType === 'rental');
  const hasOpenWarehouseStage = (job: (typeof rentalJobs)[number]) =>
    job.stages.some(
      (stage) =>
        (stage.key === 'warehouse_pick' || stage.key === 'return_warehouse') &&
        (stage.status === 'open' || stage.status === 'in_progress'),
    );
  const openJobs = rentalJobs.filter((job) => job.status === 'active' && hasOpenWarehouseStage(job));
  const closedJobs = rentalJobs.filter(
    (job) => !hasOpenWarehouseStage(job) && Boolean(job.warehousePrep || job.returnWarehouseCheck),
  );
  const jobs = view === 'open' ? openJobs : closedJobs;

  const bookingIds = rentalJobs.map((job) => job.bookingId);
  const admin = createAdminClient();
  const { data: bookings } = bookingIds.length
    ? await admin.from('bookings').select('id,customers(name)').in('id', bookingIds)
    : { data: [] };
  const customerByBookingId = new Map(
    (bookings ?? []).map((booking) => {
      const customer = Array.isArray(booking.customers) ? booking.customers[0] : booking.customers;
      return [Number(booking.id), customer?.name ?? 'Customer'] as const;
    }),
  );

  return (
    <StaffPortalShell
      name={session.name}
      departments={session.departments}
      permissions={session.permissions}
      accessModules={session.accessModules}
      isMainId={session.isMainId}
    >
      <div className="mx-auto max-w-[1180px] space-y-5">
        <DashboardHeader title="Warehouse" subtitle="Pick rental items and send completed jobs to QC & Packing" />

        {completed ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="size-4" /> {completed} was completed and sent to QC &amp; Packing.
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/staff-portal/warehouse"
            className={`rounded-xl border p-4 transition ${view === 'open' ? 'border-[#d6b98d] bg-[#f5ead8] text-[#70481c] shadow-sm' : 'bg-white hover:bg-[#fcfaf7]'}`}
          >
            <span className="flex items-center gap-2 text-sm font-medium"><Clock3 className="size-4" /> Open jobs</span>
            <strong className="mt-1 block text-2xl">{openJobs.length}</strong>
          </Link>
          <Link
            href="/staff-portal/warehouse?view=closed"
            className={`rounded-xl border p-4 transition ${view === 'closed' ? 'border-[#d6b98d] bg-[#f5ead8] text-[#70481c] shadow-sm' : 'bg-white hover:bg-[#fcfaf7]'}`}
          >
            <span className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="size-4" /> Closed jobs</span>
            <strong className="mt-1 block text-2xl">{closedJobs.length}</strong>
          </Link>
        </div>

        <Card className="overflow-hidden border-border shadow-level-1">
          <CardContent className="p-0">
            {jobs.length ? (
              <ul className="divide-y divide-border">
                {jobs.map((job) => {
                  const returnStage = job.stages.find((stage) => stage.key === 'return_warehouse');
                  const isReturn = Boolean(returnStage && (returnStage.status === 'open' || returnStage.status === 'in_progress'));
                  return (
                    <li key={job.id}>
                      <Link
                        href={`/staff-portal/warehouse/${job.id}`}
                        className="group flex items-center gap-3 px-4 py-4 transition hover:bg-[#fcfaf7] sm:px-5"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#f5ead8] text-[#70481c]">
                          <Boxes className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <strong className="truncate text-sm">{customerByBookingId.get(job.bookingId) ?? 'Customer'}</strong>
                            <Badge variant="outline" className="border-[#e4d2b6] bg-white text-[#70481c]">
                              {isReturn ? 'Return' : view === 'closed' ? 'Completed' : 'Picking'}
                            </Badge>
                          </span>
                          <span className="mt-1 block truncate text-sm text-muted-foreground">
                            {job.eventSummary.eventName} · {job.bookingNumber}
                          </span>
                          <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays className="size-3.5" /> {friendlyDate(job.eventSummary.eventDate)}
                            {job.eventSummary.eventTime ? ` · ${friendlyTime(job.eventSummary.eventTime)}` : ''}
                          </span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-[#70481c]" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="grid min-h-52 place-items-center p-8 text-center">
                <div>
                  <span className="mx-auto grid size-11 place-items-center rounded-full bg-[#f5ead8] text-[#70481c]">
                    {view === 'open' ? <Boxes className="size-5" /> : <CheckCircle2 className="size-5" />}
                  </span>
                  <h3 className="mt-3 font-semibold">No {view} warehouse jobs</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {view === 'open' ? 'Confirmed rental jobs will appear here for picking.' : 'Completed picking jobs will appear here.'}
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
