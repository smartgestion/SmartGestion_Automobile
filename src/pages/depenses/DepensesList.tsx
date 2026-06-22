import React, { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Plus, Search, FileEdit, Trash2, Receipt, Wallet, Building2,
  ChevronLeft, ChevronRight, Filter, TrendingUp, TrendingDown,
  Landmark, CreditCard, Banknote, CalendarDays, ArrowUpRight
} from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatCurrencyLocale, formatDate } from '@/lib/utils'

import { DepenseForm } from '@/components/forms/DepenseForm'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface Depense {
  id: number;
  reference: string;
  categorie: string;
  description: string;
  montantHt: number;
  montantTva: number;
  montantTtc: number;
  dateDepense: string;
  modePaiement: string;
  fournisseurId: number;
  fournisseur?: { nom: string; nomSociete?: string; email?: string };
}

const ITEMS_PER_PAGE = 10;

export function DepensesList() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth();
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDepense, setEditingDepense] = useState<any | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [depenseToDelete, setDepenseToDelete] = useState<number | null>(null);

  const categoryConfig: Record<string, { label: string; color: string; bg: string; pieColor: string }> = {
    fournitures: { label: t('depenses.categories.supplies'), color: 'text-sky-700', bg: 'bg-sky-50 text-sky-700 border border-sky-200/50', pieColor: '#0EA5E9' },
    loyer: { label: t('depenses.categories.rent'), color: 'text-violet-700', bg: 'bg-violet-50 text-violet-700 border border-violet-200/50', pieColor: '#8B5CF6' },
    salaires: { label: t('depenses.categories.salaries'), color: 'text-emerald-700', bg: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50', pieColor: '#10B981' },
    marketing: { label: t('depenses.categories.marketing'), color: 'text-orange-700', bg: 'bg-orange-50 text-orange-700 border border-orange-200/50', pieColor: '#F97316' },
    stock: { label: t('depenses.categories.stock'), color: 'text-amber-700', bg: 'bg-amber-50 text-amber-700 border border-amber-200/50', pieColor: '#F59E0B' },
    autre: { label: t('depenses.categories.other'), color: 'text-slate-600', bg: 'bg-slate-50 text-slate-600 border border-slate-200/50', pieColor: '#94A3B8' },
  };

  const paymentIcons: Record<string, { icon: React.ElementType; label: string }> = {
    espèces: { icon: Banknote, label: t('shared.payment_modes.cash') },
    chèque: { icon: Landmark, label: t('shared.payment_modes.cheque') },
    virement: { icon: CreditCard, label: t('shared.payment_modes.bank_transfer') },
    carte: { icon: CreditCard, label: t('shared.payment_modes.card') },
  };

  const mapDepense = (d: any) => ({
    ...d,
    id: d.id,
    reference: d.reference || '',
    categorie: d.categorie || 'autre',
    description: d.description || '',
    montantHt: Number(d.montant_ht || d.montantHt || 0),
    montantTva: Number(d.montant_tva || d.montantTva || 0),
    montantTtc: Number(d.montant_ttc || d.montantTtc || 0),
    dateDepense: d.date_depense,
    modePaiement: d.mode_paiement || 'virement',
    fournisseurId: d.fournisseur_id,
    fournisseur: d.fournisseur,
  });

  const fetchDepenses = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('depenses')
        .select('*, fournisseur:fournisseurs(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDepenses(Array.isArray(data) ? (data || []).map(mapDepense) : []);
    } catch (error) {
      console.error('Failed to fetch depenses', error);
      toast.error(t('depenses.toast_load_error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchDepenses();
    }
  }, [user?.id]);

  const handleDelete = async () => {
    if (!depenseToDelete) return;

    try {
      const { error } = await supabase.from('depenses').delete().eq('id', depenseToDelete);
      if (error) throw error;
      toast.success(t('depenses.toast_deleted'));
      fetchDepenses();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(t('shared.toast.delete_error'));
    } finally {
      setDeleteConfirmOpen(false);
      setDepenseToDelete(null);
    }
  };

  const handleEdit = async (depense: Depense) => {
    try {
      const { data: depenseData, error } = await supabase
        .from('depenses')
        .select('*, fournisseur:fournisseurs(*)')
        .eq('id', depense.id)
        .single();

      if (error) throw error;

      const mappedData = {
        ...depenseData,
        description: depenseData.description || '',
        reference: depenseData.reference || '',
        dateDepense: depenseData.date_depense?.split('T')[0] || '',
        fournisseurId: depenseData.fournisseur_id?.toString() || 'none',
        montantHt: Number(depenseData.montant_ht || 0),
        tva: Number(depenseData.tva || 20),
      };

      setEditingDepense(mappedData);
      setShowForm(true);
    } catch (error) {
      console.error('Error loading depense:', error);
      toast.error(t('depenses.toast_load_error'));
    }
  };

  const openNewForm = () => {
    setEditingDepense(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingDepense(null);
  };

  const getCategoryConfig = (categorie: string) => {
    return categoryConfig[categorie] || categoryConfig.autre;
  };

  const getPaymentIcon = (mode: string) => {
    const key = mode.toLowerCase();
    return paymentIcons[key] || paymentIcons.virement;
  };

  const filteredDepenses = useMemo(() => {
    let filtered = depenses.filter((depense) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        (depense.description?.toLowerCase() || '').includes(query) ||
        (depense.categorie?.toLowerCase() || '').includes(query) ||
        (depense.reference?.toLowerCase() || '').includes(query) ||
        (depense.fournisseur?.nomSociete?.toLowerCase() || '').includes(query) ||
        (depense.fournisseur?.nom?.toLowerCase() || '').includes(query)
      );
    });

    if (paymentFilter !== 'all') {
      filtered = filtered.filter(d => d.modePaiement === paymentFilter);
    }

    return filtered;
  }, [depenses, searchQuery, paymentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDepenses.length / ITEMS_PER_PAGE));
  const paginatedDepenses = filteredDepenses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, paymentFilter]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const totalDepenses = filteredDepenses.reduce((sum, d) => sum + d.montantTtc, 0);
  const depensesCount = filteredDepenses.length;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const monthDepenses = depenses.filter(d => {
    const dd = new Date(d.dateDepense);
    return dd >= monthStart && dd <= now;
  });
  const monthTotal = monthDepenses.reduce((sum, d) => sum + d.montantTtc, 0);

  const lastMonthDepenses = depenses.filter(d => {
    const dd = new Date(d.dateDepense);
    return dd >= lastMonthStart && dd < monthStart;
  });
  const lastMonthTotal = lastMonthDepenses.reduce((sum, d) => sum + d.montantTtc, 0);

  const trend = lastMonthTotal > 0 ? ((monthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;

  // Category breakdown for pie chart
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    monthDepenses.forEach(d => {
      totals[d.categorie] = (totals[d.categorie] || 0) + d.montantTtc;
    });
    return totals;
  }, [monthDepenses]);

  const pieData = Object.entries(categoryTotals)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a);

  const grandTotal = pieData.reduce((sum, [, v]) => sum + v, 0);

  // Generate SVG pie slices
  const pieSlices = useMemo(() => {
    if (grandTotal === 0) return [];
    let currentAngle = -90;
    return pieData.map(([cat, value]) => {
      const percentage = value / grandTotal;
      const angle = percentage * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      const r = 40;
      const cx = 50;
      const cy = 50;

      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);

      const largeArc = angle > 180 ? 1 : 0;

      return {
        cat,
        path: `M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${largeArc},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`,
        color: getCategoryConfig(cat).pieColor,
        // Keep raw fraction so we can format it per the active locale at
        // render time. The string form (used by the legacy SVG label fallback)
        // is kept for backwards compatibility.
        fraction: percentage,
        percentage: (percentage * 100).toFixed(0),
      };
    });
  }, [pieData, grandTotal]);

  // Locale-aware percentage formatter. In Arabic this renders Arabic-Indic
  // digits (e.g. "٢٨٪") instead of "28%". Built once per language change.
  const formatPercent = useMemo(() => {
    const lang = i18n.language || 'fr';
    const locale = lang.startsWith('ar') ? 'ar' : lang.startsWith('en') ? 'en' : 'fr';
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      maximumFractionDigits: 0,
    });
  }, [i18n.language]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title={t('shared.confirm_delete.title_expense')}
        description={t('shared.confirm_delete.body_expense')}
      />

      {showForm ? (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={closeForm}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">
                {editingDepense ? t('depenses.dialog_edit') : t('depenses.dialog_create')}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {editingDepense ? t('depenses.dialog_subtitle_edit', { reference: editingDepense.reference }) : t('depenses.dialog_subtitle_create')}
              </p>
            </div>
          </div>
          <div className="rounded-sm dark:bg-card dark:border-white/10 border border-slate-200 bg-white p-4 sm:p-6">
            <DepenseForm
              initialData={editingDepense}
              onSuccess={() => {
                closeForm();
                fetchDepenses();
              }}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Header — stacks below sm, button full-width on mobile */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-[6px] bg-red-50 border border-red-200/50 dark:bg-slate-900/60 dark:border-white/10 dark:rounded-sm shrink-0">
                <Wallet className="h-5 w-5 text-red-500 dark:text-rose-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">{t('depenses.page_title')}</h2>
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                  {t('depenses.page_subtitle')}
                </p>
              </div>
            </div>
            <Button
              onClick={openNewForm}
              className="w-full sm:w-auto bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-[4px] h-10 px-5 shadow-none dark:rounded-sm"
            >
              <Plus className="me-2 h-4 w-4" />
              {t('depenses.new_button')}
            </Button>
          </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Left Column - Table */}
        <div className="lg:col-span-3 space-y-4 min-w-0">
          {/* Search & Filters — filter becomes full-width on mobile */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                type="text"
                placeholder={t('depenses.search_ph')}
                className="pl-9 h-10 bg-white border-slate-200 rounded-[4px] focus:border-slate-300 shadow-none text-sm dark:bg-transparent dark:border-white/10 dark:rounded-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="h-10 w-full sm:w-[160px] bg-white border-slate-200 rounded-[4px] shadow-none text-sm dark:bg-transparent dark:border-white/10 dark:rounded-sm">
                <Filter className="h-3.5 w-3.5 text-slate-400 me-2" />
                <SelectValue placeholder={t('shared.table.payment')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('depenses.filter_all_payments')}</SelectItem>
                <SelectItem value="espèces">{t('shared.payment_modes.cash')}</SelectItem>
                <SelectItem value="carte">{t('shared.payment_modes.card')}</SelectItem>
                <SelectItem value="virement">{t('shared.payment_modes.bank_transfer')}</SelectItem>
                <SelectItem value="chèque">{t('shared.payment_modes.cheque')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table — wrapped in `overflow-x-auto` for mobile scroll */}
          <Card className="border border-slate-200 shadow-none rounded-[6px] overflow-hidden dark:border-white/10 dark:rounded-sm">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-100 dark:border-white/5">
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.date')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.description')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.category')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.supplier')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.payment')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 text-start">{t('depenses.col_amount')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 text-start">{t('shared.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                        <p className="text-sm text-muted-foreground font-medium">{t('depenses.loading')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedDepenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="bg-slate-50 rounded-[6px] p-4 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5 dark:rounded-sm">
                          <Receipt className="h-8 w-8 text-slate-300" />
                        </div>
                        <p className="text-sm text-slate-500 font-medium dark:text-slate-400">
                          {searchQuery || paymentFilter !== 'all'
                            ? t('depenses.empty_filtered')
                            : t('depenses.empty_all')}
                        </p>
                        {!searchQuery && paymentFilter === 'all' && (
                          <div className="flex gap-2 mt-1">
                            <Button
                              variant="outline"
                              className="rounded-[4px] text-sm"
                              onClick={openNewForm}
                            >
                              <Plus className="me-2 h-4 w-4" />
                              {t('depenses.create_first')}
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDepenses.map((depense) => {
                    const cat = getCategoryConfig(depense.categorie);
                    const PayIcon = getPaymentIcon(depense.modePaiement).icon;
                    const fournisseurInitial = (depense.fournisseur?.nom || '?').charAt(0).toUpperCase();

                    return (
                      <TableRow
                        key={depense.id}
                        className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors dark:border-white/5 dark:hover:bg-white/[0.03]"
                      >
                        <TableCell className="px-4 py-5">
                          <span
                            dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                            className="text-sm text-slate-500 dark:text-slate-400"
                          >
                            {depense.dateDepense
                              ? formatDate(depense.dateDepense, 'dd MMM yyyy', i18n.language)
                              : '-'}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <div>
                            {/* `dir="auto"` lets the browser pick LTR/RTL based on the
                                first strong character of the user-entered text, so an
                                Arabic description renders RTL and a French one renders
                                LTR regardless of the active UI language. */}
                            <p
                              dir="auto"
                              className="text-sm font-semibold text-slate-800 max-w-[220px] truncate text-start dark:text-white"
                            >
                              {depense.description || '-'}
                            </p>
                            <p dir="ltr" className="text-[11px] text-slate-400 font-mono mt-0.5 text-start">
                              {depense.reference || ''}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium",
                            cat.bg
                          )}>
                            {cat.label}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          {depense.fournisseur ? (
                            <div className="flex items-center gap-2.5">
                              <Avatar size="sm" className="h-7 w-7 border border-slate-200">
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${depense.fournisseur?.nom}`} />
                                <AvatarFallback className="text-[10px] font-semibold bg-slate-100 text-slate-600">
                                  {fournisseurInitial}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm text-slate-700 dark:text-white">
                                {depense.fournisseur?.nomSociete || depense.fournisseur?.nom || '-'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <div className="flex items-center gap-1.5">
                            <PayIcon className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-xs text-slate-500 capitalize dark:text-slate-400">
                              {getPaymentIcon(depense.modePaiement).label}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-5 text-start">
                          <span
                            dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                            className="text-sm font-bold text-rose-600"
                          >
                            -{formatCurrencyLocale(depense.montantTtc, i18n.language)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5 text-start">
                          <div className="flex justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[4px] dark:hover:text-white dark:hover:bg-white/5 dark:rounded-sm"
                              onClick={() => handleEdit(depense)}
                              title={t('shared.actions.edit')}
                            >
                              <FileEdit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-[4px] dark:hover:text-red-400 dark:hover:bg-white/5 dark:rounded-sm"
                              onClick={() => {
                                setDepenseToDelete(depense.id);
                                setDeleteConfirmOpen(true);
                              }}
                              title={t('shared.actions.delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            </div>

            {!isLoading && paginatedDepenses.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-white/5">
                <p className="text-xs text-slate-400" dir="ltr">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredDepenses.length)} {t('shared.pagination.of')} {filteredDepenses.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-[4px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:hover:text-white dark:hover:bg-white/5 dark:rounded-sm"
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
                        "h-8 min-w-[32px] rounded-[4px] text-sm font-medium dark:rounded-sm",
                        page === currentPage
                          ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-white"
                          : "text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:text-white dark:hover:bg-white/5"
                      )}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-[4px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:hover:text-white dark:hover:bg-white/5 dark:rounded-sm"
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
          <Card className="border border-slate-200 shadow-none rounded-[6px] dark:border-white/10 dark:rounded-sm">
            <CardHeader className="px-4 py-4 border-b border-slate-100 dark:border-white/5">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-white">{t('depenses.sidebar_title')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-4 space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-[6px] bg-red-50 border border-red-200/50 shrink-0 dark:rounded-sm dark:bg-rose-500/10 dark:border-rose-500/20">
                  <Wallet className="h-4 w-4 text-red-500 dark:text-rose-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500">{t('depenses.sidebar_total')}</p>
                  <p dir="ltr" className="text-lg font-bold text-rose-600 dark:text-rose-400">{formatCurrency(monthTotal)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-[6px] bg-slate-50 border border-slate-100 px-3 py-2 dark:rounded-sm dark:bg-transparent dark:border-white/5">
                {trend >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-rose-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-emerald-500" />
                )}
                <div className="flex-1">
                  <p className="text-[11px] text-slate-500 font-medium">{t('depenses.sidebar_vs_last')}</p>
                  <p dir="ltr" className={cn(
                    "text-sm font-bold",
                    trend >= 0 ? "text-rose-600" : "text-emerald-600"
                  )}>
                    {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Pie Chart */}
              {pieSlices.length > 0 && (
                <div className="border-t border-slate-100 pt-4 dark:border-white/5">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">{t('depenses.sidebar_by_cat')}</p>
                  <div className="flex items-center gap-4">
                    <svg viewBox="0 0 100 100" className="h-20 w-20 shrink-0">
                      {pieSlices.map((slice, i) => (
                        <path key={i} d={slice.path} fill={slice.color} />
                      ))}
                      <circle cx="50" cy="50" r="18" fill="white" />
                    </svg>
                    <div className="flex-1 space-y-1.5 min-w-0">
                      {pieSlices.slice(0, 5).map((slice, i) => (
                        <div key={i} className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: slice.color }}
                          />
                          <span className="text-[11px] text-slate-500 flex-1 truncate text-start dark:text-slate-400">
                            {getCategoryConfig(slice.cat).label}
                          </span>
                          {/* Percentage uses logical direction matching the
                              active language, and locale-aware digits so AR
                              renders e.g. "٢٨٪" with the percent glyph on the
                              correct side. */}
                          <span
                            dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                            className="text-[11px] font-semibold text-slate-700 tabular-nums shrink-0 dark:text-slate-400"
                          >
                            {formatPercent.format(slice.fraction)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
