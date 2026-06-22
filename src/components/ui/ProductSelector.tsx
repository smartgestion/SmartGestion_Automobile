import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Plus, Minus, Package, ShoppingCart, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatCurrencyLocale } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Produit {
  id: number | string;
  reference?: string;
  designation?: string;
  nom?: string;
  marque?: string;
  prixVenteHt: number;
  prixVenteTtc?: number;
  tauxTva: number;
  stockActuel: number;
  imageUrl?: string;
  image_url?: string;
  prixAchatHt?: number;
}

interface ProductSelectorProps {
  produits: Produit[];
  onSelect: (produit: Produit, quantite: number) => void;
  trigger?: React.ReactNode;
  disabled?: boolean;
}

interface ProductCardProps {
  produit: Produit;
  onClick: () => void;
  selected: boolean;
  key?: string | number;
}

const StockBadge = ({ stock }: { stock: number }) => {
  const { t } = useTranslation()
  if (stock <= 0) {
    return <span className="text-[10px] font-semibold text-white bg-rose-500 px-2.5 py-1 rounded-full">{t('shared.product_selector.badge_out_of_stock')}</span>
  }
  if (stock <= 5) {
    return <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30 px-2.5 py-1 rounded-full">{t('shared.product_selector.badge_remaining', { count: stock })}</span>
  }
  return <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/30 px-2.5 py-1 rounded-full">{t('shared.product_selector.badge_in_stock', { count: stock })}</span>
}

