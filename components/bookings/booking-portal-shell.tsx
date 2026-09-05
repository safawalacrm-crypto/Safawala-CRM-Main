import type { ReactNode } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { getStaffSession } from '@/lib/staff-portal/session';

export async function BookingPortalShell({
  email,
  children,
}: {
  email: string;
  children: ReactNode;
}) {
  const staffSession = await getStaffSession();

  if (staffSession) {
    return (
      <StaffPortalShell name={staffSession.name} departments={staffSession.departments} accessModules={staffSession.accessModules} isMainId={staffSession.isMainId}>
        {children}
      </StaffPortalShell>
    );
  }

  return <DashboardShell email={email}>{children}</DashboardShell>;
}
