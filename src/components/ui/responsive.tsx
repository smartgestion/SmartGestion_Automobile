import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ResponsiveTableWrapperProps {
  children: ReactNode;
  className?: string;
}

export function ResponsiveTableWrapper({ children, className }: ResponsiveTableWrapperProps) {
  return (
    <div className={cn("w-full overflow-auto", className)}>
      <div className="min-w-[600px] md:min-w-0">
        {children}
      </div>
    </div>
  );
}

export function MobileCard({ children, className }: ResponsiveTableWrapperProps) {
  return (
    <div className={cn(
      "bg-card rounded-lg border p-4 md:hidden",
      className
    )}>
      {children}
    </div>
  );
}

export function HideOnMobile({ children, className }: ResponsiveTableWrapperProps) {
  return (
    <div className={cn("hidden md:block", className)}>
      {children}
    </div>
  );
}

export function ShowOnMobileOnly({ children, className }: ResponsiveTableWrapperProps) {
  return (
    <div className={cn("md:hidden", className)}>
      {children}
    </div>
  );
}