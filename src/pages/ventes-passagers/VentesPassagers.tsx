import React, { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Plus, Search, Trash2, ShoppingCart, Receipt, CreditCard, X,
  ShoppingBag, CalendarDays, Filter, ChevronLeft, ChevronRight,
  Printer, Eye, User, TrendingUp, DollarSign, FileSpreadsheet, Package,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { updateStockAndNotify, ensureLowStockNotifications } from '@/lib/notifications'
import { ProductSelector } from '@/components/ui/ProductSelector'
// Ticket-print customisation — read on each handlePrint() so the latest
// user settings (configured in Parametres → Apparence) are always applied.
import { readTicketSettings, fontToFamily, sizeToPx } from '@/lib/ticketSettings'

interface VentePassager {
  id: string;
  numero: string;
  date: string;
  montantHt: number;
  montantTva: number;
  montantTtc: number;
  cogs?: number;
  lignes: any[];
}

interface Produit {
   id: number | string;
   nom?: string;
   designation?: string;
   reference?: string;
   prixVenteHt: number;
   prix_vente_ht?: number;
   prixVenteTtc?: number;
   prix_vente_ttc?: number;
   tauxTva: number;
   tva?: number;
   stockActuel: number;
   stock_actuel?: number;
   prixAchatHt?: number;
   prix_achat_ht?: number;
   marque?: string;
   imageUrl?: string;
   image_url?: string;
 }

const ITEMS_PER_PAGE = 10;

export default function VentesPassagers() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [ventes, setVentes] = useState<VentePassager[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [detailVente, setDetailVente] = useState<VentePassager | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const mapProduit = (p: any) => ({
    ...p,
    id: p.id,
    reference: p.reference || '',
    designation: p.designation || p.nom || '',
    marque: p.marque || '',
    prixVenteHt: Number(p.prix_vente_ht || p.prixVenteHt || 0),
    prixVenteTtc: Number(p.prix_vente_ttc || 0),
    prixAchatHt: Number(p.prix_achat_ht || p.prixAchatHt || 0),
    tauxTva: p.taux_tva != null ? Number(p.taux_tva) : (p.tva != null ? Number(p.tva) : 20),
    stockActuel: Number(p.stock_actuel || p.stockActuel || 0),
    imageUrl: p.image_url || p.imageUrl || undefined,
  });

  const [panier, setPanier] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchVentes();
      fetchProduits();
    }
  }, [user?.id]);

  const fetchVentes = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('ventes_passagers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const mappedData = (data || []).map((v: any) => ({
        ...v,
        id: v.id,
        numero: v.numero || '',
        date: v.date || v.created_at,
        montantHt: Number(v.montant_ht || v.montantHt || 0),
        montantTva: Number(v.montant_tva || v.montantTva || 0),
        montantTtc: Number(v.montant_ttc || v.montantTtc || 0),
        cogs: Number(v.cogs || 0),
      }));

      setVentes(mappedData);
    } catch (error) {
      console.error('Error fetching sales:', error);
      toast.error(t('ventes.toast_load_error'));
      setVentes([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProduits = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('produits')
        .select('*')
        .eq('user_id', user.id)
        .order('designation');
      if (error) throw error;
      setProduits(Array.isArray(data) ? data.map(mapProduit) : []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error(t('ventes.toast_load_error'));
      setProduits([]);
    }
  };

  const removeFromPanier = (index: number) => {
    setPanier(panier.filter((_, i) => i !== index));
  };

  // Allow editing the unit selling price of a cart line (e.g. when
  // negotiating with the client). Recomputes the line totals on change.
  const updatePanierPrice = (index: number, rawValue: string) => {
    const newPu = Number(rawValue);
    setPanier(panier.map((item, idx) => {
      if (idx !== index) return item;
      const pu = isNaN(newPu) || newPu < 0 ? 0 : newPu;
      const mht = pu * item.quantite;
      const mtva = mht * (Number(item.tva || 0) / 100);
      const mttc = mht + mtva;
      return { ...item, prixUnitaireHt: pu, montantHt: mht, montantTva: mtva, montantTtc: mttc };
    }));
  };

  const handleSubmit = async () => {
    if (panier.length === 0) {
      toast.error(t('ventes.toast_cart_empty'));
      return;
    }

    const totalHt = panier.reduce((sum, item) => sum + item.montantHt, 0);
    const totalTva = panier.reduce((sum, item) => sum + item.montantTva, 0);
    const totalTtc = panier.reduce((sum, item) => sum + item.montantTtc, 0);
    const totalCogs = panier.reduce((sum, item) => sum + (Number(item.prixAchatHt || 0) * item.quantite), 0);

    try {
      let numero: string | undefined;
      const year = new Date().getFullYear();
      let attempts = 0;
      while (!numero && attempts < 10) {
        const { data: existing } = await supabase
          .from('ventes_passagers')
          .select('numero')
          .like('numero', `VP-${year}-%`)
          .eq('user_id', user?.id);
        let maxNum = 0;
        for (const v of existing || []) {
          const match = v.numero?.match(new RegExp(`^VP-${year}-(\\d+)$`));
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
        const candidate = `VP-${year}-${String(maxNum + 1).padStart(4, '0')}`;
        const { data: dup } = await supabase.from('ventes_passagers').select('id').eq('numero', candidate).eq('user_id', user?.id).maybeSingle();
        if (!dup) { numero = candidate; break; }
        attempts++;
      }

      let { data: venteData, error: venteError } = await supabase
        .from('ventes_passagers')
        .insert([{
          user_id: user?.id,
          numero: numero,
          montant_ht: totalHt,
          montant_tva: totalTva,
          montant_ttc: totalTtc,
          cogs: totalCogs,
          date: new Date().toISOString(),
        }])
        .select()
        .single();

      if (venteError?.message?.includes('duplicate key') || venteError?.code === '23505') {
        const { data: dupCheck } = await supabase.from('ventes_passagers').select('numero').eq('numero', numero).eq('user_id', user?.id).maybeSingle();
        if (dupCheck) {
          const year2 = new Date().getFullYear();
          const { data: all } = await supabase.from('ventes_passagers').select('numero').like('numero', `VP-${year2}-%`).eq('user_id', user?.id);
          let mn = 0;
          for (const v of all || []) {
            const m = v.numero?.match(new RegExp(`^VP-${year2}-(\\d+)$`));
            if (m) { const n = parseInt(m[1], 10); if (n > mn) mn = n; }
          }
          numero = `VP-${year2}-${String(mn + 1).padStart(4, '0')}`;
          const retry = await supabase.from('ventes_passagers').upsert([{ user_id: user?.id, numero, montant_ht: totalHt, montant_tva: totalTva, montant_ttc: totalTtc, cogs: totalCogs, date: new Date().toISOString() }]).select().single();
          venteData = retry.data;
          venteError = retry.error;
        }
      }
      if (venteError) throw venteError;

      const lignesPayload = panier.map((item, index) => ({
        vp_id: venteData.id,
        produit_id: item.produitId,
        designation: item.designation,
        quantite: item.quantite,
        prix_unitaire_ht: item.prixUnitaireHt,
        tva: item.tva,
        montant_ht: item.montantHt,
        montant_ttc: item.montantTtc,
        montant_tva: item.montantTva,
        ordre: index,
      }));

      if (lignesPayload.length > 0) {
        const { error: lignesError } = await supabase.from('ventes_passagers_lignes').insert(lignesPayload);
        if (lignesError) throw lignesError;
      }

      for (const item of panier) {
        await updateStockAndNotify(user?.id, item.produitId, -item.quantite);
      }
      await ensureLowStockNotifications(user?.id);

      toast.success(t('ventes.toast_sale_success'));
      closeForm();
      fetchVentes();
      fetchProduits();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || t('ventes.toast_save_error'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // Fetch the sale lines before deleting so we can restore the stock
      // that was decremented when the sale was created.
      const { data: lignes } = await supabase
        .from('ventes_passagers_lignes')
        .select('produit_id, quantite')
        .eq('vp_id', id);

      const { error } = await supabase.from('ventes_passagers').delete().eq('id', id);
      if (error) throw error;

      // Put the sold quantities back into stock (inverse of the sale).
      for (const ligne of lignes || []) {
        if (ligne.produit_id) {
          await updateStockAndNotify(user?.id, ligne.produit_id, Number(ligne.quantite || 0));
        }
      }

      toast.success(t('ventes.toast_deleted'));
      fetchVentes();
      fetchProduits();
    } catch (error) {
      toast.error(t('ventes.toast_delete_error'));
    }
  };

  /**
   * Print a cash-register ticket for a sale.
   *
   * The visual style (store name, subtitle, contact info, footer message,
   * font family, size, weight, optional logo) is fully driven by the
   * settings configured in Parametres → Apparence → "Paramètres du Ticket".
   * Those settings are persisted in localStorage under `pg_ticket_settings`
   * and read here at print time so the latest customisation always wins.
   *
   * The ticket layout itself (header / meta line / items / totals / footer)
   * mirrors the live preview shown inside `TicketSettingsDialog` so the
   * user gets exactly what they saw before saving.
   */
  const handlePrint = (vente: VentePassager) => {
    // In Tauri's WebView, `window.open('', '_blank')` is blocked (the
    // shell forwards external URLs to the OS browser and refuses blank
    // targets). When that happens we fall back to printing through a
    // hidden same-document iframe — same final HTML, same OS print
    // dialog, no UX change. In a regular browser the original popup
    // path is preserved verbatim.
    const printWindow = window.open('', '_blank');
    const useIframeFallback = !printWindow;

    const settings = readTicketSettings();
    const fontFamily = fontToFamily(settings.font);
    const bodySizePx = sizeToPx(settings.size);
    const fontWeight = settings.weight === 'bold' ? 700 : 400;

    // Small helper — escape any user-controlled string before injecting
    // into the print-window HTML to keep the receipt safe even if the
    // user types HTML in the settings fields.
    const esc = (s: string) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    // Printed receipts must reflect Morocco time — the till operator is
    // there, not in UTC.
    const dateStr = formatMaDate(vente.date, {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
    const numStr = vente.numero || '';

    // Render each cart line as a 3-column grid row to match the on-screen
    // dialog: [QTY] | [DESC] | [TOTAL]. Falls back to a single synthesised
    // row for legacy sales saved without `lignes`.
    const lignes = Array.isArray(vente.lignes) ? vente.lignes : [];
    const lineRows = lignes.length > 0
      ? lignes.map((l: any) => {
          const qte = Number(l.quantite || 1);
          const designation = l.designation || l.nom || l.reference || '-';
          const total = Number(
            l.montantTtc ?? l.montant_ttc ?? qte * (l.prixUnitaireTtc ?? l.prix_unitaire_ttc ?? l.prixUnitaireHt ?? l.prix_unitaire_ht ?? 0)
          );
          return `
            <div class="line-row">
              <span>${qte}x</span>
              <span class="desc">${esc(designation)}</span>
              <span class="total">${formatCurrency(total)}</span>
            </div>`;
        }).join('')
      : `
          <div class="line-row">
            <span>1x</span>
            <span class="desc">—</span>
            <span class="total">${formatCurrency(vente.montantTtc)}</span>
          </div>`;

    // Detect RTL so the print preview lays out correctly when the active
    // language is Arabic. The thermal printer's own layout is irrelevant
    // here — we only care about how the browser composes the page.
    const isRtl = (i18n.language || '').startsWith('ar')
    const htmlLang = i18n.language || 'fr'
    const htmlDir = isRtl ? 'rtl' : 'ltr'

    // The printed sub-total (HT + TVA) — same value the dialog shows above
    // NET À PAYER. Pre-computing the value here keeps the template tidy.
    const subtotal = (Number(vente.montantHt) || 0) + (Number(vente.montantTva) || 0)

    const printHtml = `
      <html lang="${esc(htmlLang)}" dir="${htmlDir}">
      <head>
        <title>Ticket ${esc(numStr)}</title>
        <style>
          @page { margin: 8mm; }
          * { box-sizing: border-box; }
          body {
            font-family: ${fontFamily};
            font-size: ${bodySizePx}px;
            font-weight: ${fontWeight};
            color: #000;
            padding: 12px;
            max-width: 320px;
            margin: 0 auto;
            line-height: 1.45;
          }
          .center { text-align: center; }
          .row { display: flex; justify-content: space-between; gap: 8px; }
          .strong { font-weight: 700; }
          .store-name { font-weight: 700; font-size: ${bodySizePx + 1}px; margin-bottom: 2px; }
          .divider {
            border-top: 1px dashed #000;
            margin: 8px 0;
          }
          /* 3-column grid mirroring the on-screen dialog: a narrow QTY
             column, a flexible DESC, and a right-aligned TOTAL. Headers
             share the same template so columns line up perfectly. */
          .line-row {
            display: grid;
            grid-template-columns: 40px 1fr auto;
            column-gap: 8px;
            margin-top: 2px;
          }
          .line-row .desc {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .line-row .total { text-align: end; }
          .net-payable {
            font-weight: 700;
            font-size: ${bodySizePx + 1}px;
            display: flex;
            justify-content: space-between;
            align-items: baseline;
          }
          .logo {
            max-height: 56px;
            max-width: 140px;
            object-fit: contain;
            display: block;
            margin: 0 auto 6px;
          }
          .barcode {
            font-family: monospace;
            text-align: center;
            background: #f1f5f9;
            color: #475569;
            padding: 2px 24px;
            display: inline-block;
            margin-top: 8px;
            font-size: 10px;
            letter-spacing: 1px;
          }
          .signature {
            text-align: center;
            margin-top: 8px;
            font-size: ${bodySizePx - 1}px;
            color: #475569;
          }
        </style>
      </head>
      <body>
        ${settings.logoUrl ? `<img class="logo" src="${esc(settings.logoUrl)}" alt="" />` : ''}

        <div class="center">
          ${settings.storeName ? `<div class="store-name">${esc(settings.storeName)}</div>` : ''}
          ${settings.subtitle ? `<div>${esc(settings.subtitle)}</div>` : ''}
          ${settings.phone    ? `<div>Tél: ${esc(settings.phone)}</div>`        : ''}
          ${settings.address  ? `<div>Adresse: ${esc(settings.address)}</div>`  : ''}
        </div>

        <div class="divider"></div>

        <!-- Date only, no time, no client/ID rows — matches the dialog -->
        <div>
          <span>${esc(t('parametres.ticket.preview_date'))}: ${esc(dateStr)}</span>
        </div>

        <div class="divider"></div>

        <!-- QTÉ / DESC / TOTAL column headers, same grid as the rows -->
        <div class="line-row strong">
          <span>${esc(t('ventes.ticket_col_qty'))}</span>
          <span class="desc">${esc(t('ventes.ticket_col_desc'))}</span>
          <span class="total">${esc(t('ventes.ticket_col_total'))}</span>
        </div>

        ${lineRows}

        <div class="divider"></div>

        <!-- Sub-total -->
        <div class="row">
          <span>${esc(t('ventes.ticket_subtotal'))}</span>
          <span>${formatCurrency(subtotal)}</span>
        </div>

        <div class="divider"></div>

        <!-- NET À PAYER — the headline total -->
        <div class="net-payable">
          <span>${esc(t('ventes.ticket_net_payable'))}</span>
          <span>${formatCurrency(vente.montantTtc)}</span>
        </div>

        <div class="divider"></div>

        ${settings.footer ? `<div class="center">${esc(settings.footer)}</div>` : ''}

        <div class="center">
          <div class="barcode">||||| | ||||  || ||| | ||</div>
        </div>

        ${settings.storeName ? `<div class="signature">*** ${esc(settings.storeName)} ***</div>` : ''}

        <script>
          // Trigger the print dialog automatically — same UX as before.
          window.onload = function () { window.print(); };
        </script>
      </body>
      </html>
    `;

    if (!useIframeFallback && printWindow) {
      // Standard browser path — unchanged behaviour.
      printWindow.document.write(printHtml);
      printWindow.document.close();
      return;
    }

    // Tauri / popup-blocked fallback: render the same HTML into a hidden
    // same-document iframe and call print() on its contentWindow. The
    // iframe is removed after the print dialog returns so it leaves no
    // trace in the DOM.
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const cleanup = () => {
      // Defer one tick so Chromium has time to wire the print job before
      // we yank the iframe out of the DOM (yanking too early cancels it).
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1000);
    };

    iframe.onload = () => {
      try {
        const cw = iframe.contentWindow;
        if (!cw) {
          cleanup();
          return;
        }
        // `afterprint` fires once the OS dialog closes, regardless of
        // whether the user pressed Print or Cancel.
        cw.addEventListener('afterprint', cleanup);
        cw.focus();
        cw.print();
      } catch {
        // Last-ditch cleanup if something throws before afterprint.
        cleanup();
      }
    };

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      cleanup();
      toast.error(t('ventes.toast_print_error') || 'Print failed');
      return;
    }
    doc.open();
    doc.write(printHtml);
    doc.close();
  };

  const filteredVentes = useMemo(() => {
    let filtered = ventes.filter(v => {
      const searchLower = searchTerm.toLowerCase().trim();
      if (!searchLower) return true;
      const matchesNumero = (v.numero || '').toLowerCase().includes(searchLower);
      // Match against the Morocco-zone rendered date so typing "20/05/2026"
      // works regardless of the viewer's local timezone.
      const matchesDate = v.date && formatMaDate(v.date).toLowerCase().includes(searchLower);
      return matchesNumero || matchesDate;
    });

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
      filtered = filtered.filter(v => {
        const d = new Date(v.date);
        return d >= start && d < end;
      });
    }

    return filtered;
  }, [ventes, searchTerm, timeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredVentes.length / ITEMS_PER_PAGE));
  const paginatedVentes = filteredVentes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, timeFilter]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleViewDetail = async (vente: VentePassager) => {
    try {
      const { data: lignes } = await supabase
        .from('ventes_passagers_lignes')
        .select('*')
        .eq('vp_id', vente.id)
        .order('ordre');
      setDetailVente({ ...vente, lignes: lignes || [] });
      setIsDetailOpen(true);
    } catch {
      toast.error(t('ventes.toast_detail_error'));
    }
  };

  const openNewForm = () => {
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setPanier([]);
  };

  // ─── Sidebar period switcher ─────────────────────────────────────────────
  type SidebarPeriod = 'today' | 'thisMonth' | 'thisYear' | 'all'
  const [sidebarPeriod, setSidebarPeriod] = useState<SidebarPeriod>('today')

  // Locale helper for date formatting (matches the active UI language)
  const { i18n } = useTranslation()
  const dateBcp47 = i18n.language?.startsWith('ar') ? 'ar-MA'
    : i18n.language?.startsWith('en') ? 'en-US'
    : 'fr-FR'

  // ─── Time-zone for displayed sale dates ────────────────────────────
  // Sales are stored as UTC ISO strings (`new Date().toISOString()` at
  // insert time). When we render them back to the user we MUST pin the
  // formatter to Africa/Casablanca, otherwise a deploy in any other tz
  // (e.g. a server in UTC or a client traveling abroad) would show a
  // sale's date/time shifted by several hours.
  //
  // `Africa/Casablanca` is the canonical IANA tz for Morocco and
  // automatically handles DST/Ramadan-time offset changes for us.
  const MOROCCO_TZ = 'Africa/Casablanca'

  /**
   * Format a date value for display in Morocco time.
   * Centralised here so every list row / detail dialog / search filter
   * shares the same timezone & locale conventions.
   */
  const formatMaDate = (
    value: string | number | Date,
    options: Intl.DateTimeFormatOptions = {},
  ) =>
    new Date(value).toLocaleString(dateBcp47, {
      timeZone: MOROCCO_TZ,
      ...options,
    })

  const totalVentes = ventes.reduce((sum, v) => sum + (v.montantTtc || 0), 0);

  // ─── Period cutoffs anchored to the MOROCCAN calendar ──────────────
  // Naive `now.getFullYear() / .getMonth() / .getDate()` would use the
  // BROWSER's local calendar. If the browser is in UTC and it's 00:30
  // Casablanca time, `getDate()` returns yesterday → "today's" sales
  // from 00:00-00:30 MA time would be excluded from the daily total.
  // We instead build the cutoff timestamps to align with 00:00 on the
  // Morocco wall clock for the relevant day/month/year.

  /**
   * Return the UTC timestamp that corresponds to 00:00:00 on the given
   * Morocco-local calendar date (year/month-zero-based/day).
   *
   * We can't rely on `Date.UTC(y, m, d)` alone because the result is
   * UTC midnight, not Casablanca midnight (those differ by ~1 hour most
   * of the year). The trick: take the naive UTC midnight, read it back
   * through `Intl` in Africa/Casablanca, see how many hours off we are,
   * and subtract. Two passes are enough to converge — DST is at most
   * a 1-hour shift.
   */
  const moroccoCalendarStart = (y: number, mZeroBased: number, d: number): Date => {
    let candidate = Date.UTC(y, mZeroBased, d, 0, 0, 0)
    for (let i = 0; i < 2; i++) {
      const hourStr = new Intl.DateTimeFormat('en-US', {
        timeZone: MOROCCO_TZ,
        hour: 'numeric',
        hourCycle: 'h23',
      }).formatToParts(new Date(candidate))
        .find(p => p.type === 'hour')?.value ?? '0'
      const h = Number(hourStr)
      if (h === 0) break
      candidate -= h * 3_600_000
    }
    return new Date(candidate)
  }

  // Today's Y/M/D as Morocco would read them right now.
  const maParts = new Intl.DateTimeFormat('en-US', {
    timeZone: MOROCCO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const maY = Number(maParts.find(p => p.type === 'year')!.value)
  const maM = Number(maParts.find(p => p.type === 'month')!.value) - 1
  const maD = Number(maParts.find(p => p.type === 'day')!.value)

  const todayStart = moroccoCalendarStart(maY, maM, maD)
  const monthStart = moroccoCalendarStart(maY, maM, 1)
  const yearStart  = moroccoCalendarStart(maY, 0,   1)

  function getCutoff(period: SidebarPeriod): Date {
    switch (period) {
      case 'today':     return todayStart
      case 'thisMonth': return monthStart
      case 'thisYear':  return yearStart
      default:          return new Date(0)
    }
  }

  // Filtered list for the currently selected sidebar period
  const sidebarVentes = useMemo(() => {
    const cutoff = getCutoff(sidebarPeriod)
    return ventes.filter(v => new Date(v.date) >= cutoff)
  }, [ventes, sidebarPeriod])

  const sidebarCount   = sidebarVentes.length
  const sidebarRevenue = sidebarVentes.reduce((sum, v) => sum + (v.montantTtc || 0), 0)
  const sidebarAvg     = sidebarCount > 0 ? sidebarRevenue / sidebarCount : 0
  const sidebarTva     = sidebarVentes.reduce((sum, v) => sum + (v.montantTva || 0), 0)

  // Keep a today snapshot for the sparkline (always today regardless of period switch)
  const todayVentesList = ventes.filter(v => new Date(v.date) >= todayStart);
  const todayRevenue    = todayVentesList.reduce((sum, v) => sum + (v.montantTtc || 0), 0);

  // Weekly sparkline data (last 7 days) — labels use the active locale
  const weekDays: { label: string; total: number }[] = useMemo(() => {
    const result: { label: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const dayTotal = ventes
        .filter(v => {
          const vd = new Date(v.date);
          return vd >= d && vd < next;
        })
        .reduce((s, v) => s + (v.montantTtc || 0), 0);
      result.push({
        // Weekday label in Morocco tz so the chart bars line up with the
        // local week even if the browser is in a different zone.
        label: formatMaDate(d, { weekday: 'short' }).slice(0, 3),
        total: dayTotal,
      });
    }
    return result;
  }, [ventes, dateBcp47]);

  const maxSparkValue = Math.max(...weekDays.map(d => d.total), 1);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {showForm ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={closeForm}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-foreground">{t('ventes.dialog_create')}</h2>
              <p className="text-sm text-muted-foreground">{t('ventes.dialog_subtitle_create')}</p>
            </div>
          </div>

          <div className="space-y-8">
            {/* Section 1: Information de Vente */}
            <div className="rounded-sm dark:bg-card dark:border-white/10 border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center gap-2.5 px-6 py-4 border-b dark:border-white/10 border-slate-100 dark:bg-card bg-slate-50/50">
                <ShoppingCart className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-bold text-slate-800">{t('ventes.sale_info')}</span>
              </div>
              <div className="p-6 space-y-4">
                <ProductSelector
                  produits={produits}
                  onSelect={(produit, qte) => {
                    const puHt = Number(produit.prixVenteHt ?? 0);
                    const tvaRate = Number(produit.tauxTva ?? 20);
                    const mht = puHt * qte;
                    const mtva = mht * (tvaRate / 100);
                    const mttc = mht + mtva;

                    const existingIndex = panier.findIndex(item => Number(item.produitId) === Number(produit.id));
                    if (existingIndex >= 0) {
                      const existing = panier[existingIndex];
                      const newQte = existing.quantite + qte;
                      const newMht = existing.prixUnitaireHt * newQte;
                      const newMtva = newMht * (existing.tva / 100);
                      const newMttc = newMht + newMtva;

                      setPanier(panier.map((item, idx) =>
                        idx === existingIndex
                          ? { ...item, quantite: newQte, montantHt: newMht, montantTva: newMtva, montantTtc: newMttc }
                          : item
                      ));
                    } else {
                      setPanier([...panier, {
                        produitId: produit.id,
                        designation: produit.designation || t('shared.table.product'),
                        quantite: qte,
                        prixUnitaireHt: puHt,
                        tva: tvaRate,
                        montantHt: mht,
                        montantTva: mtva,
                        montantTtc: mttc,
                        prixAchatHt: Number(produit.prixAchatHt ?? 0)
                      }]);
                    }
                    toast.success(t('ventes.toast_item_added', { name: produit.designation || t('shared.table.product') }));
                  }}
                  trigger={
                    <Button className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-sm shadow-none text-base">
                      <ShoppingCart className="mr-2 h-5 w-5" />
                      {t('ventes.select_product')}
                    </Button>
                  }
                />
                <p className="text-xs text-slate-400 text-center">
                  {t('ventes.select_product_hint')}
                </p>
              </div>
            </div>

            {/* Section 2: Panier */}
            <div className="rounded-sm dark:bg-card dark:border-white/10 border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b dark:border-white/10 border-slate-100 dark:bg-card bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <Package className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm font-bold text-slate-800">
                    {t('ventes.cart_title')} <span className="text-slate-400 font-normal">({t(panier.length === 1 ? 'ventes.cart_item_one' : 'ventes.cart_item_other', { count: panier.length })})</span>
                  </span>
                </div>
              </div>

              <div className="p-4 sm:p-6">
                <div className="rounded-sm dark:border-white/10 border border-slate-200 overflow-hidden">
                  {/* Cart table scrolls horizontally on narrow viewports. */}
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b dark:border-white/10 border-slate-100 dark:bg-card bg-slate-50/30">
                        <TableHead className="text-[11px] font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-5 py-4">{t('ventes.col_designation')}</TableHead>
                        <TableHead className="text-[11px] font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-5 py-4 text-right">{t('ventes.col_qty')}</TableHead>
                        <TableHead className="text-[11px] font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-5 py-4 text-right">{t('ventes.col_unit_price')}</TableHead>
                        <TableHead className="text-[11px] font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-5 py-4 text-right">{t('ventes.col_vat')}</TableHead>
                        <TableHead className="text-[11px] font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-5 py-4 text-right">{t('ventes.col_total')}</TableHead>
                        <TableHead className="w-14 px-5 py-4"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {panier.map((item, index) => (
                        <TableRow key={index} className="border-b dark:border-white/10 border-slate-100 last:border-0">
                          <TableCell className="px-5 py-4">
                            <p className="text-sm font-medium dark:text-card-foreground text-slate-800">{item.designation}</p>
                          </TableCell>
                          <TableCell className="px-5 py-4 text-right">
                            <span className="inline-flex items-center justify-center min-w-[32px] h-7 px-2.5 rounded-sm dark:bg-slate-800 bg-slate-100 text-sm font-bold dark:text-card-foreground text-slate-700">{item.quantite}</span>
                          </TableCell>
                          <TableCell className="px-5 py-4 text-right">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.prixUnitaireHt}
                              onChange={(e) => updatePanierPrice(index, e.target.value)}
                              className="h-8 w-24 ms-auto text-right text-sm dark:bg-slate-900/50 dark:border-white/10 bg-white border-slate-300"
                            />
                          </TableCell>
                          <TableCell className="px-5 py-4 text-right text-sm dark:text-muted-foreground text-slate-500">{item.tva}%</TableCell>
                          <TableCell className="px-5 py-4 text-right">
                            <span className="text-sm font-bold text-emerald-600">{formatCurrency(item.montantTtc)}</span>
                          </TableCell>
                          <TableCell className="px-5 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-[8px]"
                              onClick={() => removeFromPanier(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {panier.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-16">
                            <div className="flex flex-col items-center gap-4">
                              <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-300">
                                <rect x="10" y="26" width="52" height="36" rx="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                                <path d="M8 22C8 19.7909 9.79086 18 12 18H60C62.2091 18 64 19.7909 64 22V26H8V22Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                                <path d="M26 34H46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 3" />
                                <path d="M22 42H50" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 3" />
                                <path d="M24 50H36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 3" />
                                <circle cx="38" cy="14" r="3" fill="#10B981" stroke="white" strokeWidth="1.5" />
                              </svg>
                              <div>
                                <p className="text-sm font-semibold text-slate-500">{t('ventes.cart_empty_title')}</p>
                                <p className="text-xs text-slate-400 mt-1">{t('ventes.cart_empty_hint')}</p>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              </div>

              {/* Totals — restored after accidental deletion. Wraps the
                  three sub-totals so they stack vertically on phones and
                  align right on tablets+, mirroring the rest of this row. */}
              {panier.length > 0 && (
                <div className="px-4 sm:px-6 py-4 border-t dark:border-white/10 border-slate-100 dark:bg-card bg-slate-50/50">
                  <div className="flex justify-end">
                    <div className="flex flex-wrap items-center gap-4 sm:gap-8">
                      <div className="text-right">
                        <p className="text-[11px] font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider">{t('ventes.total_ht')}</p>
                        <p className="text-base sm:text-lg font-bold dark:text-card-foreground text-slate-800">{formatCurrency(panier.reduce((sum, i) => sum + i.montantHt, 0))}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider">{t('ventes.total_vat')}</p>
                        <p className="text-base sm:text-lg font-bold dark:text-card-foreground text-slate-800">{formatCurrency(panier.reduce((sum, i) => sum + i.montantTva, 0))}</p>
                      </div>
                      <div className="text-right border-l border-emerald-200 ps-4 sm:ps-8">
                        <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">{t('ventes.total_ttc')}</p>
                        <p className="text-xl sm:text-2xl font-black text-emerald-600">{formatCurrency(panier.reduce((sum, i) => sum + i.montantTtc, 0))}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 px-4 sm:px-8 py-4 sm:py-5 border-t dark:border-white/10 border-slate-200 dark:bg-card bg-slate-50/50 rounded-sm">
              <Button
                variant="outline"
                onClick={closeForm}
                className="h-10 px-5 rounded-sm dark:border-white/10 dark:text-muted-foreground border-slate-300 text-slate-600 font-semibold text-sm shadow-none"
              >
                {t('ventes.btn_cancel')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={panier.length === 0}
                className="h-10 px-5 rounded-sm bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-none"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {t('ventes.btn_validate')}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Header — stacks below sm, button full-width on mobile */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-sm dark:bg-emerald-500/10 dark:border-emerald-500/20 bg-emerald-50 border border-emerald-200/50 shrink-0">
                <ShoppingBag className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">{t('ventes.page_title')}</h2>
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{t('ventes.page_subtitle')}</p>
              </div>
            </div>

            <Button onClick={openNewForm} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-sm h-10 px-5 shadow-none">
              <Plus className="mr-2 h-4 w-4" />
              {t('ventes.new_button')}
            </Button>
          </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Left Column - Table */}
        <div className="lg:col-span-3 space-y-4 min-w-0">
          {/* Search & Filters — filter becomes full-width on mobile */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 dark:text-muted-foreground text-slate-400" />
              <Input
                type="text"
                placeholder={t('ventes.search_ph')}
                className="pl-9 h-10 dark:bg-slate-900/50 dark:border-white/5 bg-white border-slate-200 rounded-sm focus:border-slate-300 shadow-none text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="h-10 w-full sm:w-[150px] dark:bg-slate-900/50 dark:border-white/5 bg-white border-slate-200 rounded-sm shadow-none text-sm">
                <CalendarDays className="h-3.5 w-3.5 dark:text-muted-foreground text-slate-400 mr-2" />
                <SelectValue placeholder={t('ventes.filter_all')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ventes.filter_all')}</SelectItem>
                <SelectItem value="today">{t('ventes.filter_today')}</SelectItem>
                <SelectItem value="yesterday">{t('ventes.filter_yesterday')}</SelectItem>
                <SelectItem value="thisWeek">{t('ventes.filter_week')}</SelectItem>
                <SelectItem value="lastWeek">{t('ventes.filter_last_week')}</SelectItem>
                <SelectItem value="thisMonth">{t('ventes.filter_month')}</SelectItem>
                <SelectItem value="lastMonth">{t('ventes.filter_last_month')}</SelectItem>
                <SelectItem value="thisYear">{t('ventes.filter_year')}</SelectItem>
                <SelectItem value="lastYear">{t('ventes.filter_last_year')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sales Table — wrapped in `overflow-x-auto` for mobile scroll */}
          <Card className="border dark:border-white/10 border-slate-200 shadow-none rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b dark:border-white/5 border-slate-100">
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">{t('ventes.col_client')}</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">{t('ventes.col_number')}</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">{t('ventes.col_date')}</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3 text-right">{t('ventes.col_details')}</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3 text-center">{t('ventes.col_status')}</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3 text-right">{t('ventes.col_actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                        <p className="text-sm text-muted-foreground font-medium">{t('ventes.loading')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedVentes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="dark:bg-white/5 dark:border-white/10 bg-slate-50 rounded-sm p-4 border border-slate-100">
                          <Receipt className="h-8 w-8 dark:text-muted-foreground text-slate-300" />
                        </div>
                        <p className="text-sm dark:text-muted-foreground text-slate-500 font-medium">
                          {searchTerm || timeFilter !== 'all'
                            ? t('ventes.empty_filtered')
                            : t('ventes.empty_all')}
                        </p>
                        {!searchTerm && timeFilter === 'all' && (
                          <Button
                            variant="outline"
                            className="mt-1 rounded-sm text-sm"
                            onClick={openNewForm}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            {t('ventes.create_first')}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedVentes.map((vente) => (
                    <TableRow
                      key={vente.id}
                      className="border-b dark:border-white/5 border-slate-100"
                    >
                      <TableCell className="px-4 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full dark:bg-slate-800 dark:border-white/10 bg-slate-100 border border-slate-200">
                            <User className="h-4 w-4 dark:text-muted-foreground text-slate-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold dark:text-card-foreground text-slate-800">{t('ventes.walk_in_client')}</p>
                            <p className="text-xs dark:text-muted-foreground text-slate-400">{t('ventes.counter_sale')}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-5">
                        <span className="text-sm font-mono font-medium dark:text-card-foreground text-slate-700">{vente.numero}</span>
                      </TableCell>
                      <TableCell className="px-4 py-5">
                        <span className="text-sm dark:text-muted-foreground text-slate-500">
                          {/* Pinned to Africa/Casablanca via `formatMaDate` so the
                              displayed time matches when the sale was actually
                              made in Morocco, regardless of the viewer's tz. */}
                          {formatMaDate(vente.date, {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-5 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm font-bold dark:text-card-foreground text-slate-800">{formatCurrency(vente.montantTtc)}</span>
                          <span className="text-[11px] dark:text-muted-foreground text-slate-400">
                            HT: {formatCurrency(vente.montantHt)} · TVA: {formatCurrency(vente.montantTva)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-5 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {t('ventes.status_completed')}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-5 text-right">
                        <div className="flex justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 dark:text-muted-foreground dark:hover:text-card-foreground dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-sm"
                            onClick={() => handleViewDetail(vente)}
                            title={t('shared.actions.view_detail')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 dark:text-muted-foreground dark:hover:text-red-400 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-sm"
                            onClick={() => handleDelete(vente.id?.toString())}
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

            {!loading && paginatedVentes.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t dark:border-white/5 border-slate-100">
                <p className="text-xs dark:text-muted-foreground text-slate-400">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredVentes.length)} {t('shared.pagination.of')} {filteredVentes.length}
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
        <div className="lg:col-span-1 space-y-4">
          <Card className="border dark:border-white/10 border-slate-200 shadow-none rounded-sm">

            {/* ── Card header: title + period toggle buttons ─────────── */}
            <CardHeader className="px-4 py-3 border-b dark:border-white/5 border-slate-100 space-y-3">
              <CardTitle className="text-sm font-semibold dark:text-card-foreground text-slate-700">
                {t(`ventes.sidebar_title_${sidebarPeriod}`)}
              </CardTitle>

              {/* Period toggle pill group */}
              <div className="flex items-center gap-1 p-0.5 rounded-sm bg-slate-100 dark:bg-white/5 w-full">
                {([ 'today', 'thisMonth', 'thisYear', 'all' ] as SidebarPeriod[]).map((period) => {
                  const labelKey = {
                    today:     'ventes.sidebar_period_today',
                    thisMonth: 'ventes.sidebar_period_month',
                    thisYear:  'ventes.sidebar_period_year',
                    all:       'ventes.sidebar_period_all',
                  }[period]
                  const isActive = sidebarPeriod === period
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setSidebarPeriod(period)}
                      className={cn(
                        'flex-1 text-[10px] font-semibold px-1 py-1 rounded-[3px] transition-all duration-150 truncate',
                        isActive
                          ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
                      )}
                    >
                      {t(labelKey)}
                    </button>
                  )
                })}
              </div>
            </CardHeader>

            <CardContent className="px-4 py-4 space-y-5">

              {/* Sales count */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-sm dark:bg-primary/10 dark:border-primary/20 bg-emerald-50 border border-emerald-200/50 shrink-0">
                  <ShoppingBag className="h-4 w-4 dark:text-primary text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs dark:text-muted-foreground text-slate-500">
                    {t('ventes.sidebar_sales_count')}
                  </p>
                  <p className="text-lg font-bold dark:text-card-foreground text-slate-800" dir="ltr">
                    {sidebarCount}{' '}
                    <span className="text-sm font-normal text-slate-400 dark:text-muted-foreground">
                      {sidebarCount === 1
                        ? t('ventes.sidebar_sale_one')
                        : t('ventes.sidebar_sale_other')}
                    </span>
                  </p>
                </div>
              </div>

              {/* Revenue */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-sm dark:bg-primary/10 dark:border-primary/20 bg-emerald-50 border border-emerald-200/50 shrink-0">
                  <DollarSign className="h-4 w-4 dark:text-primary text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs dark:text-muted-foreground text-slate-500">
                    {t('ventes.sidebar_revenue')}
                  </p>
                  <p className="text-lg font-bold text-emerald-600" dir="ltr">
                    {formatCurrency(sidebarRevenue)}
                  </p>
                </div>
              </div>

              {/* Average basket + VAT */}
              <div className="border-t dark:border-white/5 border-slate-100 pt-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs dark:text-muted-foreground text-slate-500 truncate">
                    {t('ventes.sidebar_avg')}
                  </p>
                  <p className="text-sm font-bold dark:text-card-foreground text-slate-800 shrink-0" dir="ltr">
                    {formatCurrency(sidebarAvg)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs dark:text-muted-foreground text-slate-500 truncate">
                    {t('ventes.sidebar_vat')}
                  </p>
                  <p className="text-sm font-semibold dark:text-muted-foreground text-slate-600 shrink-0" dir="ltr">
                    {formatCurrency(sidebarTva)}
                  </p>
                </div>
              </div>

              {/* Weekly sparkline — always shows last 7 days regardless of period */}
              <div className="border-t dark:border-white/5 border-slate-100 pt-4">
                <p className="text-[11px] font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider mb-3">
                  {t('ventes.sidebar_trend')}
                </p>
                {/* Sparkline SVG is direction-independent; wrap in dir=ltr so SVG
                    coordinates are not mirrored by the parent RTL context */}
                <div dir="ltr">
                  <svg viewBox="0 0 200 60" className="w-full h-16">
                    <defs>
                      <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {(() => {
                      const points = weekDays.map((d, i) => ({
                        x: (i / (weekDays.length - 1)) * 180 + 10,
                        y: 55 - (d.total / maxSparkValue) * 40,
                      }));
                      const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
                      const areaPath = linePath + ` L${points[points.length - 1].x},55 L${points[0].x},55 Z`;
                      return (
                        <>
                          <path d={areaPath} fill="url(#sparkGrad)" />
                          <path d={linePath} fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          {points.map((p, i) => (
                            <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#10B981" stroke="white" strokeWidth="1.5" />
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                  <div className="flex justify-between mt-1">
                    {weekDays.map((d, i) => (
                      <span key={i} className="text-[10px] dark:text-muted-foreground text-slate-400">
                        {d.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
        </>
      )}

      {/* ── Detail Dialog — receipt-style preview ──────────────────────
          Renders the sale as an actual cash-register ticket using the
          user's saved ticket settings (logo, store name, fonts, footer)
          so what they see here is exactly what gets printed. The dialog
          mirrors the screenshot: white "paper" card with logo header,
          dashed dividers, item lines, NET À PAYER highlight, payment
          method line, footer message, and a faux barcode block. */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          {/* Header — small bar above the receipt with the dialog title.
              The default Dialog already provides the X close button, so
              we only render the title text on the left. */}
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-card">
            <Receipt className="h-4 w-4 text-emerald-600" />
            <DialogTitle className="text-base font-semibold text-foreground">
              {t('ventes.ticket_dialog_title')}
            </DialogTitle>
          </div>

          {detailVente && (() => {
            // Resolve ticket settings + matching font/size/weight so the
            // preview mirrors the print output. Read on every render so
            // updates from the settings dialog take effect instantly.
            const settings = readTicketSettings()
            const fontFamily = fontToFamily(settings.font)
            const bodySizePx = sizeToPx(settings.size)
            const fontWeight = settings.weight === 'bold' ? 700 : 400
            // Detail dialog renders the receipt in Morocco tz, DATE ONLY
            // (no time / client / payment-mode lines — matches the printed
            // ticket exactly so the on-screen preview is a 1:1 mock-up).
            const dateOnly = formatMaDate(detailVente.date, {
              day: '2-digit', month: '2-digit', year: 'numeric',
            })
            const lignes = Array.isArray(detailVente.lignes) ? detailVente.lignes : []

            return (
              <div
                className="bg-slate-100 dark:bg-slate-950 px-4 py-5 max-h-[70vh] overflow-y-auto"
              >
                {/* The receipt itself. `dir="ltr"` is forced so numbers and
                    the ticket layout always read like the actual printed
                    output, even when the app is in Arabic. */}
                <div
                  dir="ltr"
                  className="bg-white text-black rounded-sm shadow-md mx-auto"
                  style={{
                    maxWidth: 320,
                    padding: '16px 16px 18px',
                    fontFamily,
                    fontSize: `${bodySizePx}px`,
                    fontWeight,
                    lineHeight: 1.45,
                    color: '#000',
                  }}
                >
                  {/* Logo (optional) */}
                  {settings.logoUrl && (
                    <div className="flex justify-center mb-2">
                      <img
                        src={settings.logoUrl}
                        alt=""
                        style={{ maxHeight: 56, maxWidth: 140, objectFit: 'contain' }}
                      />
                    </div>
                  )}

                  {/* Centred store header — subtitle / phone / address are
                      omitted when blank so the user doesn't see empty lines. */}
                  <div className="text-center">
                    {settings.storeName && (
                      <p style={{ fontWeight: 700, fontSize: `${bodySizePx + 1}px`, marginBottom: 2 }}>
                        {settings.storeName}
                      </p>
                    )}
                    {settings.subtitle && <p>{settings.subtitle}</p>}
                    {settings.phone && <p>Tél: {settings.phone}</p>}
                    {settings.address && <p>Adresse: {settings.address}</p>}
                  </div>

                  <TicketDashedDivider />

                  {/* Date only — no time, no client, no ID.
                      Keeps the receipt clean and matches the printed output. */}
                  <div>
                    <p>{t('parametres.ticket.preview_date')}: {dateOnly}</p>
                  </div>

                  <TicketDashedDivider />

                  {/* Column headers + line items. QTÉ | DESC | TOTAL.
                      We use a 3-column grid so columns line up cleanly even
                      with proportional (non-monospace) fonts. */}
                  <div
                    className="grid items-center"
                    style={{ gridTemplateColumns: '40px 1fr auto', columnGap: 8, fontWeight: 700 }}
                  >
                    <span>{t('ventes.ticket_col_qty')}</span>
                    <span>{t('ventes.ticket_col_desc')}</span>
                    <span className="text-right">{t('ventes.ticket_col_total')}</span>
                  </div>

                  {lignes.length > 0 ? (
                    lignes.map((l: any, i: number) => {
                      const qte = Number(l.quantite || 1)
                      const designation = l.designation || l.nom || l.reference || '-'
                      const total = Number(
                        l.montantTtc ?? l.montant_ttc ?? qte * (l.prixUnitaireTtc ?? l.prix_unitaire_ttc ?? l.prixUnitaireHt ?? l.prix_unitaire_ht ?? 0)
                      )
                      return (
                        <div
                          key={i}
                          className="grid items-center mt-1"
                          style={{ gridTemplateColumns: '40px 1fr auto', columnGap: 8 }}
                        >
                          <span>{qte}x</span>
                          <span className="truncate">{designation}</span>
                          <span className="text-right">{formatCurrency(total)}</span>
                        </div>
                      )
                    })
                  ) : (
                    /* Fallback for legacy rows without `lignes`: a single
                        synthesised line summarising the TTC total. */
                    <div
                      className="grid items-center mt-1"
                      style={{ gridTemplateColumns: '40px 1fr auto', columnGap: 8 }}
                    >
                      <span>1x</span>
                      <span className="truncate">—</span>
                      <span className="text-right">{formatCurrency(detailVente.montantTtc)}</span>
                    </div>
                  )}

                  <TicketDashedDivider />

                  {/* Subtotal */}
                  <div className="flex justify-between">
                    <span>{t('ventes.ticket_subtotal')}</span>
                    <span>{formatCurrency(detailVente.montantHt + detailVente.montantTva)}</span>
                  </div>

                  <TicketDashedDivider />

                  {/* NET À PAYER — emphasised line.
                      Slightly larger font + bold weight so this row reads
                      as the "headline" total. Payment-mode line removed
                      per the simplified ticket layout. */}
                  <div
                    className="flex justify-between items-baseline"
                    style={{ fontWeight: 700, fontSize: `${bodySizePx + 1}px` }}
                  >
                    <span>{t('ventes.ticket_net_payable')}</span>
                    <span>{formatCurrency(detailVente.montantTtc)}</span>
                  </div>

                  <TicketDashedDivider />

                  {/* Thank-you message from settings */}
                  {settings.footer && (
                    <p className="text-center" style={{ marginTop: 2 }}>{settings.footer}</p>
                  )}

                  {/* Faux barcode block */}
                  <div className="flex justify-center mt-2">
                    <div
                      style={{
                        fontFamily: 'monospace',
                        background: '#f1f5f9',
                        color: '#475569',
                        padding: '2px 24px',
                        fontSize: '10px',
                        letterSpacing: '1px',
                      }}
                    >
                      ||||| | ||||  || ||| | ||
                    </div>
                  </div>

                  {/* Store-name signature line ("*** ENTREPRISE X ***") */}
                  {settings.storeName && (
                    <p className="text-center mt-2" style={{ fontSize: `${bodySizePx - 1}px`, color: '#475569' }}>
                      *** {settings.storeName} ***
                    </p>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Footer with Close + Print actions, matching the screenshot.
              Print stays orange/amber per the mockup to read as the
              primary action without conflicting with the brand emerald. */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border bg-card">
            <Button
              variant="outline"
              onClick={() => setIsDetailOpen(false)}
              className="flex-1 sm:flex-none h-10 rounded-md"
            >
              {t('ventes.ticket_btn_close')}
            </Button>
            {detailVente && (
              <Button
                className="flex-1 sm:flex-none h-10 rounded-md bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-none"
                onClick={() => { handlePrint(detailVente); setIsDetailOpen(false); }}
              >
                <Printer className="me-2 h-4 w-4" />
                {t('ventes.ticket_btn_print')}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Dashed horizontal rule used inside the receipt preview to mimic the
 * dotted separator lines printed on a thermal till roll.
 */
function TicketDashedDivider() {
  return (
    <div
      style={{
        borderTop: '1px dashed #94a3b8',
        margin: '8px 0',
      }}
    />
  )
}
