/**
 * TicketSettingsDialog
 * ─────────────────────────────────────────────────────────────────────
 * Two-pane modal where the user customises the look of the printed
 * cash-register ticket (used by VentesPassagers).
 *
 *   ┌───────────────────────────┬────────────────────────────┐
 *   │  Informations Magasin     │                            │
 *   │   • Nom du magasin        │      ╔══════════════╗      │
 *   │   • Sous-titre            │      ║  Live ticket ║      │
 *   │   • Téléphone / Adresse   │      ║   preview    ║      │
 *   │   • Pied de page          │      ╚══════════════╝      │
 *   │                           │                            │
 *   │  Apparence                │                            │
 *   │   • Police  • Taille      │                            │
 *   │   • Épaisseur  • Logo     │                            │
 *   ├───────────────────────────┴────────────────────────────┤
 *   │                          [Annuler]  [Enregistrer ...]  │
 *   └────────────────────────────────────────────────────────┘
 *
 * Persistence: `pg_ticket_settings` in localStorage (see
 * `@/lib/ticketSettings`). The dialog reads on open, updates a local
 * draft as the user types, and only commits to localStorage on Save.
 * Cancel/close discards the draft.
 *
 * The right pane is a real-time preview rendered with the same fonts /
 * sizes / weights that `VentesPassagers.handlePrint` will use, so what
 * the user sees here is exactly what gets printed.
 */

import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Receipt, Type, Upload, Save, X } from 'lucide-react'
import {
  DEFAULT_TICKET_SETTINGS,
  readTicketSettings,
  writeTicketSettings,
  sizeToPx,
  fontToFamily,
  type TicketSettings,
  type TicketFont,
  type TicketSize,
  type TicketWeight,
} from '@/lib/ticketSettings'
import { cn } from '@/lib/utils'

interface TicketSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const LOGO_MAX_BYTES = 500 * 1024 // 500 KB

