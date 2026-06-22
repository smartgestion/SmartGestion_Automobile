import React from 'react'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

export interface KPICardProps {
  title: string
  value: string
  subtitle: string
  icon: React.ElementType
  change?: { value: string; positive: boolean; label?: string }
  iconContainerClass?: string
}

/**
 * KPICard — RTL-aware financial metric card.
 *
 * Layout behaviour:
 *   LTR  →  [Icon]  ........  (top-start corner)
 *            TITLE
 *            Value
 *            [badge]  subtitle
 *
 *   RTL  →  ........  [Icon]  (top-end corner, auto via justify-between + dir)
 *                      TITLE
 *                      Value
 *            subtitle  [badge]
 *
 * Key logical-property choices:
 *   - `text-start`   instead of `text-left`   (flips to right in RTL)
 *   - `ms-auto`      on the icon wrapper pushes it to the logical end in RTL
 *   - No physical `left-*` / `right-*` / `pl-*` / `pr-*` utilities
 *   - Numeric `value` rendered with `dir="ltr"` so digits always read left→right
 */
export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  change,
  iconContainerClass,
}: KPICardProps) {
  return (
    /* Responsive padding: tighter on phones (more cards per screen), generous
       on desktop. The icon and text sizes scale together so the visual rhythm
       stays consistent at every breakpoint. */
    <div className="rounded-[6px] bg-card p-3 sm:p-4 lg:p-5 border border-border">
      {/* Icon row — justify-between so icon sits at logical END,
          matching the original design's top-right placement in LTR
          and auto-mirroring to top-left in RTL */}
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        {/* invisible spacer keeps the icon pushed to the end */}
        <span />
        <div
          className={cn(
            'h-8 w-8 sm:h-10 sm:w-10 rounded-sm flex items-center justify-center shrink-0',
            iconContainerClass ?? 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300',
          )}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>

      {/* Title — `text-start` = left in LTR, right in RTL */}
      <p className="text-[10px] sm:text-xs font-medium text-muted-foreground tracking-wide uppercase text-start line-clamp-2">
        {title}
      </p>

      {/* Value — always LTR so DH 1,234.56 / ١٬٢٣٤٫٥٦ درهم reads correctly */}
      <p
        className="text-lg sm:text-xl lg:text-2xl font-bold text-card-foreground mt-0.5 tracking-tight text-start truncate"
        dir="ltr"
      >
        {value}
      </p>

      {/* Change badge + subtitle */}
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {change && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-[4px]',
              change.positive
                ? 'text-[#0EA5E9] bg-[#0EA5E9]/10'
                : 'text-red-400 bg-red-500/10',
            )}
            dir="ltr"
          >
            {change.positive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {change.value}
          </span>
        )}
        <span className="text-xs text-muted-foreground text-start">
          {change?.label ?? subtitle}
        </span>
      </div>
    </div>
  )
}
