import { LoaderCircle } from 'lucide-react';

import { BrandMark } from '@/components/brand-mark';

export default function AppLoading() {
  return (
    <main
      aria-live="polite"
      aria-label="Loading Safawala CRM"
      className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-surface px-6 py-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(177,119,47,0.10),transparent_42%)]"
      />

      <section className="relative w-full max-w-[340px] rounded-2xl border border-[#e5d9ca] bg-white/95 px-8 py-8 text-center shadow-[0_18px_45px_rgba(67,48,28,0.10)] backdrop-blur-sm dark:border-border dark:bg-card/95">
        <BrandMark className="mx-auto mb-7 w-[220px] justify-center" />

        <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full border border-[#eadcca] bg-[#fffaf3] dark:border-border dark:bg-muted">
          <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary" strokeWidth={2.2} />
        </div>
        <p className="text-sm font-semibold text-foreground">Opening your workspace</p>
        <p className="mt-1 text-xs text-muted-foreground">Preparing Safawala CRM…</p>

        <div aria-hidden="true" className="mt-5 flex justify-center gap-1.5">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          <span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:160ms]" />
          <span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:320ms]" />
        </div>
      </section>
    </main>
  );
}
