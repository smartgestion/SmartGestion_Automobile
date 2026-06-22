/**
 * Global Select primitives — built on top of Base UI's `Select`.
 *
 * This file is the SINGLE SOURCE OF STYLING for every dropdown/select in the
 * application. Modifying any class name here propagates to every screen.
 *
 * Design goals (kept in sync with the broader UI checklist):
 *   1. Premium look — rounded-xl popup, soft shadow, crisp border, modern
 *      typography (text-sm), generous item padding.
 *   2. Bulletproof RTL — every physical (`left-*`, `right-*`, `text-left`,
 *      `pr-*`, `pl-*`) class has been replaced with logical equivalents
 *      (`start-*`, `end-*`, `text-start`, `pe-*`, `ps-*`). Direction is
 *      provided application-wide by the `<DirectionProvider>` in `App.tsx`,
 *      driven by the active i18n language.
 *   3. No viewport overflow — Base UI's collision-avoidance is enabled with
 *      a generous `collisionPadding` so the popup never clips the edge of
 *      the screen on Arabic (RTL) layouts where the trigger sits near the
 *      right edge.
 *   4. Trigger-matched width — `w-(--anchor-width)` makes the popup as wide
 *      as the trigger by default; downstream callers can opt out by passing
 *      a different `className`.
 *   5. Selected indicator — a checkmark on the trailing edge of the active
 *      item (flips automatically in RTL).
 */

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

/*
 * Label registry context
 * ──────────────────────
 * Base UI's `<Select.Value>` renders the raw `value` of the selected item by
 * default. That meant filter dropdowns across the app were showing things
 * like `en_attente` or `thisYear` in the trigger instead of their translated
 * labels.
 *
 * To fix this app-wide WITHOUT touching every call site, the `<Select>`
 * wrapper now exposes a per-instance registry. Each `<SelectItem>` registers
 * its rendered children under its `value`, and `<SelectValue>` consults the
 * registry to display the proper label.
 *
 * No caller-side API changes are required — the existing
 *   <SelectValue placeholder={...} />
 * pattern now automatically resolves to a localized label.
 */
type LabelRegistry = {
  register: (value: string, label: React.ReactNode) => void
  unregister: (value: string) => void
  get: (value: string) => React.ReactNode | undefined
  subscribe: (cb: () => void) => () => void
}

const SelectLabelsContext = React.createContext<LabelRegistry | null>(null)

/**
 * Recursively walk a React children tree to collect every `<SelectItem>`'s
 * `value` → `children` mapping. Used so the trigger can show a translated
 * label even when the popup hasn't been opened yet (Base UI's popup, and
 * therefore the items inside it, are not mounted until the first open).
 */
function collectLabels(
  children: React.ReactNode,
  out: Map<string, React.ReactNode>
): void {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    // `SelectItem` is the only element type that contributes a label.
    if (child.type === SelectItem) {
      const props = child.props as { value?: unknown; children?: React.ReactNode }
      if (props.value != null) {
        out.set(String(props.value), props.children)
      }
      return
    }
    // Recurse into any container (Fragment, SelectContent, SelectGroup, …).
    const props = (child.props ?? {}) as { children?: React.ReactNode }
    if (props.children !== undefined) {
      collectLabels(props.children, out)
    }
  })
}

function Select({ children, ...props }: SelectPrimitive.Root.Props<unknown>) {
  // Re-scan whenever the children change so newly added items contribute
  // labels (and removed ones disappear).
  const labels = React.useMemo(() => {
    const map = new Map<string, React.ReactNode>()
    collectLabels(children, map)
    return map
  }, [children])

  // Stable subscriber set. Currently unused (labels are derived from
  // children so SelectValue re-renders alongside Select), but kept for API
  // symmetry in case future callers register out-of-band.
  const subsRef = React.useRef(new Set<() => void>())

  const registry = React.useMemo<LabelRegistry>(() => ({
    register: (value, label) => {
      labels.set(value, label)
      subsRef.current.forEach((cb) => cb())
    },
    unregister: (value) => {
      labels.delete(value)
      subsRef.current.forEach((cb) => cb())
    },
    get: (value) => labels.get(value),
    subscribe: (cb) => {
      subsRef.current.add(cb)
      return () => {
        subsRef.current.delete(cb)
      }
    },
  }), [labels])

  return (
    <SelectLabelsContext.Provider value={registry}>
      <SelectPrimitive.Root {...props}>{children}</SelectPrimitive.Root>
    </SelectLabelsContext.Provider>
  )
}

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

