'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
import { staffLogoutAction } from '@/lib/staff-portal/logout-action';
import { DEPARTMENT_META, type StaffDepartment } from '@/lib/staff-portal/constants';
import type { StaffDepartmentGrant } from '@/lib/staff-portal/types';
import {
  DEPARTMENT_STAFF_MODULES,
  STAFF_MODULE_META,
  type StaffModule,
} from '@/lib/staff-portal/modules';
import { ACCESS_MODULE_META, type AccessModule } from '@/lib/staff-portal/access-modules';
import {
  Bell,
  Activity,
  Boxes,
  CalendarDays,
  CalendarOff,
  ChevronUp,
  CircleGauge,
  Clock3,
  FileSignature,
  IndianRupee,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  Plus,
  ReceiptText,
  UserRound,
  UsersRound,
  Wrench,
} from 'lucide-react';

const DEPARTMENT_ICON: Record<StaffDepartment, typeof LayoutDashboard> = {
  booking: FileText,
  warehouse: Boxes,
  qc: ClipboardList,
  stylist: UserRound,
  collection: PackageCheck,
  modification: Wrench,
};

function SidebarNavigation({ modules }: { modules: AccessModule[] }) {
  const pathname = usePathname();
  const moduleIcons: Partial<Record<AccessModule, typeof LayoutDashboard>> = {
    dashboard: LayoutDashboard,
    quotations: ClipboardList,
    bookings: ReceiptText,
    create_booking: Plus,
    customers: UsersRound,
    event_jobs: ClipboardList,
    calendar: CalendarDays,
    performance: CircleGauge,
    stylist_approvals: UserRound,
    travel: CalendarDays,
    modifications: Wrench,
    inventory: Boxes,
    packages: PackageCheck,
    ledger: IndianRupee,
  };
  const seen = new Set<string>();
  const links = [
    { href: '/staff-portal', label: 'Home', icon: LayoutDashboard },
    ...modules.flatMap((module) => {
      const meta = ACCESS_MODULE_META[module];
      if (!meta.href || seen.has(meta.href)) return [];
      seen.add(meta.href);
      return [{ href: meta.href, label: meta.label, icon: moduleIcons[module] ?? LayoutDashboard }];
    }),
  ];
  return (
    <nav aria-label="Primary navigation" className="mt-8 space-y-1">
      {links.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === '/staff-portal'
            ? pathname === href
            : href === '/bookings'
              ? pathname === '/bookings' || /^\/bookings\/\d+/.test(pathname)
              : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex h-11 items-center gap-2.5 rounded-lg border px-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive ? 'border-[#e4d2b6] bg-[#f5ead8] font-semibold text-[#70481c]' : 'border-transparent text-muted-foreground hover:bg-[#f7f4ef] hover:text-foreground'}`}
          >
            <span
              className={`grid size-7 place-items-center rounded-md ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}
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

function AccountPanel({ name, departments }: { name: string; departments: StaffDepartmentGrant[] }) {
  const [open, setOpen] = useState(false);
  const initials = name.slice(0, 2).toUpperCase();
  const activeLabels = departments
    .filter((grant) => grant.active)
    .map((grant) => DEPARTMENT_META[grant.department].label);

  return (
    <div className="rounded-xl border border-[#e4d2b6] bg-[#fcfaf7] p-1.5 shadow-level-1">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-[#f5ead8]"
      >
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-[11px] font-semibold text-white shadow-sm"
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-xs font-semibold">{name}</strong>
          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
            {activeLabels.length ? activeLabels.join(', ') : 'No department access'}
          </span>
        </span>
        <ChevronUp
          aria-hidden="true"
          className={`size-4 shrink-0 text-muted-foreground transition ${open ? '' : 'rotate-180'}`}
        />
      </button>
      {open ? (
        <form action={staffLogoutAction}>
          <Button
            type="submit"
            variant="ghost"
            className="mt-1 h-9 w-full justify-start px-3 text-muted-foreground hover:bg-red-50 hover:text-destructive"
            aria-label="Log out of the staff portal"
          >
            <LogOut aria-hidden="true" />
            <span>Log out</span>
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function BrandDivider() {
  return <div aria-hidden="true" className="mt-5 h-px bg-[#cec5b9]" />;
}

export function StaffPortalShell({
  name,
  departments,
  children,
  notificationCount = 0,
  permissions,
  accessModules,
  isMainId,
}: {
  name: string;
  departments: StaffDepartmentGrant[];
  children: ReactNode;
  notificationCount?: number;
  permissions?: StaffModule[];
  accessModules?: AccessModule[];
  isMainId?: boolean;
}) {
  const effectiveModules = accessModules ?? [];
  return (
    <div className="min-h-dvh bg-surface">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-white px-4 py-6 lg:flex">
        <BrandMark className="px-2" />
        <BrandDivider />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNavigation modules={effectiveModules} />
        </div>
        <div className="mt-4">
          <AccountPanel name={name} departments={departments} />
          <p className="mt-3 text-center text-[10px] text-muted-foreground">Safawala Staff Portal</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="pointer-events-none sticky top-0 z-40 flex h-16 items-center justify-between border-b border-transparent bg-transparent px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Sheet>
              <SheetTrigger
                aria-label="Open navigation"
                className="pointer-events-auto fixed left-4 top-4 z-40 inline-flex size-9 items-center justify-center rounded-lg border border-border bg-white text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
              >
                <Menu aria-hidden="true" className="size-5" />
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col border-border bg-white px-4 py-6">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                  <SheetDescription>Safawala Staff Portal navigation</SheetDescription>
                </SheetHeader>
                <BrandMark className="px-2" />
                <BrandDivider />
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <SidebarNavigation modules={effectiveModules} />
                </div>
                <div className="mt-4">
                  <AccountPanel name={name} departments={departments} />
                </div>
              </SheetContent>
            </Sheet>
            <div className="min-w-0 flex-1" />
            <Link
              href="/staff-portal/notifications"
              aria-label="Notifications"
              className="pointer-events-auto relative inline-flex size-9 items-center justify-center rounded-lg border border-border bg-white text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Bell aria-hidden="true" className="size-4" />
              {notificationCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
                >
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              ) : null}
            </Link>
          </div>
        </header>
        <main className="bg-surface px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
