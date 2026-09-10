import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

export type AdminNotification = {
  id: string;
  title: string;
  message: string;
  href: string | null;
  createdAt: string;
  readAt: string | null;
};

// Notifications for the account owner / Main ID (e.g. new leads, locked
// dates) — separate from the staff department job notifications in
// lib/notifications/store.ts, which are keyed by department instead of owner.
export async function notificationsForOwner(ownerId: string): Promise<AdminNotification[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('admin_notifications')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((item) => ({
    id: String(item.id),
    title: String(item.title),
    message: String(item.message),
    href: (item.href as string | null) ?? null,
    createdAt: String(item.created_at),
    readAt: (item.read_at as string | null) ?? null,
  }));
}

export async function unreadCountForOwner(ownerId: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from('admin_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .is('read_at', null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markAllReadForOwner(ownerId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from('admin_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('owner_id', ownerId)
    .is('read_at', null);
  if (error) throw new Error(error.message);
}
