import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { HrRecordManager } from '@/components/hr/hr-record-manager';
import { AttendanceManager } from '@/components/hr/attendance-manager';
import { PayrollManager } from '@/components/hr/payroll-manager';
import { LettersManager } from '@/components/hr/letters-manager';
import { KycManager } from '@/components/hr/kyc-manager';
import { WorkOrdersManager } from '@/components/hr/work-orders-manager';

const modules = {
  attendance: {
    title: 'Attendance',
    subtitle: 'Daily presence and leave records',
    table: 'hr_attendance',
    columns: [
      'attendance_date',
      'status',
      'check_in',
      'check_out',
      'working_hours',
      'overtime',
    ],
  },
  payroll: {
    title: 'Payroll',
    subtitle: 'Salary processing and payment status',
    table: 'hr_payroll',
    columns: [
      'period',
      'base_salary',
      'allowances',
      'deductions',
      'advances',
      'net_salary',
      'status',
    ],
  },
  letters: {
    title: 'HR Letters',
    subtitle: 'Employee letters issued by HR',
    table: 'hr_letters',
    columns: ['letter_type', 'title', 'issued_on'],
  },
  kyc: {
    title: 'KYC & Documents',
    subtitle: 'Identity documents and verification status',
    table: 'hr_kyc_documents',
    columns: [
      'document_type',
      'document_number',
      'address_proof',
      'bank_details_status',
      'status',
    ],
  },
  'work-orders': {
    title: 'Work Orders',
    subtitle: 'HR and department assignments',
    table: 'hr_work_orders',
    columns: ['title', 'department', 'status', 'due_date'],
  },
} as const;

export const dynamic = 'force-dynamic';

