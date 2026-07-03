import { useEffect, useMemo, useRef, useState, useCallback, type ElementType } from 'react'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import {
  CalendarDays, Package, ShoppingCart, Receipt, FileSpreadsheet, FileText,
  Printer, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  Layers, DollarSign, Hash, TrendingUp, Boxes, Loader2, X,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ProductSearchSelect } from '@/components/ui/ProductSearchSelect'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn, formatCurrencyLocale, formatDate } from '@/lib/utils'

// ─── Date range helpers (identical semantics to the Dashboard filter) ──────────

type DateRangeKey =
  | 'today' | 'yesterday' | 'this_week' | 'last_week'
  | 'this_month' | 'last_month' | 'this_year' | 'last_year'
  | 'all' | 'custom'

function getDateRange(
  option: DateRangeKey,
  customStart?: string,
  customEnd?: string,
): { start: Date | null; end: Date | null } {
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)

  switch (option) {
    case 'today':
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break
    case 'yesterday':
      start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0)
      end.setDate(end.getDate() - 1); end.setHours(23, 59, 59, 999)
      break
    case 'this_week': {
      const day = start.getDay()
      const diff = day === 0 ? 6 : day - 1
      start.setDate(start.getDate() - diff); start.setHours(0, 0, 0, 0)
      break
    }
    case 'last_week': {
      const day = start.getDay()
      const diff = day === 0 ? 6 : day - 1
      start.setDate(start.getDate() - diff - 7); start.setHours(0, 0, 0, 0)
      end.setDate(end.getDate() - diff - 1); end.setHours(23, 59, 59, 999)
      break
    }
    case 'this_month':
      start.setDate(1); start.setHours(0, 0, 0, 0)
      break
    case 'last_month':
      start.setMonth(start.getMonth() - 1, 1); start.setHours(0, 0, 0, 0)
      end.setMonth(end.getMonth(), 0); end.setHours(23, 59, 59, 999)
      break
    case 'this_year':
      start.setMonth(0, 1); start.setHours(0, 0, 0, 0)
      break
    case 'last_year':
      start.setFullYear(start.getFullYear() - 1, 0, 1); start.setHours(0, 0, 0, 0)
      end.setFullYear(end.getFullYear() - 1, 11, 31); end.setHours(23, 59, 59, 999)
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

// ─── Row model ─────────────────────────────────────────────────────────────────

interface SaleRow {
  id: string
  date: string
  productId: string | null
  productName: string
  barcode: string
  quantite: number
  prixUnitaire: number
  total: number
  source: 'facture' | 'vente_passager'
  documentNumber: string
  clientName: string
}

type SortKey =
  | 'date' | 'productName' | 'barcode' | 'quantite'
  | 'prixUnitaire' | 'total' | 'source' | 'documentNumber' | 'clientName'

const ITEMS_PER_PAGE = 10

// ─── Component ───────────────────────────────────────────────────────────────

