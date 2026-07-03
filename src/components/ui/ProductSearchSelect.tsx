import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Search, Package, ChevronDown, X, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn, formatCurrencyLocale } from '@/lib/utils'

/**
 * Normalized product shape used internally by the search component. Products
 * come from the DB either as raw snake_case rows (local SQLite adapter) or as
 * camelCase objects — `normalizeProduit` copes with both.
 */
export interface NormalizedProduit {
  id: number | string;
  reference: string;
  designation: string;
  nom: string;
  marque: string;
  barcode: string;
  prixVenteHt: number;
  prixAchatHt: number;
  tauxTva: number;
  stockActuel: number;
  raw: any;
}

/** Convert a raw/camelCase product row into a consistent shape. */
export function normalizeProduit(p: any): NormalizedProduit {
  const designation = p.designation || p.nom || '';
  return {
    id: p.id,
    reference: p.reference || '',
    designation,
    nom: p.nom || p.designation || '',
    marque: p.marque || '',
    barcode: p.barcode || '',
    prixVenteHt: Number(p.prixVenteHt ?? p.prix_vente_ht ?? 0),
    prixAchatHt: Number(p.prixAchatHt ?? p.prix_achat_ht ?? 0),
    tauxTva: Number(p.tauxTva ?? p.taux_tva ?? p.tva ?? 20),
    stockActuel: Number(p.stockActuel ?? p.stock_actuel ?? 0),
    raw: p,
  };
}

interface ProductSearchSelectProps {
  /** Raw or normalized product list. */
  produits: any[];
  /** Currently selected product id (as string), or empty. */
  value?: string;
  /** Fired with the selected product id (string) when a product is picked. */
  onSelect: (produitId: string) => void;
  /**
   * Which price to surface in the results — sale price for sales documents,
   * purchase price for purchase documents. Defaults to "sale".
   */
  priceMode?: 'sale' | 'purchase';
  disabled?: boolean;
  className?: string;
}

const StockPill = ({ stock }: { stock: number }) => {
  const { t } = useTranslation();
  if (stock <= 0) {
    return (
      <span className="text-[10px] font-semibold text-white bg-rose-500 px-1.5 py-0.5 rounded">
        {t('shared.product_search.out_of_stock')}
      </span>
    );
  }
  const cls =
    stock <= 5
      ? 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30'
      : 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/30';
  return (
    <span className={cn('text-[10px] font-semibold border px-1.5 py-0.5 rounded whitespace-nowrap', cls)}>
      {t('shared.product_search.in_stock', { count: stock })}
    </span>
  );
};

/**
 * Inline product search combobox. A drop-in replacement for the plain
 * per-row product `<Select>` used across all sales/purchase document forms.
 *
 * Features:
 *  - Search by product name, reference/code, brand or barcode.
 *  - Live dropdown results while typing.
 *  - Full keyboard navigation (Arrow Up/Down, Enter to pick, Escape to close).
 *  - Shows name, reference, stock quantity and unit price for each result.
 *  - Handles large catalogs (results capped for rendering performance).
 */
