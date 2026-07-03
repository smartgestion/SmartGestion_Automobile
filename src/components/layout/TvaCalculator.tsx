import { useState, useEffect, useRef, useCallback, useMemo, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Calculator, X, Check, Copy, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Quick TVA (VAT) calculator — a self-contained floating window that can be
 * dragged, resized, and stays open while the user keeps working in the ERP.
 * Its position and size are persisted to localStorage so it reappears where
 * the user last left it.
 *
 * Two modes:
 *   - TTC -> HT :  HT  = TTC / (1 + tva/100),  VAT = TTC - HT
 *   - HT  -> TTC:  TTC = HT  * (1 + tva/100),  VAT = TTC - HT
 */

type Mode = 'ttc_to_ht' | 'ht_to_ttc'

interface Position {
  x: number;
  y: number;
}
interface Size {
  width: number;
  height: number;
}

const POS_KEY = 'tva-calc-pos';
const SIZE_KEY = 'tva-calc-size';

const MIN_WIDTH = 280;
const MIN_HEIGHT = 360;
const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 440;

interface TvaCalculatorProps {
  open: boolean;
  onClose: () => void;
}

/** Clamp a window position so the title bar always stays on screen. */
function clampPosition(pos: Position, size: Size): Position {
  const maxX = Math.max(0, window.innerWidth - Math.min(size.width, window.innerWidth));
  const maxY = Math.max(0, window.innerHeight - 48); // keep the header grabbable
  return {
    x: Math.min(Math.max(0, pos.x), maxX),
    y: Math.min(Math.max(0, pos.y), maxY),
  };
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function TvaCalculator({ open, onClose }: TvaCalculatorProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');

  const [size, setSize] = useState<Size>(() =>
    readStored<Size>(SIZE_KEY, { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }),
  );
  const [position, setPosition] = useState<Position>(() => {
    const fallback: Position = {
      x: Math.max(16, window.innerWidth - DEFAULT_WIDTH - 24),
      y: 88,
    };
    return readStored<Position>(POS_KEY, fallback);
  });

  const [mode, setMode] = useState<Mode>('ttc_to_ht');
  const [priceInput, setPriceInput] = useState('');
  const [tvaInput, setTvaInput] = useState('20');
  const [copied, setCopied] = useState(false);

  const windowRef = useRef<HTMLDivElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  // Drag / resize interaction state kept in a ref to avoid re-renders per move.
  const drag = useRef<{
    type: 'move' | 'resize' | null;
    startX: number;
    startY: number;
    origin: Position;
    originSize: Size;
  }>({ type: null, startX: 0, startY: 0, origin: { x: 0, y: 0 }, originSize: { width: 0, height: 0 } });

  // Persist position & size (debounced via the state itself — cheap enough).
  useEffect(() => {
    localStorage.setItem(POS_KEY, JSON.stringify(position));
  }, [position]);
  useEffect(() => {
    localStorage.setItem(SIZE_KEY, JSON.stringify(size));
  }, [size]);

  // Re-clamp into view whenever the window is (re)opened or the viewport resizes.
  useEffect(() => {
    if (!open) return;
    setPosition((p) => clampPosition(p, size));
    const onResize = () => setPosition((p) => clampPosition(p, size));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, size]);

  // Focus the price field when the window opens.
  useEffect(() => {
    if (open) requestAnimationFrame(() => priceRef.current?.focus());
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // ── Drag & resize handling ───────────────────────────────────────────────
  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = drag.current;
    if (!d.type) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (d.type === 'move') {
      setPosition(clampPosition({ x: d.origin.x + dx, y: d.origin.y + dy }, d.originSize));
    } else {
      // Resize handle sits at the (logical) end/bottom corner.
      const width = Math.max(MIN_WIDTH, d.originSize.width + (isRTL ? -dx : dx));
      const height = Math.max(MIN_HEIGHT, d.originSize.height + dy);
      setSize({
        width: Math.min(width, window.innerWidth),
        height: Math.min(height, window.innerHeight),
      });
    }
  }, [isRTL]);

  const endInteraction = useCallback(() => {
    drag.current.type = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endInteraction);
  }, [onPointerMove]);

  const startInteraction = (type: 'move' | 'resize', e: ReactPointerEvent) => {
    e.preventDefault();
    drag.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      origin: position,
      originSize: size,
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = type === 'resize' ? 'nwse-resize' : 'grabbing';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endInteraction);
  };

  useEffect(() => () => endInteraction(), [endInteraction]);

  // ── Calculation ──────────────────────────────────────────────────────────
  // Accept both "," and "." as decimal separators (French number entry).
  const parseNum = (v: string): number => {
    const normalized = v.replace(/\s/g, '').replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : NaN;
  };

  const price = parseNum(priceInput);
  const tva = parseNum(tvaInput);

  const priceInvalid = priceInput.trim() !== '' && (Number.isNaN(price) || price < 0);
  const tvaInvalid = tvaInput.trim() !== '' && (Number.isNaN(tva) || tva < 0);
  const canCompute = priceInput.trim() !== '' && !priceInvalid && !tvaInvalid && !Number.isNaN(tva);

  const result = useMemo(() => {
    if (!canCompute) return null;
    if (mode === 'ttc_to_ht') {
      const ht = price / (1 + tva / 100);
      const montantTva = price - ht;
      return { main: ht, tva: montantTva, mainLabel: 'ht' as const };
    }
    const ttc = price * (1 + tva / 100);
    const montantTva = ttc - price;
    return { main: ttc, tva: montantTva, mainLabel: 'ttc' as const };
  }, [canCompute, mode, price, tva]);

  const fmt = useCallback(
    (n: number) =>
      new Intl.NumberFormat(isRTL ? 'ar' : i18n.language?.startsWith('en') ? 'en-US' : 'fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n),
    [i18n.language, isRTL],
  );

  const handleCopy = useCallback(() => {
    if (!result) return;
    const mainLabel =
      result.mainLabel === 'ht' ? t('calculator.result_ht') : t('calculator.result_ttc');
    const text = `${mainLabel}: ${fmt(result.main)} — ${t('calculator.result_vat')}: ${fmt(result.tva)}`;
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }, [result, fmt, t]);

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Instant recalculation already keeps the result live; Enter simply
      // blurs to confirm and (re)triggers the memo via a no-op state touch.
      setPriceInput((v) => v);
    }
  };

  if (!open) return null;

  const priceLabel = mode === 'ttc_to_ht' ? t('calculator.price_ttc') : t('calculator.price_ht');
  const mainResultLabel =
    result?.mainLabel === 'ttc' ? t('calculator.result_ttc') : t('calculator.result_ht');

  return (
    <div
      ref={windowRef}
      role="dialog"
      aria-label={t('calculator.title')}
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed z-[100] flex flex-col rounded-xl border border-border bg-popover shadow-2xl overflow-hidden animate-scale-in"
      style={{
        top: position.y,
        left: position.x,
        width: size.width,
        height: size.height,
      }}
    >
      {/* Title bar (drag handle) */}
      <div
        onPointerDown={(e) => startInteraction('move', e)}
        className="flex items-center gap-2 px-3 py-2.5 bg-muted/60 border-b border-border cursor-grab active:cursor-grabbing select-none shrink-0"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/60" />
        <Calculator className="h-4 w-4 text-emerald-500" />
        <span className="flex-1 text-sm font-semibold text-popover-foreground truncate">
          {t('calculator.title')}
        </span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          aria-label={t('calculator.close')}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Mode selector */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">{t('calculator.mode')}</p>
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted/50 rounded-lg">
            {(['ttc_to_ht', 'ht_to_ttc'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'py-1.5 px-2 rounded-md text-xs font-semibold transition-all',
                  mode === m
                    ? 'bg-popover text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(`calculator.${m}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Price input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">{priceLabel}</label>
          <input
            ref={priceRef}
            type="text"
            inputMode="decimal"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="0,00"
            dir="ltr"
            className={cn(
              'h-10 w-full rounded-lg border bg-background px-3 text-sm text-end tabular-nums outline-none transition-colors',
              priceInvalid
                ? 'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/20'
                : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20',
            )}
          />
          {priceInvalid && (
            <p className="text-[11px] font-medium text-destructive">{t('calculator.invalid_value')}</p>
          )}
        </div>

        {/* TVA input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">{t('calculator.tva_pct')}</label>
          <input
            type="text"
            inputMode="decimal"
            value={tvaInput}
            onChange={(e) => setTvaInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="20"
            dir="ltr"
            className={cn(
              'h-10 w-full rounded-lg border bg-background px-3 text-sm text-end tabular-nums outline-none transition-colors',
              tvaInvalid
                ? 'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/20'
                : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20',
            )}
          />
          {tvaInvalid && (
            <p className="text-[11px] font-medium text-destructive">{t('calculator.invalid_value')}</p>
          )}
        </div>

        {/* Result */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground">{t('calculator.result')}</p>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!result}
              aria-label={t('calculator.copy')}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors',
                result
                  ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                  : 'text-muted-foreground/40 cursor-not-allowed',
              )}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? t('calculator.copied') : t('calculator.copy')}
            </button>
          </div>

          {result ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{mainResultLabel}</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums" dir="ltr">
                  {fmt(result.main)}
                </span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t('calculator.result_vat')}</span>
                <span className="text-sm font-bold text-popover-foreground tabular-nums" dir="ltr">
                  {fmt(result.tva)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/60 py-2 text-center">
              {t('calculator.enter_values')}
            </p>
          )}
        </div>
      </div>

      {/* Resize handle — anchored to the logical bottom-end corner. */}
      <div
        onPointerDown={(e) => startInteraction('resize', e)}
        className={cn(
          'absolute bottom-0 h-4 w-4 cursor-nwse-resize',
          isRTL ? 'left-0' : 'right-0',
        )}
        style={{ touchAction: 'none' }}
      >
        <svg viewBox="0 0 16 16" className={cn('h-full w-full text-muted-foreground/40', isRTL && 'scale-x-[-1]')}>
          <path d="M14 6 L6 14 M14 10 L10 14 M14 14 L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
