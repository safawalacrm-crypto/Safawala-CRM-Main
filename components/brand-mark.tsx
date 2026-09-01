import Image from 'next/image';
import { cn } from '@/lib/utils';

export function BrandMark({ compact = false, inverse = false, className }: { compact?: boolean; inverse?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', inverse && 'text-white', className)} aria-label="Safawala CRM">
      <span aria-hidden="true" className="block size-10 shrink-0 overflow-hidden">
        <Image src={inverse ? '/safawala-crown-light.png' : '/safawala-crown-dark.png'} alt="" width={120} height={40} className="h-10 w-auto max-w-none object-contain object-left" />
      </span>
      {!compact && <span className="text-[15px] font-semibold tracking-[-0.02em]">SAFAWALA CRM</span>}
    </div>
  );
}
