'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { createClient } from '@/lib/supabase/client';
import {
  Boxes,
  CalendarDays,
  ChevronUp,
  ClipboardList,
  ContactRound,
  FileText,
  Landmark,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  PlaneTakeoff,
  Plus,
  Route,
  Settings,
  Trophy,
  UserCheck,
  UsersRound,
  Wrench,
  UserCog,
} from 'lucide-react';

function SidebarNavigation() {
  const pathname = usePathname();
  const links = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/bookings', label: 'All bookings', icon: ClipboardList },
    { href: '/quotes', label: 'Quotes', icon: FileText },
    { href: '/bookings/new', label: 'Create booking', icon: Plus },
    { href: '/bookings/calendar', label: 'Calendar', icon: CalendarDays },
    { href: '/stylist-approvals', label: 'Stylist Approvals', icon: UserCheck },
    { href: '/travel', label: 'Travel Manager', icon: PlaneTakeoff },
    { href: '/performance', label: 'Performance', icon: Trophy },
    { href: '/event-tracking', label: 'Job Tracking', icon: Route },
    { href: '/modifications', label: 'Modifications', icon: Wrench },
    { href: '/inventory', label: 'Inventory', icon: Boxes },
    { href: '/packages', label: 'Package Manager', icon: Layers3 },
    { href: '/customers', label: 'Customers', icon: ContactRound },
    { href: '/ledger', label: 'Customer ledger', icon: Landmark },
    { href: '/staff', label: 'Staff', icon: UsersRound },
    { href: '/hr', label: 'HR & Staff', icon: UserCog },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];
  return (
    <nav aria-label="Primary navigation" className="mt-8 space-y-1">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          href === '/dashboard'
            ? pathname === href
            : href === '/bookings'
              ? pathname === href
              : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex h-11 items-center gap-2.5 rounded-lg border px-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'border-[#e4d2b6] bg-[#f5ead8] dark:bg-[#33291c] font-semibold text-[#70481c] dark:border-[#4a3c2a] dark:bg-[#33291c] dark:text-[#f0d9ad]' : 'border-transparent text-muted-foreground hover:bg-[#f7f4ef] dark:hover:bg-[#241e17] hover:text-foreground dark:hover:bg-[#241e17]'}`}
          >
            <span
              className={`grid size-7 place-items-center rounded-md ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              <Icon aria-hidden="true" className="size-4" />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function AccountPanel({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const initials = email.slice(0, 2).toUpperCase();

  async function signOut() {
    try {
      await createClient().auth.signOut();
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <div className="rounded-xl border border-[#e4d2b6] bg-[#fcfaf7] dark:bg-[#241e17] p-1.5 shadow-level-1 dark:border-[#3a2f22] dark:bg-[#241e17]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-[#f5ead8] dark:hover:bg-[#33291c]"
      >
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-[11px] font-semibold text-white shadow-sm"
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-xs font-semibold">
            Safawala Admin
          </strong>
          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
            {email}
          </span>
        </span>
        <ChevronUp
          aria-hidden="true"
          className={`size-4 shrink-0 text-muted-foreground transition ${open ? '' : 'rotate-180'}`}
        />
      </button>
      {open ? (
        <Button
          type="button"
          variant="ghost"
          onClick={signOut}
          className="mt-1 h-9 w-full justify-start px-3 text-muted-foreground hover:bg-red-50 hover:text-destructive dark:hover:bg-destructive/15"
          aria-label="Log out of Safawala CRM"
        >
          <LogOut aria-hidden="true" />
          <span>Log out</span>
        </Button>
      ) : null}
    </div>
  );
}

function BrandDivider() {
  return <div aria-hidden="true" className="mt-5 h-px bg-[#cec5b9] dark:bg-[#332b21]" />;
}

export function DashboardShell({
  email,
  children,
}: {
  email: string;
  children: ReactNode;
}) {
  const themeRootRef = useRef<HTMLDivElement>(null);

  // Applies the saved theme preference on every mount (hard page loads and
  // client-side/SPA navigations alike -- each route's page.tsx mounts its
  // own DashboardShell instance). Runs synchronously before the browser
  // paints, so there's no visible flash, and since it fires strictly after
  // hydration commits there's no hydration-mismatch warning either.
  useLayoutEffect(() => {
    const root = themeRootRef.current;
    if (!root) return;
    try {
      const stored = localStorage.getItem('safawala-theme');
      const shouldBeDark = stored
        ? stored === 'dark'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', shouldBeDark);
    } catch {}
  }, []);

  return (
    <div ref={themeRootRef} data-theme-root className="min-h-dvh bg-surface text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-white dark:bg-card px-4 py-6 dark:bg-card lg:flex">
        <BrandMark className="px-2" />
        <BrandDivider />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNavigation />
        </div>
        <div className="mt-4">
          <AccountPanel email={email} />
          <p className="mt-3 text-center text-[10px] text-muted-foreground">
            Safawala CRM · Version 1.0
          </p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="pointer-events-none sticky top-0 z-40 flex h-16 items-center justify-between border-b border-transparent bg-transparent px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Sheet>
              <SheetTrigger
                aria-label="Open navigation"
                className="pointer-events-auto fixed left-4 top-4 z-40 inline-flex size-9 items-center justify-center rounded-lg border border-border bg-white dark:bg-card text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-card lg:hidden"
              >
                <Menu aria-hidden="true" className="size-5" />
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex w-72 flex-col border-border bg-white dark:bg-card px-4 py-6 dark:bg-card"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                  <SheetDescription>
                    Safawala CRM primary navigation
                  </SheetDescription>
                </SheetHeader>
                <BrandMark className="px-2" />
                <BrandDivider />
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <SidebarNavigation />
                </div>
                <div className="mt-4">
                  <AccountPanel email={email} />
                </div>
              </SheetContent>
            </Sheet>
            <div className="min-w-0 flex-1" />
          <ThemeToggle className="pointer-events-auto inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-card" />
          </div>
        </header>
        <main className="bg-surface px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
