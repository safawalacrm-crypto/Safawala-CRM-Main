import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { DEPARTMENT_META, STAFF_DEPARTMENTS, type StaffDepartment } from '@/lib/staff-portal/constants';
import { ACCESS_MODULE_META } from '@/lib/staff-portal/access-modules';
import { requireStaffSession } from '@/lib/staff-portal/guard';
import { unreadCountForSession } from '@/lib/notifications/store';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ denied?: string }>;
};

export default async function StaffPortalHomePage({ searchParams }: Props) {
  const session = await requireStaffSession();
  const params = await searchParams;
  const activeDepartments = session.departments.filter((grant) => grant.active);
  const availableModules = session.accessModules;
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

        {availableModules.length === 0 ? <Card className="border-border shadow-level-1"><CardContent className="p-6 text-sm text-muted-foreground">No active department is assigned to this staff account.</CardContent></Card> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableModules.map((module) => (
              <a key={module} href={ACCESS_MODULE_META[module].href} className="block">
                <Card className="border-border shadow-level-1 transition hover:shadow-level-2">
                  <CardContent className="p-5">
                    <p className="font-semibold">{ACCESS_MODULE_META[module].label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ACCESS_MODULE_META[module].description}
                    </p>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        )}
      </div>
    </StaffPortalShell>
  );
}
