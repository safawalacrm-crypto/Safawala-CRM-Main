import type { ReactNode } from 'react';

export function DashboardHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-30 flex h-16 min-w-0 items-center gap-3 border-b border-transparent bg-white/95 pl-16 pr-16 backdrop-blur print:hidden sm:pr-20 lg:left-64 lg:pl-8 lg:pr-20">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold leading-5 tracking-[-0.025em]">
          {title}
        </h1>
        <p className="mt-0.5 hidden truncate text-xs leading-4 text-muted-foreground sm:block">
          {subtitle}
        </p>
      </div>
      {actions ? (
        <div className="pointer-events-auto ml-auto flex min-w-0 shrink-0 items-center gap-2 [&_[data-slot=button]]:h-9 [&_[data-slot=button]]:min-w-9 [&_[data-slot=button]]:shrink-0 [&_[data-slot=button]]:rounded-lg [&_[data-slot=button]]:px-3 [&_[data-slot=button]]:text-sm">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
