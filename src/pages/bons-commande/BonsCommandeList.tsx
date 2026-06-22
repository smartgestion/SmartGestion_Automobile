import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus, Search, FileEdit, Trash2, Download,   ArrowLeft, ShoppingCart, Package,
  FileText, Clock, CheckCircle, Ban, Truck, Send, ChevronLeft,
  ChevronRight, CalendarDays, Filter, Building2, ArrowUpRight, XCircle,
  Wallet, CircleDollarSign, CircleDot
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
import { toast } from 'sonner'
import { BonCommandeForm } from '@/components/forms/BonCommandeForm'
import { useReactToPrint } from 'react-to-print'
import { BonCommandeDocument } from '@/components/documents/BonCommandeDocument'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Link } from 'react-router-dom'

interface BonCommande {
  id: number;
  numero: string;
  fournisseurId: number;
  fournisseur: { nom: string; nomSociete?: string; email?: string };
  dateCommande: string;
  dateLivraisonPrevue?: string;
  montantHt: number;
  montantTva: number;
  montantTtc: number;
  statut: string;
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

export function BonsCommandeList() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth();
  const [bons, setBons] = useState<BonCommande[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBon, setEditingBon] = useState<any | null>(null);
  const [entreprise, setEntreprise] = useState<any>(null);
  const [selectedBon, setSelectedBon] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bonToDelete, setBonToDelete] = useState<number | null>(null);
  // Pending status change awaiting confirmation. `kind` selects which
  // explanatory popup to show: 'deliver' (→ livré) or 'cancel' (→ annulé).
  const [statusConfirm, setStatusConfirm] = useState<
    { id: number; newStatus: string; kind: 'deliver' | 'cancel' } | null
  >(null);

  // --- Payment status (visualization only, local UI state) ---------------
  // Mirrors the "Statut" column but is purely for display: no DB / logic.
  const [paymentStatuses, setPaymentStatuses] = useState<Record<number, string>>({});
  const getPaymentStatus = (id: number) => paymentStatuses[id] ?? 'non_paye';
  const setPaymentStatus = (id: number, value: string) =>
    setPaymentStatuses((prev) => ({ ...prev, [id]: value }));
  // Amounts (visualization only) for the "edit unpaid" popup on partial payments.
  const [unpaidAmounts, setUnpaidAmounts] = useState<Record<number, string>>({});
  const [editPaymentBon, setEditPaymentBon] = useState<BonCommande | null>(null);
  const [editPaymentValue, setEditPaymentValue] = useState('');

  const paymentOptions: StatutOption[] = [
    { value: 'non_paye', label: 'Non payé', icon: CircleDot, color: 'text-rose-700', bgColor: 'bg-rose-50 text-rose-700 border border-rose-200/50' },
    { value: 'partiel', label: 'Partiellement payé', icon: Wallet, color: 'text-amber-700', bgColor: 'bg-amber-50 text-amber-700 border border-amber-200/50' },
    { value: 'paye', label: 'Payé', icon: CircleDollarSign, color: 'text-emerald-700', bgColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' },
  ];
  const getPaymentConfig = (value: string) =>
    paymentOptions.find((p) => p.value === value) || paymentOptions[0];

  const statusOptions: StatutOption[] = [
    { value: 'brouillon', label: t('shared.status.draft'), icon: FileText, color: 'text-amber-700', bgColor: 'bg-amber-50 text-amber-700 border border-amber-200/50' },
    { value: 'envoyé', label: t('shared.status.sent'), icon: Send, color: 'text-amber-700', bgColor: 'bg-amber-50 text-amber-700 border border-amber-200/50' },
    { value: 'confirmé', label: t('shared.status.confirmed'), icon: CheckCircle, color: 'text-emerald-700', bgColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' },
    { value: 'livré', label: t('shared.status.delivered'), icon: Truck, color: 'text-violet-700', bgColor: 'bg-violet-50 text-violet-700 border border-violet-200/50' },
    { value: 'annulé', label: t('shared.status.cancelled'), icon: Ban, color: 'text-rose-700', bgColor: 'bg-rose-50 text-rose-700 border border-rose-200/50' },
    { value: 'refusé', label: t('shared.status.refused'), icon: XCircle, color: 'text-red-700', bgColor: 'bg-red-50 text-red-700 border border-red-200/50' },
  ];

  const componentRef = useRef<HTMLDivElement>(null);
  // Tracks whether the app was in fullscreen before a print, so it can be
  // restored after the native print dialog (which exits fullscreen) closes.
  const wasFullscreenRef = useRef(false);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: selectedBon ? `Bon_Commande_${selectedBon.numero}` : 'Bon_Commande',
    onBeforePrint: async () => {
      wasFullscreenRef.current = Boolean(document.fullscreenElement);
    },
    onAfterPrint: () => {
      if (wasFullscreenRef.current && !document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    },
  });

  const mapBonCommande = (b: any) => ({
    ...b,
    id: b.id,
    numero: b.numero || '',
    fournisseurId: b.fournisseur_id,
    fournisseur: b.fournisseur,
    dateCommande: b.date_commande,
    dateLivraisonPrevue: b.date_livraison_prevue,
    montantHt: Number(b.montant_ht || 0),
    montantTva: Number(b.montant_tva || 0),
    montantTtc: Number(b.montant_ttc || 0),
    statut: b.statut || 'brouillon',
  });

  const fetchBons = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('bons_commande')
        .select('*, fournisseur:fournisseurs(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBons(Array.isArray(data) ? (data || []).map(mapBonCommande) : []);
    } catch (error) {
      console.error('Failed to fetch bons de commande', error);
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
      const { error } = await supabase.from('bons_commande').delete().eq('id', bonToDelete);
      if (error) throw error;
      toast.success(t('bons_commande.toast_deleted'));
      fetchBons();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(t('shared.toast.delete_error'));
    } finally {
      setDeleteConfirmOpen(false);
      setBonToDelete(null);
    }
  };

  const handleEdit = async (bon: BonCommande) => {
    try {
      const { data: bonData, error } = await supabase
        .from('bons_commande')
        .select('*, fournisseur:fournisseurs(*)')
        .eq('id', bon.id)
        .single();

      if (error) throw error;

      const { data: lignesData } = await supabase
        .from('bon_commande_lignes')
        .select('*')
        .eq('bon_commande_id', bon.id)
        .order('ordre');

      const mappedData = {
        ...bonData,
        fournisseurId: bonData.fournisseur_id?.toString() || '',
        dateCommande: bonData.date_commande?.split('T')[0] || '',
        dateLivraisonPrevue: bonData.date_livraison_prevue?.split('T')[0] || '',
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
      toast.error(t('bons_commande.toast_load_error'));
    }
  };

  const handleDownload = async (bon: BonCommande) => {
    try {
      toast.info(t('shared.toast.pdf_preparing'));

      const { data: bonData, error } = await supabase
        .from('bons_commande')
        .select('*, fournisseur:fournisseurs(*)')
        .eq('id', bon.id)
        .single();

      if (error) throw error;

      const { data: lignesData } = await supabase
        .from('bon_commande_lignes')
        .select('*')
        .eq('bon_commande_id', bon.id)
        .order('ordre');

      const mappedBon = {
        ...bonData,
        numero: bonData.numero,
        fournisseurId: bonData.fournisseur_id,
        fournisseur: bonData.fournisseur,
        dateCommande: bonData.date_commande,
        dateLivraisonPrevue: bonData.date_livraison_prevue,
        montantHt: bonData.montant_ht,
        montantTva: bonData.montant_tva,
        montantTtc: bonData.montant_ttc,
        statut: bonData.statut,
        lignes: (lignesData || []).map((l: any) => ({
          designation: l.designation || '',
          reference: l.reference || '',
          quantite: l.quantite,
          prixUnitaireHt: l.prix_unitaire_ht,
          prix_unitaire_ht: l.prix_unitaire_ht,
          tva: l.tva,
          montantHt: l.montant_ht,
          montant_ht: l.montant_ht,
          montantTtc: l.montant_ttc,
          montant_ttc: l.montant_ttc,
        })),
      };
      setSelectedBon(mappedBon);
      setTimeout(() => handlePrint(), 100);
    } catch (error) {
      toast.error(t('shared.toast.loading_error'));
    }
  };

  /**
   * Update the status of a Bon de Commande and apply all side effects in
   * an idempotent way.
   *
   * Business rules (per the user spec):
   *
   *   • brouillon / en_attente / envoyé / annulé / refusé
   *       → not counted in expense totals, no stock effect.
   *   • confirmé
   *       → counted in expense totals (handled by Dashboard.tsx /
   *         BonsCommandeList stats), no stock effect.
   *   • livré / livrée
   *       → counted in totals AND adds stock + creates a linked Bon
   *         de Livraison.
   *
   * Idempotency is driven by the persistent `bons_commande.stock_updated`
   * flag, NOT by the previous status. This guarantees:
   *
   *   1. Switching between non-"livré" statuses never touches stock.
   *   2. Switching to "livré" from any non-livré state increments stock
   *      exactly once.
   *   3. Switching away from "livré" reverts stock exactly once.
   *   4. Switching back to "livré" later increments stock again — but
   *      still only once per "entry into the livré state".
   *
   * The flag is flipped atomically with the side-effects so the state
   * stays consistent even if the user spams status changes.
   */
  const changeBonCommandeStatus = async (id: number, newStatus: string) => {
    const isLivréStatus = (s?: string | null) =>
      s === 'livré' || s === 'livrée'
    const isNowLivré = isLivréStatus(newStatus)

    // --- 1. fetch the existing row to know the idempotency flag --------
    const { data: oldBon, error: fetchError } = await supabase
      .from('bons_commande')
      .select('statut, fournisseur_id, numero, user_id, stock_updated')
      .eq('id', id)
      .single()
    if (fetchError || !oldBon) {
      throw new Error(`Bon de commande ${id} introuvable`)
    }
    // SQLite stores booleans as 0/1; treat any truthy value as "applied".
    const wasStockUpdated = Boolean(Number(oldBon.stock_updated || 0))

    // --- 2. update the status ------------------------------------------
    const { error: updateError } = await supabase
      .from('bons_commande')
      .update({ statut: newStatus })
      .eq('id', id)
    if (updateError) {
      throw new Error(updateError.message || 'Failed to update status')
    }

    // --- 3. linked Bon de Livraison sync -------------------------------
    // BL existence mirrors the stock flag (1 BL per "into livré" entry).
    if (isNowLivré && !wasStockUpdated) {
      try {
        const { data: bonDetails } = await supabase
          .from('bons_commande')
          .select('*')
          .eq('id', id)
          .single()
        const { data: bonLignes } = await supabase
          .from('bon_commande_lignes')
          .select('*')
          .eq('bon_commande_id', id)

        if (bonDetails) {
          const year = new Date().getFullYear()
          const { data: blExisting } = await supabase
            .from('bons_livraison')
            .select('numero')
            .like('numero', `BL-${year}-%`)
            .eq('user_id', bonDetails.user_id)
          let blMax = 0
          for (const b of blExisting || []) {
            const m = b.numero?.match(new RegExp(`^BL-${year}-(\\d+)$`))
            if (m) {
              const n = parseInt(m[1], 10)
              if (n > blMax) blMax = n
            }
          }
          const blNumero = `BL-${year}-${String(blMax + 1).padStart(4, '0')}`
          const blData: any = {
            numero: blNumero,
            user_id: bonDetails.user_id,
            fournisseur_id: bonDetails.fournisseur_id,
            date_livraison: new Date().toISOString(),
            statut: 'livré',
            notes: `Généré automatiquement depuis Bon de Commande ${bonDetails.numero}`,
            montant_ht: bonDetails.montant_ht || 0,
            montant_tva: bonDetails.montant_tva || 0,
            montant_ttc: bonDetails.montant_ttc || 0,
            bon_commande_id: id,
          }
          const { data: newBL, error: blError } = await supabase
            .from('bons_livraison')
            .insert([blData])
            .select()
            .single()
          if (!blError && newBL && bonLignes && bonLignes.length > 0) {
            const blLignesData = (bonLignes as any[]).map((l: any, index: number) => ({
              bon_livraison_id: newBL.id,
              produit_id: l.produit_id,
              reference: l.reference,
              designation: l.designation,
              quantite: l.quantite,
              prix_unitaire_ht: l.prix_unitaire_ht,
              tva: l.tva,
              montant_ht:
                l.montant_ht ||
                Number(l.quantite || 0) * Number(l.prix_unitaire_ht || 0),
              montant_ttc:
                l.montant_ttc ||
                Number(l.quantite || 0) *
                  Number(l.prix_unitaire_ht || 0) *
                  (1 + Number(l.tva || 0) / 100),
              ordre: l.ordre !== undefined ? l.ordre : index,
            }))
            await supabase.from('bon_livraison_lignes').insert(blLignesData)
          }
        }
      } catch (blSyncErr) {
        // Non-fatal — same policy as the server (BC status update already succeeded)
        console.error('[changeBonCommandeStatus] BL sync error (non-fatal):', blSyncErr)
      }
    } else if (!isNowLivré && wasStockUpdated) {
      // Reverting: remove the auto-generated Bon de Livraison
      await supabase.from('bons_livraison').delete().eq('bon_commande_id', id)
    }

    // --- 4. stock movement sync (idempotent via stock_updated) ---------
    const adjustStock = async (
      produitId: number,
      delta: number,
      type: string,
      notes: string,
      bonNumero: string | undefined,
      fournisseurNom: string | undefined,
      prixUnitaire?: number,
      clampToZero?: boolean,
    ) => {
      if (!produitId) return
      const { data: produit } = await supabase
        .from('produits')
        .select('stock_actuel')
        .eq('id', produitId)
        .single()
      if (!produit) return
      const currentStock = Number(produit.stock_actuel || 0)
      const candidateStock = currentStock + delta
      const newStock = clampToZero
        ? Math.max(0, candidateStock)
        : candidateStock
      if (!clampToZero && newStock < 0) {
        throw new Error(
          `Stock insuffisant pour le produit ${produitId}. ` +
            `Stock actuel: ${currentStock}, tentative: ${delta}`,
        )
      }
      await supabase
        .from('produits')
        .update({ stock_actuel: newStock })
        .eq('id', produitId)
      await supabase.from('mouvements_stock').insert([
        {
          produit_id: produitId,
          type,
          quantite: delta,
          notes,
          reference_document: bonNumero,
          entite_nom: fournisseurNom,
          prix_unitaire: prixUnitaire || 0,
          date_mouvement: new Date().toISOString(),
        },
      ])
    }

    // Only fetch lignes/context if we actually need to move stock.
    const needStockAdd = isNowLivré && !wasStockUpdated
    const needStockRevert = !isNowLivré && wasStockUpdated

    if (needStockAdd || needStockRevert) {
      const { data: currentLignes } = await supabase
        .from('bon_commande_lignes')
        .select('*')
        .eq('bon_commande_id', id)
      const { data: b } = await supabase
        .from('bons_commande')
        .select('*, fournisseur:fournisseurs(nom)')
        .eq('id', id)
        .single()
      const fournisseurNom: string | undefined = b?.fournisseur?.nom
      const bonNumero: string | undefined = b?.numero

      if (needStockAdd && currentLignes && currentLignes.length > 0) {
        for (const l of currentLignes as any[]) {
          if (!l.produit_id) continue
          try {
            await adjustStock(
              l.produit_id,
              Number(l.quantite || 0),
              'achat',
              `Réception Bon de Commande ${bonNumero ?? ''}`,
              bonNumero,
              fournisseurNom,
              l.prix_unitaire_ht,
              /* clampToZero */ false,
            )
          } catch (stockErr) {
            console.error(
              `[changeBonCommandeStatus] stock increment failed for produit ${l.produit_id}:`,
              stockErr,
            )
          }
        }
      } else if (needStockRevert && currentLignes && currentLignes.length > 0) {
        // Revert stock — clamp to 0 so a low/zero stock does not block the
        // administrative status change.
        for (const l of currentLignes as any[]) {
          if (!l.produit_id) continue
          try {
            await adjustStock(
              l.produit_id,
              -Number(l.quantite || 0),
              'ajustement',
              `Annulation Réception Bon de Commande ${bonNumero ?? ''}`,
              bonNumero,
              fournisseurNom,
              l.prix_unitaire_ht,
              /* clampToZero */ true,
            )
          } catch (stockErr) {
            console.error(
              `[changeBonCommandeStatus] stock revert failed for produit ${l.produit_id}:`,
              stockErr,
            )
          }
        }
      }

      // --- 5. flip the idempotency flag atomically with the side-effects -
      // Persisted AFTER the stock work so a crash mid-flight leaves us in
      // a state we can recover from on the next status change.
      await supabase
        .from('bons_commande')
        .update({ stock_updated: needStockAdd ? 1 : 0 })
        .eq('id', id)
    }

    // --- 6. cancelled BC -> auto-create a linked supplier credit note ----
    // When a Bon de Commande is cancelled, we record a supplier avoir for
    // traceability. It is LINKED (bon_commande_id set), so it does NOT impact
    // stock here and is EXCLUDED from dashboard totals. Stock reversal (if the
    // BC was delivered) is already handled by the needStockRevert branch above.
    if (newStatus === 'annulé') {
      try {
        const { data: existingAvf } = await supabase
          .from('avoirs_fournisseur')
          .select('id')
          .eq('bon_commande_id', id)
          .maybeSingle()

        if (!existingAvf) {
          const { data: bcFull } = await supabase
            .from('bons_commande')
            .select('*')
            .eq('id', id)
            .single()
          const { data: bcLignes } = await supabase
            .from('bon_commande_lignes')
            .select('*')
            .eq('bon_commande_id', id)

          if (bcFull) {
            const year = new Date().getFullYear()
            const { data: avfExisting } = await supabase
              .from('avoirs_fournisseur')
              .select('numero')
              .like('numero', `AVF-${year}-%`)
              .eq('user_id', bcFull.user_id)
            let avfMax = 0
            for (const a of avfExisting || []) {
              const m = a.numero?.match(new RegExp(`^AVF-${year}-(\\d+)$`))
              if (m) {
                const n = parseInt(m[1], 10)
                if (n > avfMax) avfMax = n
              }
            }
            const avfNumero = `AVF-${year}-${String(avfMax + 1).padStart(4, '0')}`
            const { data: newAvf, error: avfError } = await supabase
              .from('avoirs_fournisseur')
              .insert([{
                user_id: bcFull.user_id,
                numero: avfNumero,
                bon_commande_id: id,
                fournisseur_id: bcFull.fournisseur_id,
                date_emission: new Date().toISOString(),
                montant_ht: bcFull.montant_ht || 0,
                montant_tva: bcFull.montant_tva || 0,
                montant_ttc: bcFull.montant_ttc || 0,
                statut: 'annulé',
                notes: `Avoir généré automatiquement depuis l'annulation du Bon de Commande ${bcFull.numero}`,
              }])
              .select()
              .single()

            if (!avfError && newAvf && bcLignes && bcLignes.length > 0) {
              const avfLignes = (bcLignes as any[]).map((l: any, index: number) => ({
                avoir_fournisseur_id: newAvf.id,
                produit_id: l.produit_id,
                designation: l.designation,
                quantite: l.quantite,
                prix_unitaire_ht: l.prix_unitaire_ht,
                tva: l.tva,
                montant_ht: l.montant_ht || Number(l.quantite || 0) * Number(l.prix_unitaire_ht || 0),
                montant_ttc: l.montant_ttc || Number(l.quantite || 0) * Number(l.prix_unitaire_ht || 0) * (1 + Number(l.tva || 0) / 100),
                ordre: l.ordre !== undefined ? l.ordre : index,
              }))
              await supabase.from('avoir_fournisseur_lignes').insert(avfLignes)
            }
          }
        }
      } catch (avfErr) {
        // Non-fatal — the BC status change already succeeded.
        console.error('[changeBonCommandeStatus] supplier avoir sync error (non-fatal):', avfErr)
      }
    }
  }

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await changeBonCommandeStatus(id, newStatus);
      toast.success(t('shared.toast.status_updated'));
      fetchBons();
    } catch (error: any) {
      // Surface the actual server message so the user knows exactly what failed
      toast.error(error?.message || t('shared.toast.update_error'));
    }
  };

  const isLivréValue = (s?: string | null) => s === 'livré' || s === 'livrée';

  // The status dropdown is frozen once the order reaches "livré" or
  // "annulé": the user can no longer pick an arbitrary status from it.
  // (A "livré" order can still be cancelled via the dedicated icon.)
  const isStatusLocked = (statut?: string | null) =>
    isLivréValue(statut) || statut === 'annulé';

  // "annulé" is fully terminal — no transition of any kind is allowed.
  const isStatusTerminal = (statut?: string | null) => statut === 'annulé';

  /**
   * Entry point from the status dropdown / cancel icon. Changing to
   * "livré" (adds stock) or "annulé" (terminal) is irreversible, so we
   * ask for an explicit confirmation that explains the consequence before
   * applying it. Every other transition is applied directly as before.
   *
   * A "livré" order may still be moved to "annulé" (the cancel icon stays
   * available); only "annulé" itself blocks every further change.
   */
  const requestStatusChange = (id: number, newStatus: string, currentStatus: string) => {
    if (isStatusTerminal(currentStatus)) return; // annulé — no change allowed
    if (newStatus === currentStatus) return;

    if (isLivréValue(newStatus)) {
      setStatusConfirm({ id, newStatus, kind: 'deliver' });
      return;
    }
    if (newStatus === 'annulé') {
      setStatusConfirm({ id, newStatus, kind: 'cancel' });
      return;
    }
    handleStatusChange(id, newStatus);
  };

  const getStatusConfig = (statut: string) => {
    return statusOptions.find(s => s.value === statut) || statusOptions[0];
  };

  const openNewForm = () => {
    setEditingBon(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingBon(null);
  };

  const filteredBons = useMemo(() => {
    let filtered = bons.filter((bon) =>
      bon.numero?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bon.fournisseur?.nomSociete?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bon.fournisseur?.nom?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => b.statut === statusFilter);
    }

    if (timeFilter !== 'all') {
      const now = new Date();
      // Inclusive start, exclusive end of the selected period.
      let start = new Date(0);
      let end = new Date(8640000000000000); // max date
      const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      // Monday as the first day of the week.
      const startOfWeek = (d: Date) => {
        const s = startOfDay(d);
        const day = (s.getDay() + 6) % 7; // 0 = Monday
        s.setDate(s.getDate() - day);
        return s;
      };
      switch (timeFilter) {
        case 'today':
          start = startOfDay(now);
          end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
          break;
        case 'yesterday':
          end = startOfDay(now);
          start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
          break;
        case 'thisWeek':
          start = startOfWeek(now);
          end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
          break;
        case 'lastWeek':
          end = startOfWeek(now);
          start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 7);
          break;
        case 'thisMonth':
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;
        case 'lastMonth':
          start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          end = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'thisYear':
          start = new Date(now.getFullYear(), 0, 1);
          end = new Date(now.getFullYear() + 1, 0, 1);
          break;
        case 'lastYear':
          start = new Date(now.getFullYear() - 1, 0, 1);
          end = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          break;
      }
      filtered = filtered.filter(b => {
        const d = new Date(b.dateCommande);
        return d >= start && d < end;
      });
    }

    return filtered;
  }, [bons, searchQuery, statusFilter, timeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBons.length / ITEMS_PER_PAGE));
  const paginatedBons = filteredBons.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, timeFilter]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const totalBons = bons.length;
  const bonsConfirmes = bons.filter(b => ['confirmé', 'livré'].includes(b.statut)).length;
  const bonsEnAttente = bons.filter(b => ['brouillon', 'envoyé'].includes(b.statut)).length;
  const totalMontant = filteredBons.reduce((sum, b) => sum + (b.montantTtc || b.montant_ttc || 0), 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthBons = bons.filter(b => {
    const d = new Date(b.dateCommande);
    return d >= monthStart;
  });
  const monthCount = monthBons.length;
  const monthValue = monthBons.reduce((sum, b) => sum + (b.montantTtc || 0), 0);
  const pendingOrders = monthBons.filter(b => ['brouillon', 'envoyé'].includes(b.statut)).length;
  const deliveredOrders = monthBons.filter(b => b.statut === 'livré').length;
  const cancelledOrders = monthBons.filter(b => b.statut === 'annulé').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title={t('shared.confirm_delete.title_order')}
        description={t('shared.confirm_delete.body_order')}
      />

      <ConfirmDialog
        isOpen={statusConfirm !== null}
        onClose={() => setStatusConfirm(null)}
        onConfirm={() => {
          if (statusConfirm) handleStatusChange(statusConfirm.id, statusConfirm.newStatus);
          setStatusConfirm(null);
        }}
        title={
          statusConfirm?.kind === 'deliver'
            ? t('bons_commande.confirm_deliver_title')
            : t('bons_commande.confirm_cancel_title')
        }
        description={
          statusConfirm?.kind === 'deliver'
            ? t('bons_commande.confirm_deliver_body')
            : t('bons_commande.confirm_cancel_body')
        }
        confirmText={t('bons_commande.confirm_button')}
        cancelText={t('bons_commande.cancel_button')}
      />

      {/* Edit unpaid amount (visualization only) for partially-paid orders */}
      <Dialog open={editPaymentBon !== null} onOpenChange={(open) => { if (!open) setEditPaymentBon(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Modifier le montant impayé</DialogTitle>
            <DialogDescription>
              {editPaymentBon
                ? `Bon ${editPaymentBon.numero} — Total ${formatCurrencyLocale(editPaymentBon.montantTtc, i18n.language)}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="unpaid-amount">Montant impayé</Label>
            <Input
              id="unpaid-amount"
              type="number"
              min="0"
              step="0.01"
              value={editPaymentValue}
              onChange={(e) => setEditPaymentValue(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPaymentBon(null)}>
              {t('bons_commande.cancel_button')}
            </Button>
            <Button
              onClick={() => {
                if (editPaymentBon) {
                  setUnpaidAmounts((prev) => ({ ...prev, [editPaymentBon.id]: editPaymentValue }));
                }
                setEditPaymentBon(null);
              }}
            >
              {t('bons_commande.confirm_button')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="hidden">
        <BonCommandeDocument ref={componentRef} bon={selectedBon} entreprise={entreprise} lang={i18n.language} />
      </div>

      {showForm ? (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={closeForm}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">
                {editingBon ? t('bons_commande.dialog_edit') : t('bons_commande.dialog_create')}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {editingBon ? t('bons_commande.dialog_subtitle_edit', { number: editingBon.numero }) : t('bons_commande.dialog_subtitle_create')}
              </p>
            </div>
          </div>
          <div className="rounded-sm dark:bg-card dark:border-white/10 border border-slate-200 bg-white p-4 sm:p-6">
            <BonCommandeForm
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
                <ShoppingCart className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">{t('bons_commande.page_title')}</h2>
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                  {t('bons_commande.page_subtitle')}
                </p>
              </div>
            </div>
            <Button
              onClick={openNewForm}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-[4px] h-10 px-5 shadow-none dark:rounded-sm"
            >
              <Plus className="me-2 h-4 w-4" />
              {t('bons_commande.new_button')}
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
                placeholder={t('bons_commande.search_ph')}
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
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="h-10 w-full sm:w-[150px] bg-white border-slate-200 rounded-[4px] shadow-none text-sm dark:bg-transparent dark:border-white/10 dark:rounded-sm">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400 me-2" />
                <SelectValue placeholder={t('shared.filters.all_periods')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('shared.filters.all_periods')}</SelectItem>
                <SelectItem value="today">{t('shared.filters.today')}</SelectItem>
                <SelectItem value="yesterday">{t('shared.filters.yesterday')}</SelectItem>
                <SelectItem value="thisWeek">{t('shared.filters.this_week')}</SelectItem>
                <SelectItem value="lastWeek">{t('shared.filters.last_week')}</SelectItem>
                <SelectItem value="thisMonth">{t('shared.filters.this_month')}</SelectItem>
                <SelectItem value="lastMonth">{t('shared.filters.last_month')}</SelectItem>
                <SelectItem value="thisYear">{t('shared.filters.this_year')}</SelectItem>
                <SelectItem value="lastYear">{t('shared.filters.last_year')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table — wrapped in `overflow-x-auto` for mobile scroll */}
          <Card className="border border-slate-200 shadow-none rounded-[6px] overflow-hidden dark:border-white/10 dark:rounded-sm">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-100 dark:border-white/5">
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.supplier')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.bon_number')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.date')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.delivery')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 text-start">{t('shared.table.amount')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 text-center">{t('shared.table.status')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 text-center">Paiement</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 text-start">{t('shared.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                        <p className="text-sm text-muted-foreground font-medium">{t('shared.empty.loading')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedBons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="bg-slate-50 rounded-[6px] p-4 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5 dark:rounded-sm">
                          <Package className="h-8 w-8 text-slate-300" />
                        </div>
                        <p className="text-sm text-slate-500 font-medium dark:text-slate-400">
                          {searchQuery || statusFilter !== 'all' || timeFilter !== 'all'
                            ? t('bons_commande.empty_filtered')
                            : t('bons_commande.empty_all')}
                        </p>
                        {!searchQuery && statusFilter === 'all' && timeFilter === 'all' && (
                          <Button
                            variant="outline"
                            className="mt-1 rounded-[4px] text-sm"
                            onClick={openNewForm}
                          >
                            <Plus className="me-2 h-4 w-4" />
                            {t('bons_commande.create_first')}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedBons.map((bon) => {
                    const status = getStatusConfig(bon.statut);
                    const StatusIcon = status.icon;
                    const paymentStatus = getPaymentStatus(bon.id);
                    const payment = getPaymentConfig(paymentStatus);
                    const PaymentIcon = payment.icon;
                    const fournisseurInitial = (bon.fournisseur?.nom || '?').charAt(0).toUpperCase();

                    return (
                      <TableRow
                        key={bon.id}
                        className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors dark:border-white/5 dark:hover:bg-white/[0.03]"
                      >
                        <TableCell className="px-4 py-5">
                          <div className="flex items-center gap-3">
                            <Avatar size="sm" className="h-8 w-8 border border-slate-200">
                              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${bon.fournisseur?.nom}`} />
                              <AvatarFallback className="text-xs font-semibold bg-slate-100 text-slate-600">
                                {fournisseurInitial}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                {bon.fournisseur?.nom || bon.fournisseur?.nomSociete || '-'}
                              </p>
                              <p className="text-xs text-slate-400">
                                {bon.fournisseur?.email || bon.numero}
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
                            {formatDate(bon.dateCommande || bon.date, 'dd MMM yyyy', i18n.language)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <span
                            dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                            className="text-sm text-slate-500 dark:text-slate-400"
                          >
                            {bon.dateLivraisonPrevue
                              ? formatDate(bon.dateLivraisonPrevue, 'dd MMM yyyy', i18n.language)
                              : '-'}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5 text-start">
                          <span
                            dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                            className="text-sm font-bold text-slate-800 dark:text-white"
                          >
                            {formatCurrencyLocale(bon.montantTtc, i18n.language)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5 text-center">
                          <Select
                            value={bon.statut}
                            disabled={isStatusLocked(bon.statut)}
                            onValueChange={(val) => requestStatusChange(bon.id, String(val), String(bon.statut ?? ''))}
                          >
                            <SelectTrigger className="h-auto w-auto mx-auto bg-transparent border-none shadow-none focus:ring-0 p-0 disabled:opacity-100 disabled:cursor-default">
                              <SelectValue>
                                <span className={cn(
                                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
                                  status.bgColor,
                                  bon.statut === 'livré' && "dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20"
                                )}>
                                  <StatusIcon className={cn("h-3 w-3", status.color, bon.statut === 'livré' && "dark:text-violet-300")} />
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
                        <TableCell className="px-4 py-5 text-center">
                          <Select
                            value={paymentStatus}
                            onValueChange={(val) => setPaymentStatus(bon.id, String(val))}
                          >
                            <SelectTrigger className="h-auto w-auto mx-auto bg-transparent border-none shadow-none focus:ring-0 p-0">
                              <SelectValue>
                                <span className={cn(
                                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
                                  payment.bgColor
                                )}>
                                  <PaymentIcon className={cn("h-3 w-3", payment.color)} />
                                  {payment.label}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {paymentOptions.map(opt => {
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
                            {paymentStatus === 'partiel' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-[4px] dark:hover:text-amber-400 dark:hover:bg-white/5 dark:rounded-sm"
                                onClick={() => {
                                  setEditPaymentBon(bon);
                                  setEditPaymentValue(unpaidAmounts[bon.id] ?? '');
                                }}
                                title="Modifier le montant impayé"
                              >
                                <Wallet className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[4px] dark:hover:text-white dark:hover:bg-white/5 dark:rounded-sm"
                              onClick={() => handleDownload(bon)}
                              title={t('shared.actions.download_pdf')}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {bon.statut === 'brouillon' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[4px] dark:hover:text-white dark:hover:bg-white/5 dark:rounded-sm"
                                onClick={() => handleEdit(bon)}
                                title={t('shared.actions.edit')}
                              >
                                <FileEdit className="h-4 w-4" />
                              </Button>
                            )}
                            {bon.statut === 'brouillon' ? (
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
                            ) : !isStatusTerminal(bon.statut) ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-[4px] dark:hover:text-red-400 dark:hover:bg-white/5 dark:rounded-sm"
                                onClick={() => requestStatusChange(bon.id, 'annulé', String(bon.statut ?? ''))}
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
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-white">{t('bons_commande.sidebar_title')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-4 space-y-5">

              {/* ── Montant engagé ce mois ───────────────────────────── */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-[6px] bg-emerald-50 border border-emerald-200/50 shrink-0 dark:rounded-sm dark:bg-primary/10 dark:border-primary/20">
                  <ShoppingCart className="h-4 w-4 text-emerald-600 dark:text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-muted-foreground">
                    {t('bons_commande.sidebar_committed')}
                  </p>
                  <p dir="ltr" className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(monthValue)}
                  </p>
                </div>
              </div>

              {/* ── Commandes passées ────────────────────────────────── */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-[6px] bg-emerald-50 border border-emerald-200/50 shrink-0 dark:rounded-sm dark:bg-primary/10 dark:border-primary/20">
                  <Package className="h-4 w-4 text-emerald-600 dark:text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-muted-foreground">
                    {t('bons_commande.sidebar_orders')}
                  </p>
                  {/*
                   * RTL: number always reads LTR; plural resolved via proper
                   * locale keys instead of appending a hardcoded English 's'.
                   * AR: "١ أمر" / "٣ أوامر"
                   * FR: "1 commande" / "3 commandes"
                   * EN: "1 order" / "3 orders"
                   */}
                  <p className="text-lg font-bold text-slate-800 dark:text-white" dir="ltr">
                    {monthCount}{' '}
                    <span className="text-sm font-normal text-slate-400 dark:text-muted-foreground">
                      {monthCount === 1
                        ? t('bons_commande.sidebar_order_one')
                        : t('bons_commande.sidebar_order_other')}
                    </span>
                  </p>
                </div>
              </div>

              {/* ── Status breakdown ─────────────────────────────────── */}
              <div className="border-t border-slate-100 pt-4 space-y-3 dark:border-white/5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-muted-foreground">
                    {t('bons_commande.sidebar_pending')}
                  </span>
                  <span dir="ltr" className="font-semibold text-amber-600">{pendingOrders}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-muted-foreground">
                    {t('bons_commande.sidebar_delivered')}
                  </span>
                  <span dir="ltr" className="font-semibold text-violet-600 dark:text-slate-400">{deliveredOrders}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-muted-foreground">
                    {t('bons_commande.sidebar_cancelled')}
                  </span>
                  <span dir="ltr" className="font-semibold text-rose-500 dark:text-slate-400">{cancelledOrders}</span>
                </div>
              </div>

              {/* ── Link to suppliers ────────────────────────────────── */}
              <div className="border-t border-slate-100 pt-4 dark:border-white/5">
                <Link
                  to="/fournisseurs"
                  className="flex items-center gap-2 rounded-[6px] bg-slate-50 border border-slate-200/50 px-3 py-2.5 hover:bg-slate-100 transition-colors dark:rounded-sm dark:bg-slate-900/40 dark:border-white/10 dark:hover:bg-slate-900/60"
                >
                  <Building2 className="h-4 w-4 text-slate-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {t('bons_commande.sidebar_view_suppliers')}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-muted-foreground">
                      {t('bons_commande.sidebar_access_list')}
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
    </div>
  );
}
