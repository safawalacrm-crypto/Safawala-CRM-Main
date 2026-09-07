import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function DashboardHeader({
  title,
  subtitle,
  actions,
  backHref,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  backHref?: string;
}) {
  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-30 flex h-16 min-w-0 items-center gap-3 border-b border-border/80 bg-white/95 pl-16 pr-16 backdrop-blur print:hidden sm:pl-20 sm:pr-20 lg:left-64 lg:pl-8 lg:pr-20">
      {backHref ? <Link href={backHref} aria-label="Back" className="pointer-events-auto grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-[#f5ead8] hover:text-[#70481c]"><ArrowLeft className="size-4" /></Link> : null}
      <div className={`min-w-0 flex-1 ${actions ? 'hidden sm:block' : ''}`}>
        <h1 className="truncate text-lg font-semibold leading-5 tracking-[-0.025em]">
          {title}
        </h1>
        <p className="mt-0.5 hidden truncate text-xs leading-4 text-muted-foreground sm:block">
          {subtitle}
        </p>
      </div>
      {actions ? (
        <div className="pointer-events-auto ml-auto flex min-w-0 max-w-full shrink items-center gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&_[data-slot=button]]:h-9 [&_[data-slot=button]]:min-w-9 [&_[data-slot=button]]:shrink-0 [&_[data-slot=button]]:rounded-lg [&_[data-slot=button]]:px-3 [&_[data-slot=button]]:text-sm">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
