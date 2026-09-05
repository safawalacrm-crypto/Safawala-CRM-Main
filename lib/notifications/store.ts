import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { StaffDepartment } from '@/lib/staff-portal/constants';

export type EventJobNotification = {
  id: string;
  jobId: string;
  recipientDepartment: StaffDepartment | null;
  recipientAccountId: string | null;
  message: string;
  createdAt: string;
  readAt: string | null;
};

async function notify(
  jobId: string,
  message: string,
  target: { department: StaffDepartment } | { accountId: string },
) {
  const admin = createAdminClient();
  const { error } = await admin.from('event_job_notifications').insert({
    event_job_id: jobId,
    recipient_department: 'department' in target ? target.department : null,
    recipient_account_id: 'accountId' in target ? target.accountId : null,
    message,
  });
  if (error) throw new Error(error.message);
}

export async function notifyDepartment(jobId: string, department: StaffDepartment, message: string) {
  await notify(jobId, message, { department });
}

export async function notifyAccount(jobId: string, accountId: string, message: string) {
  await notify(jobId, message, { accountId });
}

// Everything addressed to one of the caller's active departments, OR to their account
// directly — never notifications for a department they don't (or no longer) hold.
export async function notificationsForSession(accountId: string, activeDepartments: StaffDepartment[]): Promise<EventJobNotification[]> {
  const admin = createAdminClient();
  const filters = [`recipient_account_id.eq.${accountId}`];
  if (activeDepartments.length) filters.push(`recipient_department.in.(${activeDepartments.join(',')})`);
  const { data, error } = await admin.from('event_job_notifications').select('*').or(filters.join(',')).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((item) => ({
    id: String(item.id), jobId: String(item.event_job_id),
    recipientDepartment: item.recipient_department as StaffDepartment | null,
    recipientAccountId: item.recipient_account_id as string | null,
    message: String(item.message), createdAt: String(item.created_at), readAt: item.read_at as string | null,
  }));
}

export async function unreadCountForSession(accountId: string, activeDepartments: StaffDepartment[]): Promise<number> {
  return (await notificationsForSession(accountId, activeDepartments)).filter((item) => item.readAt === null).length;
}

export async function markAllReadForSession(accountId: string, activeDepartments: StaffDepartment[]) {
  const admin = createAdminClient();
  const mine = await notificationsForSession(accountId, activeDepartments);
  const ids = mine.filter((item) => !item.readAt).map((item) => item.id);
  if (!ids.length) return;
  const { error } = await admin.from('event_job_notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
  if (error) throw new Error(error.message);
}