const ProductCard = ({
  produit,
  onClick,
  selected,
}: ProductCardProps) => {
  const { t, i18n } = useTranslation()
  const stock = Number(produit.stockActuel ?? 0);
  const outOfStock = stock <= 0;
  const imageUrl = produit.imageUrl || produit.image_url;
  const displayName = produit.designation || produit.nom || t('shared.product_selector.default_product_name');

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={outOfStock}
      className={cn(
        "w-full relative text-start transition-all duration-200",
        "flex gap-4 items-start p-4",
        selected
          ? "bg-emerald-50/30 dark:bg-emerald-500/10"
          : "hover:bg-slate-50 dark:hover:bg-white/5",
        outOfStock && "opacity-50 cursor-not-allowed",
        "border-b border-slate-100 dark:border-white/10 last:border-0"
      )}
    >
      {/* Start-edge accent bar for selected state (logical: left in LTR, right in RTL) */}
      <div className={cn(
        "absolute start-0 top-2 bottom-2 w-[3px] rounded-e-full transition-all duration-200",
        selected ? "bg-emerald-500" : "bg-transparent"
      )} />

      {/* Product Image */}
      <div className={cn(
        "w-[68px] h-[68px] rounded-[12px] overflow-hidden shrink-0 border",
        selected ? "border-emerald-200 dark:border-emerald-500/30" : "border-slate-200 dark:border-white/10"
      )}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={displayName}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement?.classList.add('flex', 'items-center', 'justify-center');
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-white/5">
            <Package className="w-7 h-7 text-slate-300 dark:text-slate-500" />
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={cn(
              "text-sm font-semibold truncate",
              outOfStock ? "text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-card-foreground"
            )}>
              {displayName}
            </p>
            {(produit.marque || produit.reference) && (
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                {produit.marque && <span>{produit.marque}</span>}
                {produit.marque && produit.reference && <span> • </span>}
                {produit.reference && <span className="font-mono" dir="ltr">{produit.reference}</span>}
              </p>
            )}
          </div>
          <StockBadge stock={stock} />
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1.5 mt-3">
          <span
            dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
            className="text-lg font-black text-emerald-600 dark:text-emerald-400"
          >
            {formatCurrencyLocale(produit.prixVenteHt, i18n.language)}
          </span>
          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{t('shared.product_selector.price_ht')}</span>
          {produit.prixVenteTtc && (
            <>
              <span className="text-xs text-slate-300 dark:text-slate-600 mx-0.5">•</span>
              <span
                dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                className="text-sm font-bold text-slate-700 dark:text-slate-200"
              >
                {formatCurrencyLocale(produit.prixVenteTtc, i18n.language)}
              </span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{t('shared.product_selector.price_ttc')}</span>
            </>
          )}
          {produit.tauxTva !== undefined && (
            <>
              <span className="text-xs text-slate-300 dark:text-slate-600 mx-0.5">•</span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{t('shared.product_selector.vat_short')} {produit.tauxTva}%</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
};

export function ProductSelector({
  produits,
  onSelect,
  trigger,
  disabled,
}: ProductSelectorProps) {
  const { t } = useTranslation()
  const PAGE_SIZE = 5;
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<number | string | null>(null);
  const [quantite, setQuantite] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const filteredProduits = produits.filter(p => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    return (
      (p.designation || p.nom || '').toLowerCase().includes(searchLower) ||
      (p.reference || '').toLowerCase().includes(searchLower) ||
      (p.marque || '').toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredProduits.length / PAGE_SIZE));
  const paginatedProduits = filteredProduits.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset to the first page whenever the result set changes (search/open).
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, isOpen]);

  // Keep the current page within bounds if the list shrinks.
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const selectedProduit = produits.find(p => p.id === selectedId);
  const stock = selectedProduit ? Number(selectedProduit.stockActuel ?? 0) : 0;

  const handleSelect = (produit: Produit) => {
    if (selectedId === produit.id) {
      setSelectedId(null);
    } else {
      setSelectedId(produit.id);
      setQuantite(1);
    }
  };

  const handleConfirm = () => {
    if (selectedProduit) {
      onSelect(selectedProduit, quantite);
      setIsOpen(false);
      setSelectedId(null);
      setSearchTerm('');
      setQuantite(1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedId) {
      handleConfirm();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            disabled={disabled}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-[4px] shadow-none"
          >
            <ShoppingCart className="me-2 h-4 w-4" />
            {t('shared.product_selector.trigger')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-0 flex-shrink-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2.5">
            <div className="flex items-center justify-center h-9 w-9 rounded-[10px] bg-emerald-50 dark:bg-emerald-500/10 dark:border dark:border-emerald-500/20">
              <ShoppingCart className="h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400" />
            </div>
            {t('shared.product_selector.title')}
          </DialogTitle>

          {/* Search Bar — uses logical start/end positioning so the icon and
              clear button automatically flip in RTL (Arabic) layouts. */}
          <div className="mt-4 relative">
            <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <Input
              ref={searchInputRef}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('shared.product_selector.search_placeholder')}
              className="ps-10 pe-10 h-11 bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-white/10 dark:text-card-foreground dark:placeholder:text-slate-500 rounded-[10px] focus:bg-white focus:border-emerald-300 dark:focus:bg-slate-900/70 dark:focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/15 shadow-none text-sm transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label={t('shared.product_selector.clear_search')}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {searchTerm && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              {t('shared.product_selector.results', {
                count: filteredProduits.length,
                term: searchTerm,
              })}
            </p>
          )}
        </DialogHeader>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto py-2">
          {filteredProduits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="mb-5">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-300 dark:text-slate-600">
                  <rect x="16" y="24" width="48" height="40" rx="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <rect x="8" y="30" width="64" height="36" rx="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M32 38H48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M28 44H52" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M30 50H50" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="58" cy="22" r="10" fill="#FEE2E2" stroke="#EF4444" strokeWidth="1.5" />
                  <path d="M54 22H62" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M58 18V26" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {searchTerm
                  ? t('shared.product_selector.empty_no_match')
                  : t('shared.product_selector.empty_no_products')}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[220px]">
                {searchTerm
                  ? t('shared.product_selector.empty_no_match_hint', { term: searchTerm })
                  : t('shared.product_selector.empty_no_products_hint')}
              </p>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="mt-4 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 hover:underline transition-colors"
                >
                  {t('shared.product_selector.clear_search')}
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/10">
              {paginatedProduits.map((produit) => (
                <ProductCard
                  key={produit.id}
                  produit={produit}
                  onClick={() => handleSelect(produit)}
                  selected={selectedId === produit.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination — caps the list at 5 products per page. */}
        {filteredProduits.length > PAGE_SIZE && (
          <div className="flex-shrink-0 flex items-center justify-between gap-3 border-t border-slate-200 dark:border-white/10 px-6 py-3">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredProduits.length)} / {filteredProduits.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                aria-label="Previous"
                className="h-8 w-8 flex items-center justify-center rounded-[8px] border border-slate-200 bg-white text-slate-500 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50/50 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-500 disabled:hover:bg-white dark:disabled:hover:bg-slate-900/50 rtl:rotate-180"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums min-w-[44px] text-center">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Next"
                className="h-8 w-8 flex items-center justify-center rounded-[8px] border border-slate-200 bg-white text-slate-500 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50/50 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-500 disabled:hover:bg-white dark:disabled:hover:bg-slate-900/50 rtl:rotate-180"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Floating Dock Action Bar */}
        {selectedProduit && (
          <div className="flex-shrink-0 border-t border-slate-200 bg-white dark:border-white/10 dark:bg-[#0F172A] px-6 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between gap-4">
              {/* Minimal Quantity Selector */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-0 group">
                  <button
                    type="button"
                    onClick={() => setQuantite(Math.max(1, quantite - 1))}
                    className="h-9 w-9 flex items-center justify-center rounded-l-[10px] border border-slate-200 bg-white text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50/50 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 -mr-px"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <div className="relative">
                    <Input
                      type="number"
                      value={quantite}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setQuantite(Math.max(1, Math.min(stock, val)));
                      }}
                      min={1}
                      max={stock}
                      className="w-14 h-9 text-center font-bold text-sm rounded-none border-x-0 border-slate-200 bg-white dark:bg-slate-900/50 dark:border-white/10 dark:text-card-foreground focus:ring-0 focus:border-emerald-300 dark:focus:border-emerald-500/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuantite(Math.min(stock, quantite + 1))}
                    disabled={quantite >= stock}
                    className="h-9 w-9 flex items-center justify-center rounded-r-[10px] border border-slate-200 bg-white text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50/50 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 -ml-px disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                {stock <= 5 && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">{t('shared.product_selector.stock_limited')}</span>
                )}
              </div>

              <Button
                type="button"
                onClick={handleConfirm}
                className="h-10 px-5 rounded-[4px] bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-none"
              >
                <Plus className="me-2 h-4 w-4" />
                {t('shared.product_selector.add_to_cart')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
