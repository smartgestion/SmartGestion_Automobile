import React from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { Check, Info, AlertTriangle, X, Loader2 } from "lucide-react"

/**
 * Application-wide toast/notification renderer.
 *
 * Visual design notes
 * ─────────────────────────────────────────────────────────────────────
 * The default sonner toast is a flat pill with a thin neutral icon. To
 * align with the rest of the ParaGestion UI we render:
 *
 *  • A coloured circular icon badge per variant (success=emerald,
 *    info=blue, warning=amber, error=rose) so the user can tell the
 *    severity at a glance from a metre away.
 *  • A 3px leading accent bar driven by the same variant colour. The
 *    bar uses the logical `start` edge so it flips to the right in RTL.
 *  • Generous padding, larger title text, optional description below.
 *  • A soft layered shadow + tinted border so toasts feel like floating
 *    cards consistent with `Card` and `Dialog` elsewhere.
 *
 * Everything is overridable per-call via sonner's `style` / `className`
 * props — we only set the *defaults*. The visual rules live in
 * `index.css` under `.cn-toast` + `[data-type=...]` selectors so we keep
 * the icon JSX terse here and the CSS in one place.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Sensible defaults: a touch longer than sonner's stock 4s so users
      // have time to read longer messages; `expand` makes the stack open
      // on hover instead of staying tightly collapsed.
      duration={4500}
      expand
      visibleToasts={5}
      // We render the icons OURSELVES inside `.cn-toast-icon` (CSS-styled
      // circular badge) — the icons sonner exposes via the `icons` prop
      // sit in a built-in slot that ignores our background colour, so we
      // override at the JSX level to gain full control over shape/colour.
      icons={{
        success: <Check className="size-3.5" strokeWidth={3} />,
        info:    <Info className="size-3.5" strokeWidth={2.5} />,
        warning: <AlertTriangle className="size-3.5" strokeWidth={2.5} />,
        error:   <X className="size-3.5" strokeWidth={3} />,
        loading: <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />,
      }}
      style={
        {
          // Default surface (overridden per-variant in `.cn-toast` CSS).
          "--normal-bg":     "var(--popover)",
          "--normal-text":   "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "12px",
        } as React.CSSProperties
      }
      toastOptions={{
        // `cn-toast` is the single hook into our CSS. Variant-specific
        // styling is matched on `[data-type="success|info|warning|error"]`
        // attribute that sonner adds automatically.
        classNames: {
          toast:       "cn-toast",
          title:       "cn-toast-title",
          description: "cn-toast-description",
          icon:        "cn-toast-icon",
          actionButton: "cn-toast-action",
          cancelButton: "cn-toast-cancel",
          closeButton:  "cn-toast-close",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
