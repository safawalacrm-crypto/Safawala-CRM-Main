export default function BookingsLoading() {
  return <div className="min-h-dvh bg-surface p-6 lg:pl-72"><div className="mx-auto max-w-[1440px] animate-pulse space-y-6"><div className="h-8 w-56 rounded bg-muted" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-32 rounded-xl border bg-white shadow-level-1" />)}</div><div className="h-[420px] rounded-xl border bg-white shadow-level-1" /></div></div>;
}
