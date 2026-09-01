'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { createClient } from '@/lib/supabase/client';
import { BarChart3, ChevronDown, FileText, LayoutDashboard, LogOut, Menu, PanelsTopLeft, Plug, ScrollText, Settings, Users, type LucideIcon } from 'lucide-react';

const NAVIGATION: Array<{ label: string; icon: LucideIcon; active?: boolean }> = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Reports', icon: FileText },
  { label: 'Contracts', icon: ScrollText },
  { label: 'Analytics', icon: BarChart3 },
  { label: 'Templates', icon: PanelsTopLeft },
  { label: 'Clients', icon: Users },
  { label: 'Integrations', icon: Plug },
  { label: 'Settings', icon: Settings },
];

function SidebarNavigation() {
  return (
    <nav aria-label="Primary navigation" className="mt-8 space-y-1">
      {NAVIGATION.map(({ label, icon: Icon, active }) => (
        <a
          key={label}
          href={active ? '/dashboard' : `#${label.toLowerCase()}`}
          aria-current={active ? 'page' : undefined}
          className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}`}
        >
          <Icon aria-hidden="true" className="size-[18px]" />
          {label}
        </a>
      ))}
    </nav>
  );
}

function UserMenu({ email }: { email: string }) {
  const router = useRouter();
  const initials = email.slice(0, 2).toUpperCase();

  async function signOut() {
    try { await createClient().auth.signOut(); }
    finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-10 items-center gap-2 rounded-md px-2 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Open user menu">
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-primary text-[11px] font-semibold text-white">{initials}</span>
        <span className="hidden max-w-44 truncate text-sm font-medium sm:block">{email}</span>
        <ChevronDown aria-hidden="true" className="hidden size-4 text-muted-foreground sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2">
        <DropdownMenuLabel className="px-2 py-2">
          <span className="block text-xs font-normal text-muted-foreground">Signed in as</span>
          <span className="mt-1 block truncate text-sm font-medium text-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="h-9 px-2" variant="destructive">
          <LogOut aria-hidden="true" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardShell({ email, children }: { email: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-background px-4 py-6 lg:block">
        <BrandMark className="px-2" />
        <SidebarNavigation />
        <p className="absolute bottom-6 left-6 text-xs text-muted-foreground">Version 1.0</p>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" />}>
                <Menu aria-hidden="true" />
              </SheetTrigger>
              <SheetContent side="left" className="w-72 px-4 py-6">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                  <SheetDescription>Safawala CRM primary navigation</SheetDescription>
                </SheetHeader>
                <BrandMark className="px-2" />
                <SidebarNavigation />
              </SheetContent>
            </Sheet>
            <div>
              <p className="text-xs text-muted-foreground">Workspace</p>
              <h1 className="text-base font-semibold tracking-[-0.02em]">Dashboard</h1>
            </div>
          </div>
          <UserMenu email={email} />
        </header>
        <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
