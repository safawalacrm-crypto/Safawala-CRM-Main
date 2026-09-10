'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { markAllAdminNotificationsReadAction } from '@/app/notifications/actions';

type Item = { id: string; title: string; message: string; href: string | null; createdAt: string; readAt: string | null };

export function AdminNotificationPopover() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const response = await fetch('/api/admin-notifications', { cache: 'no-store' });
      if (response.ok) { const data = await response.json(); setItems(data.notifications ?? []); setUnread(data.unreadCount ?? 0); }
    }
  }
  return <div className="relative pointer-events-auto"><button type="button" aria-label="Notifications" aria-expanded={open} onClick={toggle} className="relative inline-flex size-8 items-center justify-center rounded-lg border border-border bg-white text-foreground shadow-sm transition hover:bg-muted dark:bg-card"><Bell className="size-3.5" />{unread > 0 ? <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">{unread > 9 ? '9+' : unread}</span> : null}</button>{open ? <div className="absolute right-0 top-10 z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-white shadow-level-3 dark:bg-card"><div className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="font-semibold">Notifications <span className="ml-1 rounded-full border px-2 py-0.5 text-xs font-normal">{unread} new</span></h2><form action={async () => { await markAllAdminNotificationsReadAction(); setUnread(0); setItems((current) => current.map((item) => ({ ...item, readAt: new Date().toISOString() }))); }}><button type="submit" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><CheckCheck className="size-3.5" /> Mark all read</button></form></div>{items.length ? <ul className="max-h-80 divide-y divide-border overflow-y-auto">{items.map((item) => <li key={item.id} className={`p-3 text-sm ${item.readAt ? '' : 'bg-accent/30'}`}><div className="flex gap-2"><span className="mt-1 size-2 shrink-0 rounded-full bg-primary" /><div className="min-w-0"><p className="font-medium">{item.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.message}</p><p className="mt-1 text-[11px] text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</p></div></div></li>)}</ul> : <p className="p-8 text-center text-sm text-muted-foreground">No notifications yet.</p>}<Link href="/notifications" className="block border-t border-border px-4 py-3 text-center text-sm font-medium text-primary hover:bg-muted">View all notifications</Link></div> : null}</div>;
}
