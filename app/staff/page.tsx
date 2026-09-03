import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StaffDirectory, type StaffMember } from '@/components/staff/staff-directory';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const today = new Date().toISOString().slice(0, 10);
  const [staffResult, assignmentResult] = await Promise.all([
    supabase.from('staff_members').select('id,name,phone,is_active,created_at,updated_at').order('name'),
    supabase
      .from('bookings')
      .select('assigned_staff_id')
      .or('is_quote.eq.false,and(is_quote.eq.true,status.not.in.(draft,cancelled))')
      .not('assigned_staff_id', 'is', null)
      .gte('event_date', today)
      .in('status', ['draft', 'confirmed', 'ready', 'out_for_delivery', 'active']),
  ]);

  const assignmentCounts: Record<string, number> = {};
  for (const booking of assignmentResult.data ?? []) {
    if (booking.assigned_staff_id) {
      const key = String(booking.assigned_staff_id);
      assignmentCounts[key] = (assignmentCounts[key] ?? 0) + 1;
    }
  }

  return (
    <DashboardShell email={auth.user.email ?? 'Safawala user'}>
      <StaffDirectory
        initialStaff={(staffResult.data ?? []) as StaffMember[]}
        assignmentCounts={assignmentCounts}
        loadError={staffResult.error?.message ?? assignmentResult.error?.message ?? ''}
      />
    </DashboardShell>
  );
}
