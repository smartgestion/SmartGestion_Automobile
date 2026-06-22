import { forwardRef, useMemo } from 'react'
import { format, isValid, parseISO } from 'date-fns'
import { getDateLocale } from '@/lib/utils'
import { numberToFrenchWords } from '@/lib/numberToWords'
import { DOC_COLORS as C } from './docColors'

/** Strict cap of products rendered per page. Any overflow flows onto
 *  subsequent pages with the identical table structure / theme. */
const ITEMS_PER_PAGE = 8

interface BonCommandeDocumentProps {
  bon: any
  entreprise: any
  /** BCP-47 language tag from i18n.language */
  lang?: string
}

const fmt2 = (n: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)

const safeNum = (v: any, fallback = 0): number => {
  if (v === null || v === undefined || v === '') return fallback
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? fallback : n
}

const pickVal = (obj: any, ...keys: string[]) => {
  for (const k of keys) { const v = obj?.[k]; if (v !== null && v !== undefined) return v }
  return null
}

const pickNum = (obj: any, ...keys: string[]) => safeNum(pickVal(obj, ...keys))

const makeFmtDate = (lang?: string) => (d: any): string => {
  if (!d) return '-'
  try {
    let date: Date
    if (typeof d === 'string') {
      date = d.includes('T') || d.includes('-') ? parseISO(d) : new Date(d)
    } else if (d instanceof Date) {
      date = d
    } else {
      date = new Date(d)
    }
    return isValid(date) ? format(date, 'dd/MM/yyyy', { locale: getDateLocale(lang) }) : '-'
  } catch {
    return '-'
  }
}

interface TvaBucket {
  rate: number
  baseHt: number
  montantTva: number
}

