import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notificationsForOwner, unreadCountForOwner } from '@/lib/notifications/admin-store';

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ notifications: [], unreadCount: 0 }, { status: 401 });
  try {
    const [notifications, unreadCount] = await Promise.all([notificationsForOwner(data.user.id), unreadCountForOwner(data.user.id)]);
    return NextResponse.json({ notifications: notifications.slice(0, 5), unreadCount });
  } catch {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }
}