export function TicketSettingsDialog({ open, onOpenChange }: TicketSettingsDialogProps) {
  const { t, i18n } = useTranslation()
  const tk = (key: string) => t(`parametres.ticket.${key}`)

  /** BCP-47 tag for the active UI language — drives the sample date in the
   *  preview so it formats correctly when the user switches FR / EN / AR.
   *  All three target the Moroccan locale to keep the receipt visually
   *  consistent with the real printed output. */
  const dateBcp47 = i18n.language?.startsWith('ar')
    ? 'ar-MA'
    : i18n.language?.startsWith('en')
      ? 'en-MA'
      : 'fr-MA'

  // Draft state — initialised from localStorage every time the dialog opens.
  const [draft, setDraft] = useState<TicketSettings>(DEFAULT_TICKET_SETTINGS)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Reload the saved value each time the dialog opens, so reopening after a
  // cancel resets the form rather than keeping a stale draft.
  useEffect(() => {
    if (open) setDraft(readTicketSettings())
  }, [open])

  /** Single-field setter — keeps the JSX terse. */
  const update = <K extends keyof TicketSettings>(key: K, value: TicketSettings[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  const handleSave = () => {
    writeTicketSettings(draft)
    toast.success(tk('toast_saved'))
    onOpenChange(false)
  }

  const handleLogoPick = () => logoInputRef.current?.click()

  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > LOGO_MAX_BYTES) {
      toast.error(tk('toast_logo_too_large'))
      return
    }
    // Inline as a base64 data-URL so the logo travels with the localStorage
    // value — no separate upload step needed for a tiny optional logo.
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') update('logoUrl', reader.result)
    }
    reader.readAsDataURL(file)
    // Reset so the same file can be re-picked later.
    e.currentTarget.value = ''
  }

  // ── Live preview ────────────────────────────────────────────────────
  // Sample data shown in the right pane. The figures are intentionally
  // round numbers so the user can focus on layout, not totals.
  const previewSizePx = sizeToPx(draft.size)
  const previewFamily = fontToFamily(draft.font)
  const previewWeight = draft.weight === 'bold' ? 700 : 400
  const sampleDate = new Date().toLocaleDateString(dateBcp47, {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
  const sampleNumber = '#0000'
  const sample1Total = 200
  const sample2Total = 150
  const sampleTotal = sample1Total + sample2Total

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Wider than the default `sm:max-w-lg` so the two panes fit
          comfortably side-by-side. On mobile they stack vertically. */}
      <DialogContent
        className={cn(
          'sm:max-w-[860px] w-[calc(100vw-1.5rem)] p-0 gap-0 overflow-hidden',
          'max-h-[92vh]'
        )}
        showCloseButton
      >
        {/* Accessible title — visually hidden because the form has its own
            section headings; we don't need a redundant heading bar. */}
        <DialogTitle className="sr-only">{tk('dialog_title')}</DialogTitle>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] max-h-[calc(92vh-4rem)] overflow-y-auto">
          {/* ── LEFT: form (scrollable) ─────────────────────────────── */}
          <div className="bg-card md:overflow-y-auto md:max-h-[calc(92vh-4rem)] p-5 sm:p-6 border-b md:border-b-0 md:border-e border-border">
            {/* Top heading bar with icon */}
            <div className="flex items-center gap-2 mb-5">
              <div className="h-7 w-7 rounded-md bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Receipt className="h-4 w-4" />
              </div>
              <h2 className="text-base font-semibold text-foreground">
                {tk('dialog_title')}
              </h2>
            </div>

            {/* ── Section 1: Store info ───────────────────────────── */}
            <fieldset className="rounded-lg border border-border p-4 mb-4">
              <legend className="px-1 text-xs font-semibold text-foreground uppercase tracking-wide">
                {tk('section_store')}
              </legend>

              <div className="space-y-3 mt-2">
                <div>
                  <Label htmlFor="tk-store" className="text-xs font-medium text-muted-foreground">
                    {tk('store_name')}
                  </Label>
                  <Input
                    id="tk-store"
                    value={draft.storeName}
                    onChange={(e) => update('storeName', e.target.value)}
                    placeholder={tk('store_name_ph')}
                    className="mt-1 h-9 text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="tk-sub" className="text-xs font-medium text-muted-foreground">
                    {tk('subtitle')}
                  </Label>
                  <Input
                    id="tk-sub"
                    value={draft.subtitle}
                    onChange={(e) => update('subtitle', e.target.value)}
                    placeholder={tk('subtitle_ph')}
                    className="mt-1 h-9 text-sm"
                  />
                </div>

                {/* Phone + address on one row at sm+, stacked below */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="tk-phone" className="text-xs font-medium text-muted-foreground">
                      {tk('phone')}
                    </Label>
                    <Input
                      id="tk-phone"
                      value={draft.phone}
                      onChange={(e) => update('phone', e.target.value)}
                      placeholder={tk('phone_ph')}
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tk-addr" className="text-xs font-medium text-muted-foreground">
                      {tk('address')}
                    </Label>
                    <Input
                      id="tk-addr"
                      value={draft.address}
                      onChange={(e) => update('address', e.target.value)}
                      placeholder={tk('address_ph')}
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="tk-footer" className="text-xs font-medium text-muted-foreground">
                    {tk('footer')}
                  </Label>
                  <Textarea
                    id="tk-footer"
                    value={draft.footer}
                    onChange={(e) => update('footer', e.target.value)}
                    placeholder={tk('footer_ph')}
                    rows={2}
                    className="mt-1 text-sm resize-none"
                  />
                </div>
              </div>
            </fieldset>

            {/* ── Section 2: Appearance ───────────────────────────── */}
            <fieldset className="rounded-lg border border-border p-4">
              <legend className="px-1 text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Type className="h-3 w-3" />
                {tk('section_appearance')}
              </legend>

              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">
                      {tk('font')}
                    </Label>
                    <Select
                      value={draft.font}
                      onValueChange={(v) => update('font', v as TicketFont)}
                    >
                      {/* `shadow-none` overrides the default `shadow-sm` baked
                          into the shared `SelectTrigger`, keeping these three
                          appearance-row dropdowns flat and visually quiet. */}
                      <SelectTrigger className="mt-1 h-9 text-sm shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Order chosen for usability: the thermal-printer
                            classic first, then the modern installed-on-every-OS
                            fonts in roughly increasing visual weight so the
                            picker reads as a soft "sharpness" gradient. */}
                        <SelectItem value="monospace">{tk('font_monospace')}</SelectItem>
                        <SelectItem value="arial">{tk('font_arial')}</SelectItem>
                        <SelectItem value="segoe">{tk('font_segoe')}</SelectItem>
                        <SelectItem value="tahoma">{tk('font_tahoma')}</SelectItem>
                        <SelectItem value="verdana">{tk('font_verdana')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">
                      {tk('size')}
                    </Label>
                    <Select
                      value={draft.size}
                      onValueChange={(v) => update('size', v as TicketSize)}
                    >
                      <SelectTrigger className="mt-1 h-9 text-sm shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">{tk('size_small')}</SelectItem>
                        <SelectItem value="medium">{tk('size_medium')}</SelectItem>
                        <SelectItem value="large">{tk('size_large')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">
                    {tk('weight')}
                  </Label>
                  <Select
                    value={draft.weight}
                    onValueChange={(v) => update('weight', v as TicketWeight)}
                  >
                    <SelectTrigger className="mt-1 h-9 text-sm shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">{tk('weight_normal')}</SelectItem>
                      <SelectItem value="bold">{tk('weight_bold')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Logo picker */}
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">
                    {tk('logo')}
                  </Label>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  {draft.logoUrl ? (
                    /* Show a thumbnail + remove control once a logo is set. */
                    <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
                      <img
                        src={draft.logoUrl}
                        alt=""
                        className="h-10 w-10 object-contain rounded bg-white border border-border"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {tk('logo')}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={handleLogoPick}
                      >
                        <Upload className="h-3.5 w-3.5 me-1.5" />
                        {tk('logo_pick')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-rose-600"
                        onClick={() => update('logoUrl', '')}
                        aria-label={tk('logo_clear')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleLogoPick}
                      className="mt-1 w-full h-9 justify-start text-xs text-emerald-600 border-dashed"
                    >
                      <Upload className="h-3.5 w-3.5 me-1.5" />
                      {tk('logo_pick')}
                    </Button>
                  )}
                </div>
              </div>
            </fieldset>
          </div>

          {/* ── RIGHT: live preview (dark canvas like the screenshot) ── */}
          <div className="bg-slate-900 dark:bg-[#0F172A] p-5 sm:p-6 flex flex-col items-center justify-center min-h-[420px] md:min-h-0">
            <div className="w-full max-w-[280px]">
              {/* Receipt card — white paper-like surface with a subtle
                  shadow. Force LTR + black text regardless of the dialog
                  context so the preview always reads like the printed
                  output (thermal printers do not respect dir=rtl). */}
              <div
                dir="ltr"
                className="bg-white text-black shadow-xl rounded-sm"
                style={{
                  padding: '14px 14px 18px',
                  fontFamily: previewFamily,
                  fontSize: `${previewSizePx}px`,
                  fontWeight: previewWeight,
                  lineHeight: 1.45,
                }}
              >
                {/* Optional logo above the store name */}
                {draft.logoUrl && (
                  <div className="flex justify-center mb-2">
                    <img
                      src={draft.logoUrl}
                      alt=""
                      style={{ maxHeight: 40, maxWidth: 120, objectFit: 'contain' }}
                    />
                  </div>
                )}

                {/* Centred store name + tagline + contact */}
                <div className="text-center">
                  <p style={{ fontWeight: 700, fontSize: `${previewSizePx + 2}px` }}>
                    {draft.storeName || '\u00A0'}
                  </p>
                  {draft.subtitle && <p>{draft.subtitle}</p>}
                  {draft.phone && <p>{draft.phone}</p>}
                  {draft.address && <p>{draft.address}</p>}
                </div>

                <Divider />

                {/* Meta row: date on the left, ticket number on the right */}
                <div className="flex justify-between">
                  <span>{tk('preview_date')}: {sampleDate}</span>
                  <span>{sampleNumber}</span>
                </div>

                <Divider />

                {/* Item table — two columns: product name | total */}
                <div className="flex justify-between" style={{ fontWeight: 700 }}>
                  <span>{tk('preview_col_product')}</span>
                  <span>{tk('preview_col_total')}</span>
                </div>

                <div className="flex justify-between mt-1">
                  <span>2x {tk('preview_sample_1')}</span>
                  <span>{formatCurrency(sample1Total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>1x {tk('preview_sample_2')}</span>
                  <span>{formatCurrency(sample2Total)}</span>
                </div>

                <Divider />

                {/* Use the app-wide `formatCurrency` so the preview matches
                    the printed ticket character-for-character (same grouping
                    separators, decimal style, and " DH" suffix). */}
                <div className="flex justify-between" style={{ fontWeight: 700 }}>
                  <span>{tk('preview_total')}</span>
                  <span>{formatCurrency(sampleTotal)}</span>
                </div>

                <Divider />

                {draft.footer && (
                  <p className="text-center mt-1">{draft.footer}</p>
                )}

                {/* Faux barcode block so the preview looks like a real till
                    receipt — purely visual, not a real barcode. */}
                <div className="mt-3 flex justify-center">
                  <div
                    className="bg-slate-100 text-slate-500 text-center px-3 py-1 text-[10px]"
                    style={{ fontFamily: 'monospace' }}
                  >
                    ||| || ||| | ||
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Save action — pinned to the bottom of the dialog */}
        <div className="border-t border-border bg-card flex items-center justify-end gap-2 p-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9"
          >
            {tk('btn_cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            <Save className="h-4 w-4 me-2" />
            {tk('btn_save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Dashed horizontal rule used inside the preview to mimic a real
 * thermal-printed ticket's dotted separator lines.
 * Kept inline rather than imported because it's only used here.
 */
function Divider() {
  return (
    <div
      className="my-2"
      style={{
        borderTop: '1px dashed #94a3b8',
      }}
    />
  )
}
