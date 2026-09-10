import type { ReactNode } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { getStaffSession } from '@/lib/staff-portal/session';
import { unreadCountForOwner } from '@/lib/notifications/admin-store';
import { createClient } from '@/lib/supabase/server';

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
      <StaffPortalShell
        name={staffSession.name}
        departments={staffSession.departments}
        accessModules={staffSession.accessModules}
        permissions={staffSession.permissions}
        isMainId={staffSession.isMainId}
      >
        {children}
      </StaffPortalShell>
    );
  }

  // Best-effort: if the Leads Center migration hasn't been applied yet,
  // admin_notifications won't exist — fall back to 0 rather than breaking
  // every page in the app over a missing notifications count.
  let notificationCount = 0;
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) notificationCount = await unreadCountForOwner(auth.user.id);
  } catch {
    notificationCount = 0;
  }

  return (
    <DashboardShell email={email} notificationCount={notificationCount}>
      {children}
    </DashboardShell>
  );
}
