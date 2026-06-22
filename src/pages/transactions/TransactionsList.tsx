import React, { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileText, TrendingUp, ShoppingCart, Truck, CreditCard, DollarSign, Receipt,
  Search, ChevronLeft, ChevronRight
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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface Transaction {
  id: number;
  type: 'facture' | 'devis' | 'commande' | 'livraison' | 'depense' | 'vente';
  numero: string;
  client?: string;
  fournisseur?: string;
  date: string;
  montantHt: number;
  montantTva: number;
  montantTtc: number;
  statut: string;
}

const ITEMS_PER_PAGE = 10;

const statusStyles: Record<string, string> = {
  payée: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50',
  reste_a_payer: 'bg-amber-50 text-amber-700 border border-amber-200/50',
  brouillon: 'bg-slate-50 text-slate-600 border border-slate-200/50',
  en_attente: 'bg-blue-50 text-blue-700 border border-blue-200/50',
  validé: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50',
  livré: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50',
};

export function TransactionsList() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    facture: { label: t('transactions.type_invoice'), icon: FileText, color: 'bg-sky-50 text-sky-700 border border-sky-200/50' },
    devis: { label: t('transactions.type_quote'), icon: TrendingUp, color: 'bg-purple-50 text-purple-700 border border-purple-200/50' },
    commande: { label: t('transactions.type_order'), icon: ShoppingCart, color: 'bg-orange-50 text-orange-700 border border-orange-200/50' },
    livraison: { label: t('transactions.type_delivery'), icon: Truck, color: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' },
    depense: { label: t('transactions.type_expense'), icon: CreditCard, color: 'bg-red-50 text-red-700 border border-red-200/50' },
    vente: { label: t('transactions.type_sale'), icon: DollarSign, color: 'bg-teal-50 text-teal-700 border border-teal-200/50' },
  };

  const typeOptions = [
    { value: 'all', label: t('transactions.filter_all') },
    { value: 'facture', label: t('transactions.filter_invoices') },
    { value: 'devis', label: t('transactions.filter_quotes') },
    { value: 'commande', label: t('transactions.filter_orders') },
    { value: 'livraison', label: t('transactions.filter_deliveries') },
    { value: 'depense', label: t('transactions.filter_expenses') },
    { value: 'vente', label: t('transactions.filter_sales') },
  ];

  useEffect(() => {
    if (user?.id) {
      fetchAllTransactions();
    }
  }, [user?.id]);

  const fetchAllTransactions = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [factData, devisData, bcData, blData, depData, vpData] = await Promise.all([
        supabase.from('factures').select('*, clients(nom, nom_societe)').eq('user_id', user.id),
        supabase.from('devis').select('*, clients(nom, nom_societe)').eq('user_id', user.id),
        supabase.from('bons_commande').select('*, fournisseurs(nom, nom_societe)').eq('user_id', user.id),
        supabase.from('bons_livraison').select('*').eq('user_id', user.id),
        supabase.from('depenses').select('*, fournisseurs(nom, nom_societe)').eq('user_id', user.id),
        supabase.from('ventes_passagers').select('*').eq('user_id', user.id),
      ]);

      const facteur = factData?.data || [];
      const devis = devisData?.data || [];
      const commandes = bcData?.data || [];
      const livraisons = blData?.data || [];
      const depenses = depData?.data || [];
      const ventes = vpData?.data || [];

      const allTransactions: Transaction[] = [];

      for (const f of facteur) {
        const cliName = f.clients?.nom_societe || f.clients?.nom || f.client_nom || '-';
        allTransactions.push({
          id: f.id, type: 'facture', numero: f.numero,
          client: cliName, date: f.date_emission,
          montantHt: f.montant_ht || 0, montantTva: f.montant_tva || 0,
          montantTtc: f.montant_ttc || 0, statut: f.statut || 'Aucun statut',
        });
      }

      for (const d of devis) {
        const cliName = d.clients?.nom_societe || d.clients?.nom || d.client_nom || '-';
        allTransactions.push({
          id: d.id, type: 'devis', numero: d.numero,
          client: cliName, date: d.date_emission,
          montantHt: d.montant_ht || 0, montantTva: d.montant_tva || 0,
          montantTtc: d.montant_ttc || 0, statut: d.statut || 'Aucun statut',
        });
      }

      for (const c of commandes) {
        const fourName = c.fournisseurs?.nom_societe || c.fournisseurs?.nom || '-';
        allTransactions.push({
          id: c.id, type: 'commande', numero: c.numero,
          fournisseur: fourName, date: c.date_commande,
          montantHt: c.montant_ht || 0, montantTva: c.montant_tva || 0,
          montantTtc: c.montant_ttc || 0, statut: c.statut || 'Aucun statut',
        });
      }

      for (const l of livraisons) {
        let cliName = '-';
        let fourName = '-';

        if (l.client_id) {
          const { data: clientData } = await supabase.from('clients').select('nom, nom_societe').eq('id', l.client_id).single();
          cliName = clientData?.nom_societe || clientData?.nom || '-';
        }

        if (l.fournisseur_id) {
          const { data: fourData } = await supabase.from('fournisseurs').select('nom, nom_societe').eq('id', l.fournisseur_id).single();
          fourName = fourData?.nom_societe || fourData?.nom || '-';
        }

        allTransactions.push({
          id: l.id, type: 'livraison', numero: l.numero,
          client: cliName, fournisseur: fourName, date: l.date_livraison,
          montantHt: l.montant_ht || 0, montantTva: l.montant_tva || 0,
          montantTtc: l.montant_ttc || 0, statut: l.statut || 'Aucun statut',
        });
      }

      for (const d of depenses) {
        const fourName = d.fournisseurs?.nom_societe || d.fournisseurs?.nom || '-';
        allTransactions.push({
          id: d.id, type: 'depense',
          numero: d.reference || d.numero || `DEP-${d.id}`,
          fournisseur: fourName, date: d.date_depense,
          montantHt: d.montant_ht || 0, montantTva: d.montant_tva || 0,
          montantTtc: d.montant_ttc || 0, statut: d.statut || 'Aucun statut',
        });
      }

      for (const v of ventes) {
        allTransactions.push({
          id: v.id, type: 'vente', numero: v.numero,
          client: v.client_nom || '-', date: v.date,
          montantHt: v.montant_ht || 0, montantTva: v.montant_tva || 0,
          montantTtc: v.montant_ttc || 0, statut: v.statut || 'payée',
        });
      }

      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(allTransactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error(t('transactions.toast_load_error'));
    } finally {
      setIsLoading(false);
    }
  };

  const getNavigationPath = (type: string, id: number) => {
    switch (type) {
      case 'facture': return `/factures`;
      case 'devis': return `/devis`;
      case 'commande': return `/bons-commande`;
      case 'livraison': return `/bons-livraison`;
      case 'depense': return `/depenses`;
      case 'vente': return `/ventes-passagers`;
      default: return '/';
    }
  };

  const formatDateLocale = (dateStr: string) => {
    return formatDate(dateStr, 'dd MMM yyyy', i18n.language);
  };

  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.numero?.toLowerCase().includes(q) ||
        t.client?.toLowerCase().includes(q) ||
        t.fournisseur?.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== 'all') {
      filtered = filtered.filter(t => t.type === typeFilter);
    }
    return filtered;
  }, [transactions, searchQuery, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE));
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const totalAmount = filteredTransactions.reduce((sum, t) => sum + (t.montantTtc || 0), 0);

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
      {/* Header — text scales down on phones, subtitle wraps */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center h-10 w-10 rounded-[6px] bg-indigo-50 border border-indigo-200/50 shrink-0">
            <Receipt className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">{t('transactions.page_title')}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
              {t('transactions.page_subtitle')}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Left Column - Table */}
        <div className="lg:col-span-3 space-y-4 min-w-0">
          {/* Search & Filters — filter becomes full-width on mobile */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                type="text"
                placeholder={t('transactions.search_ph')}
                className="pl-9 h-10 bg-white border-slate-200 rounded-[4px] focus:border-slate-300 shadow-none text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-10 w-full sm:w-[160px] bg-white border-slate-200 rounded-[4px] shadow-none text-sm">
                <SelectValue placeholder={t('transactions.filter_all')} />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card className="border border-slate-200 shadow-none rounded-[6px] overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-100">
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('transactions.col_type')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('transactions.col_number')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('transactions.col_entity')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('transactions.col_date')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 text-right">{t('transactions.col_amount')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('transactions.col_status')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 text-right">{t('transactions.col_actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-48 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="h-8 w-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                          <p className="text-sm text-muted-foreground font-medium">{t('transactions.loading')}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-48 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="bg-slate-50 rounded-[6px] p-4 border border-slate-100">
                            <Receipt className="h-8 w-8 text-slate-300" />
                          </div>
                          <p className="text-sm text-slate-500 font-medium">
                            {searchQuery || typeFilter !== 'all' ? t('transactions.empty_filtered') : t('transactions.empty_all')}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTransactions.map((transaction) => {
                      const typeCfg = typeConfig[transaction.type] || typeConfig.facture;
                      const TypeIcon = typeCfg.icon;
                      const displayName = transaction.client || transaction.fournisseur || '-';

                      return (
                        <TableRow
                          key={`${transaction.type}-${transaction.id}`}
                          className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                        >
                          <TableCell className="px-4 py-5">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium",
                              typeCfg.color
                            )}>
                              <TypeIcon className="h-3 w-3" />
                              {typeCfg.label}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-5">
                            <span className="text-xs font-mono text-slate-500">
                              {transaction.numero}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-5">
                            <span className="text-sm text-slate-700">{displayName}</span>
                          </TableCell>
                          <TableCell className="px-4 py-5">
                            <span className="text-xs text-slate-400">
                              {formatDateLocale(transaction.date)}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-5 text-right">
                            <span className="text-sm font-semibold text-slate-800">
                              {formatCurrency(transaction.montantTtc)}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-5">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium",
                              statusStyles[transaction.statut] || 'bg-slate-50 text-slate-600 border border-slate-200/50'
                            )}>
                              {transaction.statut}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-5 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-[4px]"
                              onClick={() => navigate(getNavigationPath(transaction.type, transaction.id))}
                            >
                              {t('shared.actions.view')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {!isLoading && paginatedTransactions.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length)} {t('shared.pagination.of')} {filteredTransactions.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-[4px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30"
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
                          ? "bg-slate-100 text-slate-800"
                          : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                      )}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-[4px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30"
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
          <Card className="border border-slate-200 shadow-none rounded-[6px]">
            <CardHeader className="px-4 py-4 border-b border-slate-100">
              <CardTitle className="text-sm font-semibold text-slate-700">{t('transactions.sidebar_title')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-4 space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-[6px] bg-indigo-50 border border-indigo-200/50 shrink-0">
                  <Receipt className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500">{t('transactions.sidebar_total')}</p>
                  <p className="text-lg font-bold text-slate-800" dir="ltr">{filteredTransactions.length}</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-9 w-9 rounded-[6px] bg-emerald-50 border border-emerald-200/50 shrink-0">
                    <DollarSign className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">{t('transactions.sidebar_amount')}</p>
                    <p className="text-lg font-bold text-emerald-600" dir="ltr">{formatCurrency(totalAmount)}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('transactions.sidebar_by_type')}</p>
                {typeOptions.filter(o => o.value !== 'all').map(opt => {
                  const count = filteredTransactions.filter(t => t.type === opt.value).length;
                  const typeCfg = typeConfig[opt.value];
                  if (count === 0) return null;
                  const TypeIcon = typeCfg.icon;
                  return (
                    <div key={opt.value} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs text-slate-500">{typeCfg.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-700" dir="ltr">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
