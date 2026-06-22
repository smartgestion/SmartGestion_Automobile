import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { formatCurrencyLocale, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  DollarSign, CreditCard, Activity, FileText, Users, Package,
  TrendingUp, ShieldCheck, ChevronRight, Receipt, Building2,
  HeartPulse, ClipboardList, Plus, ShoppingCart, AlertTriangle,
  Pill, PieChart, CalendarDays, Filter, Calculator,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { KPICard } from '@/components/ui/kpi-card'
import { useTranslation } from 'react-i18next'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  clientsCount: number
  facturesCount: number
  produitsCount: number
  fournisseursCount: number
  totalRevenue: number
  totalRevenueHT: number
  unpaidRevenue: number
  totalDepenses: number
  totalDepensesHT: number
  profit: number
  profitHT: number
  totalTvaCollectee: number
  totalTvaDeductible: number
  tvaNet: number
  ventesHT: number
  totalCOGS: number
  totalCOGSTTC: number
  // ── Marge Commerciale breakdown components (for the "view calculation" popup)
  cogsHTSold: number
  cogsTTCSold: number
  cogsHTReturned: number
  cogsTTCReturned: number
  stockValueHT: number
  monthlyData: Array<{ name: string; revenue: number; expenses: number }>
  monthlyDataHT: Array<{ name: string; revenue: number; expenses: number }>
  lowStockProduits: any[]
  recentFactures: any[]
  bonsCommandeCount: number
}

// ─── Month-index → i18n key map ───────────────────────────────────────────────
const MONTH_KEYS = [
  'jan','feb','mar','apr','may','jun',
  'jul','aug','sep','oct','nov','dec',
] as const

// ─── Locale → Intl BCP-47 tag ─────────────────────────────────────────────────
function toDateLocale(lang: string): string {
  if (lang.startsWith('ar')) return 'ar-MA'
  if (lang.startsWith('en')) return 'en-US'
  return 'fr-FR'
}

// ─── Date range types & helpers ────────────────────────────────────────────────

type DateRangeKey = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'all' | 'custom'

const DATE_RANGE_OPTIONS: { key: DateRangeKey; labelKey: string }[] = [
  { key: 'today',       labelKey: 'date_range.today' },
  { key: 'yesterday',   labelKey: 'date_range.yesterday' },
  { key: 'this_week',   labelKey: 'date_range.this_week' },
  { key: 'last_week',   labelKey: 'date_range.last_week' },
  { key: 'this_month',  labelKey: 'date_range.this_month' },
  { key: 'last_month',  labelKey: 'date_range.last_month' },
  { key: 'this_year',   labelKey: 'date_range.this_year' },
  { key: 'last_year',   labelKey: 'date_range.last_year' },
  { key: 'all',         labelKey: 'date_range.all' },
  { key: 'custom',      labelKey: 'date_range.custom' },
]

function getDateRange(option: DateRangeKey, customStart?: string, customEnd?: string): { start: Date | null; end: Date | null } {
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)

  switch (option) {
    case 'today':
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break
    case 'yesterday':
      start.setDate(start.getDate() - 1)
      start.setHours(0, 0, 0, 0)
      end.setDate(end.getDate() - 1)
      end.setHours(23, 59, 59, 999)
      break
    case 'this_week': {
      const day = start.getDay()
      const diff = day === 0 ? 6 : day - 1
      start.setDate(start.getDate() - diff)
      start.setHours(0, 0, 0, 0)
      break
    }
    case 'last_week': {
      const day = start.getDay()
      const diff = day === 0 ? 6 : day - 1
      start.setDate(start.getDate() - diff - 7)
      start.setHours(0, 0, 0, 0)
      end.setDate(end.getDate() - diff - 1)
      end.setHours(23, 59, 59, 999)
      break
    }
    case 'this_month':
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      break
    case 'last_month':
      start.setMonth(start.getMonth() - 1, 1)
      start.setHours(0, 0, 0, 0)
      end.setMonth(end.getMonth(), 0)
      end.setHours(23, 59, 59, 999)
      break
    case 'this_year':
      start.setMonth(0, 1)
      start.setHours(0, 0, 0, 0)
      break
    case 'last_year':
      start.setFullYear(start.getFullYear() - 1, 0, 1)
      start.setHours(0, 0, 0, 0)
      end.setFullYear(end.getFullYear() - 1, 11, 31)
      end.setHours(23, 59, 59, 999)
      break
    case 'custom': {
      const s = customStart ? new Date(customStart) : null
      const e = customEnd ? new Date(customEnd) : null
      if (s) s.setHours(0, 0, 0, 0)
      if (e) e.setHours(23, 59, 59, 999)
      return { start: s, end: e }
    }
    case 'all':
    default:
      return { start: null, end: null }
  }
  return { start, end }
}

