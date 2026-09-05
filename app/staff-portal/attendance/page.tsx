import { Clock3 } from 'lucide-react';
import { StaffRecordPage } from '@/components/staff-portal/staff-record-page';
import { Card, CardContent } from '@/components/ui/card';
import { requirePermission } from '@/lib/staff-portal/guard';

export const dynamic = 'force-dynamic';

export default async function AttendancePage() {
  const session = await requirePermission('attendance');
  const today = new Intl.DateTimeFormat('en-IN', { dateStyle: 'full', timeZone: 'Asia/Kolkata' }).format(new Date());
  return <StaffRecordPage session={session} title="My Attendance" subtitle="Your attendance access and daily status" icon={<Clock3 />} heading="Attendance active" description="Your attendance access is enabled.">
    <div className="grid gap-4 sm:grid-cols-2"><Card className="border-border shadow-level-1"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Today</p><p className="mt-2 font-semibold">{today}</p><p className="mt-1 text-sm text-muted-foreground">Attendance module access is active.</p></CardContent></Card><Card className="border-border shadow-level-1"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Staff account</p><p className="mt-2 font-semibold">{session.name}</p><p className="mt-1 text-sm text-muted-foreground">Staff ID: {session.loginId}</p></CardContent></Card></div>
  </StaffRecordPage>;
}