function computeTvaBuckets(lignes: any[]): TvaBucket[] {
  const map = new Map<number, TvaBucket>()
  for (const l of lignes) {
    const qte = safeNum(l.quantite, 1)
    const pu = pickNum(l, 'prixUnitaireHt', 'prix_unitaire_ht')
    const mHt = pickNum(l, 'montantHt', 'montant_ht')
    const totalHt = mHt > 0 ? mHt : qte * pu
    const tvaRate = safeNum(l.tva, 20)
    const existing = map.get(tvaRate)
    if (existing) {
      existing.baseHt += totalHt
      existing.montantTva += totalHt * (tvaRate / 100)
    } else {
      map.set(tvaRate, { rate: tvaRate, baseHt: totalHt, montantTva: totalHt * (tvaRate / 100) })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.rate - a.rate)
}

export const BonCommandeDocument = forwardRef<HTMLDivElement, BonCommandeDocumentProps>(
  ({ bon, entreprise, lang }, ref) => {
    if (!bon) return null

    const fmtDate = makeFmtDate(lang)

    const lignes = bon.lignes || []
    const totalHt = pickNum(bon, 'montantHt', 'montant_ht')
    const totalTva = pickNum(bon, 'montantTva', 'montant_tva')
    const totalTtc = pickNum(bon, 'montantTtc', 'montant_ttc')
    const dateEmission = fmtDate(pickVal(bon, 'dateEmission', 'dateCommande', 'date', 'date_emission'))
    const numero = bon.numero || '-'
    const entity = pickVal(bon, 'fournisseur', 'client') || {}
    const entityName = entity?.nomSociete || entity?.nom || '-'

    const tvaBuckets = useMemo(() => computeTvaBuckets(lignes), [lignes])

    const getPu = (l: any) => pickNum(l, 'prixUnitaireHt', 'prix_unitaire_ht')
    const getQt = (l: any) => safeNum(l.quantite, 1)
    const getMt = (l: any) => { const m = pickNum(l, 'montantHt', 'montant_ht'); return m > 0 ? m : getPu(l) * getQt(l) }

    const amountWords = numberToFrenchWords(Math.abs(Number(totalTtc)))

    // Split the products into pages of at most ITEMS_PER_PAGE (8) items.
    // Each page reuses the identical table structure / theme; the totals +
    // summary block are only rendered on the very last page.
    const pages = useMemo(() => {
      if (lignes.length === 0) {
        return [{ items: [] as any[], offset: 0, isFirst: true, isLast: true }]
      }
      const chunks: { items: any[]; offset: number; isFirst: boolean; isLast: boolean }[] = []
      for (let idx = 0; idx < lignes.length; idx += ITEMS_PER_PAGE) {
        const items = lignes.slice(idx, idx + ITEMS_PER_PAGE)
        chunks.push({
          items,
          offset: idx,
          isFirst: idx === 0,
          isLast: idx + ITEMS_PER_PAGE >= lignes.length,
        })
      }
      return chunks
    }, [lignes])

    return (
      <>
        <style>{`
          @page { margin: 0; size: A4; }
          @media print {
            html, body { margin: 0 !important; padding: 0 !important; }
            .bc-page-split { page-break-after: always; }
          }
          .bc-doc {
            font-family: 'Inter', 'Helvetica', 'Arial', sans-serif;
            color: ${C.text};
            background: #fff;
            position: relative;
          }
          .bc-doc table { border-collapse: collapse; }
          .bc-watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 80pt;
            font-weight: 900;
            color: ${C.watermark};
            z-index: 0;
            white-space: nowrap;
            pointer-events: none;
            letter-spacing: 12px;
            text-transform: uppercase;
            user-select: none;
          }
        `}</style>
        <div ref={ref} className="bc-doc">
          {pages.map((page, pIdx) => (
          <div
            key={pIdx}
            className={pIdx < pages.length - 1 ? 'bc-page-split' : ''}
            style={{
            width: '210mm',
            minHeight: '297mm',
            padding: '15mm',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            boxSizing: 'border-box',
          }}>
            {entreprise?.activerFiligrane !== false && (
              <div className="bc-watermark">{entreprise?.watermarkText || 'SmartGestion'}</div>
            )}

            {page.isFirst ? (
            <>
            {/* ===== HEADER ============================================
                 Same red-pill design as the other documents — only the
                 title text inside the pill changes ("BON DE COMMANDE"). */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {entreprise?.logoUrl && (
                  <img src={entreprise.logoUrl} alt="Logo" style={{ width: 100, height: 60, objectFit: 'contain', flexShrink: 0 }} />
                )}
                <div style={{ fontSize: '9pt', lineHeight: 1.6, color: C.text }}>
                  <div style={{ fontWeight: 700, fontSize: '11pt', color: C.title, marginBottom: 6, letterSpacing: 0.3 }}>
                    {(entreprise?.nom || entreprise?.nomEntreprise || 'Nom de l\'entreprise').toUpperCase()}
                  </div>
                  {entreprise?.adresse  && <div style={{ color: C.muted }}>{entreprise.adresse}</div>}
                  {entreprise?.ville    && <div style={{ color: C.muted }}>{entreprise.ville}</div>}
                  {entreprise?.telephone && <div style={{ color: C.muted }}>Tel: {entreprise.telephone}</div>}
                  {entreprise?.email     && <div style={{ color: C.muted }}>Email: {entreprise.email}</div>}
                </div>
              </div>

              <div style={{ textAlign: 'right', minWidth: 220 }}>
                <div style={{
                  display: 'inline-block',
                  background: C.accent,
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13pt',
                  letterSpacing: 1.5,
                  padding: '10px 22px',
                  textTransform: 'uppercase',
                }}>
                  Bon de Commande
                </div>
                <div style={{ fontSize: '9pt', marginTop: 8, color: C.text }}>
                  <strong style={{ color: C.title }}>N°:</strong> {numero}
                  <span style={{ marginLeft: 16 }}>
                    <strong style={{ color: C.title }}>Date:</strong> {dateEmission}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ borderTop: `2px solid ${C.accent}`, marginBottom: 14 }} />

            {/* ===== RECIPIENT BOX ("FOURNISSEUR") ===================== */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <div style={{
                position: 'absolute',
                top: -8,
                left: 14,
                background: '#fff',
                padding: '0 8px',
                fontSize: '9pt',
                fontWeight: 700,
                color: C.title,
                letterSpacing: 0.5,
              }}>
                — FOURNISSEUR —
              </div>
              <div style={{
                border: `1px solid ${C.accent}`,
                padding: '14px 16px 12px',
                fontSize: '9.5pt',
                lineHeight: 1.65,
                color: C.text,
              }}>
                <div style={{ fontWeight: 700, fontSize: '11pt', color: C.title, marginBottom: 4, letterSpacing: 0.3 }}>
                  {(entityName || '-').toString().toUpperCase()}
                </div>
                {entity?.ice       && <div>ICE: {entity.ice}</div>}
                {entity?.telephone && <div>{entity.telephone}</div>}
                {entity?.adresse   && <div>{entity.adresse}</div>}
                {entity?.ville     && <div>{(entity.ville || '').toString().toUpperCase()}</div>}
              </div>
            </div>
            </>
            ) : (
              /* ===== CONTINUATION HEADER (pages 2+) ====================== */
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
                paddingBottom: 6,
                borderBottom: `2px solid ${C.accent}`,
              }}>
                <div style={{ fontWeight: 700, fontSize: '10pt', textTransform: 'uppercase', color: C.title }}>
                  Bon de Commande {numero} — (suite)
                </div>
                <div style={{ fontSize: '9pt', fontWeight: 600, color: C.muted }}>
                  {(entityName || '-').toString().toUpperCase()}
                </div>
              </div>
            )}

            {/* ===== ITEMS TABLE — red header bar, zebra body ============ */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '42%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '22%' }} />
                </colgroup>
                <thead>
                  <tr style={{ background: C.accent, color: '#fff' }}>
                    <th style={{ padding: '10px 8px', fontSize: '9.5pt', fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 }}>N°</th>
                    <th style={{ padding: '10px 12px', fontSize: '9.5pt', fontWeight: 700, textAlign: 'left',   textTransform: 'uppercase', letterSpacing: 0.5 }}>Désignation</th>
                    <th style={{ padding: '10px 12px', fontSize: '9.5pt', fontWeight: 700, textAlign: 'right',  textTransform: 'uppercase', letterSpacing: 0.5 }}>P.U. HT</th>
                    <th style={{ padding: '10px 12px', fontSize: '9.5pt', fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 }}>Qté</th>
                    <th style={{ padding: '10px 12px', fontSize: '9.5pt', fontWeight: 700, textAlign: 'right',  textTransform: 'uppercase', letterSpacing: 0.5 }}>Montant HT</th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((ligne: any, i: number) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : C.rowAlt }}>
                      <td style={{ padding: '8px', fontSize: '9.5pt', textAlign: 'center', borderBottom: `0.5pt solid ${C.borderSoft}`, color: C.accent, fontWeight: 700 }}>{page.offset + i + 1}</td>
                      <td style={{ padding: '8px 12px', fontSize: '9.5pt', textAlign: 'left', borderBottom: `0.5pt solid ${C.borderSoft}`, color: C.text }}>{ligne.designation || '-'}</td>
                      <td style={{ padding: '8px 12px', fontSize: '9.5pt', textAlign: 'right', borderBottom: `0.5pt solid ${C.borderSoft}`, color: C.text }}>{fmt2(getPu(ligne))} DH</td>
                      <td style={{ padding: '8px 12px', fontSize: '9.5pt', textAlign: 'center', borderBottom: `0.5pt solid ${C.borderSoft}`, color: C.text }}>{getQt(ligne)}</td>
                      <td style={{ padding: '8px 12px', fontSize: '9.5pt', textAlign: 'right', borderBottom: `0.5pt solid ${C.borderSoft}`, color: C.text, fontWeight: 700 }}>{fmt2(getMt(ligne))} DH</td>
                    </tr>
                  ))}
                  {page.items.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '10px 8px', fontSize: '9pt', textAlign: 'center', fontStyle: 'italic', color: C.subtle, borderBottom: `0.5pt solid ${C.borderSoft}` }}>Aucun article</td></tr>
                  )}
                </tbody>
              </table>

              {!page.isLast && <div style={{ flex: 1 }} />}

              {page.isLast && (
              <>
              {/* ===== TOTALS STACK ===================================== */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <table style={{ borderCollapse: 'collapse', fontSize: '9.5pt', width: 320 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '8px 14px', textAlign: 'left',  background: C.rowAlt, borderBottom: `1px solid ${C.borderSoft}`, color: C.text }}>Total H.T</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', background: C.rowAlt, borderBottom: `1px solid ${C.borderSoft}`, color: C.text, fontWeight: 700 }}>{fmt2(totalHt)} DH</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 14px', textAlign: 'left',  background: C.rowAlt, color: C.text }}>TVA{tvaBuckets.length === 1 ? ` (${tvaBuckets[0].rate}%)` : ''}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', background: C.rowAlt, color: C.text, fontWeight: 700 }}>{fmt2(totalTva)} DH</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '12px 14px', textAlign: 'left',  background: C.accent, color: '#fff', fontWeight: 700, fontSize: '11pt', letterSpacing: 0.5, textTransform: 'uppercase' }}>Total TTC</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', background: C.accent, color: '#fff', fontWeight: 800, fontSize: '11pt' }}>{fmt2(totalTtc)} DH</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Amount in words */}
              <div style={{
                marginTop: 18,
                padding: '12px 16px',
                background: C.rowAlt,
                fontSize: '9pt',
                textAlign: 'center',
                lineHeight: 1.5,
                color: C.text,
              }}>
                <div style={{ fontStyle: 'italic', color: C.muted, marginBottom: 4 }}>
                  Arrêté le présent bon de commande à la somme de :
                </div>
                <div style={{ fontWeight: 700, color: C.title }}>
                  {amountWords} dirhams
                </div>
              </div>

              {/* Notes */}
              {bon.notes && (
                <div style={{ marginTop: 14, fontSize: '9pt', color: C.text }}>
                  <strong style={{ color: C.title }}>Notes:</strong> {bon.notes}
                </div>
              )}

              <div style={{ flex: 1 }} />

              {/* ===== SIGNATURES ===================================== */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 40,
                gap: 60,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ borderTop: `1px solid ${C.title}`, width: 180, marginBottom: 6 }} />
                  <div style={{ fontSize: '9pt', color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Signature de la Société
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ borderTop: `1px solid ${C.title}`, width: 180, marginBottom: 6, marginLeft: 'auto' }} />
                  <div style={{ fontSize: '9pt', color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Signature du Fournisseur
                  </div>
                </div>
              </div>

              {/* ===== LEGAL FOOTER ===================================== */}
              <div style={{
                marginTop: 18,
                paddingTop: 8,
                borderTop: `1px solid ${C.borderSoft}`,
                textAlign: 'center',
                fontSize: '7.5pt',
                lineHeight: 1.5,
                color: C.muted,
              }}>
                {entreprise?.formeJuridique && entreprise?.capitalSocial && (
                  <span>{entreprise.formeJuridique} au Capital de {entreprise.capitalSocial} — </span>
                )}
                {entreprise?.rc && <span>R.C: {entreprise.rc} — </span>}
                {entreprise?.ifNumber && <span>I.F: {entreprise.ifNumber} — </span>}
                {entreprise?.ice && <span>I.C.E: {entreprise.ice}</span>}
              </div>
              </>
              )}
            </div>
          </div>
          ))}
        </div>
      </>
    )
  }
)

BonCommandeDocument.displayName = 'BonCommandeDocument'
