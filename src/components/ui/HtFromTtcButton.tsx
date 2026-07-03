import { useState, useEffect, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Calculator, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

/**
 * A small calculator button that opens a popup to compute a "Prix HT" (price
 * excl. VAT) from a "Prix TTC" (price incl. VAT) and a VAT rate:
 *
 *   Prix HT     = Prix TTC / (1 + TVA/100)
 *   Montant TVA = Prix TTC − Prix HT
 *
 * On "Calculer" it fills the target field via `onResult` (rounded to 2
 * decimals) and closes the popup.
 */

interface HtFromTtcButtonProps {
  /** Called with the computed HT value (2-decimal rounded number). */
  onResult: (ht: number) => void;
  /** Optional VAT rate to prefill the popup (e.g. the current line's TVA). */
  defaultTva?: number;
  disabled?: boolean;
  /** Extra classes for the trigger button. */
  className?: string;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Accept both "," and "." decimal separators (French number entry).
const parseNum = (v: string): number => {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

export function HtFromTtcButton({ onResult, defaultTva = 20, disabled, className }: HtFromTtcButtonProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [ttcInput, setTtcInput] = useState('');
  const [tvaInput, setTvaInput] = useState(String(defaultTva ?? 20));
  const ttcRef = useRef<HTMLInputElement>(null);

  // Reset fields each time the popup opens (prefill TVA from the row).
  useEffect(() => {
    if (open) {
      setTtcInput('');
      setTvaInput(String(defaultTva ?? 20));
      requestAnimationFrame(() => ttcRef.current?.focus());
    }
  }, [open, defaultTva]);

  const ttc = parseNum(ttcInput);
  const tva = parseNum(tvaInput);

  const ttcInvalid = ttcInput.trim() !== '' && (Number.isNaN(ttc) || ttc < 0);
  const tvaInvalid = tvaInput.trim() !== '' && (Number.isNaN(tva) || tva < 0);
  const canCompute =
    ttcInput.trim() !== '' &&
    tvaInput.trim() !== '' &&
    !ttcInvalid &&
    !tvaInvalid &&
    !Number.isNaN(ttc) &&
    !Number.isNaN(tva);

  const preview = useMemo(() => {
    if (!canCompute) return null;
    const ht = ttc / (1 + tva / 100);
    return { ht: round2(ht), montantTva: round2(ttc - ht) };
  }, [canCompute, ttc, tva]);

  const fmt = (n: number) =>
    new Intl.NumberFormat(i18n.language?.startsWith('ar') ? 'ar' : i18n.language?.startsWith('en') ? 'en-US' : 'fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const handleCalculate = () => {
    if (!preview) return;
    onResult(preview.ht);
    setOpen(false);
  };

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCalculate();
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label={t('ht_calc.trigger_aria')}
        title={t('ht_calc.trigger_aria')}
        className={cn(
          'inline-flex h-9 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors',
          'hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600',
          'dark:border-white/10 dark:bg-slate-950/50 dark:text-slate-400 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className,
        )}
      >
        <Calculator className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm" dir={i18n.language?.startsWith('ar') ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                <Calculator className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </span>
              {t('ht_calc.title')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Prix TTC */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">{t('ht_calc.price_ttc')}</label>
              <Input
                ref={ttcRef}
                type="text"
                inputMode="decimal"
                value={ttcInput}
                onChange={(e) => setTtcInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="0,00"
                dir="ltr"
                className={cn('text-end tabular-nums', ttcInvalid && 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20')}
              />
              {ttcInvalid && <p className="text-[11px] font-medium text-destructive">{t('ht_calc.invalid_value')}</p>}
            </div>

            {/* TVA % */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">{t('ht_calc.tva_pct')}</label>
              <Input
                type="text"
                inputMode="decimal"
                value={tvaInput}
                onChange={(e) => setTvaInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="20"
                dir="ltr"
                className={cn('text-end tabular-nums', tvaInvalid && 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20')}
              />
              {tvaInvalid && <p className="text-[11px] font-medium text-destructive">{t('ht_calc.invalid_value')}</p>}
            </div>

            {/* Preview */}
            {preview && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('ht_calc.result_ht')}</span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums" dir="ltr">
                    {fmt(preview.ht)}
                  </span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('ht_calc.vat_amount')}</span>
                  <span className="text-sm font-bold text-popover-foreground tabular-nums" dir="ltr">
                    {fmt(preview.montantTva)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('ht_calc.cancel')}
            </Button>
            <Button type="button" onClick={handleCalculate} disabled={!preview}>
              <Check className="me-1.5 h-4 w-4" />
              {t('ht_calc.calculate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
