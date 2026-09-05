'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function RefreshQuotesButton() {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => router.refresh()}
    >
      <RefreshCw />
      <span className="hidden md:inline">Refresh</span>
    </Button>
  );
}
