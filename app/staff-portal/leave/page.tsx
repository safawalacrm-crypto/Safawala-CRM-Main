import { CalendarOff } from 'lucide-react';
import { StaffRecordPage } from '@/components/staff-portal/staff-record-page';
import { requirePermission } from '@/lib/staff-portal/guard';

export default async function LeavePage() {
  const session = await requirePermission('leave_management');
  return <StaffRecordPage session={session} title="Leave Management" subtitle="View your department leave access" icon={<CalendarOff />} heading="No leave requests" description="Your approved and pending leave requests will be shown here when recorded by the franchise administrator." />;
}