export default async function HrModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const config = modules[module as keyof typeof modules];
  if (!config) redirect('/hr');
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const [{ data, error }, { data: staff }] = await Promise.all([
    supabase
      .from(config.table)
      .select(`*, staff_members(name)`)
      .order(config.columns[0], { ascending: false })
      .limit(100),
    supabase
      .from('staff_members')
      .select('id,name')
      .eq('is_active', true)
      .order('name'),
  ]);
  const workflow =
    module === 'work-orders'
      ? await supabase
          .from('event_job_stages')
          .select(
            'id,stage,status,assigned_staff_id,opened_at,completed_at,assigned:staff_members!event_job_stages_assigned_staff_id_fkey(name),event_jobs(job_number,status,bookings(event_name,event_date,event_location))',
          )
          .order('opened_at', { ascending: false })
          .limit(200)
      : null;
  if (module === 'attendance')
    return (
      <DashboardShell email={auth.user.email ?? 'Safawala user'}>
        <div className="mx-auto max-w-[1280px] space-y-6">
          <DashboardHeader title={config.title} subtitle={config.subtitle} backHref="/hr" />
          {error && (
            <Card className="border-[#e4d2b6] bg-[#fffaf2] dark:bg-[#241e17]">
              <CardContent className="p-5">
                <p className="font-semibold text-[#70481c]">
                  One-time setup required
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Apply the HR migration in Supabase SQL Editor.
                </p>
              </CardContent>
            </Card>
          )}
          <AttendanceManager
            initialRecords={(data ?? []) as never}
            staff={(staff ?? []) as { id: number; name: string }[]}
          />
        </div>
      </DashboardShell>
    );
  if (module === 'payroll')
    return (
      <DashboardShell email={auth.user.email ?? 'Safawala user'}>
        <div className="mx-auto max-w-[1280px] space-y-6">
          <DashboardHeader title={config.title} subtitle={config.subtitle} backHref="/hr" />
          {error && (
            <Card className="border-[#e4d2b6] bg-[#fffaf2] dark:bg-[#241e17]">
              <CardContent className="p-5">
                <p className="font-semibold text-[#70481c]">
                  One-time setup required
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Apply the HR migration in Supabase SQL Editor.
                </p>
              </CardContent>
            </Card>
          )}
          <PayrollManager
            initialRecords={(data ?? []) as never}
            staff={(staff ?? []) as { id: number; name: string }[]}
          />
        </div>
      </DashboardShell>
    );
  if (module === 'letters')
    return (
      <DashboardShell email={auth.user.email ?? 'Safawala user'}>
        <div className="mx-auto max-w-[1280px] space-y-6">
          <DashboardHeader title={config.title} subtitle={config.subtitle} backHref="/hr" />
          {error && (
            <Card className="border-[#e4d2b6] bg-[#fffaf2] dark:bg-[#241e17]">
              <CardContent className="p-5">
                <p className="font-semibold text-[#70481c]">
                  One-time setup required
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Apply the HR migration in Supabase SQL Editor.
                </p>
              </CardContent>
            </Card>
          )}
          <LettersManager
            initialRecords={(data ?? []) as never}
            staff={(staff ?? []) as { id: number; name: string }[]}
          />
        </div>
      </DashboardShell>
    );
  if (module === 'kyc')
    return (
      <DashboardShell email={auth.user.email ?? 'Safawala user'}>
        <div className="mx-auto max-w-[1280px] space-y-6">
          <DashboardHeader title={config.title} subtitle={config.subtitle} backHref="/hr" />
          {error && (
            <Card className="border-[#e4d2b6] bg-[#fffaf2] dark:bg-[#241e17]">
              <CardContent className="p-5">
                <p className="font-semibold text-[#70481c]">
                  One-time setup required
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Apply the HR migration in Supabase SQL Editor.
                </p>
              </CardContent>
            </Card>
          )}
          <KycManager
            initialRecords={(data ?? []) as never}
            staff={(staff ?? []) as { id: number; name: string }[]}
          />
        </div>
      </DashboardShell>
    );
  if (module === 'work-orders')
    return (
      <DashboardShell email={auth.user.email ?? 'Safawala user'}>
        <div className="mx-auto max-w-[1280px] space-y-6">
          <DashboardHeader backHref="/hr"
            title={config.title}
            subtitle="Live operational tasks from the existing event workflow"
          />
          {workflow?.error && (
            <Card className="border-[#e4d2b6] bg-[#fffaf2] dark:bg-[#241e17]">
              <CardContent className="p-5">
                <p className="font-semibold text-[#70481c]">
                  Event workflow is not available
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Apply the event operations migration in Supabase.
                </p>
              </CardContent>
            </Card>
          )}
          <WorkOrdersManager
            initialRecords={(workflow?.data ?? []) as never}
            staff={(staff ?? []) as { id: number; name: string }[]}
          />
        </div>
      </DashboardShell>
    );
  return (
    <DashboardShell email={auth.user.email ?? 'Safawala user'}>
      <div className="mx-auto max-w-[1280px] space-y-6">
        <DashboardHeader title={config.title} subtitle={config.subtitle} backHref="/hr" />
        {error && (
          <Card className="border-[#e4d2b6] bg-[#fffaf2] dark:bg-[#241e17]">
            <CardContent className="p-5">
              <p className="font-semibold text-[#70481c]">
                One-time setup required
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Run{' '}
                <code className="rounded bg-white dark:bg-card px-1.5 py-0.5 text-xs">
                  supabase/migrations/20260908010000_hr_admin_module.sql
                </code>{' '}
                in the Supabase SQL Editor. After it runs, this page will load
                and save HR records normally.
              </p>
            </CardContent>
          </Card>
        )}
        <HrRecordManager
          module={module}
          staff={(staff ?? []) as { id: number; name: string }[]}
        />
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[#faf8f4] dark:bg-[#241e17] text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Employee / work</th>
                  {config.columns.map((column) => (
                    <th key={column} className="px-5 py-3">
                      {column.replaceAll('_', ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {((data as Record<string, unknown>[]) ?? []).map((row) => (
                  <tr key={String(row.id)} className="border-b last:border-0">
                    <td className="px-5 py-4 font-medium">
                      {typeof row.staff_members === 'object' &&
                      row.staff_members
                        ? String(
                            (row.staff_members as { name?: string }).name ??
                              'Assigned',
                          )
                        : String(row.title ?? 'Employee')}
                    </td>
                    {config.columns.map((column) => (
                      <td
                        key={column}
                        className="px-5 py-4 text-muted-foreground"
                      >
                        {row[column] == null ? '—' : String(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
                {!data?.length && (
                  <tr>
                    <td
                      colSpan={config.columns.length + 1}
                      className="px-5 py-12 text-center text-muted-foreground"
                    >
                      {error
                        ? 'HR storage is waiting for the one-time Supabase setup above.'
                        : 'No records yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