export function ProductSalesAnalytics() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const lang = i18n.language ?? 'fr'
  const isRTL = lang.startsWith('ar')
  const dateFmt = lang.startsWith('ar') ? 'ar-MA' : lang.startsWith('en') ? 'en-US' : 'fr-FR'
  const tp = (k: string, opts?: any): string => t(`dashboard.product_analytics.${k}`, opts) as string
  const fmt = (n: number | null | undefined) => formatCurrencyLocale(n, lang)

  // Filters
  const [dateRange, setDateRange] = useState<DateRangeKey>('this_month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [productId, setProductId] = useState('')

  // Data
  const [produits, setProduits] = useState<any[]>([])
  const [rows, setRows] = useState<SaleRow[]>([])
  const [loading, setLoading] = useState(false)

  // Table controls
  const [tableSearch, setTableSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const printRef = useRef<HTMLDivElement>(null)

  const { start: filterStart, end: filterEnd } = getDateRange(dateRange, customStart, customEnd)

  // Load the product catalog once (for the searchable dropdown).
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('produits')
      .select('*')
      .eq('user_id', user.id)
      .order('designation')
      .then(({ data }: any) => setProduits(data || []))
  }, [user?.id])

  // ── Fetch combined sales, only for the matching filters (server-side dates) ──
  const fetchSales = useCallback(async () => {
    if (!user?.id) { setRows([]); return }
    setLoading(true)
    try {
      // 1) Fetch date-filtered parent documents (indexed date columns).
      let factQuery = supabase
        .from('factures')
        .select('id, numero, date_emission, client_id, statut')
        .eq('user_id', user.id)
      let vpQuery = supabase
        .from('ventes_passagers')
        .select('id, numero, date, client_nom')
        .eq('user_id', user.id)

      if (dateRange !== 'all') {
        factQuery = applyDateFilter(factQuery, 'date_emission', filterStart, filterEnd)
        vpQuery = applyDateFilter(vpQuery, 'date', filterStart, filterEnd)
      }

      const [factRes, vpRes] = await Promise.all([factQuery, vpQuery])
      const factures: any[] = factRes.data || []
      const ventes: any[] = vpRes.data || []

      const factIds = factures.map((f) => f.id)
      const vpIds = ventes.map((v) => v.id)
      const vpIdSet = new Set(vpIds.map((id) => String(id)))

      // 2) Fetch only the line items belonging to those documents, optionally
      //    narrowed to a single product (indexed produit_id / facture_id).
      const numericProductId = productId ? Number(productId) : null

      const buildFactLignes = () => {
        if (!factIds.length) return Promise.resolve({ data: [] as any[] })
        let q = supabase.from('facture_lignes').select('*').in('facture_id', factIds)
        if (numericProductId != null) q = q.eq('produit_id', numericProductId)
        return q
      }
      const buildVpLignes = () => {
        if (!vpIds.length) return Promise.resolve({ data: [] as any[] })
        let q = supabase.from('ventes_passagers_lignes').select('*')
        if (numericProductId != null) q = q.eq('produit_id', numericProductId)
        return q
      }

      const [factLignesRes, vpLignesRes] = await Promise.all([buildFactLignes(), buildVpLignes()])
      const factLignes: any[] = factLignesRes.data || []
      const vpLignes: any[] = (vpLignesRes.data || []).filter((l: any) => {
        const key = l.vp_id ?? l.vente_passager_id
        return key != null && vpIdSet.has(String(key))
      })

      // 3) Build lookup maps for enrichment (products, clients, parent docs).
      const prodMap = new Map<string, any>()
      for (const p of produits) prodMap.set(String(p.id), p)

      const factById = new Map<string, any>()
      for (const f of factures) factById.set(String(f.id), f)
      const vpById = new Map<string, any>()
      for (const v of ventes) vpById.set(String(v.id), v)

      // Client names (only factures link a client_id).
      const clientIds = Array.from(
        new Set(factures.map((f) => f.client_id).filter((id) => id != null)),
      )
      const clientMap = new Map<string, string>()
      if (clientIds.length) {
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, nom, nom_societe')
          .in('id', clientIds)
        for (const c of clientsData || []) {
          clientMap.set(String(c.id), c.nom || c.nom_societe || '')
        }
      }

      const nameOf = (l: any): { name: string; barcode: string } => {
        const p = l.produit_id != null ? prodMap.get(String(l.produit_id)) : null
        const name = l.designation || p?.designation || p?.nom || tp('unknown_product')
        const barcode = p?.barcode || ''
        return { name, barcode }
      }
      const lineTotalTtc = (l: any) => {
        const ttc = Number(l.montant_ttc)
        if (Number.isFinite(ttc) && ttc > 0) return ttc
        const ht = Number(l.montant_ht ?? (Number(l.prix_unitaire_ht || 0) * Number(l.quantite || 0)))
        return ht * (1 + Number(l.tva || 0) / 100)
      }

      const factureRows: SaleRow[] = factLignes.map((l: any) => {
        const parent = factById.get(String(l.facture_id))
        const { name, barcode } = nameOf(l)
        return {
          id: `f-${l.id}`,
          date: parent?.date_emission || '',
          productId: l.produit_id != null ? String(l.produit_id) : null,
          productName: name,
          barcode,
          quantite: Number(l.quantite || 0),
          prixUnitaire: Number(l.prix_unitaire_ht || 0),
          total: lineTotalTtc(l),
          source: 'facture',
          documentNumber: parent?.numero || '',
          clientName: parent?.client_id != null ? (clientMap.get(String(parent.client_id)) || '') : '',
        }
      })

      const vpRows: SaleRow[] = vpLignes.map((l: any) => {
        const key = l.vp_id ?? l.vente_passager_id
        const parent = vpById.get(String(key))
        const { name, barcode } = nameOf(l)
        return {
          id: `v-${l.id}`,
          date: parent?.date || '',
          productId: l.produit_id != null ? String(l.produit_id) : null,
          productName: name,
          barcode,
          quantite: Number(l.quantite || 0),
          prixUnitaire: Number(l.prix_unitaire_ht || 0),
          total: lineTotalTtc(l),
          source: 'vente_passager',
          documentNumber: parent?.numero || '',
          clientName: parent?.client_nom || '',
        }
      })

      setRows([...factureRows, ...vpRows])
    } catch (e) {
      console.error('Product analytics fetch error:', e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [user?.id, dateRange, filterStart?.getTime(), filterEnd?.getTime(), productId, produits])

  // Auto-refresh whenever a filter changes (custom range waits for both dates).
  useEffect(() => {
    if (dateRange === 'custom' && (!customStart || !customEnd)) return
    fetchSales()
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, customStart, customEnd, productId, user?.id, produits.length])

  // ── Summary statistics (already scoped to product if one is selected) ────────
  const summary = useMemo(() => {
    const totalQty = rows.reduce((s, r) => s + r.quantite, 0)
    const totalAmount = rows.reduce((s, r) => s + r.total, 0)
    const salesCount = rows.length
    const avgPrice = totalQty > 0 ? totalAmount / totalQty : 0
    const distinctProducts = new Set(
      rows.map((r) => (r.productId != null ? r.productId : `name:${r.productName}`)),
    ).size
    return { totalQty, totalAmount, salesCount, avgPrice, distinctProducts }
  }, [rows])

  // ── Search + sort ────────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      r.productName.toLowerCase().includes(q) ||
      r.barcode.toLowerCase().includes(q) ||
      r.documentNumber.toLowerCase().includes(q) ||
      r.clientName.toLowerCase().includes(q),
    )
  }, [rows, tableSearch])

  const sortedRows = useMemo(() => {
    const arr = [...filteredRows]
    const dir = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir
    })
    return arr
  }, [filteredRows, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / ITEMS_PER_PAGE))
  const pageRows = sortedRows.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'date' || key === 'total' || key === 'quantite' ? 'desc' : 'asc')
    }
  }

  const selectedProductName = useMemo(() => {
    if (!productId) return ''
    const p = produits.find((x) => String(x.id) === productId)
    return p ? (p.designation || p.nom || p.reference || '') : ''
  }, [productId, produits])

  // ── Exports ──────────────────────────────────────────────────────────────────
  const exportRows = () =>
    sortedRows.map((r) => ({
      [tp('col.date')]: formatDate(r.date, 'dd/MM/yyyy HH:mm', lang),
      [tp('col.product')]: r.productName,
      [tp('col.barcode')]: r.barcode,
      [tp('col.quantity')]: r.quantite,
      [tp('col.unit_price')]: Number(r.prixUnitaire.toFixed(2)),
      [tp('col.total')]: Number(r.total.toFixed(2)),
      [tp('col.source')]: r.source === 'facture' ? tp('source_facture') : tp('source_vp'),
      [tp('col.document')]: r.documentNumber,
      [tp('col.client')]: r.clientName,
    }))

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows())
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, tp('sheet_name'))
    const stamp = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `${tp('file_name')}_${stamp}.xlsx`)
  }

  const buildPrintHtml = () => {
    const rangeLabel = filterStart && filterEnd
      ? `${filterStart.toLocaleDateString(dateFmt)} – ${filterEnd.toLocaleDateString(dateFmt)}`
      : t('dashboard.date_range.all_time')
    const head = [
      'col.date', 'col.product', 'col.barcode', 'col.quantity',
      'col.unit_price', 'col.total', 'col.source', 'col.document', 'col.client',
    ].map((k) => `<th>${tp(k)}</th>`).join('')
    const body = sortedRows.map((r) => `
      <tr>
        <td>${formatDate(r.date, 'dd/MM/yyyy HH:mm', lang)}</td>
        <td>${escapeHtml(r.productName)}</td>
        <td>${escapeHtml(r.barcode)}</td>
        <td style="text-align:right">${r.quantite}</td>
        <td style="text-align:right">${fmt(r.prixUnitaire)}</td>
        <td style="text-align:right">${fmt(r.total)}</td>
        <td>${r.source === 'facture' ? tp('source_facture') : tp('source_vp')}</td>
        <td>${escapeHtml(r.documentNumber)}</td>
        <td>${escapeHtml(r.clientName)}</td>
      </tr>`).join('')
    return `<!DOCTYPE html><html dir="${isRTL ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
      <title>${tp('title')}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#0f172a}
        h1{font-size:18px;margin:0 0 4px}
        .meta{font-size:12px;color:#64748b;margin-bottom:16px}
        .summary{font-size:12px;margin-bottom:16px}
        .summary span{display:inline-block;margin-inline-end:16px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:${isRTL ? 'right' : 'left'}}
        th{background:#f1f5f9}
      </style></head><body>
      <h1>${tp('title')}</h1>
      <div class="meta">${rangeLabel}${selectedProductName ? ' — ' + escapeHtml(selectedProductName) : ''}</div>
      <div class="summary">
        <span><b>${tp('summary.total_qty')}:</b> ${summary.totalQty}</span>
        <span><b>${tp('summary.total_amount')}:</b> ${fmt(summary.totalAmount)}</span>
        <span><b>${tp('summary.sales_count')}:</b> ${summary.salesCount}</span>
        <span><b>${tp('summary.avg_price')}:</b> ${fmt(summary.avgPrice)}</span>
        <span><b>${tp('summary.distinct_products')}:</b> ${summary.distinctProducts}</span>
      </div>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      </body></html>`
  }

  const printViaIframe = () => {
    const html = buildPrintHtml()
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)
    const cw = iframe.contentWindow
    if (!cw) { document.body.removeChild(iframe); return }
    cw.document.open()
    cw.document.write(html)
    cw.document.close()
    const done = () => setTimeout(() => { try { document.body.removeChild(iframe) } catch { /* noop */ } }, 1000)
    setTimeout(() => {
      cw.focus()
      cw.print()
      done()
    }, 250)
  }

  const handlePrint = () => printViaIframe()
  // "Export PDF" reuses the browser print dialog (Save as PDF) with the same layout.
  const handleExportPdf = () => printViaIframe()

  const rangeLabel = filterStart && filterEnd
    ? `${filterStart.toLocaleDateString(dateFmt)} – ${filterEnd.toLocaleDateString(dateFmt)}`
    : t('dashboard.date_range.all_time')

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
  }

  const columns: { key: SortKey; labelKey: string; align?: 'right' }[] = [
    { key: 'date', labelKey: 'col.date' },
    { key: 'productName', labelKey: 'col.product' },
    { key: 'barcode', labelKey: 'col.barcode' },
    { key: 'quantite', labelKey: 'col.quantity', align: 'right' },
    { key: 'prixUnitaire', labelKey: 'col.unit_price', align: 'right' },
    { key: 'total', labelKey: 'col.total', align: 'right' },
    { key: 'source', labelKey: 'col.source' },
    { key: 'documentNumber', labelKey: 'col.document' },
    { key: 'clientName', labelKey: 'col.client' },
  ]

  return (
    <Card className="overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      <CardContent className="p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-500/10">
            <Layers className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground">{tp('title')}</h2>
            <p className="text-xs text-muted-foreground">{tp('subtitle')}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            {(['today', 'yesterday', 'this_week', 'this_month', 'this_year'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setDateRange(key)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md border transition-all',
                  dateRange === key
                    ? 'bg-[#0EA5E9] text-white border-[#0EA5E9] shadow-sm'
                    : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {t(`dashboard.date_range.${key}`)}
              </button>
            ))}
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeKey)}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue>{t(`dashboard.date_range.${dateRange}`)}</SelectValue>
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

          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 ps-6 flex-wrap">
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
            </div>
          )}

          {/* Product dropdown (optional) */}
          <div className="flex flex-wrap items-center gap-2 ps-6">
            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="w-full sm:w-80">
              <ProductSearchSelect
                produits={produits}
                value={productId}
                onSelect={(id) => setProductId(id)}
              />
            </div>
            {productId && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setProductId('')}>
                <X className="h-3.5 w-3.5 me-1" />
                {tp('clear_product')}
              </Button>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground ps-6">
            <CalendarDays className="inline h-3 w-3 me-1" />
            {rangeLabel}
            {selectedProductName && <span className="ms-1">· {selectedProductName}</span>}
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <SummaryCard icon={Boxes} label={tp('summary.total_qty')} value={String(summary.totalQty)} tone="sky" />
          <SummaryCard icon={DollarSign} label={tp('summary.total_amount')} value={fmt(summary.totalAmount)} tone="emerald" />
          <SummaryCard icon={Hash} label={tp('summary.sales_count')} value={String(summary.salesCount)} tone="violet" />
          <SummaryCard icon={TrendingUp} label={tp('summary.avg_price')} value={fmt(summary.avgPrice)} tone="amber" />
          <SummaryCard icon={Package} label={tp('summary.distinct_products')} value={String(summary.distinctProducts)} tone="rose" />
        </div>

        {/* Table toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <div className="relative w-full sm:w-64">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={tableSearch}
              onChange={(e) => { setTableSearch(e.target.value); setPage(1) }}
              placeholder={tp('search_placeholder')}
              className="h-9 ps-8"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={handleExportExcel} disabled={!sortedRows.length}>
              <FileSpreadsheet className="h-4 w-4 me-1.5" /> {tp('export_excel')}
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={handleExportPdf} disabled={!sortedRows.length}>
              <FileText className="h-4 w-4 me-1.5" /> {tp('export_pdf')}
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={handlePrint} disabled={!sortedRows.length}>
              <Printer className="h-4 w-4 me-1.5" /> {tp('print')}
            </Button>
          </div>
        </div>

        {/* Table */}
        <div ref={printRef} className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        'h-10 px-3 font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap',
                        c.align === 'right' ? 'text-end' : 'text-start',
                      )}
                    >
                      <span className={cn('inline-flex items-center gap-1', c.align === 'right' && 'flex-row-reverse')}>
                        {tp(c.labelKey)}
                        <SortIcon column={c.key} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={columns.length} className="py-16 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">{tp('loading')}</p>
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="py-16 text-center">
                      <Package className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm font-medium text-muted-foreground">{tp('empty')}</p>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap text-foreground" dir="ltr">
                        {formatDate(r.date, 'dd/MM/yyyy HH:mm', lang)}
                      </td>
                      <td className="px-3 py-2 font-medium text-foreground">{r.productName}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground" dir="ltr">{r.barcode || '—'}</td>
                      <td className="px-3 py-2 text-end tabular-nums text-foreground">{r.quantite}</td>
                      <td className="px-3 py-2 text-end tabular-nums text-foreground" dir="ltr">{fmt(r.prixUnitaire)}</td>
                      <td className="px-3 py-2 text-end tabular-nums font-semibold text-foreground" dir="ltr">{fmt(r.total)}</td>
                      <td className="px-3 py-2">
                        {r.source === 'facture' ? (
                          <Badge variant="info" className="gap-1 text-[10px]"><Receipt className="h-3 w-3" />{tp('source_facture')}</Badge>
                        ) : (
                          <Badge variant="success" className="gap-1 text-[10px]"><ShoppingCart className="h-3 w-3" />{tp('source_vp')}</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground" dir="ltr">{r.documentNumber || '—'}</td>
                      <td className="px-3 py-2 text-foreground">{r.clientName || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && sortedRows.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground" dir="ltr">
                {(page - 1) * ITEMS_PER_PAGE + 1}-{Math.min(page * ITEMS_PER_PAGE, sortedRows.length)} {t('shared.pagination.of')} {sortedRows.length}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                </Button>
                <span className="text-xs font-semibold text-foreground tabular-nums min-w-[64px] text-center">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Small presentational helpers ──────────────────────────────────────────────

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const TONES: Record<string, string> = {
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
}

function SummaryCard({
  icon: Icon, label, value, tone,
}: { icon: ElementType; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-md', TONES[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-[11px] font-medium text-muted-foreground leading-tight">{label}</p>
      <p className="text-base sm:text-lg font-bold text-foreground mt-0.5 tabular-nums" dir="ltr">{value}</p>
    </div>
  )
}
