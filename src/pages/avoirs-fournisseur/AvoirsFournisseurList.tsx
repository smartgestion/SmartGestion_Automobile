import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, RotateCcw, Receipt, ChevronLeft, ChevronRight, Filter, Info, Plus, ArrowLeft, XCircle, ClipboardList } from 'lucide-react'
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatCurrency, formatCurrencyLocale, formatDate } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner'
import { AvoirFournisseurForm } from '@/components/forms/AvoirFournisseurForm'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { updateStockAndNotify } from '@/lib/notifications'

interface AvoirFournisseur {
  id: number;
  numero: string;
  bonCommandeId: number | null;
  bonCommande: { numero: string; statut: string } | null;
  fournisseurId: number;
  fournisseur: { nom: string; nomSociete?: string; email?: string } | null;
  dateEmission: string;
  montantHt: number;
  montantTva: number;
  montantTtc: number;
  statut: string;
}

interface StatutOption {
  value: string;
  label: string;
  color: string;
  bgColor: string;
}

const ITEMS_PER_PAGE = 10;

export function AvoirsFournisseurList() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth();
  const [avoirs, setAvoirs] = useState<AvoirFournisseur[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [avoirToCancel, setAvoirToCancel] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const statusOptions: StatutOption[] = [
    { value: 'émis', label: t('shared.status.issued'), color: 'text-amber-700', bgColor: 'dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 bg-amber-50 text-amber-700 border border-amber-200/50' },
    { value: 'appliqué', label: t('shared.status.applied'), color: 'text-sky-700', bgColor: 'dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20 bg-sky-50 text-sky-700 border border-sky-200/50' },
    { value: 'annulé', label: t('shared.status.cancelled'), color: 'text-slate-500', bgColor: 'dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20 bg-slate-50 text-slate-600 border border-slate-200/50' },
  ];

  const mapAvoir = (a: any): AvoirFournisseur => ({
    id: a.id,
    numero: a.numero || '',
    bonCommandeId: a.bon_commande_id ?? null,
    bonCommande: a.bon_commande ?? null,
    fournisseurId: a.fournisseur_id,
    fournisseur: a.fournisseur ?? null,
    dateEmission: a.date_emission,
    montantHt: Number(a.montant_ht || 0),
    montantTva: Number(a.montant_tva || 0),
    montantTtc: Number(a.montant_ttc || 0),
    statut: a.statut || 'émis',
  });

  const fetchAvoirs = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('avoirs_fournisseur')
        .select('*, bon_commande:bons_commande(*), fournisseur:fournisseurs(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvoirs(Array.isArray(data) ? (data || []).map(mapAvoir) : []);
    } catch (error) {
      console.error('Failed to fetch supplier avoirs', error);
      toast.error(t('avoirs_fournisseur.toast_load_error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchAvoirs();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('avoirs-fournisseur-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'avoirs_fournisseur', filter: `user_id=eq.${user.id}` },
        () => { fetchAvoirs(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const handleCancel = async () => {
    if (!avoirToCancel) return;
    try {
      const target = avoirs.find(a => a.id === avoirToCancel);
      // Only manual avoirs ever touched stock, so only they need a reversal.
      // (BC-linked avoirs never reduced stock — nothing to revert.)
      if (target && !target.bonCommandeId) {
        const { data: lignes } = await supabase
          .from('avoir_fournisseur_lignes')
          .select('produit_id, quantite')
          .eq('avoir_fournisseur_id', avoirToCancel);

        for (const ligne of lignes || []) {
          if (ligne.produit_id) {
            // Manual avoir reduced stock on create; cancelling ADDS it back.
            await updateStockAndNotify(user?.id, ligne.produit_id, Number(ligne.quantite || 0));
          }
        }
      }

      const { error } = await supabase.from('avoirs_fournisseur').update({ statut: 'annulé' }).eq('id', avoirToCancel);
      if (error) throw error;
      toast.success(t('avoirs_fournisseur.toast_cancelled'));
      fetchAvoirs();
    } catch (error) {
      console.error('Cancel error:', error);
      toast.error(t('shared.toast.save_error'));
    } finally {
      setCancelConfirmOpen(false);
      setAvoirToCancel(null);
    }
  };

  const getStatusConfig = (statut: string) => {
    return statusOptions.find(s => s.value === statut) || statusOptions[0];
  };

  const filteredAvoirs = useMemo(() => {
    let filtered = (avoirs || []).filter((avoir) => {
      const search = searchQuery.toLowerCase();
      return (
        avoir.numero?.toLowerCase().includes(search) ||
        avoir.bonCommande?.numero?.toLowerCase().includes(search) ||
        avoir.fournisseur?.nom?.toLowerCase().includes(search) ||
        avoir.fournisseur?.nomSociete?.toLowerCase().includes(search)
      );
    });

    if (statusFilter !== 'all') {
      filtered = filtered.filter(a => a.statut === statusFilter);
    }

    return filtered;
  }, [avoirs, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAvoirs.length / ITEMS_PER_PAGE));
  const paginatedAvoirs = filteredAvoirs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthAvoirs = avoirs.filter(a => a.statut !== 'annulé' && new Date(a.dateEmission) >= monthStart);
  const monthTotal = monthAvoirs.reduce((sum, a) => sum + a.montantTtc, 0);
  const monthCount = monthAvoirs.length;

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
      <ConfirmDialog
        isOpen={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={handleCancel}
        title={t('avoirs_fournisseur.cancel_confirm_title')}
        description={t('avoirs_fournisseur.cancel_confirm_body')}
      />

      {showForm ? (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
              <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
            </Button>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">{t('avoirs_fournisseur.dialog_create')}</h2>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{t('avoirs_fournisseur.dialog_subtitle_create')}</p>
            </div>
          </div>
          <div className="rounded-sm dark:bg-card dark:border-white/10 border border-slate-200 bg-white p-4 sm:p-6">
            <AvoirFournisseurForm
              onSuccess={() => {
                setShowForm(false);
                fetchAvoirs();
              }}
            />
          </div>
        </div>
      ) : (
      <>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center h-10 w-10 rounded-sm dark:bg-orange-500/10 dark:border-orange-500/20 bg-orange-50 border border-orange-200/50 shrink-0">
            <RotateCcw className="h-5 w-5 text-orange-500" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">{t('avoirs_fournisseur.page_title')}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
              {t('avoirs_fournisseur.page_subtitle')}
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-sm shadow-none shrink-0"
        >
          <Plus className="h-4 w-4 me-2" />
          {t('avoirs_fournisseur.add_button')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Left Column - Table */}
        <div className="lg:col-span-3 space-y-4 min-w-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 dark:text-muted-foreground text-slate-400 pointer-events-none" />
              <Input
                type="text"
                placeholder={t('avoirs_fournisseur.search_ph')}
                className="pl-9 h-10 dark:bg-slate-900/50 dark:border-white/5 bg-white border-slate-200 rounded-sm focus:border-slate-300 shadow-none text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-full sm:w-[160px] dark:bg-slate-900/50 dark:border-white/5 bg-white border-slate-200 rounded-sm shadow-none text-sm">
                <Filter className="h-3.5 w-3.5 dark:text-muted-foreground text-slate-400 me-2" />
                <SelectValue placeholder={t('shared.table.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('shared.filters.all_statuses')}</SelectItem>
                {statusOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="border dark:border-white/10 border-slate-200 shadow-none rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b dark:border-white/5 border-slate-100">
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.supplier')}</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">{t('avoirs_fournisseur.col_avoir')}</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">{t('avoirs_fournisseur.col_original_order')}</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.date')}</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3 text-start">{t('avoirs_fournisseur.col_amount_ttc')}</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3 text-center">{t('shared.table.status')}</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3 text-start">{t('shared.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                        <p className="text-sm text-muted-foreground font-medium">{t('avoirs_fournisseur.loading')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedAvoirs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="dark:bg-white/5 dark:border-white/10 bg-slate-50 rounded-sm p-4 border border-slate-100">
                          <RotateCcw className="h-8 w-8 dark:text-muted-foreground text-slate-300" />
                        </div>
                        <p className="text-sm dark:text-muted-foreground text-slate-500 font-medium">
                          {searchQuery || statusFilter !== 'all'
                            ? t('avoirs_fournisseur.empty_filtered')
                            : t('avoirs_fournisseur.empty_all')}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedAvoirs.map((avoir) => {
                    const status = getStatusConfig(avoir.statut);
                    const supplierName = avoir.fournisseur?.nom || avoir.fournisseur?.nomSociete || '-';
                    const supplierInitial = (supplierName || '?').charAt(0).toUpperCase();

                    return (
                      <TableRow
                        key={avoir.id}
                        className="border-b dark:border-white/5 border-slate-100"
                      >
                        <TableCell className="px-4 py-5">
                          <div className="flex items-center gap-3">
                            <Avatar size="sm" className="h-8 w-8 dark:border-white/10 border border-slate-200">
                              <AvatarFallback className="text-xs font-semibold dark:bg-slate-800 dark:text-muted-foreground bg-slate-100 text-slate-600">
                                {supplierInitial}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-semibold dark:text-card-foreground text-slate-800">
                                {supplierName}
                              </p>
                              <p className="text-xs dark:text-muted-foreground text-slate-400">
                                {avoir.fournisseur?.email || avoir.numero}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <span dir="ltr" className="text-sm font-mono font-medium dark:text-card-foreground text-slate-700">{avoir.numero || '-'}</span>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          {avoir.bonCommande?.numero ? (
                            <span dir="ltr" className="text-sm font-mono font-medium dark:text-emerald-400 dark:bg-emerald-500/10 text-emerald-600 bg-emerald-50/50 px-2 py-0.5 rounded-sm inline-flex items-center gap-1">
                              <ClipboardList className="h-3 w-3" />
                              {avoir.bonCommande.numero}
                            </span>
                          ) : (
                            <span className="text-xs font-medium dark:text-orange-400 dark:bg-orange-500/10 text-orange-600 bg-orange-50 px-2 py-0.5 rounded-sm inline-flex items-center gap-1">
                              {t('avoirs_fournisseur.manual_badge')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <span
                            dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                            className="text-sm dark:text-muted-foreground text-slate-500"
                          >
                            {formatDate(avoir.dateEmission, 'dd MMM yyyy', i18n.language)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5 text-start">
                          <span
                            dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                            className="text-sm font-bold text-red-500 dark:text-red-400"
                          >
                            {formatCurrencyLocale(avoir.montantTtc, i18n.language)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5 text-center">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
                            status.bgColor
                          )}>
                            {status.label}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5 text-start">
                          <div className="flex justify-end gap-0.5">
                            {avoir.statut !== 'annulé' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 dark:text-muted-foreground dark:hover:text-amber-400 dark:hover:bg-amber-500/10 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-sm"
                                onClick={() => {
                                  setAvoirToCancel(avoir.id);
                                  setCancelConfirmOpen(true);
                                }}
                                title={t('avoirs_fournisseur.cancel_action')}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            </div>

            {!isLoading && paginatedAvoirs.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t dark:border-white/5 border-slate-100">
                <p className="text-xs dark:text-muted-foreground text-slate-400" dir="ltr">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredAvoirs.length)} {t('shared.pagination.of')} {filteredAvoirs.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-sm dark:text-muted-foreground dark:hover:text-card-foreground dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30"
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
                        "h-8 min-w-[32px] rounded-sm text-sm font-medium",
                        page === currentPage
                          ? "dark:bg-white/10 dark:text-card-foreground bg-slate-100 text-slate-800"
                          : "dark:text-muted-foreground dark:hover:text-card-foreground dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                      )}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-sm dark:text-muted-foreground dark:hover:text-card-foreground dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30"
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
        <div className="lg:col-span-1">
          <Card className="border dark:border-white/10 border-slate-200 shadow-none rounded-sm">
            <CardHeader className="px-4 py-4 border-b dark:border-white/5 border-slate-100">
              <CardTitle className="text-sm font-semibold dark:text-card-foreground text-slate-700">{t('avoirs_fournisseur.sidebar_title')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-4 space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-sm dark:bg-primary/10 dark:border-primary/20 bg-orange-50 border border-orange-200/50 shrink-0">
                  <Receipt className="h-4 w-4 dark:text-primary text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs dark:text-muted-foreground text-slate-500">{t('avoirs_fournisseur.sidebar_month_total_label')}</p>
                  <p dir="ltr" className="text-lg font-bold text-red-500 dark:text-red-400">{formatCurrency(monthTotal)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-sm dark:bg-primary/10 dark:border-primary/20 bg-orange-50 border border-orange-200/50 shrink-0">
                  <RotateCcw className="h-4 w-4 dark:text-primary text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs dark:text-muted-foreground text-slate-500">{t('avoirs_fournisseur.sidebar_returns_label')}</p>
                  <p className="text-lg font-bold dark:text-card-foreground text-slate-800" dir="ltr">
                    {monthCount}
                  </p>
                </div>
              </div>

              <div className="border-t dark:border-white/5 border-slate-100 pt-4">
                <div className="rounded-sm dark:bg-amber-500/10 dark:border-amber-500/20 bg-amber-50 border border-amber-200/50 p-3 flex items-start gap-2.5">
                  <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold dark:text-amber-400 text-amber-800">{t('avoirs_fournisseur.sidebar_impact_title')}</p>
                    <p className="text-[11px] dark:text-amber-400/80 text-amber-700/80 leading-relaxed mt-0.5">
                      {t('avoirs_fournisseur.sidebar_impact_body')}
                    </p>
                  </div>
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
