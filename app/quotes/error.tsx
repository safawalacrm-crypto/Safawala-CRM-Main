'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function QuotesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="grid min-h-dvh place-items-center bg-surface p-6"><div className="max-w-md rounded-xl border bg-white p-8 text-center shadow-level-2"><span className="mx-auto grid size-12 place-items-center rounded-full bg-red-50 text-destructive"><AlertTriangle /></span><h1 className="mt-4 text-xl font-semibold">This quotes view could not load</h1><p className="mt-2 text-sm text-muted-foreground">Your data is safe. Check the connection and try again.</p><Button onClick={reset} className="mt-5">Try again</Button></div></main>;
}
