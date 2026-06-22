import { forwardRef, useMemo } from 'react'
import { format, isValid, parseISO } from 'date-fns'
import { getDateLocale } from '@/lib/utils'
import { numberToFrenchWords } from '@/lib/numberToWords'
import { DOC_COLORS as C } from './docColors'

type DocType = 'facture' | 'devis' | 'bon_commande' | 'bon_livraison' | 'bon_livraison_client'

interface DocumentPreviewProps {
  type: DocType
  data: any
  entreprise: any
  /** BCP-47 language tag from i18n.language — drives date locale ('ar', 'en', 'fr') */
  lang?: string
}

const ITEMS_PER_PAGE = 8

const fmt2 = (n: number): string =>
  new Intl.NumberFormat('fr-MA', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)

const fmt4 = (n: number): string =>
  new Intl.NumberFormat('fr-MA', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)

const safeNum = (v: any, fallback = 0): number => {
  if (v === null || v === undefined || v === '') return fallback
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? fallback : n
}

/** Returns a date formatter scoped to the given i18n language tag. */
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

const pickVal = (obj: any, ...keys: string[]) => {
  for (const k of keys) { const v = obj?.[k]; if (v !== null && v !== undefined) return v }
  return null
}

const pickNum = (obj: any, ...keys: string[]) => safeNum(pickVal(obj, ...keys))

const titles: Record<DocType, string> = {
  facture: 'FACTURE',
  devis: 'DEVIS',
  bon_commande: 'BON DE COMMANDE',
  bon_livraison: 'BON DE LIVRAISON',
  bon_livraison_client: 'BON DE LIVRAISON',
}

const entityLabel: Record<DocType, string> = {
  facture: 'Client',
  devis: 'Client',
  bon_commande: 'Fournisseur',
  bon_livraison: 'Fournisseur',
  bon_livraison_client: 'Client',
}

/** "FACTURÉ À" → "FOURNISSEUR" / "DESTINATAIRE" depending on doc type.
 *  The tabbed label that sits on the top edge of the red recipient box. */
