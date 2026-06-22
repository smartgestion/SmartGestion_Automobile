import * as React from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  className,
  icon,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={cn("border rounded-lg bg-white overflow-hidden shadow-sm", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {icon && <div className="text-slate-500">{icon}</div>}
          <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">{title}</h3>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {isOpen && <div className="p-4 border-t bg-white">{children}</div>}
    </div>
  );
}
