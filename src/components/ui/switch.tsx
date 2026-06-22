"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & { thumbClassName?: string }
>(({ className, thumbClassName, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        // RTL Note: the checked-state transform uses physical translate-x-5 in LTR
        // and is mirrored to -translate-x-5 in RTL via the rtl: variant so the thumb
        // always slides toward the "on" side of the track regardless of direction.
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-none ring-0 transition-transform",
        "data-[state=unchecked]:translate-x-0",
        "data-[state=checked]:translate-x-5 rtl:data-[state=checked]:-translate-x-5",
        thumbClassName
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