export function ProductSearchSelect({
  produits,
  value,
  onSelect,
  priceMode = 'sale',
  disabled,
  className,
}: ProductSearchSelectProps) {
  const { t, i18n } = useTranslation();
  const MAX_RESULTS = 50;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  // Fixed-position rect of the dropdown, computed from the trigger. The list is
  // rendered in a portal (document.body) so it is never clipped by the parent
  // table's `overflow-hidden` / `overflow-x-auto` scroll containers.
  const [rect, setRect] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Normalize once per produits change.
  const normalized = useMemo(() => (produits || []).map(normalizeProduit), [produits]);

  const selected = useMemo(
    () => (value ? normalized.find((p) => p.id.toString() === value) : undefined),
    [normalized, value],
  );

  // Filtered results: name, reference, barcode or brand contain the query.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = q
      ? normalized.filter(
          (p) =>
            p.designation.toLowerCase().includes(q) ||
            p.nom.toLowerCase().includes(q) ||
            p.reference.toLowerCase().includes(q) ||
            p.barcode.toLowerCase().includes(q) ||
            p.marque.toLowerCase().includes(q),
        )
      : normalized;
    return source.slice(0, MAX_RESULTS);
  }, [normalized, query]);

  // Reset active row whenever the result set changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  // Compute the dropdown's fixed position from the trigger's bounding rect,
  // choosing to open upward when there isn't enough room below.
  const DROPDOWN_MAX_H = 288; // matches max-h-72 (18rem)
  const updateRect = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < DROPDOWN_MAX_H && r.top > spaceBelow;
    setRect({
      top: openUp ? r.top : r.bottom,
      left: r.left,
      width: r.width,
      openUp,
    });
  }, []);

  // Track position while open (reposition on scroll/resize anywhere in the page).
  useLayoutEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    updateRect();
    const onScroll = () => updateRect();
    // capture:true so we also catch scrolling inside the table container.
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, updateRect]);

  // Close on outside click — accounts for the portaled list living outside
  // the container in the DOM tree.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        listRef.current && !listRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, results.length]);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    // focus after paint so the input is mounted
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [disabled]);

  const pick = useCallback(
    (p: NormalizedProduit | undefined) => {
      if (!p) return;
      onSelect(p.id.toString());
      setOpen(false);
      setQuery('');
    },
    [onSelect],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(results.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case 'Enter':
        e.preventDefault();
        pick(results[activeIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  const displayName = selected
    ? selected.designation || selected.nom || selected.reference || t('shared.product_search.unnamed')
    : '';

  const priceOf = (p: NormalizedProduit) => (priceMode === 'purchase' ? p.prixAchatHt : p.prixVenteHt);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger — shows the selected product, or acts as a search launcher. */}
      {!open ? (
        <button
          type="button"
          disabled={disabled}
          onClick={openDropdown}
          className={cn(
            'flex h-9 w-full items-center gap-2 rounded-md border bg-white px-3 text-sm transition-colors',
            'border-slate-200 hover:border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:hover:border-white/20',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
          <span
            className={cn(
              'flex-1 truncate text-start',
              selected ? 'text-slate-800 dark:text-card-foreground' : 'text-slate-400 dark:text-slate-500',
              value && !selected ? 'text-orange-500' : '',
            )}
          >
            {selected ? displayName : t('shared.product_search.placeholder')}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
        </button>
      ) : (
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('shared.product_search.search_placeholder')}
            className="h-9 ps-8 pe-8 rounded-md bg-white border-slate-200 dark:bg-slate-950/50 dark:border-white/10"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('shared.product_search.close')}
            className="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Results dropdown — rendered in a portal so it floats above the table
          and is never clipped by the parent's overflow containers. */}
      {open && rect && createPortal(
        <div
          ref={listRef}
          role="listbox"
          dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
          style={{
            position: 'fixed',
            top: rect.top,
            left: rect.left,
            width: Math.max(rect.width, 320),
            maxWidth: 'min(420px, 95vw)',
            transform: rect.openUp ? 'translateY(calc(-100% - 4px))' : 'translateY(4px)',
          }}
          className="z-[200] max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0F172A]"
        >
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 px-4 py-8 text-center">
              <Package className="h-6 w-6 text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {query
                  ? t('shared.product_search.no_match', { term: query })
                  : t('shared.product_search.no_products')}
              </p>
            </div>
          ) : (
            results.map((p, index) => {
              const isActive = index === activeIndex;
              const isSelected = selected?.id === p.id;
              const name = p.designation || p.nom || p.reference || t('shared.product_search.unnamed');
              return (
                <button
                  key={p.id}
                  type="button"
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => pick(p)}
                  className={cn(
                    'flex w-full items-center gap-3 border-b border-slate-50 px-3 py-2 text-start last:border-0 dark:border-white/5',
                    isActive ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'hover:bg-slate-50 dark:hover:bg-white/5',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {isSelected && <Check className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />}
                      <span className="truncate text-sm font-semibold text-slate-800 dark:text-card-foreground">
                        {name}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                      {p.reference && (
                        <span className="font-mono" dir="ltr">
                          {p.reference}
                        </span>
                      )}
                      {p.reference && p.marque && <span>•</span>}
                      {p.marque && <span className="truncate">{p.marque}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                      className="text-sm font-bold text-emerald-600 dark:text-emerald-400"
                    >
                      {formatCurrencyLocale(priceOf(p), i18n.language)}
                    </span>
                    <StockPill stock={p.stockActuel} />
                  </div>
                </button>
              );
            })
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
