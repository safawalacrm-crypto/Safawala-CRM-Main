export default function AppLoading() {
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] place-items-center bg-surface p-6">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-white dark:bg-card px-5 py-4 text-sm font-medium text-foreground shadow-level-1">
        <span
          aria-hidden="true"
          className="size-5 animate-spin rounded-full border-2 border-[#dfd3c3] border-t-primary"
        />
        Opening…
      </div>
    </div>
  );
}