function applyDateFilter(q: any, field: string, start: Date | null, end: Date | null) {
  if (start) q = q.gte(field, start.toISOString())
  if (end) q = q.lte(field, end.toISOString())
  return q
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()

  const lang    = i18n.language ?? 'fr'
  const isRTL   = lang.startsWith('ar')
  const dateFmt = toDateLocale(lang)

  // Shorthand so we don't repeat `t('dashboard.X')` everywhere
  const td = (key: string) => t(`dashboard.${key}`)

  const [stats, setStats]     = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isTtcMode, setIsTtcMode] = useState(true)
  const [margeDetailsOpen, setMargeDetailsOpen] = useState(false)
  const [dateRange, setDateRange] = useState<DateRangeKey>('this_month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const { start: filterStart, end: filterEnd } = getDateRange(dateRange, customStart, customEnd)

  // Locale-aware currency formatter (memoised to the current language)
  const fmt = (n: number | null | undefined) => formatCurrencyLocale(n, lang)

  const fetchDashboardStats = useCallback(() => {
    setLoading(true)
    if (!user?.id) {
      setStats(null)
      setLoading(false)
      return
    }

    let factQuery = supabase.from('factures').select('*').eq('user_id', user.id)
    let vpQuery = supabase.from('ventes_passagers').select('*').eq('user_id', user.id)
    let depQuery = supabase.from('depenses').select('*').eq('user_id', user.id)
    let bcQuery = supabase.from('bons_commande').select('*').eq('user_id', user.id)
      let recentQuery = supabase.from('factures').select('*, clients(nom)').eq('user_id', user.id).order('date_emission', { ascending: false }).limit(5)
      // Manual credit notes only (facture_id IS NULL). Facture-linked avoirs are
      // excluded here because the linked invoice's amount already reflects the
      // deduction — counting them again would double-reduce revenue.
      let avoirQuery = supabase.from('avoirs').select('*').eq('user_id', user.id).is('facture_id', null).neq('statut', 'annulé')
      // Manual supplier credit notes only (bon_commande_id IS NULL). BC-linked
      // ones are excluded because cancelling a counted BC already removes it
      // from expenses — counting the linked avoir too would double-reduce.
      let avoirFournQuery = supabase.from('avoirs_fournisseur').select('*').eq('user_id', user.id).is('bon_commande_id', null).neq('statut', 'annulé')

      if (dateRange !== 'all') {
        factQuery = applyDateFilter(factQuery, 'date_emission', filterStart, filterEnd)
        vpQuery = applyDateFilter(vpQuery, 'date', filterStart, filterEnd)
        depQuery = applyDateFilter(depQuery, 'date_depense', filterStart, filterEnd)
        bcQuery = applyDateFilter(bcQuery, 'date_commande', filterStart, filterEnd)
        recentQuery = applyDateFilter(recentQuery, 'date_emission', filterStart, filterEnd)
        avoirQuery = applyDateFilter(avoirQuery, 'date_emission', filterStart, filterEnd)
        avoirFournQuery = applyDateFilter(avoirFournQuery, 'date_emission', filterStart, filterEnd)
      }

      Promise.all([
        factQuery,
        vpQuery,
        depQuery,
        supabase.from('produits').select('*').eq('user_id', user.id),
        supabase.from('clients').select('*').eq('user_id', user.id),
        supabase.from('fournisseurs').select('*').eq('user_id', user.id),
        recentQuery,
        bcQuery,
        avoirQuery,
        avoirFournQuery,
      ]).then(async ([factRes, vpRes, depRes, prodRes, cliRes, fourRes, recentRes, bcRes, avoirRes, avoirFournRes]) => {
        const factures         = factRes.data  ?? []
        const ventesPassagers  = vpRes.data    ?? []
        const depenses         = depRes.data   ?? []
        const produits         = prodRes.data  ?? []
        const clients          = cliRes.data   ?? []
        const fournisseurs     = fourRes.data  ?? []
        const recentFacturesRaw = recentRes.data ?? []
        const bonsCommande     = bcRes.data    ?? []
        // Manual credit notes that reduce revenue.
        const avoirsManuels    = avoirRes.data ?? []
        // Manual supplier credit notes that reduce expenses.
        const avoirsFournManuels = avoirFournRes.data ?? []

        const facturesValides = factures.filter((f: any) =>
          ['payée', 'reste_a_payer'].includes(f.statut)
        )
        const payeesFact    = factures.filter((f: any) => f.statut === 'payée')
        const resteAPayerFact = factures.filter((f: any) => f.statut === 'reste_a_payer')
        const brouillonFact = factures.filter((f: any) => f.statut === 'brouillon')
        // BC statuses that count toward expense calculations.
        // Rule: brouillon / en_attente / envoyé / annulé / refusé → excluded.
        // confirmé and livré/livrée → included in monetary totals (TTC, TVA).
        // Stock effects are still gated separately on livré only.
        const bonsCommandeValides = bonsCommande.filter((b: any) =>
          ['confirmé', 'livré', 'livrée'].includes(b.statut),
        )

        // Manual credit note totals — subtracted from revenue & collected VAT.
        const avoirsTtc = avoirsManuels.reduce((s: number, a: any) => s + Number(a.montant_ttc || 0), 0)
        const avoirsHt  = avoirsManuels.reduce((s: number, a: any) => s + Number(a.montant_ht || 0), 0)
        const avoirsTva = avoirsManuels.reduce((s: number, a: any) => s + Number(a.montant_tva || 0), 0)

        // Manual supplier credit note totals — subtracted from expenses & deductible VAT.
        const avoirsFournTtc = avoirsFournManuels.reduce((s: number, a: any) => s + Number(a.montant_ttc || 0), 0)
        const avoirsFournHt  = avoirsFournManuels.reduce((s: number, a: any) => s + Number(a.montant_ht || 0), 0)
        const avoirsFournTva = avoirsFournManuels.reduce((s: number, a: any) => s + Number(a.montant_tva || 0), 0)

        const caVP = ventesPassagers.reduce((s: number, vp: any) => s + Number(vp.montant_ttc || 0), 0)
        const caFactures = facturesValides.reduce((s: number, f: any) => s + Number(f.montant_ttc || 0), 0)
        const totalRevenue = caVP + caFactures - avoirsTtc

        const caVP_HT = ventesPassagers.reduce((s: number, vp: any) => s + Number(vp.montant_ht || 0), 0)
        const caFactures_HT = facturesValides.reduce((s: number, f: any) => s + Number(f.montant_ht || 0), 0)
        const totalRevenueHT = caVP_HT + caFactures_HT - avoirsHt

        const totalDepenses = depenses.reduce((s: number, d: any) => s + Number(d.montant_ttc || 0), 0)
          + bonsCommandeValides.reduce((s: number, b: any) => s + Number(b.montant_ttc || 0), 0)
          - avoirsFournTtc
        const totalDepensesHT = depenses.reduce((s: number, d: any) => s + Number(d.montant_ht || 0), 0)
          + bonsCommandeValides.reduce((s: number, b: any) => s + Number(b.montant_ht || 0), 0)
          - avoirsFournHt
        const unpaidRevenue = resteAPayerFact.reduce((s: number, f: any) => s + Number(f.reste_a_payer || 0), 0)
        const profit = totalRevenue - totalDepenses
        const profitHT = totalRevenueHT - totalDepensesHT

        const tvaVP = ventesPassagers.reduce((s: number, vp: any) => s + Number(vp.montant_tva || 0), 0)
        const tvaFactures = facturesValides.reduce((s: number, f: any) => s + Number(f.montant_tva || 0), 0)
        const totalTvaCollectee = tvaVP + tvaFactures - avoirsTva
        const tvaDepenses = depenses.reduce((s: number, d: any) => s + Number(d.montant_tva || 0), 0)
        const tvaBC = bonsCommandeValides.reduce((s: number, b: any) => s + Number(b.montant_tva || 0), 0)
        const totalTvaDeductible = tvaDepenses + tvaBC - avoirsFournTva
        const tvaNet = totalTvaCollectee - totalTvaDeductible

        const ventesHT = caVP + facturesValides.reduce((s: number, f: any) => s + Number(f.montant_ht || 0), 0)

        // ── Cost of Goods Sold (COGS) — both HT and TTC ──────────────────
        // The stored `cogs` column is an aggregate HT cost with no per-product
        // VAT breakdown, so it cannot produce an accurate TTC cost. To keep the
        // Marge Commerciale "apples-to-apples" in both toggle states we recompute
        // COGS from the underlying line items: each line's cost is the product's
        // `prix_achat_ht`, and the TTC cost applies that line's own VAT rate
        // (which mirrors the product category, e.g. 20% or 7%).
        //
        //   cogsHT  = Σ (prix_achat_ht × quantité)
        //   cogsTTC = Σ (prix_achat_ht × (1 + tva/100) × quantité)
        //
        // Manual customer credit notes (Avoir Client) reduce the sold quantity,
        // so their lines' cost is subtracted symmetrically:
        //   totalCOGS    = coût ventes HT  − avoirs client coût ventes HT
        //   totalCOGSTTC = coût ventes TTC − avoirs client coût ventes TTC
        // Supplier credit notes affect purchases/expenses, not goods-sold cost,
        // so they are not applied here.
        const prodCostMap = new Map<string, number>()
        for (const p of produits as any[]) {
          prodCostMap.set(String(p.id), Number(p.prix_achat_ht || 0))
        }

        const factIds = facturesValides.map((f: any) => f.id)
        const vpIds = (ventesPassagers as any[]).map((vp: any) => vp.id)
        const avoirIds = (avoirsManuels as any[]).map((a: any) => a.id)

        const [factLignesRes, vpLignesRes, avoirLignesRes] = await Promise.all([
          factIds.length
            ? supabase.from('facture_lignes').select('*').in('facture_id', factIds)
            : Promise.resolve({ data: [] as any[] }),
          vpIds.length
            ? supabase.from('ventes_passagers_lignes').select('*')
            : Promise.resolve({ data: [] as any[] }),
          avoirIds.length
            ? supabase.from('avoir_lignes').select('*').in('avoir_id', avoirIds)
            : Promise.resolve({ data: [] as any[] }),
        ])

        const factLignes = factLignesRes.data ?? []
        // VP lines: the schema carries both `vp_id` (written by the sales UI) and
        // `vente_passager_id` (used by the relation map). Match on whichever is set.
        const vpIdSet = new Set(vpIds.map((id: any) => String(id)))
        const vpLignes = (vpLignesRes.data ?? []).filter((l: any) => {
          const key = l.vp_id ?? l.vente_passager_id
          return key != null && vpIdSet.has(String(key))
        })
        const avoirLignes = avoirLignesRes.data ?? []

        const lineCostHT = (l: any) =>
          (prodCostMap.get(String(l.produit_id)) ?? 0) * Number(l.quantite || 0)
        const lineCostTTC = (l: any) =>
          (prodCostMap.get(String(l.produit_id)) ?? 0) * (1 + Number(l.tva || 0) / 100) * Number(l.quantite || 0)

        const cogsHTSold = [...factLignes, ...vpLignes].reduce((s: number, l: any) => s + lineCostHT(l), 0)
        const cogsTTCSold = [...factLignes, ...vpLignes].reduce((s: number, l: any) => s + lineCostTTC(l), 0)
        // Avoir Client lines reduce sold quantity → reduce COGS symmetrically.
        // Always taken as a positive magnitude so the subtraction below reads
        // exactly: coût ventes − (positive avoir coût).
        const cogsHTReturned = Math.abs(avoirLignes.reduce((s: number, l: any) => s + lineCostHT(l), 0))
        const cogsTTCReturned = Math.abs(avoirLignes.reduce((s: number, l: any) => s + lineCostTTC(l), 0))

        const totalCOGS = cogsHTSold - cogsHTReturned
        const totalCOGSTTC = cogsTTCSold - cogsTTCReturned

        const monthlyData: Stats['monthlyData'] = []
        const monthlyDataHT: Stats['monthlyData'] = []
        const chartStart = filterStart || new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1)
        const chartEnd = filterEnd || new Date()
        const daysDiff = Math.ceil((chartEnd.getTime() - chartStart.getTime()) / (1000 * 60 * 60 * 24))
        const useDaily = daysDiff <= 31

        if (useDaily) {
          const dayCount = Math.max(1, daysDiff)
          for (let i = dayCount - 1; i >= 0; i--) {
            const d = new Date(chartEnd)
            d.setDate(d.getDate() - i)
            const dateStr = d.toISOString().split('T')[0]
            const dayAvoir = avoirsManuels
              .filter((a: any) => new Date(a.date_emission).toISOString().split('T')[0] === dateStr)
              .reduce((s: number, a: any) => s + Number(a.montant_ttc || 0), 0)
            const dayAvoirHT = avoirsManuels
              .filter((a: any) => new Date(a.date_emission).toISOString().split('T')[0] === dateStr)
              .reduce((s: number, a: any) => s + Number(a.montant_ht || 0), 0)
            const dayRev = [...facturesValides, ...ventesPassagers]
              .filter((f: any) => new Date(f.date || f.date_emission).toISOString().split('T')[0] === dateStr)
              .reduce((s: number, f: any) => s + Number(f.montant_ttc || 0), 0) - dayAvoir
            const dayRevHT = [...facturesValides, ...ventesPassagers]
              .filter((f: any) => new Date(f.date || f.date_emission).toISOString().split('T')[0] === dateStr)
              .reduce((s: number, f: any) => s + Number(f.montant_ht || 0), 0) - dayAvoirHT
            const dayAvoirFourn = avoirsFournManuels
              .filter((a: any) => new Date(a.date_emission).toISOString().split('T')[0] === dateStr)
              .reduce((s: number, a: any) => s + Number(a.montant_ttc || 0), 0)
            const dayAvoirFournHT = avoirsFournManuels
              .filter((a: any) => new Date(a.date_emission).toISOString().split('T')[0] === dateStr)
              .reduce((s: number, a: any) => s + Number(a.montant_ht || 0), 0)
            const dayExp = [...depenses, ...bonsCommandeValides]
              .filter((entry: any) => new Date(entry.date_depense || entry.date_commande).toISOString().split('T')[0] === dateStr)
              .reduce((s: number, entry: any) => s + Number(entry.montant_ttc || 0), 0) - dayAvoirFourn
            const dayExpHT = [...depenses, ...bonsCommandeValides]
              .filter((entry: any) => new Date(entry.date_depense || entry.date_commande).toISOString().split('T')[0] === dateStr)
              .reduce((s: number, entry: any) => s + Number(entry.montant_ht || 0), 0) - dayAvoirFournHT
            monthlyData.push({ name: d.getDate().toString(), revenue: dayRev, expenses: dayExp })
            monthlyDataHT.push({ name: d.getDate().toString(), revenue: dayRevHT, expenses: dayExpHT })
          }
        } else {
          const startMonth = chartStart.getMonth() + chartStart.getFullYear() * 12
          const endMonth = chartEnd.getMonth() + chartEnd.getFullYear() * 12
          const monthCount = Math.max(1, endMonth - startMonth + 1)
          for (let i = 0; i < monthCount; i++) {
            const d = new Date(chartStart.getFullYear(), chartStart.getMonth() + i, 1)
            const month = d.getMonth()
            const year = d.getFullYear()
            const monthAvoir = avoirsManuels
              .filter((a: any) => { const ad = new Date(a.date_emission); return ad.getMonth() === month && ad.getFullYear() === year })
              .reduce((s: number, a: any) => s + Number(a.montant_ttc || 0), 0)
            const monthAvoirHT = avoirsManuels
              .filter((a: any) => { const ad = new Date(a.date_emission); return ad.getMonth() === month && ad.getFullYear() === year })
              .reduce((s: number, a: any) => s + Number(a.montant_ht || 0), 0)
            const monthRev = [...facturesValides, ...ventesPassagers]
              .filter((f: any) => { const fd = new Date(f.date || f.date_emission); return fd.getMonth() === month && fd.getFullYear() === year })
              .reduce((s: number, f: any) => s + Number(f.montant_ttc || 0), 0) - monthAvoir
            const monthRevHT = [...facturesValides, ...ventesPassagers]
              .filter((f: any) => { const fd = new Date(f.date || f.date_emission); return fd.getMonth() === month && fd.getFullYear() === year })
              .reduce((s: number, f: any) => s + Number(f.montant_ht || 0), 0) - monthAvoirHT
            const monthAvoirFourn = avoirsFournManuels
              .filter((a: any) => { const ad = new Date(a.date_emission); return ad.getMonth() === month && ad.getFullYear() === year })
              .reduce((s: number, a: any) => s + Number(a.montant_ttc || 0), 0)
            const monthAvoirFournHT = avoirsFournManuels
              .filter((a: any) => { const ad = new Date(a.date_emission); return ad.getMonth() === month && ad.getFullYear() === year })
              .reduce((s: number, a: any) => s + Number(a.montant_ht || 0), 0)
            const monthExp = [...depenses, ...bonsCommandeValides]
              .filter((entry: any) => { const ed = new Date(entry.date_depense || entry.date_commande); return ed.getMonth() === month && ed.getFullYear() === year })
              .reduce((s: number, entry: any) => s + Number(entry.montant_ttc || 0), 0) - monthAvoirFourn
            const monthExpHT = [...depenses, ...bonsCommandeValides]
              .filter((entry: any) => { const ed = new Date(entry.date_depense || entry.date_commande); return ed.getMonth() === month && ed.getFullYear() === year })
              .reduce((s: number, entry: any) => s + Number(entry.montant_ht || 0), 0) - monthAvoirFournHT
            const nameKey = MONTH_KEYS[month]
            monthlyData.push({ name: t(`dashboard.chart.months.${nameKey}`), revenue: monthRev, expenses: monthExp })
            monthlyDataHT.push({ name: t(`dashboard.chart.months.${nameKey}`), revenue: monthRevHT, expenses: monthExpHT })
          }
        }

        const stockValueHT = produits.reduce((s, p: any) => s + (Number(p.stock_actuel || 0) * Number(p.prix_achat_ht || 0)), 0)

        setStats({
          clientsCount: clients.length,
          facturesCount: payeesFact.length + resteAPayerFact.length + brouillonFact.length,
          produitsCount: produits.length,
          fournisseursCount: fournisseurs.length,
          totalRevenue, totalRevenueHT, unpaidRevenue,
          totalDepenses, totalDepensesHT,
          profit, profitHT,
          totalTvaCollectee, totalTvaDeductible, tvaNet,
          ventesHT, totalCOGS, totalCOGSTTC,
          cogsHTSold, cogsTTCSold, cogsHTReturned, cogsTTCReturned,
          stockValueHT, monthlyData, monthlyDataHT,
          bonsCommandeCount: bonsCommande.filter((b: any) => ['livré', 'livrée'].includes(b.statut)).length,
          lowStockProduits: produits.filter((p: any) => Number(p.stock_actuel) <= Number(p.stock_min)).slice(0, 5),
          recentFactures: recentFacturesRaw,
        })
      }).catch((err) => {
        console.error('Failed to fetch stats', err)
        setStats(null)
      }).finally(() => {
        setLoading(false)
      })
  }, [user?.id, lang, dateRange, customStart, customEnd])

  useEffect(() => {
    fetchDashboardStats()
  }, [fetchDashboardStats])

  // ─── Loading state ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="h-16 w-16 border-4 border-primary/20 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <HeartPulse className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="space-y-2 text-center">
            <p className="text-lg font-semibold text-foreground">{td('loading.title')}</p>
            <p className="text-sm text-muted-foreground">{td('loading.subtitle')}</p>
          </div>
        </div>
      </div>
    )
  }

  // ─── Invoice status label ────────────────────────────────────────────────
  const invoiceStatusLabel = (statut: string) => {
    if (statut === 'payée')          return td('recent_invoices.status_paid')
    if (statut === 'reste_a_payer')  return td('recent_invoices.status_partial')
    return td('recent_invoices.status_pending')
  }

  // ─── Quick actions (labels from i18n) ────────────────────────────────────
  const quickActions = [
    { label: td('quick_actions.new_invoice'), icon: FileText,     bg: 'bg-primary/10',      color: 'text-primary',    link: '/factures'         },
    { label: td('quick_actions.quick_sale'),  icon: ShoppingCart, bg: 'bg-[#0EA5E9]/10',  color: 'text-[#0EA5E9]',link: '/ventes-passagers'  },
    { label: td('quick_actions.new_expense'), icon: CreditCard,   bg: 'bg-red-500/10',      color: 'text-red-400',    link: '/depenses'          },
    { label: td('quick_actions.add_client'),  icon: Users,        bg: 'bg-amber-500/10',    color: 'text-amber-400',  link: '/clients'           },
  ]

  // ─── Chart custom tooltip ────────────────────────────────────────────────
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      // Keep tooltip contents dir=ltr so numbers always read correctly
      <div
        className="rounded-[4px] border p-3 text-xs"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        dir="ltr"
      >
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: entry.color }} />
            <span className="text-muted-foreground">
              {entry.dataKey === 'revenue'
                ? td('chart.tooltip_revenue')
                : td('chart.tooltip_expenses')}:
            </span>
            <span className="font-semibold">{fmt(entry.value)}</span>
          </div>
        ))}
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="space-y-4 sm:space-y-6"
      /*
       * RTL Note: `dir` is already set on <html> by App.tsx's RtlSynchronizer
       * and on the DashboardLayout wrapper. We set it here too so this page is
       * self-contained and correct in isolation (tests, Storybook).
       */
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      {/*
       * RTL: justify-between + flex automatically mirrors — title sits at the
       * logical start, stock mini-card at the logical end.
       *
       * Responsive: title uses a fluid size (text-xl → text-2xl). On very
       * narrow phones the stock mini-card wraps below the title via flex-wrap.
       */}
      <div className="flex items-center justify-between gap-3 sm:gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{td('header.title')}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{td('header.subtitle')}</p>
        </div>

        {/* Stock value mini-card — logical end (right in LTR, left in RTL) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Package className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="text-start">
            <p className="text-[10px] sm:text-xs text-muted-foreground">{td('header.stock_value_label')}</p>
            {/* dir=ltr keeps the number reading left→right even in Arabic */}
            <p className="text-base sm:text-lg font-bold text-foreground" dir="ltr">
              {fmt(stats?.stockValueHT ?? 0)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Date Range Filter ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-1 flex-wrap">
            {(['today', 'yesterday', 'this_week', 'this_month', 'this_year'] as const).map((key) => (
              <button
                key={key}
                onClick={() => { setDateRange(key); setLoading(true) }}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md border transition-all',
                  dateRange === key
                    ? 'bg-[#0EA5E9] text-white border-[#0EA5E9] shadow-sm'
                    : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {t(`dashboard.date_range.${key}`)}
              </button>
            ))}
            <Select value={dateRange} onValueChange={(v) => { setDateRange(v as DateRangeKey); setLoading(true) }}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                {/*
                 * The active dateRange may have been chosen via a quick-pill
                 * above (e.g. `this_month`) which isn't listed as a SelectItem
                 * inside this dropdown. Rendering an explicit child here
                 * guarantees the trigger always shows a translated label
                 * instead of the raw enum value.
                 */}
                <SelectValue placeholder={td('date_range.more')}>
                  {t(`dashboard.date_range.${dateRange}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(['last_week', 'last_month', 'last_year', 'all', 'custom'] as const).map((key) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    {t(`dashboard.date_range.${key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {dateRange === 'custom' && (
          <div className="flex items-center gap-2 ps-6">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
            />
            <span className="text-xs text-muted-foreground">-</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
            />
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              disabled={!customStart || !customEnd || loading}
              onClick={() => fetchDashboardStats()}
            >
              {t('dashboard.date_range.filter')}
            </Button>
          </div>
        )}
        <div className="ps-6">
          <p className="text-[11px] text-muted-foreground">
            <CalendarDays className="inline h-3 w-3 me-1" />
            {filterStart && filterEnd
              ? `${filterStart.toLocaleDateString(dateFmt)} – ${filterEnd.toLocaleDateString(dateFmt)}`
              : t('dashboard.date_range.all_time')}
          </p>
        </div>
      </div>

      {/* ── HT / TTC Toggle ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-0.5 rounded-lg border border-input bg-background w-fit">
        <button
          type="button"
          onClick={() => setIsTtcMode(false)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-md transition-all',
            !isTtcMode
              ? 'bg-[#0EA5E9] text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          HT
        </button>
        <button
          type="button"
          onClick={() => setIsTtcMode(true)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-md transition-all',
            isTtcMode
              ? 'bg-[#0EA5E9] text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          TTC
        </button>
      </div>

      {/* ── KPI Row 1: Financial KPIs ─────────────────────────────────────── */}
      {/* Mobile: 2 columns (full-width single-col makes huge cards waste
          vertical space). Tablet/desktop: 2-4 cols. */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 xl:grid-cols-5">
        {/*
         * Each KPICard's `iconContainerClass` now declares BOTH light- and
         * dark-mode tints on the same line. Light mode uses the *-50 tint
         * backgrounds with *-200 borders and *-600 icon strokes, which is
         * the conventional shadcn pastel-on-paper treatment and matches the
         * saturation of the dark-mode *-400 icons at parity contrast.
         */}
        <KPICard
          title={isTtcMode ? td('kpi.revenue.title_ttc') : td('kpi.revenue.title_ht')}
          value={fmt(isTtcMode ? (stats?.totalRevenue ?? 0) : (stats?.totalRevenueHT ?? 0))}
          subtitle={td('kpi.revenue.subtitle')}
          icon={DollarSign}
          iconContainerClass="bg-[#0EA5E9]/10 border border-[#0EA5E9]/30 text-[#0EA5E9] dark:bg-[#0EA5E9]/10 dark:border-[#0EA5E9]/20 dark:text-[#0EA5E9]"
        />
        <KPICard
          title={td('kpi.receivables.title')}
          value={fmt(stats?.unpaidRevenue ?? 0)}
          subtitle={td('kpi.receivables.subtitle')}
          icon={CreditCard}
          iconContainerClass="bg-blue-50 border border-blue-200/60 text-blue-600 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400"
        />
        <KPICard
          title={isTtcMode ? td('kpi.expenses.title_ttc') : td('kpi.expenses.title_ht')}
          value={fmt(isTtcMode ? (stats?.totalDepenses ?? 0) : (stats?.totalDepensesHT ?? 0))}
          subtitle={td('kpi.expenses.subtitle')}
          icon={Activity}
          iconContainerClass="bg-rose-50 border border-rose-200/60 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400"
        />
        <KPICard
          title={isTtcMode ? td('kpi.profit.title_ttc') : td('kpi.profit.title_ht')}
          value={fmt(isTtcMode ? (stats?.profit ?? 0) : (stats?.profitHT ?? 0))}
          subtitle={td('kpi.profit.subtitle')}
          icon={ShieldCheck}
          iconContainerClass="bg-rose-50 border border-rose-200/60 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400"
        />
        <div className="relative">
          <KPICard
            title={isTtcMode ? td('kpi.marge_commerciale.title_ttc') : td('kpi.marge_commerciale.title_ht')}
            value={fmt(
              isTtcMode
                ? (stats?.totalRevenue ?? 0) - (stats?.totalCOGSTTC ?? 0)
                : (stats?.totalRevenueHT ?? 0) - (stats?.totalCOGS ?? 0)
            )}
            subtitle={td('kpi.marge_commerciale.subtitle')}
            icon={TrendingUp}
            iconContainerClass="bg-violet-50 border border-violet-200/60 text-violet-600 dark:bg-violet-500/10 dark:border-violet-500/20 dark:text-violet-400"
          />
          {/* Overlay button — opens the calculation breakdown. Positioned at the
              logical start-bottom corner so it never overlaps the value/icon. */}
          <button
            type="button"
            onClick={() => setMargeDetailsOpen(true)}
            title={td('kpi.marge_commerciale.view_calc')}
            className="absolute bottom-2 end-2 inline-flex items-center gap-1 rounded-[4px] border border-violet-200/60 bg-violet-50 px-1.5 py-1 text-[10px] font-medium text-violet-600 hover:bg-violet-100 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-400 dark:hover:bg-violet-500/20 transition-colors"
          >
            <Calculator className="h-3 w-3" />
            <span className="hidden sm:inline">{td('kpi.marge_commerciale.view_calc')}</span>
          </button>
        </div>
      </div>

      {/* ── KPI Row 2: Counter cards ──────────────────────────────────────── */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
        <KPICard
          title={td('kpi.purchase_orders.title')}
          value={String(stats?.bonsCommandeCount ?? 0)}
          subtitle={td('kpi.purchase_orders.subtitle')}
          icon={ClipboardList}
          iconContainerClass="bg-slate-100 border border-slate-200/60 text-slate-600 dark:bg-slate-500/10 dark:border-slate-500/20 dark:text-slate-300"
        />
        <KPICard
          title={td('kpi.clients.title')}
          value={String(stats?.clientsCount ?? 0)}
          subtitle={td('kpi.clients.subtitle')}
          icon={Users}
          iconContainerClass="bg-blue-50 border border-blue-200/60 text-blue-600 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400"
        />
        <KPICard
          title={td('kpi.suppliers.title')}
          value={String(stats?.fournisseursCount ?? 0)}
          subtitle={td('kpi.suppliers.subtitle')}
          icon={Building2}
          iconContainerClass="bg-indigo-50 border border-indigo-200/60 text-indigo-600 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-400"
        />
        <KPICard
          title={td('kpi.products.title')}
          value={String(stats?.produitsCount ?? 0)}
          subtitle={td('kpi.products.subtitle')}
          icon={Package}
          iconContainerClass="bg-amber-50 border border-amber-200/60 text-amber-600 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400"
        />
        <KPICard
          title={td('kpi.invoices.title')}
          value={String(stats?.facturesCount ?? 0)}
          subtitle={td('kpi.invoices.subtitle')}
          icon={FileText}
          iconContainerClass="bg-slate-100 border border-slate-200/60 text-slate-600 dark:bg-slate-500/10 dark:border-slate-500/20 dark:text-slate-300"
        />
      </div>

      {/* ── Main content row: Chart + Recent Invoices ─────────────────────── */}
      {/*
       * RTL: CSS grid column flow reverses under dir=rtl, so the chart
       * (lg:col-span-4) naturally sits on the RIGHT in Arabic — correct for
       * a right-to-left reading order where the primary visual comes first.
       */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-7">

        {/* Cash-flow chart — `min-w-0` lets Recharts ResponsiveContainer
            shrink properly inside the grid cell on small screens. Without it
            the chart could push the grid wider than the viewport. */}
        <Card className="lg:col-span-4 shadow-none rounded-[6px] min-w-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2 gap-3 sm:gap-4 flex-wrap">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary shrink-0" />
                {td('chart.title')}
              </CardTitle>
              <CardDescription>{td('chart.subtitle')} ({isTtcMode ? 'TTC' : 'HT'})</CardDescription>
            </div>

            {/* Legend — ms-auto pushes it to the logical end */}
            <div className="flex items-center gap-4 text-xs ms-auto shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gradient-to-r from-[#0EA5E9] to-[#0EA5E9]/60 shrink-0" />
                <span className="text-muted-foreground font-medium">
                  {td('chart.legend_revenue')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gradient-to-r from-red-400 to-red-500 shrink-0" />
                <span className="text-muted-foreground font-medium">
                  {td('chart.legend_expenses')}
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {/*
             * RTL + Recharts note:
             * Recharts renders a plain SVG and is NOT direction-aware. We wrap
             * the chart in a `dir="ltr"` container so:
             *   1. The X-axis reads left → right (chronological order preserved).
             *   2. The Y-axis stays on the LEFT side of the chart.
             *   3. SVG `x1/x2` gradient coordinates are not inverted.
             * The surrounding UI text (title, legend) inherits RTL from the
             * parent dir=rtl and mirrors correctly on its own.
             */}
            <div className="h-[240px] sm:h-[280px] lg:h-[320px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={isTtcMode ? (stats?.monthlyData ?? []) : (stats?.monthlyDataHT ?? [])}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#0EA5E9" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="oklch(0.55 0.2 25)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="oklch(0.55 0.2 25)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'oklch(0.5 0.03 250)' }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'oklch(0.5 0.03 250)' }}
                    // Keep Y-axis on the left side regardless of page direction
                    orientation="left"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name={td('chart.tooltip_revenue')}
                    stroke="#0EA5E9"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    name={td('chart.tooltip_expenses')}
                    stroke="oklch(0.55 0.2 25)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorExpenses)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card className="lg:col-span-3 shadow-none rounded-[6px] min-w-0">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary shrink-0" />
                {td('recent_invoices.title')}
              </CardTitle>
              <CardDescription>{td('recent_invoices.subtitle')}</CardDescription>
            </div>
            {/*
             * RTL: ms-auto pushes the button to the logical end.
             * ChevronRight gets rtl:rotate-180 so it points the correct way.
             */}
            <Button
              variant="ghost"
              size="sm"
              className="text-primary font-semibold hover:bg-primary/5 ms-auto shrink-0"
            >
              <Link to="/factures" className="flex items-center gap-1">
                {td('recent_invoices.view_all')}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {stats?.recentFactures?.length ? (
                stats.recentFactures.map((facture) => (
                  <div
                    key={facture.id}
                    className="flex items-center gap-4 p-3 rounded-[6px] hover:bg-muted/50 transition-all duration-200 group cursor-pointer"
                  >
                    {/* Status icon */}
                    <div className={cn(
                      'h-11 w-11 rounded-[6px] flex items-center justify-center shrink-0',
                      facture.statut === 'payée'
                        ? 'bg-gradient-to-br from-[#0EA5E9]/10 to-[#0EA5E9]/5 text-[#0EA5E9]'
                        : facture.statut === 'reste_a_payer'
                          ? 'bg-gradient-to-br from-blue-500/10 to-blue-500/5 text-blue-400'
                          : 'bg-gradient-to-br from-amber-500/10 to-amber-500/5 text-amber-400',
                    )}>
                      <FileText className="h-5 w-5" />
                    </div>

                    {/* Client name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate text-foreground text-start">
                        {facture.client?.nom ?? td('recent_invoices.walk_in_client')}
                      </p>
                      {/*
                       * RTL: invoice number and date are LTR artefacts
                       * (latin digits, ISO date). dir=ltr on this row ensures
                       * they don't get reversed by the parent RTL context.
                       */}
                      <p className="text-xs text-muted-foreground flex items-center gap-2" dir="ltr">
                        <span className="font-mono">{facture.numero}</span>
                        <span>•</span>
                        <span>
                          {new Date(facture.date_emission).toLocaleDateString(dateFmt)}
                        </span>
                      </p>
                    </div>

                    {/* Amount + badge — text-end = right in LTR, left in RTL */}
                    <div className="text-end shrink-0">
                      <p className="text-sm font-black text-foreground" dir="ltr">
                        {fmt(facture.montant_ttc)}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] h-5 px-2 font-bold border-0',
                          facture.statut === 'payée'
                            ? 'bg-[#0EA5E9]/10 text-[#0EA5E9]'
                            : facture.statut === 'reste_a_payer'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-amber-500/10 text-amber-400',
                        )}
                      >
                        {invoiceStatusLabel(facture.statut)}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-[8px] p-4 mb-3">
                    <FileText className="h-8 w-8 text-primary/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">{td('recent_invoices.empty_title')}</p>
                  <Link
                    to="/factures"
                    className="mt-2 text-xs text-primary font-semibold hover:underline"
                  >
                    {td('recent_invoices.empty_cta')}
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Second row: Quick Actions + Stock Alerts ──────────────────────── */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">

        {/* Quick Actions */}
        <Card className="shadow-none rounded-[6px]">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              {td('quick_actions.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {quickActions.map((action) => (
                <Link
                  key={action.link}
                  to={action.link}
                  className={cn(
                    'flex flex-col items-center gap-3 p-4 rounded-[8px] border border-transparent',
                    'hover:border-border hover:bg-muted/30 transition-all duration-200 group',
                  )}
                >
                  <div className={cn('p-3 rounded-[6px]', action.bg)}>
                    <action.icon className={cn('h-6 w-6', action.color)} />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground text-center group-hover:text-foreground transition-colors">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stock Alerts */}
        <Card className="shadow-none rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {td('stock_alerts.title')}
            </CardTitle>
            {!!stats?.lowStockProduits?.length && (
              <Badge
                variant="destructive"
                className="dark:bg-amber-500/20 dark:text-amber-500 dark:border dark:border-amber-500/30 bg-amber-500 text-white"
              >
                {stats.lowStockProduits.length}{' '}
                {stats.lowStockProduits.length > 1
                  ? td('stock_alerts.product_other')
                  : td('stock_alerts.product_one')}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.lowStockProduits?.length ? (
                stats.lowStockProduits.slice(0, 4).map((produit) => (
                  <div
                    key={produit.id}
                    className="flex items-center justify-between p-3 rounded-sm dark:bg-white/5 dark:border-white/10 bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="dark:bg-amber-500/10 bg-card p-2 rounded-[4px] border dark:border-0 border-amber-500/20 shrink-0">
                        <Pill className="h-4 w-4 dark:text-amber-300 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{produit?.nom ?? '—'}</p>
                        <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider" dir="ltr">
                          {td('stock_alerts.ref_label')} {produit.reference}
                        </p>
                      </div>
                    </div>
                    {/* Stock count — always LTR for unit + number */}
                    <div className="text-end" dir="ltr">
                      <p className="text-sm font-black text-amber-400">
                        {produit.stock_actuel} {produit.unite}
                      </p>
                      <p className="text-[10px] text-amber-400/60 font-semibold uppercase">
                        {td('stock_alerts.low_stock')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="bg-gradient-to-br from-[#0EA5E9]/10 to-[#0EA5E9]/5 rounded-[8px] p-4 mb-3">
                    <ShieldCheck className="h-8 w-8 text-[#0EA5E9]" />
                  </div>
                  <p className="text-sm font-semibold text-[#0EA5E9]">{td('stock_alerts.optimal_title')}</p>
                  <p className="text-xs text-muted-foreground">{td('stock_alerts.optimal_subtitle')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── TVA Summary ───────────────────────────────────────────────────── */}
      <Card className="shadow-none rounded-[6px]">
        {/* Card header banner */}
        <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 px-4 sm:px-6 py-3 sm:py-4 border-b border-primary/10 flex items-center gap-3">
          <div className="p-2 rounded-[6px] bg-primary/10 shrink-0">
            <PieChart className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-foreground text-sm sm:text-base">{td('tva.section_title')}</h3>
            <p className="text-[11px] sm:text-xs text-muted-foreground">{td('tva.section_subtitle')}</p>
          </div>
        </div>

        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-6 sm:gap-8 md:grid-cols-3">

            {/* TVA Collectée */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-start">
                  {td('tva.collected')}
                </p>
                <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
              </div>
              <p className="text-2xl font-black text-foreground" dir="ltr">
                {Number(stats?.totalTvaCollectee ?? 0).toFixed(2)}{' '}
                <span className="text-sm font-medium text-muted-foreground">{td('tva.currency_short')}</span>
              </p>
              {/* Progress bar always reads left→right */}
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden" dir="ltr">
                <div className={cn('h-full bg-gradient-to-r from-primary to-primary/60 rounded-full', Number(stats?.totalTvaCollectee ?? 0) === 0 ? 'w-0' : 'w-[70%]')} />
              </div>
            </div>

            {/* TVA Déductible */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-start">
                  {td('tva.deductible')}
                </p>
                <div className="h-2 w-2 rounded-full bg-[#0EA5E9] shrink-0" />
              </div>
              <p className="text-2xl font-black text-foreground" dir="ltr">
                {Number(stats?.totalTvaDeductible ?? 0).toFixed(2)}{' '}
                <span className="text-sm font-medium text-muted-foreground">{td('tva.currency_short')}</span>
              </p>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden" dir="ltr">
                <div className={cn('h-full bg-gradient-to-r from-[#0EA5E9] to-[#0EA5E9]/70 rounded-full', Number(stats?.totalTvaDeductible ?? 0) === 0 ? 'w-0' : 'w-[45%]')} />
              </div>
            </div>

            {/* Solde TVA */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-start">
                  {td('tva.balance')}
                </p>
                <Badge className={cn(
                  'font-bold shrink-0',
                  (stats?.tvaNet ?? 0) > 0
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/10'
                    : 'bg-[#0EA5E9]/10 text-[#0EA5E9] hover:bg-[#0EA5E9]/10',
                )}>
                  {(stats?.tvaNet ?? 0) > 0 ? td('tva.to_pay') : td('tva.credit')}
                </Badge>
              </div>
              <p className="text-2xl font-black text-foreground" dir="ltr">
                {Number(stats?.tvaNet ?? 0).toFixed(2)}{' '}
                <span className="text-sm font-medium text-muted-foreground">{td('tva.currency_short')}</span>
              </p>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden" dir="ltr">
                {stats && Number(stats.totalTvaCollectee) > 0 && (
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        (Math.abs(Number(stats.tvaNet)) / Number(stats.totalTvaCollectee)) * 100,
                        100,
                      )}%`,
                      backgroundColor: (stats?.tvaNet ?? 0) > 0 ? '#B84A59' : '#0ea5e9',
                    }}
                  />
                )}
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* ── Marge Commerciale — calculation breakdown ───────────────────── */}
      <Dialog open={margeDetailsOpen} onOpenChange={setMargeDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              {isTtcMode ? td('kpi.marge_commerciale.title_ttc') : td('kpi.marge_commerciale.title_ht')}
            </DialogTitle>
            <DialogDescription>
              {td('kpi.marge_commerciale.calc_subtitle')} ({isTtcMode ? 'TTC' : 'HT'})
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const revenue = isTtcMode ? (stats?.totalRevenue ?? 0) : (stats?.totalRevenueHT ?? 0)
            const cogsSold = isTtcMode ? (stats?.cogsTTCSold ?? 0) : (stats?.cogsHTSold ?? 0)
            const cogsReturned = isTtcMode ? (stats?.cogsTTCReturned ?? 0) : (stats?.cogsHTReturned ?? 0)
            const netCogs = cogsSold - cogsReturned
            const marge = revenue - netCogs
            const Row = ({ label, value, op }: { label: string; value: string; op?: string }) => (
              <div className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-b-0">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  {op && <span className="font-mono font-bold text-foreground w-3 text-center">{op}</span>}
                  {label}
                </span>
                <span className="text-sm font-semibold text-card-foreground" dir="ltr">{value}</span>
              </div>
            )
            return (
              <div className="mt-1">
                <Row label={td('kpi.marge_commerciale.calc_revenue')} value={fmt(revenue)} />
                <Row label={td('kpi.marge_commerciale.calc_cogs_sold')} value={fmt(cogsSold)} op="−" />
                <Row label={td('kpi.marge_commerciale.calc_cogs_returned')} value={fmt(cogsReturned)} op="+" />
                <Row label={td('kpi.marge_commerciale.calc_net_cogs')} value={fmt(netCogs)} />
                <div className="flex items-center justify-between gap-3 pt-3 mt-1">
                  <span className="text-sm font-bold text-foreground">{td('kpi.marge_commerciale.calc_result')}</span>
                  <span className="text-lg font-bold text-violet-600 dark:text-violet-400" dir="ltr">{fmt(marge)}</span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed bg-muted/50 rounded-[4px] p-2.5" dir="ltr">
                  {fmt(revenue)} − ({fmt(cogsSold)} − {fmt(cogsReturned)}) = {fmt(marge)}
                </p>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
