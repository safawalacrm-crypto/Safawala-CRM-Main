import { requireDepartment } from '@/lib/staff-portal/guard';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { DepartmentPlaceholder } from '@/components/staff-portal/department-placeholder';
import { DEPARTMENT_META } from '@/lib/staff-portal/constants';

export const dynamic = 'force-dynamic';

export default async function StaffModificationPage() {
  const session = await requireDepartment('modification');
  return (
    <StaffPortalShell name={session.name} departments={session.departments} permissions={session.permissions} isMainId={session.isMainId}>
      <DepartmentPlaceholder
        title={DEPARTMENT_META.modification.label}
        subtitle="Alteration requests"
        description="Alteration and modification requests assigned to you will appear here in the next build step."
      />
    </StaffPortalShell>
  );
}
