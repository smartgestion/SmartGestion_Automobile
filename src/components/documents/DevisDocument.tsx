import { forwardRef, useMemo } from 'react'
import { format, isValid, parseISO } from 'date-fns'
import { getDateLocale } from '@/lib/utils'
import { DOC_COLORS as C } from './docColors'

/** Strict cap of products rendered per page. Any overflow flows onto
 *  subsequent pages with the identical table structure / theme. */
const ITEMS_PER_PAGE = 8

interface DevisDocumentProps {
  devis: any
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

export const DevisDocument = forwardRef<HTMLDivElement, DevisDocumentProps>(
  ({ devis, entreprise, lang }, ref) => {
    if (!devis) return null

    const fmtDate = makeFmtDate(lang)

    const lignes = devis.lignes || []
    const totalHt = pickNum(devis, 'montantHt', 'montant_ht')
    const totalTva = pickNum(devis, 'montantTva', 'montant_tva')
    const totalTtc = pickNum(devis, 'montantTtc', 'montant_ttc')
    const numero = devis.numero || '-'
    const dateEmission = fmtDate(pickVal(devis, 'dateEmission', 'date_emission'))
    const dateValidite = fmtDate(pickVal(devis, 'dateValidite', 'date_echeance', 'dateEcheance'))
    const modePaiement = (pickVal(devis, 'modePaiement', 'mode_paiement') as string) || ''
    const voiture = (pickVal(devis, 'voiture') as string) || ''
    const matricule = (pickVal(devis, 'matricule') as string) || ''
    const conditionsPaiement = devis.conditionsPaiement || ''
    const client = pickVal(devis, 'client', 'fournisseur') || {}
    const entityName = client?.nomSociete || client?.nom || '-'

    const getPu = (l: any) => pickNum(l, 'prixUnitaireHt', 'prix_unitaire_ht')
    const getQt = (l: any) => safeNum(l.quantite, 1)
    const getMt = (l: any) => { const m = pickNum(l, 'montantHt', 'montant_ht'); return m > 0 ? m : getPu(l) * getQt(l) }

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
            .devis-page-split { page-break-after: always; }
          }
          .devis-doc {
            font-family: 'Inter', 'Helvetica', 'Arial', sans-serif;
            color: ${C.text};
            background: #fff;
            position: relative;
          }
          .devis-doc table { border-collapse: collapse; }
          .devis-watermark {
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
        <div ref={ref} className="devis-doc">
          {pages.map((page, pIdx) => (
          <div
            key={pIdx}
            className={pIdx < pages.length - 1 ? 'devis-page-split' : ''}
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
              <div className="devis-watermark">{entreprise?.watermarkText || 'SmartGestion'}</div>
            )}

            {page.isFirst ? (
            <>
            {/* ===== HEADER ============================================
                 Same red-pill design as FactureDocument so every document
                 type reads as part of the same brand family. The only
                 piece of text that changes is "DEVIS" inside the pill. */}
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
                  Devis
                </div>
                <div style={{ fontSize: '9pt', marginTop: 8, color: C.text }}>
                  <strong style={{ color: C.title }}>N°:</strong> {numero}
                  <span style={{ marginLeft: 16 }}>
                    <strong style={{ color: C.title }}>Date:</strong> {dateEmission}
                  </span>
                </div>
                {entreprise?.ice && (
                  <div style={{ fontSize: '8pt', color: C.muted, marginTop: 2 }}>
                    I.C.E: {entreprise.ice}
                  </div>
                )}
              </div>
            </div>

            <div style={{ borderTop: `2px solid ${C.accent}`, marginBottom: 14 }} />

            {/* ===== RECIPIENT BOX ("DEVIS POUR") ====================== */}
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
                — DEVIS POUR —
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
                {voiture   && <div><strong style={{ color: C.title }}>Voiture:</strong> {voiture}</div>}
                {matricule && <div><strong style={{ color: C.title }}>Matricule:</strong> {matricule}</div>}
                {client?.ice       && <div>ICE: {client.ice}</div>}
                {client?.telephone && <div>{client.telephone}</div>}
                {client?.adresse   && <div>{client.adresse}</div>}
                {client?.ville     && <div>{(client.ville || '').toString().toUpperCase()}</div>}
              </div>
            </div>

            {/* Slim metadata strip — mode de règlement only.
                Validity is intentionally shown ONLY in the closing
                courtesy box below as "Validité de l'offre" so there's
                no duplication. */}
            {modePaiement && (
              <div style={{
                fontSize: '9pt',
                color: C.muted,
                marginBottom: 12,
                paddingBottom: 6,
                borderBottom: `1px solid ${C.borderSoft}`,
              }}>
                <strong style={{ color: C.title }}>Mode de règlement:</strong> {modePaiement}
              </div>
            )}

            {/* ===== INTRO COURTESY PARAGRAPH =============================
                 Standard "Cher Client …" introduction printed on every
                 devis just above the items table. Kept short, italic, and
                 slate-muted so it reads as a polite preamble without
                 competing visually with the red items-table header. */}
            <div style={{
              fontSize: '9pt',
              lineHeight: 1.5,
              fontStyle: 'italic',
              color: C.muted,
              marginBottom: 14,
            }}>
              Cher Client, Nous avons bien reçu votre demande et nous vous remercions de la confiance que vous nous accordez.
              Veuillez trouver ci-dessous le détail de notre proposition.
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
                  Devis {numero} — (suite)
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
                      <td style={{ padding: '8px 12px', fontSize: '9.5pt', textAlign: 'center', borderBottom: `0.5pt solid ${C.borderSoft}`, color: C.text }}>{fmt2(getQt(ligne))}</td>
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
                      <td style={{ padding: '8px 14px', textAlign: 'left',  background: C.rowAlt, color: C.text }}>TVA</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', background: C.rowAlt, color: C.text, fontWeight: 700 }}>{fmt2(totalTva)} DH</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '12px 14px', textAlign: 'left',  background: C.accent, color: '#fff', fontWeight: 700, fontSize: '11pt', letterSpacing: 0.5, textTransform: 'uppercase' }}>Total TTC</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', background: C.accent, color: '#fff', fontWeight: 800, fontSize: '11pt' }}>{fmt2(totalTtc)} DH</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Closing courtesy text + conditions */}
              <div style={{
                marginTop: 18,
                padding: '12px 16px',
                background: C.rowAlt,
                fontSize: '9pt',
                lineHeight: 1.55,
                color: C.text,
              }}>
                <p style={{ margin: 0, fontStyle: 'italic', color: C.muted, textAlign: 'center' }}>
                  Nous sommes à votre disposition pour tout renseignement complémentaire et vous remercions de votre confiance.
                </p>
                {(conditionsPaiement || dateValidite !== '-') && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.borderSoft}` }}>
                    {conditionsPaiement && (
                      <div><strong style={{ color: C.title }}>Conditions de règlement:</strong> {conditionsPaiement}</div>
                    )}
                    {dateValidite !== '-' && (
                      <div style={{ marginTop: 2 }}>
                        <strong style={{ color: C.title }}>Validité de l'offre:</strong> {dateValidite}
                      </div>
                    )}
                  </div>
                )}
              </div>

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
                    Signature du Vendeur
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ borderTop: `1px solid ${C.title}`, width: 180, marginBottom: 6, marginLeft: 'auto' }} />
                  <div style={{ fontSize: '9pt', color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Signature du Client
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

DevisDocument.displayName = 'DevisDocument'
