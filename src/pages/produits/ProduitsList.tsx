import React, { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Plus, Search, FileEdit, Trash2, Package, AlertTriangle,
  ChevronLeft, ChevronRight, ImageIcon
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

import { toast } from 'sonner'
import { ProduitForm } from '@/components/forms/ProduitForm'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface Produit {
  id: number;
  reference: string;
  nom: string;
  designation?: string;
  marque?: string;
  barcode?: string;
  prixAchatHt: number;
  prixVenteHt: number;
  prixVenteTtc: number;
  tauxTva: number;
  stockActuel: number;
  stockMin: number;
  unite: string;
  imageUrl?: string;
  image_url?: string;
}

const ITEMS_PER_PAGE = 10;

export function ProduitsList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduit, setEditingProduit] = useState<Produit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [produitToDelete, setProduitToDelete] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const mapProduit = (p: any) => ({
    ...p,
    id: p.id,
    reference: p.reference || '',
    nom: p.designation || p.nom || '',
    designation: p.designation || p.nom || '',
    marque: p.marque || '',
    barcode: p.barcode || '',
    prixVenteHt: Number(p.prix_vente_ht || 0),
    prixAchatHt: Number(p.prix_achat_ht || 0),
    prixVenteTtc: Number(p.prix_vente_ttc || 0),
    prixAchatTtc: Number(p.prix_achat_ttc || 0),
    tauxTva: p.taux_tva == null ? 20 : Number(p.taux_tva),
    stockActuel: Number(p.stock_actuel || 0),
    stockMin: Number(p.stock_min || 0),
    unite: p.unite || '',
    imageUrl: p.image_url || p.imageUrl || undefined,
  });

  const fetchProduits = async () => {
    if (!user?.id) {
      setProduits([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('produits')
        .select('*')
        .eq('user_id', user.id)
        .order('nom');

      if (error) {
        toast.error(t('produits.toast_load_error'));
        setProduits([]);
        setIsLoading(false);
        return;
      }

      const mapped = (data || []).map(mapProduit);
      setProduits(mapped);
    } catch (error) {
      console.error('ERROR:', error);
      setProduits([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchProduits();
    }
  }, [user?.id]);

  const handleDelete = async () => {
    if (!produitToDelete || !user?.id) return;
    try {
      const productId = Number(produitToDelete);

      const { error } = await supabase
        .from('produits')
        .delete()
        .eq('id', productId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success(t('produits.toast_deleted'));
      fetchProduits();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || t('produits.toast_load_error'));
    } finally {
      setDeleteConfirmOpen(false);
      setProduitToDelete(null);
    }
  };

  const handleEdit = (produit: Produit) => {
    setEditingProduit(produit);
    setShowForm(true);
  };

  const openNewForm = () => {
    setEditingProduit(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingProduit(null);
  };

  const filteredProduits = useMemo(() => {
    if (!searchQuery.trim()) return produits;
    const query = searchQuery.toLowerCase();
    return produits.filter((produit) =>
      produit.designation?.toLowerCase().includes(query) ||
      produit.reference?.toLowerCase().includes(query) ||
      produit.barcode?.toLowerCase().includes(query) ||
      produit.marque?.toLowerCase().includes(query)
    );
  }, [produits, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredProduits.length / ITEMS_PER_PAGE));
  const paginatedProduits = filteredProduits.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const produitsCount = produits.length;
  const lowStockCount = produits.filter(p => p.stockActuel <= p.stockMin).length;
  const stockValue = produits.reduce((sum, p) => sum + (p.stockActuel * p.prixAchatHt), 0);
  const avgMargin = produitsCount > 0
    ? produits.reduce((sum, p) => {
        const margin = p.prixVenteHt > 0 ? ((p.prixVenteHt - p.prixAchatHt) / p.prixVenteHt) * 100 : 0;
        return sum + margin;
      }, 0) / produitsCount
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title={t('shared.confirm_delete.title_product')}
        description={t('shared.confirm_delete.body_product')}
      />

      {showForm ? (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={closeForm}>
              <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
            </Button>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">
                {editingProduit ? t('produits.dialog_edit') : t('produits.dialog_create')}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {editingProduit ? t('produits.dialog_subtitle_edit', { name: editingProduit.designation || editingProduit.nom }) : t('produits.dialog_subtitle_create')}
              </p>
            </div>
          </div>
          <div className="rounded-sm dark:bg-card dark:border-white/10 border border-slate-200 bg-white p-4 sm:p-6">
            <ProduitForm
              initialData={editingProduit}
              onSuccess={() => {
                closeForm();
                fetchProduits();
              }}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Header — stacks below sm, button becomes full-width on mobile */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-[6px] bg-amber-50 border border-amber-200/50 dark:bg-[#0F172A]/60 dark:border-white/10 shrink-0">
                <Package className="h-5 w-5 text-amber-500 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">{t('produits.page_title')}</h2>
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                  {t('produits.page_subtitle')}
                </p>
              </div>
            </div>
            <Button
              onClick={openNewForm}
              className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-[4px] h-10 px-5 shadow-none"
            >
              <Plus className="me-2 h-4 w-4" />
              {t('produits.new_button')}
            </Button>
          </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Left Column - Table */}
        <div className="lg:col-span-3 space-y-4 min-w-0">
          {/* Search — logical start-3 so the icon flips in RTL; full-width
              on mobile, max-w-md from sm up. */}
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none dark:text-slate-500" />
            <Input
              type="text"
              placeholder={t('produits.search_ph')}
              className="ps-9 h-10 bg-white border-slate-200 rounded-[4px] focus:border-slate-300 shadow-none text-sm dark:bg-[#0F172A] dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Table */}
          <Card className="border border-slate-200 shadow-none rounded-[6px] overflow-hidden dark:bg-[#0F172A] dark:border-white/10">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-100 dark:border-white/5">
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 w-[60px] dark:text-slate-400"></TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 dark:text-slate-400">{t('produits.col_ref')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 dark:text-slate-400">{t('produits.col_product')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 dark:text-slate-400">{t('produits.col_buy_price')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 dark:text-slate-400">{t('produits.col_sale_price')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 dark:text-slate-400">{t('produits.col_vat')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 dark:text-slate-400">{t('produits.col_price_ttc')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 text-right dark:text-slate-400">{t('produits.col_stock')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 text-right dark:text-slate-400">{t('produits.col_actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-48 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="h-8 w-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                          <p className="text-sm text-muted-foreground font-medium">{t('produits.loading')}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedProduits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-48 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                        <div className="bg-slate-50 rounded-[6px] p-4 border border-slate-100 dark:bg-[#0F172A]/40 dark:border-white/10">
                          <Package className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                        </div>
                        <p className="text-sm text-slate-500 font-medium dark:text-slate-400">
                            {searchQuery ? t('produits.empty_filtered') : t('produits.empty_all')}
                          </p>
                          {!searchQuery && (
                            <Button
                              variant="outline"
                              className="rounded-[4px] text-sm"
                              onClick={openNewForm}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              {t('produits.create_first')}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedProduits.map((produit) => (
                      <TableRow
                        key={produit.id}
                        className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors dark:border-white/5 dark:hover:bg-white/[0.02]"
                      >
                        <TableCell className="px-4 py-5">
                          {produit.imageUrl ? (
                            <img
                              src={produit.imageUrl}
                              alt={produit.designation || ''}
                              className="h-9 w-9 rounded-[4px] object-cover border border-slate-200 dark:border-white/10"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-[4px] bg-slate-100 flex items-center justify-center border border-dashed border-slate-200 dark:bg-slate-800 dark:border-white/10">
                              <ImageIcon className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                            {produit.reference || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-800 dark:text-white">
                              {produit.designation || '-'}
                            </span>
                            {produit.marque && (
                              <span className="text-[11px] text-slate-400 italic dark:text-slate-500">{produit.marque}</span>
                            )}
                            {produit.barcode && (
                              <span className="text-[10px] font-mono text-slate-300 mt-0.5 dark:text-slate-600">
                                {produit.barcode}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            {formatCurrency(produit.prixAchatHt)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            {formatCurrency(produit.prixVenteHt)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <span className="text-xs text-slate-400 dark:text-slate-500">{produit.tauxTva}%</span>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(produit.prixVenteTtc)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {produit.stockActuel <= produit.stockMin && (
                              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 dark:text-amber-400" />
                            )}
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
                              produit.stockActuel <= produit.stockMin
                                ? "bg-rose-50 text-rose-700 border border-rose-200/50 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                            )}>
                              {produit.stockActuel} {produit.unite}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-5 text-right">
                          <div className="flex justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[4px] dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5"
                              onClick={() => handleEdit(produit)}
                              title={t('shared.actions.edit')}
                            >
                              <FileEdit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-[4px] dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-red-500/10"
                              onClick={() => {
                                setProduitToDelete(produit.id);
                                setDeleteConfirmOpen(true);
                              }}
                              title={t('shared.actions.delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {!isLoading && paginatedProduits.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-white/5">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredProduits.length)} {t('shared.pagination.of')} {filteredProduits.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-[4px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5"
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-8 min-w-[32px] rounded-[4px] text-sm font-medium",
                        page === currentPage
                          ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-white"
                          : "text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:text-slate-500 dark:hover:text-white dark:hover:bg-white/5"
                      )}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-[4px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5"
                    disabled={currentPage === totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column - Summary */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border border-slate-200 shadow-none rounded-[6px] dark:bg-[#0F172A] dark:border-white/10">
            <CardHeader className="px-4 py-4 border-b border-slate-100 dark:border-white/5">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('produits.sidebar_title')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-4 space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-[6px] bg-amber-50 border border-amber-200/50 shrink-0 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                  <Package className="h-4 w-4 text-amber-500 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('produits.sidebar_total')}</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-white" dir="ltr">{produitsCount}</p>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-white/5 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t('produits.sidebar_low_stock')}</span>
                  </div>
                  <span className={cn(
                    "text-sm font-semibold",
                    lowStockCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                  )} dir="ltr">
                    {lowStockCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{t('produits.sidebar_value')}</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300" dir="ltr">{formatCurrency(stockValue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{t('produits.sidebar_margin')}</span>
                  <span className={cn(
                    "text-sm font-semibold",
                    avgMargin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )} dir="ltr">
                    {avgMargin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
