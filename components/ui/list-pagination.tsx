'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const LIST_PAGE_SIZES = [10, 25, 50, 100] as const;

export function ListPagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'items',
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  itemLabel?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-b bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <p className="text-muted-foreground" aria-live="polite">
          {total === 0 ? (
            `No ${itemLabel} to show`
          ) : (
            <>
              Showing <strong className="text-foreground">{from}</strong> to{' '}
              <strong className="text-foreground">{to}</strong> of{' '}
              <strong className="text-foreground">{total}</strong> {itemLabel}
            </>
          )}
        </p>
        <label className="flex items-center gap-2 text-muted-foreground">
          <span>Items per page</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-9 rounded-lg border bg-white px-3 font-semibold text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            aria-label={`Items per page for ${itemLabel}`}
          >
            {LIST_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-20 text-center text-xs text-muted-foreground">
          Page {safePage} of {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={safePage >= pageCount}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
