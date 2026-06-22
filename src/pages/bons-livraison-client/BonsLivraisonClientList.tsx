import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus, Search, FileEdit, Trash2, Truck, Package, Clock,
  CheckCircle, Ban, ChevronLeft, ChevronRight, CalendarDays, Filter,
  ArrowLeft, Printer, Eye, TrendingUp, ArrowUpRight, ShoppingBag
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
import { format } from 'date-fns'
import { fr, enUS, ar as arLocale } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner'
import { BonLivraisonClientForm } from '@/components/forms/BonLivraisonClientForm'
import { useReactToPrint } from 'react-to-print'
import { BonLivraisonClientDocument } from '@/components/documents/BonLivraisonClientDocument'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { formatCurrency, formatCurrencyLocale } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Link } from 'react-router-dom'

interface BonLivraisonClient {
  id: number;
  numero: string;
  clientId: number;
  client: { nom: string; nomSociete?: string; email?: string };
  date: string;
  dateLivraison?: string;
  montantHt: number;
  montantTva: number;
  montantTtc: number;
  statut: string;
  voiture?: string;
  matricule?: string;
  lignes?: any[];
}

interface StatutOption {
  value: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const ITEMS_PER_PAGE = 10;

export function BonsLivraisonClientList() {
  const { t, i18n } = useTranslation()

  // Resolve the date-fns locale from the active UI language
  const dateFnsLocale = i18n.language?.startsWith('ar') ? arLocale
    : i18n.language?.startsWith('en') ? enUS
    : fr
  const { user } = useAuth();
  const [bons, setBons] = useState<BonLivraisonClient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBon, setEditingBon] = useState<any | null>(null);
  const [entreprise, setEntreprise] = useState<any>(null);
  const [selectedBon, setSelectedBon] = useState<any>(null);
  const [detailBon, setDetailBon] = useState<BonLivraisonClient | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailPage, setDetailPage] = useState(1);
  const DETAIL_ITEMS_PER_PAGE = 6;
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bonToDelete, setBonToDelete] = useState<number | null>(null);

  const statusOptions: StatutOption[] = [
    { value: 'en_attente', label: t('shared.status.in_progress'), icon: Clock, color: 'text-sky-700', bgColor: 'bg-sky-50 text-sky-700 border border-sky-200/50' },
    { value: 'livré', label: t('shared.status.received'), icon: CheckCircle, color: 'text-emerald-700', bgColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' },
    { value: 'partiel', label: t('shared.status.partial'), icon: Clock, color: 'text-orange-700', bgColor: 'bg-orange-50 text-orange-700 border border-orange-200/50' },
    { value: 'annulé', label: t('shared.status.cancelled'), icon: Ban, color: 'text-slate-600', bgColor: 'bg-slate-50 text-slate-600 border border-slate-200/50' },
  ];

  const componentRef = useRef<HTMLDivElement>(null);
  // Tracks whether the app was in fullscreen before a print, so it can be
  // restored after the native print dialog (which exits fullscreen) closes.
  const wasFullscreenRef = useRef(false);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: selectedBon ? `Bon_Livraison_${selectedBon.numero}` : 'Bon_Livraison',
    onBeforePrint: async () => {
      wasFullscreenRef.current = Boolean(document.fullscreenElement);
    },
    onAfterPrint: () => {
      if (wasFullscreenRef.current && !document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    },
  });

  const mapBonLivraison = (b: any) => ({
    ...b,
    id: b.id,
    numero: b.numero || '',
    clientId: b.client_id,
    client: b.client,
    date: b.date_livraison || b.date,
    dateLivraison: b.date_livraison,
    montantHt: Number(b.montant_ht || 0),
    montantTva: Number(b.montant_tva || 0),
    montantTtc: Number(b.montant_ttc || 0),
    statut: b.statut || 'en_attente',
    voiture: b.voiture,
    matricule: b.matricule,
  });

  const fetchBons = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('bons_livraison_client')
        .select('*, client:clients(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBons(Array.isArray(data) ? (data || []).map(mapBonLivraison) : []);
    } catch (error) {
      console.error('Failed to fetch bons de livraison client', error);
      toast.error(t('shared.toast.loading_error'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEntreprise = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('parametres')
        .select('id,user_id,nom_societe,nom,adresse,ville,telephone,email,ice,logo_url,couleur_principale,watermark_text,activer_filigrane')
        .eq('user_id', String(user.id))
        .maybeSingle();

      if (!data) {
        setEntreprise(null);
        return;
      }

      if (error && error.code !== 'PGRST116') {
        console.warn('Error:', error);
      }

      if (data) {
        const cleanLogoUrl = !data.logo_url || data.logo_url === 'image.png'
          ? ''
          : data.logo_url;
        setEntreprise({
          userId: user.id,
          nomEntreprise: data.nom_societe || data.nom || '',
          adresse: data.adresse || '',
          ville: data.ville || '',
          telephone: data.telephone || '',
          email: data.email || '',
          ice: data.ice || '',
          logoUrl: cleanLogoUrl,
          couleurPrincipale: data.couleur_principale || '#267E54',
          watermarkText: data.watermark_text || 'SmartGestion',
          activerFiligrane: data.activer_filigrane !== undefined ? data.activer_filigrane : true,
        });
      }
    } catch (error) {
      console.warn('Failed to fetch entreprise:', error);
    }
  };

  useEffect(() => {
    fetchBons();
    fetchEntreprise();
  }, [user]);

  const handleDelete = async () => {
    if (!bonToDelete) return;

    try {
      const { error } = await supabase.from('bons_livraison_client').delete().eq('id', bonToDelete);
      if (error) throw error;
      toast.success(t('bons_livraison_client.toast_deleted'));
      fetchBons();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(t('shared.toast.delete_error'));
    } finally {
      setDeleteConfirmOpen(false);
      setBonToDelete(null);
    }
  };

  const handleEdit = async (bon: BonLivraisonClient) => {
    try {
      const { data: bonData, error } = await supabase
        .from('bons_livraison_client')
        .select('*, client:clients(*)')
        .eq('id', bon.id)
        .single();

      if (error) throw error;

      const { data: lignesData } = await supabase
        .from('bon_livraison_client_lignes')
        .select('*')
        .eq('bon_livraison_client_id', bon.id)
        .order('ordre');

      const mappedData = {
        ...bonData,
        clientId: bonData.client_id?.toString() || '',
        dateCommande: bonData.date?.split('T')[0] || '',
        dateLivraisonPrevue: bonData.date_livraison?.split('T')[0] || '',
        lignes: (lignesData || []).map((l: any) => ({
          produitId: l.produit_id?.toString() || '',
          designation: l.designation || '',
          quantite: Number(l.quantite || 1),
          prixUnitaireHt: Number(l.prix_unitaire_ht || 0),
          tva: Number(l.tva || 20),
          montantHt: Number(l.montant_ht || 0),
          montantTtc: Number(l.montant_ttc || 0),
        })),
      };

      setEditingBon(mappedData);
      setShowForm(true);
    } catch (error) {
      console.error('Error loading bon:', error);
      toast.error(t('bons_livraison.toast_load_error'));
    }
  };

  const handleDownload = async (bon: BonLivraisonClient) => {
    try {
      toast.info(t('shared.toast.pdf_preparing'));

      const { data: bonData, error } = await supabase
        .from('bons_livraison_client')
        .select('*, client:clients(*)')
        .eq('id', bon.id)
        .single();

      if (error) throw error;

      const { data: lignesData } = await supabase
        .from('bon_livraison_client_lignes')
        .select('*')
        .eq('bon_livraison_client_id', bon.id)
        .order('ordre');

      const mappedBon = {
        ...bonData,
        numero: bonData.numero,
        clientId: bonData.client_id,
        client: bonData.client,
        date: bonData.date_livraison || bonData.date,
        dateLivraison: bonData.date_livraison,
        montantHt: bonData.montant_ht,
        montantTva: bonData.montant_tva,
        montantTtc: bonData.montant_ttc,
        statut: bonData.statut,
        lignes: (lignesData || []).map((l: any) => ({
          designation: l.designation || '',
          reference: l.reference || '',
          quantite: l.quantite,
          prix_unitaire_ht: l.prix_unitaire_ht,
          prixUnitaireHt: l.prix_unitaire_ht,
          tva: l.tva,
          montant_ht: l.montant_ht,
          montantHt: l.montant_ht,
          montant_ttc: l.montant_ttc,
          montantTtc: l.montant_ttc,
        })),
      };

      setSelectedBon(mappedBon);
      setTimeout(() => handlePrint(), 100);
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error(error.message || t('shared.toast.loading_error'));
    }
  };

  // Client delivery notes never affect stock — status change is a plain update.
  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('bons_livraison_client')
        .update({ statut: newStatus })
        .eq('id', id)
        .eq('user_id', user?.id);
      if (error) throw error;

      toast.success(t('shared.toast.status_updated'));
      fetchBons();
    } catch (error) {
      toast.error(t('shared.toast.update_error'));
    }
  };

  const handleViewDetail = async (bon: BonLivraisonClient) => {
    try {
      const { data: lignesData } = await supabase
        .from('bon_livraison_client_lignes')
        .select('*')
        .eq('bon_livraison_client_id', bon.id)
        .order('ordre');
      setDetailBon({ ...bon, lignes: lignesData || [] });
      setDetailPage(1);
      setIsDetailOpen(true);
    } catch {
      toast.error(t('shared.toast.loading_error'));
    }
  };

  const getStatusConfig = (statut: string) => {
    return statusOptions.find(s => s.value === statut) || statusOptions[0];
  };

  const filteredBons = useMemo(() => {
    let filtered = bons.filter((bon) => {
      const search = searchQuery.toLowerCase();
      return (
        bon.numero?.toLowerCase().includes(search) ||
        bon.client?.nomSociete?.toLowerCase().includes(search) ||
        bon.client?.nom?.toLowerCase().includes(search)
      );
    });

    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => b.statut === statusFilter);
    }

    return filtered;
  }, [bons, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBons.length / ITEMS_PER_PAGE));
  const paginatedBons = filteredBons.slice(
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
  const monthBons = bons.filter(b => {
    const d = new Date(b.date);
    return d >= monthStart;
  });
  const monthCount = monthBons.length;
  const monthValue = monthBons.reduce((sum, b) => sum + (b.montantTtc || 0), 0);
  const pendingReceipts = bons.filter(b => b.statut === 'en_attente').length;

  const openNewForm = () => {
    setEditingBon(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingBon(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title={t('shared.confirm_delete.title_delivery')}
        description={t('shared.confirm_delete.body_delivery')}
      />

      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <BonLivraisonClientDocument ref={componentRef} bon={selectedBon} entreprise={entreprise} lang={i18n.language} />
      </div>

      {showForm ? (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={closeForm}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">
                {editingBon ? t('bons_livraison_client.dialog_edit') : t('bons_livraison_client.dialog_create')}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {editingBon ? t('bons_livraison_client.dialog_subtitle_edit', { number: editingBon.numero }) : t('bons_livraison_client.dialog_subtitle_create')}
              </p>
            </div>
          </div>
          <div className="rounded-sm dark:bg-card dark:border-white/10 border border-slate-200 bg-white p-4 sm:p-6">
            <BonLivraisonClientForm
              initialData={editingBon}
              onSuccess={() => {
                closeForm();
                fetchBons();
              }}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Header — stacks below sm, button full-width on mobile */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-[6px] bg-emerald-50 border border-emerald-200/50 dark:bg-slate-900/60 dark:border-white/10 dark:rounded-sm shrink-0">
                <Truck className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">{t('bons_livraison_client.page_title')}</h2>
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                  {t('bons_livraison_client.page_subtitle')}
                </p>
              </div>
            </div>
            <Button
              onClick={openNewForm}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-[4px] h-10 px-5 shadow-none dark:rounded-sm"
            >
              <Plus className="me-2 h-4 w-4" />
              {t('bons_livraison_client.new_button')}
            </Button>
          </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Left Column - Table */}
        <div className="lg:col-span-3 space-y-4 min-w-0">
          {/* Search & Filters — filter becomes full-width on mobile */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="search"
                placeholder={t('bons_livraison_client.search_ph')}
                className="pl-9 h-10 bg-white border-slate-200 rounded-[4px] focus:border-slate-300 shadow-none text-sm dark:bg-transparent dark:border-white/10 dark:rounded-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-full sm:w-[140px] bg-white border-slate-200 rounded-[4px] shadow-none text-sm dark:bg-transparent dark:border-white/10 dark:rounded-sm">
                <Filter className="h-3.5 w-3.5 text-slate-400 me-2" />
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

          {/* Table — wrapped in `overflow-x-auto` for mobile scroll */}
          <Card className="border border-slate-200 shadow-none rounded-[6px] overflow-hidden dark:border-white/10 dark:rounded-sm">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-100 dark:border-white/5">
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.client')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.bon_number')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.date')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 text-start">{t('shared.table.amount')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 text-center">{t('shared.table.status')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 text-start">{t('shared.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                        <p className="text-sm text-muted-foreground font-medium">{t('shared.empty.loading')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedBons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="bg-slate-50 rounded-[6px] p-4 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5 dark:rounded-sm">
                          <Package className="h-8 w-8 text-slate-300" />
                        </div>
                        <p className="text-sm text-slate-500 font-medium dark:text-slate-400">
                          {searchQuery || statusFilter !== 'all'
                            ? t('bons_livraison_client.empty_filtered')
                            : t('bons_livraison_client.empty_all')}
                        </p>
                        {!searchQuery && statusFilter === 'all' && (
                          <Button
                            variant="outline"
                            className="mt-1 rounded-[4px] text-sm"
                            onClick={openNewForm}
                          >
                            <Plus className="me-2 h-4 w-4" />
                            {t('bons_livraison_client.create_first')}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedBons.map((bon) => {
                    const status = getStatusConfig(bon.statut);
                    const StatusIcon = status.icon;
                    const clientInitial = (bon.client?.nom || '?').charAt(0).toUpperCase();

                    return (
                      <TableRow
                        key={bon.id}
                        className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors dark:border-white/5 dark:hover:bg-white/[0.03]"
                      >
                        <TableCell className="px-4 py-5">
                          <div className="flex items-center gap-3">
                            <Avatar size="sm" className="h-8 w-8 border border-slate-200">
                              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${bon.client?.nom}`} />
                              <AvatarFallback className="text-xs font-semibold bg-slate-100 text-slate-600">
                                {clientInitial}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                {bon.client?.nom || bon.client?.nomSociete || '-'}
                              </p>
                              <p className="text-xs text-slate-400">
                                {bon.client?.email || bon.numero}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <span dir="ltr" className="text-sm font-mono font-medium text-slate-700 dark:text-white">{bon.numero}</span>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <span
                            dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                            className="text-sm text-slate-500 dark:text-slate-400"
                          >
                            {(() => {
                              try {
                                const dateStr = bon.dateLivraison || bon.date;
                                if (!dateStr) return '-';
                                const date = new Date(dateStr);
                                if (isNaN(date.getTime())) return '-';
                                return format(date, 'dd MMM yyyy', { locale: dateFnsLocale });
                              } catch {
                                return '-';
                              }
                            })()}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5 text-start">
                          <span
                            dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                            className="text-sm font-bold text-slate-800 dark:text-white"
                          >
                            {formatCurrencyLocale(bon.montantTtc || 0, i18n.language)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5 text-center">
                          <Select
                            value={bon.statut}
                            onValueChange={(val) => handleStatusChange(bon.id, val)}
                          >
                            <SelectTrigger className="h-auto w-auto mx-auto bg-transparent border-none shadow-none focus:ring-0 p-0">
                              <SelectValue>
                                <span className={cn(
                                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
                                  status.bgColor,
                                  bon.statut === 'livré' && "dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                                )}>
                                  <StatusIcon className={cn("h-3 w-3", status.color, bon.statut === 'livré' && "dark:text-emerald-300")} />
                                  {status.label}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map(opt => {
                                const OptIcon = opt.icon;
                                return (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    <div className="flex items-center gap-2">
                                      <OptIcon className={cn("h-4 w-4", opt.color)} />
                                      <span>{opt.label}</span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="px-4 py-5 text-start">
                          <div className="flex justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[4px] dark:hover:text-white dark:hover:bg-white/5 dark:rounded-sm"
                              onClick={() => handleDownload(bon)}
                              title={t('shared.actions.print')}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[4px] dark:hover:text-white dark:hover:bg-white/5 dark:rounded-sm"
                              onClick={() => handleViewDetail(bon)}
                              title={t('shared.actions.view')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {bon.statut === 'en_attente' ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-[4px] dark:hover:text-red-400 dark:hover:bg-white/5 dark:rounded-sm"
                                onClick={() => {
                                  setBonToDelete(bon.id);
                                  setDeleteConfirmOpen(true);
                                }}
                                title={t('shared.actions.delete')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : bon.statut !== 'annulé' ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-[4px] dark:hover:text-red-400 dark:hover:bg-white/5 dark:rounded-sm"
                                onClick={() => handleStatusChange(bon.id, 'annulé')}
                                title={t('shared.status.cancelled')}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            </div>

            {!isLoading && paginatedBons.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-white/5">
                <p className="text-xs text-slate-400" dir="ltr">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredBons.length)} {t('shared.pagination.of')} {filteredBons.length}
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
        <div className="lg:col-span-1">
          <Card className="border border-slate-200 shadow-none rounded-[6px] dark:border-white/10 dark:rounded-sm">
            <CardHeader className="px-4 py-4 border-b border-slate-100 dark:border-white/5">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-white">
                {t('bons_livraison_client.sidebar_title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-4 space-y-5">

              {/* ── Bons ce mois-ci ─────────────────────────────────── */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-[6px] bg-emerald-50 border border-emerald-200/50 shrink-0 dark:rounded-sm dark:bg-primary/10 dark:border-primary/20">
                  <Package className="h-4 w-4 text-emerald-600 dark:text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-muted-foreground">
                    {t('bons_livraison_client.sidebar_this_month')}
                  </p>
                  <p className="text-lg font-bold text-slate-800 dark:text-white" dir="ltr">
                    {monthCount}{' '}
                    <span className="text-sm font-normal text-slate-400 dark:text-muted-foreground">
                      {monthCount === 1
                        ? t('bons_livraison.sidebar_note_one')
                        : t('bons_livraison.sidebar_note_other')}
                    </span>
                  </p>
                </div>
              </div>

              {/* ── Valeur livrée ─────────────────────────────────────── */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-[6px] bg-emerald-50 border border-emerald-200/50 shrink-0 dark:rounded-sm dark:bg-primary/10 dark:border-primary/20">
                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-muted-foreground">
                    {t('bons_livraison_client.sidebar_delivered_value')}
                  </p>
                  <p dir="ltr" className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(monthValue)}
                  </p>
                </div>
              </div>

              {/* ── En attente ───────────────────────────────────────── */}
              <div className="border-t border-slate-100 pt-4 flex items-center gap-3 dark:border-white/5">
                <div className="flex items-center justify-center h-9 w-9 rounded-[6px] bg-sky-50 border border-sky-200/50 shrink-0 dark:rounded-sm dark:bg-primary/10 dark:border-primary/20">
                  <Clock className="h-4 w-4 text-sky-600 dark:text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-muted-foreground">
                    {t('bons_livraison_client.sidebar_awaiting')}
                  </p>
                  <p className="text-lg font-bold text-slate-800 dark:text-white" dir="ltr">
                    {pendingReceipts}{' '}
                    <span className="text-sm font-normal text-slate-400 dark:text-muted-foreground">
                      {pendingReceipts === 1
                        ? t('bons_livraison.sidebar_note_one')
                        : t('bons_livraison.sidebar_note_other')}
                    </span>
                  </p>
                </div>
              </div>

              {/* ── Link to clients ──────────────────────────────────── */}
              <div className="border-t border-slate-100 pt-4 dark:border-white/5">
                <Link
                  to="/clients"
                  className="flex items-center gap-2 rounded-[6px] bg-slate-50 border border-slate-200/50 px-3 py-2.5 hover:bg-slate-100 transition-colors dark:rounded-sm dark:bg-slate-900/40 dark:border-white/10 dark:hover:bg-slate-900/60"
                >
                  <ShoppingBag className="h-4 w-4 text-slate-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {t('bons_livraison_client.sidebar_check_clients')}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-muted-foreground">
                      {t('bons_livraison_client.sidebar_access_clients')}
                    </p>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 shrink-0 rtl:rotate-180" />
                </Link>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-xl max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden dark:bg-slate-900 dark:border-white/10">
          <DialogHeader className="shrink-0 px-4 sm:px-6 pt-5 pb-4 border-b border-slate-100 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 shrink-0 rounded-[6px] bg-emerald-50 border border-emerald-200/50 dark:rounded-sm dark:bg-emerald-500/10 dark:border-emerald-500/20">
                <Truck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base sm:text-lg font-bold truncate dark:text-white">{t('bons_livraison_client.detail_title')}</DialogTitle>
                <p className="text-sm text-muted-foreground truncate">{detailBon?.numero}</p>
              </div>
            </div>
          </DialogHeader>
          {detailBon && (
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  <span dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}>
                    {(() => {
                      try {
                        const dateStr = detailBon.dateLivraison || detailBon.date;
                        if (!dateStr) return '-';
                        const date = new Date(dateStr);
                        if (isNaN(date.getTime())) return '-';
                        return format(date, 'dd MMMM yyyy', { locale: dateFnsLocale });
                      } catch { return '-'; }
                    })()}
                  </span>
                </span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="font-medium text-slate-700 dark:text-white truncate">
                  {detailBon.client?.nom || detailBon.client?.nomSociete || '-'}
                </span>
              </div>

              {detailBon.lignes && detailBon.lignes.length > 0 && (() => {
                const totalLignes = detailBon.lignes.length;
                const totalPages = Math.ceil(totalLignes / DETAIL_ITEMS_PER_PAGE);
                const safePage = Math.min(detailPage, totalPages);
                const startIdx = (safePage - 1) * DETAIL_ITEMS_PER_PAGE;
                const pageLignes = detailBon.lignes.slice(startIdx, startIdx + DETAIL_ITEMS_PER_PAGE);

                return (
                <>
                  {/* Desktop / tablet: tabular layout */}
                  <div className="hidden sm:block rounded-[6px] border border-slate-200 overflow-hidden dark:border-white/10 dark:rounded-sm">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-slate-100 bg-slate-50/60 dark:bg-slate-900/40 dark:border-white/5">
                            <TableHead className="text-xs font-semibold text-slate-500 uppercase">{t('bons_livraison.detail_col_product')}</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 uppercase text-start whitespace-nowrap">{t('bons_livraison.detail_col_qty')}</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 uppercase text-start whitespace-nowrap">{t('bons_livraison.detail_col_unit_price')}</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 uppercase text-end whitespace-nowrap">{t('bons_livraison.detail_col_total')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pageLignes.map((l: any, i: number) => (
                            <TableRow key={startIdx + i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors dark:border-white/5 dark:hover:bg-white/5">
                              <TableCell className="py-3 text-sm dark:text-white">{l.designation || 'Produit'}</TableCell>
                              <TableCell className="py-3 text-start text-sm font-medium dark:text-white" dir="ltr">{l.quantite}</TableCell>
                              <TableCell className="py-3 text-start text-sm text-slate-500 whitespace-nowrap dark:text-slate-400" dir="ltr">{formatCurrency(l.prix_unitaire_ht || 0)}</TableCell>
                              <TableCell className="py-3 text-end text-sm font-bold whitespace-nowrap dark:text-white" dir="ltr">{formatCurrency(l.montant_ttc || 0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Mobile: stacked cards (no horizontal scroll needed) */}
                  <div className="sm:hidden space-y-2">
                    {pageLignes.map((l: any, i: number) => (
                      <div key={startIdx + i} className="rounded-[6px] border border-slate-200 p-3 dark:border-white/10 dark:rounded-sm">
                        <p className="text-sm font-medium text-slate-800 dark:text-white">{l.designation || 'Produit'}</p>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span dir="ltr">{t('bons_livraison.detail_col_qty')}: <span className="font-medium text-slate-700 dark:text-slate-200">{l.quantite}</span></span>
                          <span dir="ltr">{formatCurrency(l.prix_unitaire_ht || 0)}</span>
                          <span dir="ltr" className="text-sm font-bold text-slate-800 dark:text-white">{formatCurrency(l.montant_ttc || 0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination controls (max 6 products per page) */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                        {startIdx + 1}–{startIdx + pageLignes.length} / {totalLignes}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-[4px]"
                          disabled={safePage <= 1}
                          onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                        </Button>
                        <span className="px-2 text-xs font-medium text-slate-600 dark:text-slate-300" dir="ltr">
                          {safePage} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-[4px]"
                          disabled={safePage >= totalPages}
                          onClick={() => setDetailPage((p) => Math.min(totalPages, p + 1))}
                        >
                          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
                );
              })()}

              <div className="rounded-[6px] border border-slate-100 bg-slate-50/50 p-4 space-y-1.5 dark:border-white/10 dark:bg-slate-900/60 dark:rounded-sm">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('bons_livraison.detail_total_ht')}</span>
                  <span dir="ltr" className="font-medium text-slate-800 dark:text-white">{formatCurrency(detailBon.montantHt)}</span>
                </div>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('bons_livraison.detail_total_vat')}</span>
                  <span dir="ltr" className="font-medium text-slate-800 dark:text-white">{formatCurrency(detailBon.montantTva)}</span>
                </div>
                <div className="flex justify-between gap-3 text-base font-bold pt-1.5 border-t border-slate-200 dark:border-white/10">
                  <span className="text-slate-800 dark:text-white">{t('bons_livraison.detail_total_ttc')}</span>
                  <span dir="ltr" className="text-emerald-600 dark:text-emerald-400">{formatCurrency(detailBon.montantTtc)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="shrink-0 px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-white/10">
            <Button
              variant="outline"
              onClick={() => setIsDetailOpen(false)}
              className="rounded-[4px] h-10 w-full sm:w-auto"
            >
              {t('shared.actions.close')}
            </Button>
            {detailBon && (
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-[4px] h-10 w-full sm:w-auto shadow-none"
                onClick={() => { handleEdit(detailBon); setIsDetailOpen(false); }}
              >
                <FileEdit className="me-2 h-4 w-4" />
                {t('shared.actions.edit')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
