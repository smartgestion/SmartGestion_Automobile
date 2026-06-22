import { cn } from '@/lib/utils';

interface BrandLogoProps {
  /** When true, renders the compact variant for a collapsed sidebar. */
  collapsed?: boolean;
  className?: string;
}

/**
 * SmartGestion brand wordmark — a simple text logo. "Smart" is white and
 * "Gestion" uses the sidebar accent blue, with an "INTEGRATED ERP SOLUTIONS"
 * tagline underneath. Centered and responsive. When collapsed, only "SG" shows.
 */
export function BrandLogo({ collapsed = false, className }: BrandLogoProps) {
  if (collapsed) {
    return (
      <span
        className={cn(
          'text-2xl font-extrabold tracking-tight leading-none select-none',
          className
        )}
        title="SmartGestion"
      >
        <span className="text-white">S</span>
        <span className="text-[#38BDF8]">G</span>
      </span>
    );
  }

  return (
    <div
      className={cn('flex flex-col items-center text-center select-none', className)}
      title="SmartGestion"
    >
      <span className="text-lg sm:text-xl font-extrabold tracking-tight leading-none whitespace-nowrap">
        <span className="text-white">Smart</span>
        <span className="text-[#38BDF8]">Gestion</span>
      </span>
      <span className="mt-1 text-[8px] sm:text-[9px] font-medium uppercase tracking-[0.18em] text-[#94A3B8] whitespace-nowrap">
        Integrated ERP Solutions
      </span>
    </div>
  );
}