const recipientBoxLabel: Record<DocType, string> = {
  facture:        'FACTURÉ À',
  devis:          'DEVIS POUR',
  bon_commande:   'FOURNISSEUR',
  bon_livraison:  'DESTINATAIRE',
  bon_livraison_client: 'DESTINATAIRE',
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

export const DocumentPreview = forwardRef<HTMLDivElement, DocumentPreviewProps>(
  ({ type, data, entreprise, lang }, ref) => {
    if (!data) return null

    // Locale-aware date formatter for this render — uses Arabic/English/French
    // date-fns locale based on the active UI language.
    const fmtDate = makeFmtDate(lang)

    const docTitle = titles[type]
    const entityNameLabel = entityLabel[type]
    const lignes = data.lignes || []
    const totalHt = pickNum(data, 'montantHt', 'montant_ht')
    const totalTva = pickNum(data, 'montantTva', 'montant_tva')
    const totalTtc = pickNum(data, 'montantTtc', 'montant_ttc')
    const modePaiement = (pickVal(data, 'modePaiement', 'mode_paiement') as string) || ''
    const voiture = (pickVal(data, 'voiture') as string) || ''
    const matricule = (pickVal(data, 'matricule') as string) || ''

    const entity = pickVal(data, 'client', 'fournisseur') || {}
    const entityName = entity?.nomSociete || entity?.nom || '-'
    const docDate = fmtDate(pickVal(data, 'dateEmission', 'dateCommande', 'date', 'dateLivraison'))

    const meta = [
      { label: 'Numéro', value: data.numero || '-' },
      { label: 'Date', value: docDate },
      { label: 'Référence', value: '-' },
      { label: 'Mode de Règlement', value: modePaiement || '-' },
      {
        label: 'Échéance',
        value: fmtDate(pickVal(data, 'dateEcheance', 'dateValidite', 'dateLivraisonPrevue', 'dateLivraison')),
      },
      { label: 'Agent', value: entityName },
    ]

    const dateValidite = fmtDate(pickVal(data, 'dateValidite', 'dateEcheance', 'dateLivraisonPrevue'))
    const conditionsPaiement = data.conditionsPaiement || ''

    const tvaBuckets = useMemo(() => computeTvaBuckets(lignes), [lignes])

    const pages = useMemo(() => {
      if (lignes.length === 0) return [{ items: [] as any[], isFirst: true, isLast: true, carryTotal: 0 }]
      const chunks: { items: any[]; isFirst: boolean; isLast: boolean; carryTotal: number }[] = []
      let idx = 0
      let carryTotal = 0
      while (idx < lignes.length) {
        const chunk = lignes.slice(idx, idx + ITEMS_PER_PAGE)
        const chunkTotal = chunk.reduce((s: number, l: any) => {
          const qte = safeNum(l.quantite, 1)
          const pu = pickNum(l, 'prixUnitaireHt', 'prix_unitaire_ht')
          const mHt = pickNum(l, 'montantHt', 'montant_ht')
          return s + (mHt > 0 ? mHt : qte * pu)
        }, 0)
        idx += ITEMS_PER_PAGE
        const isLast = idx >= lignes.length
        chunks.push({ items: chunk, isFirst: chunks.length === 0, isLast, carryTotal })
        carryTotal += chunkTotal
      }
      return chunks
    }, [lignes])

    const getPu = (l: any) => pickNum(l, 'prixUnitaireHt', 'prix_unitaire_ht')
    const getQt = (l: any) => safeNum(l.quantite, 1)
    const getMt = (l: any) => { const m = pickNum(l, 'montantHt', 'montant_ht'); return m > 0 ? m : getPu(l) * getQt(l) }

    return (
      <>
        <style>{`
          @page { margin: 0; size: A4; }
          @media print {
            html, body { margin: 0 !important; padding: 0 !important; }
            .page-split { page-break-after: always; }
          }
          .doc {
            font-family: 'Inter', 'Helvetica', 'Arial', sans-serif;
            color: ${C.text};
            background: #fff;
            position: relative;
          }
          .doc table { border-collapse: collapse; }
          .watermark {
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
        <div ref={ref} className="doc">
          {pages.map((page, pIdx) => (
            <div
              key={pIdx}
              className={pIdx < pages.length - 1 ? 'page-split' : ''}
              style={{
                width: '210mm',
                height: '297mm',
                padding: '15mm',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
                boxSizing: 'border-box',
              }}
            >
              {/* ===== WATERMARK ===== */}
              {entreprise?.activerFiligrane !== false && (
                <div className="watermark">{entreprise?.watermarkText || 'SmartGestion'}</div>
              )}

              {page.isFirst ? (
                <>
                  {/* ===== HEADER ============================================
                       Company info (logo + name + address/contact lines) on
                       the left. Red title pill ("FACTURE" / "DEVIS" / …) on
                       the right, with N°/Date row underneath. Mirrors the
                       FactureDocument design so every document type reads
                       as part of the same family. */}
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

                    <div style={{ textAlign: 'right', minWidth: 200 }}>
                      <div style={{
                        display: 'inline-block',
                        background: C.accent,
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '14pt',
                        letterSpacing: 2,
                        padding: '10px 28px',
                        textTransform: 'uppercase',
                      }}>
                        {docTitle}
                      </div>
                      <div style={{ fontSize: '9pt', marginTop: 8, color: C.text }}>
                        <strong style={{ color: C.title }}>N°:</strong> {data.numero || '-'}
                        <span style={{ marginLeft: 16 }}>
                          <strong style={{ color: C.title }}>Date:</strong> {docDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Thin red rule above the recipient box. */}
                  <div style={{ borderTop: `2px solid ${C.accent}`, marginBottom: 14 }} />

                  {/* ===== RECIPIENT BOX ====================================
                       Thin red border around the recipient's identity. A
                       small white label sits on top of the border ("— FACTURÉ
                       À —" / "— FOURNISSEUR —" / etc) depending on doc type. */}
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
                      — {recipientBoxLabel[type]} —
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
                      {type === 'bon_livraison_client' && voiture   && <div><strong style={{ color: C.title }}>Voiture:</strong> {voiture}</div>}
                      {type === 'bon_livraison_client' && matricule && <div><strong style={{ color: C.title }}>Matricule:</strong> {matricule}</div>}
                      {entity?.ice       && <div>ICE: {entity.ice}</div>}
                      {entity?.telephone && <div>{entity.telephone}</div>}
                      {entity?.adresse   && <div>{entity.adresse}</div>}
                      {entity?.ville     && <div>{(entity.ville || '').toString().toUpperCase()}</div>}
                    </div>
                  </div>

                  {/* Optional metadata strip (not on bon_livraison) — kept
                      subtle so it doesn't compete with the red pill. */}
                  {type !== 'bon_livraison' && modePaiement && (
                    <div style={{
                      fontSize: '9pt',
                      color: C.muted,
                      marginBottom: 12,
                      paddingBottom: 6,
                      borderBottom: `1px solid ${C.borderSoft}`,
                    }}>
                      <strong style={{ color: C.title }}>Mode de règlement:</strong> {modePaiement}
                      {' '}
                      <span style={{ marginLeft: 16 }}>
                        <strong style={{ color: C.title }}>Échéance:</strong>{' '}
                        {meta.find(m => m.label === 'Échéance')?.value || '-'}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* ===== CONTINUATION HEADER ==============================
                       Page 2+ keeps a slim red rule + report line so the
                       document still reads as branded across page breaks. */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 10,
                    paddingBottom: 6,
                    borderBottom: `2px solid ${C.accent}`,
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '10pt', textTransform: 'uppercase', color: C.title }}>
                      Report — {docTitle} {data.numero}
                    </div>
                    <div style={{ fontSize: '9pt', fontWeight: 600, color: C.muted }}>I.C.E: {entreprise?.ice || '-'}</div>
                  </div>
                </>
              )}

              {/* ===== ITEMS TABLE ============================================
                   Solid red header bar with white uppercase columns.
                   First column is a simple row index (N°) displayed in red.
                   Zebra rows on the body for easy scanning. Carry-over
                   numbering across multi-page documents is preserved by
                   using the page's offset (`pageIdx * ITEMS_PER_PAGE`). */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <table style={{ width: '100%' }}>
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
                    {page.items.map((ligne: any, i: number) => {
                      const rowNum = pIdx * ITEMS_PER_PAGE + i + 1
                      const stripe = i % 2 === 0 ? '#fff' : C.rowAlt
                      return (
                        <tr key={i} style={{ background: stripe }}>
                          <td style={{ padding: '8px', fontSize: '9.5pt', textAlign: 'center', borderBottom: `0.5pt solid ${C.borderSoft}`, color: C.accent, fontWeight: 700 }}>
                            {rowNum}
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: '9.5pt', textAlign: 'left', borderBottom: `0.5pt solid ${C.borderSoft}`, color: C.text }}>
                            {ligne.designation || '-'}
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: '9.5pt', textAlign: 'right', borderBottom: `0.5pt solid ${C.borderSoft}`, color: C.text }}>
                            {fmt4(getPu(ligne))} DH
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: '9.5pt', textAlign: 'center', borderBottom: `0.5pt solid ${C.borderSoft}`, color: C.text }}>
                            {fmt2(getQt(ligne))}
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: '9.5pt', textAlign: 'right', borderBottom: `0.5pt solid ${C.borderSoft}`, color: C.text, fontWeight: 700 }}>
                            {fmt2(getMt(ligne))} DH
                          </td>
                        </tr>
                      )
                    })}
                    {page.items.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '10px 8px', fontSize: '9pt', textAlign: 'center', fontStyle: 'italic', color: C.subtle, borderBottom: `0.5pt solid ${C.borderSoft}` }}>Aucun article</td></tr>
                    )}
                  </tbody>
                </table>

                <div style={{ flex: 1 }} />

                {/* ===== CARRY OVER ===== */}
                {!page.isLast && pages.length > 1 && (
                  <div style={{ marginTop: 6, textAlign: 'right', fontSize: '9pt', borderTop: `1px dashed ${C.border}`, paddingTop: 6, color: C.text }}>
                    <strong style={{ color: C.title }}>A reporter:</strong> {fmt2(page.carryTotal)} Dirhams DHS
                  </div>
                )}

                {/* ===== LAST PAGE: TOTALS + WORDS + EXTRA SECTIONS ========
                     Right-aligned 3-row totals (Total HT → TVA → solid red
                     TOTAL TTC), then the centred amount-in-words box, then
                     optional devis/notes/payment/signature blocks. */}
                {page.isLast && (
                  <>
                    {/* Totals stack — same red TTC pattern as FactureDocument */}
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

                    {/* Amount in words — centred light-gray callout */}
                    {type !== 'bon_livraison' && (
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
                          Arrêtée la présente {docTitle.toLowerCase()} à la somme de :
                        </div>
                        <div style={{ fontWeight: 700, color: C.title }}>
                          {numberToFrenchWords(Math.abs(Number(totalTtc)))} dirhams
                        </div>
                      </div>
                    )}

                    {/* Devis-specific validity + conditions strip */}
                    {type === 'devis' && (dateValidite !== '-' || conditionsPaiement) && (
                      <div style={{
                        marginTop: 14,
                        padding: '10px 14px',
                        fontSize: '9pt',
                        background: C.rowAlt,
                        color: C.text,
                      }}>
                        {dateValidite !== '-' && (
                          <div><strong style={{ color: C.title }}>Validité de l'offre:</strong> {dateValidite}</div>
                        )}
                        {conditionsPaiement && (
                          <div style={{ marginTop: 4 }}>
                            <strong style={{ color: C.title }}>Conditions de règlement:</strong> {conditionsPaiement}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Payment information (RIB / banque) */}
                    {(entreprise?.banque || entreprise?.rib) && (
                      <div style={{ marginTop: 18, fontSize: '9pt', color: C.text }}>
                        <div style={{ fontWeight: 700, color: C.title, letterSpacing: 0.5, marginBottom: 4 }}>
                          INFORMATIONS DE PAIEMENT
                        </div>
                        {entreprise?.banque && <div>{entreprise.banque}</div>}
                        {entreprise?.rib    && <div>{entreprise.rib}</div>}
                      </div>
                    )}

                    {/* Free-text notes captured on the document */}
                    {data.notes && (
                      <div style={{ marginTop: 14, fontSize: '9pt', color: C.text }}>
                        <strong style={{ color: C.title }}>Notes:</strong> {data.notes}
                      </div>
                    )}

                    {/* Push signatures to the bottom of the last page */}
                    <div style={{ flex: 1 }} />

                    {/* ===== SIGNATURES =======================================
                         Two thin underline lines with "SIGNATURE DU …"
                         small-caps labels — sober, no dashed boxes. */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: 40,
                      gap: 60,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ borderTop: `1px solid ${C.title}`, width: 180, marginBottom: 6 }} />
                        <div style={{ fontSize: '9pt', color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                          Signature du Vendeur
                        </div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'right' }}>
                        <div style={{ borderTop: `1px solid ${C.title}`, width: 180, marginBottom: 6, marginLeft: 'auto' }} />
                        <div style={{ fontSize: '9pt', color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                          Signature du {entityNameLabel}
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

DocumentPreview.displayName = 'DocumentPreview'
