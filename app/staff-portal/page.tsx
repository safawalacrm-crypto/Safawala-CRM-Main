import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { DEPARTMENT_META, STAFF_DEPARTMENTS, type StaffDepartment } from '@/lib/staff-portal/constants';
import { ACCESS_MODULE_META } from '@/lib/staff-portal/access-modules';
import { STAFF_MODULE_META } from '@/lib/staff-portal/modules';
import { requireStaffSession } from '@/lib/staff-portal/guard';
import { unreadCountForSession } from '@/lib/notifications/store';
import { listJobs } from '@/lib/event-jobs/store';
import { Boxes, CheckCircle2, Clock3 } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ denied?: string }>;
};

export default async function StaffPortalHomePage({ searchParams }: Props) {
  const session = await requireStaffSession();
  const params = await searchParams;
  const activeDepartments = session.departments.filter((grant) => grant.active);
  const rawModuleCards = [
    ...session.accessModules.map((module) => ({ key: `access-${module}`, ...ACCESS_MODULE_META[module] })),
    ...session.permissions.map((module) => ({ key: `staff-${module}`, ...STAFF_MODULE_META[module] })),
  ];
  const seenModuleHrefs = new Set<string>();
  const moduleCards = rawModuleCards.flatMap((module) => {
    if (!module.href || seenModuleHrefs.has(module.href)) return [];
    seenModuleHrefs.add(module.href);
    return [{ ...module, href: module.href }];
  });
  const hasWarehouse = activeDepartments.some((grant) => grant.department === 'warehouse');
  const warehouseJobs = hasWarehouse ? (await listJobs()).filter((job) => job.bookingType === 'rental') : [];
  const openWarehouseJobs = warehouseJobs.filter((job) =>
    job.status === 'active' && job.stages.some((stage) =>
      (stage.key === 'warehouse_pick' || stage.key === 'return_warehouse') &&
      (stage.status === 'open' || stage.status === 'in_progress'),
    ),
  );
  const closedWarehouseJobs = warehouseJobs.filter((job) =>
    !job.stages.some((stage) =>
      (stage.key === 'warehouse_pick' || stage.key === 'return_warehouse') &&
      (stage.status === 'open' || stage.status === 'in_progress'),
    ) && Boolean(job.warehousePrep || job.returnWarehouseCheck),
  );
  const deniedDepartment = STAFF_DEPARTMENTS.includes(params.denied as StaffDepartment)
    ? (params.denied as StaffDepartment)
    : null;
  const notificationCount = await unreadCountForSession(
    session.id,
    activeDepartments.map((grant) => grant.department),
  );

  return (
    <StaffPortalShell name={session.name} departments={session.departments} accessModules={session.accessModules} isMainId={session.isMainId} notificationCount={notificationCount}>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <DashboardHeader title={`Welcome, ${session.name}`} subtitle="Your Safawala staff portal" />

        {deniedDepartment ? (
          <Alert variant="destructive">
            <AlertTitle>Access not granted</AlertTitle>
            <AlertDescription>
              You don&rsquo;t have {DEPARTMENT_META[deniedDepartment].label} access. Ask your admin to grant
              it from Manage Access if you need it.
            </AlertDescription>
          </Alert>
        ) : null}

        {hasWarehouse ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/staff-portal/warehouse" className="rounded-xl border border-[#d6b98d] bg-[#f5ead8] p-4 text-[#70481c] shadow-sm transition hover:shadow-level-1">
              <span className="flex items-center gap-2 text-sm font-medium"><Clock3 className="size-4" /> Open warehouse jobs</span>
              <span className="mt-2 flex items-end justify-between"><strong className="text-3xl">{openWarehouseJobs.length}</strong><Boxes className="size-5" /></span>
            </Link>
            <Link href="/staff-portal/warehouse?view=closed" className="rounded-xl border bg-white p-4 shadow-sm transition hover:bg-[#fcfaf7] hover:shadow-level-1">
              <span className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="size-4 text-emerald-700" /> Closed warehouse jobs</span>
              <strong className="mt-2 block text-3xl">{closedWarehouseJobs.length}</strong>
            </Link>
          </div>
        ) : null}

        {moduleCards.length === 0 ? <Card className="border-border shadow-level-1"><CardContent className="p-6 text-sm text-muted-foreground">No active department is assigned to this staff account.</CardContent></Card> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {moduleCards.map((module) => (
              <Link key={module.key} href={module.href} className="block">
                <Card className="border-border shadow-level-1 transition hover:shadow-level-2">
                  <CardContent className="p-5">
                    <p className="font-semibold">{module.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {module.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </StaffPortalShell>
  );
}