function SelectValue({ className, children, ...props }: SelectPrimitive.Value.Props) {
  const registry = React.useContext(SelectLabelsContext)

  // Re-render whenever the labels registry changes (items mount/unmount).
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0)
  React.useEffect(() => {
    if (!registry) return
    return registry.subscribe(() => forceUpdate())
  }, [registry])

  // If the caller already passed an explicit render fn or node, honor it
  // verbatim — that's a deliberate override (e.g. status pills in tables).
  const resolvedChildren: SelectPrimitive.Value.Props["children"] =
    children !== undefined
      ? children
      : registry
        ? (value: unknown) => {
            if (value == null || value === "") return null
            const key = String(value)
            const label = registry.get(key)
            // Fall back to the raw value if no label was registered yet
            // (e.g. before items have mounted). This preserves the previous
            // behaviour rather than rendering nothing.
            return label !== undefined ? label : key
          }
        : undefined

  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-start", className)}
      {...props}
    >
      {resolvedChildren}
    </SelectPrimitive.Value>
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        // Layout / sizing
        "flex w-fit items-center justify-between gap-1.5 py-2 ps-3 pe-2 text-sm whitespace-nowrap",
        // Surface
        "rounded-lg border border-input bg-transparent shadow-sm transition-colors outline-none select-none",
        // States
        "hover:bg-slate-50 dark:hover:bg-slate-800/60",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        // Placeholder text colour
        "data-placeholder:text-muted-foreground",
        // Sizes
        "data-[size=default]:h-9 data-[size=sm]:h-8",
        // Value text alignment / clamping
        "*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5",
        // Dark
        "dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        // SVG sanity
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground transition-transform data-[open=true]:rotate-180" />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 6,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = false,
  collisionPadding = 12,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    | "align"
    | "alignOffset"
    | "side"
    | "sideOffset"
    | "alignItemWithTrigger"
    | "collisionPadding"
    | "collisionBoundary"
    | "collisionAvoidance"
    | "sticky"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        // `alignItemWithTrigger` overlaps the popup with the trigger so the
        // selected item sits exactly on the trigger's value. We default to
        // `false` to get the more predictable "appears just below the
        // trigger" behaviour familiar from modern web apps (Linear, Stripe,
        // Vercel, etc.). Callers that need the original behaviour can opt in.
        alignItemWithTrigger={alignItemWithTrigger}
        // Generous collision padding so the popup never clips the viewport
        // edge — especially important in Arabic (RTL) where triggers often
        // sit near the right edge of the screen.
        collisionPadding={collisionPadding}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            // Layout
            "relative isolate z-50 max-h-(--available-height) min-w-(--anchor-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto",
            // Premium surface
            "rounded-xl border border-slate-200/80 bg-popover text-popover-foreground shadow-xl ring-1 ring-black/[0.04]",
            "dark:border-white/10 dark:ring-white/5 dark:shadow-2xl dark:shadow-black/40",
            // Inner spacing so first/last items breathe
            "p-1",
            // Open / close animation
            "duration-100",
            "data-[align-trigger=true]:animate-none",
            "data-[side=bottom]:slide-in-from-top-2",
            "data-[side=inline-end]:slide-in-from-left-2",
            "data-[side=inline-start]:slide-in-from-right-2",
            "data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2",
            "data-[side=top]:slide-in-from-bottom-2",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  // Labels are collected at the <Select> wrapper level by walking the JSX
  // children tree, so no per-item registration is needed here.
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        // Layout — logical padding so the checkmark slot is on the end side
        // in both LTR and RTL.
        "relative flex w-full cursor-default items-center gap-2 py-2 ps-3 pe-9 text-sm text-start outline-hidden select-none",
        // Shape
        "rounded-lg",
        // Hover / focus / highlight (Base UI sets data-highlighted on keyboard
        // navigation and pointer hover when highlightItemOnHover is true).
        "transition-colors",
        "hover:bg-slate-50 dark:hover:bg-slate-800/80",
        "focus:bg-slate-100 focus:text-foreground dark:focus:bg-slate-700/70",
        "data-[highlighted]:bg-slate-100 data-[highlighted]:text-foreground dark:data-[highlighted]:bg-slate-700/70",
        // Selected state (Base UI sets data-selected on the active item)
        "data-[selected]:font-medium data-[selected]:text-foreground",
        // Disabled
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        // SVG sanity
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // Last <span> inside (Base UI's value text wrapper) — keep its
        // children laid out horizontally with consistent spacing.
        "*:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          // Logical `end-2` flips to the correct visual side based on the
          // ambient text direction provided by `<DirectionProvider>`.
          <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 flex size-4 items-center justify-center text-primary" />
        }
      >
        <CheckIcon className="pointer-events-none size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "sticky top-0 z-10 flex w-full cursor-default items-center justify-center rounded-t-xl bg-popover/95 backdrop-blur py-1 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <ChevronUpIcon />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "sticky bottom-0 z-10 flex w-full cursor-default items-center justify-center rounded-b-xl bg-popover/95 backdrop-blur py-1 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <ChevronDownIcon />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
