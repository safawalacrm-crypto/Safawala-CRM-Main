import { cn } from '@/lib/utils';

export function BrandMark({
  compact = false,
  inverse = false,
  className,
}: {
  compact?: boolean;
  inverse?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center', className)}>
      <span className="sr-only">Safawala.com by Ronak</span>
      <span
        aria-hidden="true"
        style={{
          WebkitMaskImage: "url('/safawala-wordmark-transparent.png')",
          maskImage: "url('/safawala-wordmark-transparent.png')",
          WebkitMaskPosition: 'left center',
          maskPosition: 'left center',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
        }}
        className={cn(
          'block aspect-[2037/535] w-full',
          compact ? 'max-w-36' : 'max-w-[210px]',
          inverse
            ? 'bg-[linear-gradient(90deg,#fff8ed_0%,#dfbc77_100%)]'
            : 'bg-[linear-gradient(90deg,#9a6728_0%,#70481c_35%,#332c24_100%)]',
        )}
      />
    </div>
  );
}
