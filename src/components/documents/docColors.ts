/**
 * Shared colour palette for printable documents (Facture, Devis, Bon de
 * Commande, Bon de Livraison, Avoir).
 *
 * Design goals
 * ─────────────────────────────────────────────────────────────────────
 * The previous PDFs were pure black-on-white with harsh `#000` borders
 * everywhere. That reads as a 1990s scan rather than a modern document.
 * This palette keeps the same neutral feel — the document is still
 * readable when printed in greyscale — but replaces:
 *
 *   • pure `#000` borders   → soft slate `#CBD5E1` / `#E2E8F0`
 *   • pure `#000` headings  → slate-900 `#0F172A`
 *   • muted `#475569` body  → slate-500/600 with better print contrast
 *
 * A single brand accent (`accent`) is introduced for:
 *   • the underline below the items table header
 *   • the bottom border of the meta/info row
 *   • the highlight of the "Total TTC" line in the totals stack
 *
 * The accent colour is now USER-CUSTOMISABLE. It is persisted per-device
 * in localStorage under `pg_doc_accent` (see `readDocAccent` /
 * `writeDocAccent`). `DOC_COLORS.accent` / `.accentStrong` are exposed as
 * getters so every document that reads `C.accent` at render time always
 * picks up the latest chosen colour without any prop-drilling.
 *
 * KEEP THE NON-ACCENT VALUES STABLE — every document file imports from
 * here, so any tweak propagates atomically.
 */

/** localStorage key for the user-chosen document accent colour. */
export const DOC_ACCENT_KEY = 'pg_doc_accent'

/** Factory default accent (bold invoice red) used when nothing is saved. */
export const DEFAULT_DOC_ACCENT = '#E63946'

// Module-level cache of the current accent. Initialised from localStorage
// at module load and refreshed by `writeDocAccent`. Reading from a cached
// variable (rather than localStorage on every getter access) keeps the
// hot render path cheap.
let currentAccent: string = readDocAccentFromStorage()

function readDocAccentFromStorage(): string {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(DOC_ACCENT_KEY) : null
    return v && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v) ? v : DEFAULT_DOC_ACCENT
  } catch {
    return DEFAULT_DOC_ACCENT
  }
}

/** Read the current document accent colour (cached). */
export function readDocAccent(): string {
  return currentAccent
}

/** Persist a new document accent colour and refresh the in-memory cache. */
export function writeDocAccent(hex: string): void {
  const safe = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex) ? hex : DEFAULT_DOC_ACCENT
  currentAccent = safe
  try {
    localStorage.setItem(DOC_ACCENT_KEY, safe)
  } catch {
    /* ignore quota / unavailable storage */
  }
}

export const DOC_COLORS = {
  /** Primary brand accent — user-customisable. Used by the title pill,
   *  the items table header bar, the TOTAL TTC highlight row, and the
   *  thin separator rule above the FACTURÉ À box. */
  get accent(): string {
    return currentAccent
  },
  /** Faint wash for soft accents (currently unused — reserved for
   *  any subtle "callout" cells that need a tinted background). */
  accentSoft:    '#FEE2E2',
  /** Strong accent — mirrors the chosen accent (used where the primary
   *  accent needs to be intensified for contrast). */
  get accentStrong(): string {
    return currentAccent
  },

  /** Document headings (FACTURE, DEVIS, etc.). Softer than pure black. */
  title:         '#0F172A',
  /** Body copy + table cell content. */
  text:          '#1E293B',
  /** Secondary / supplementary text (subtitles, footer, dates). */
  muted:         '#475569',
  /** Tertiary text (page numbers, legal mentions). */
  subtle:        '#64748B',

  /** Strong border — table column dividers, info boxes, totals stack. */
  border:        '#CBD5E1',
  /** Light border — single-row separators inside tables. */
  borderSoft:    '#E2E8F0',
  /** Zebra / alternating row tint (so faint it survives photocopy). */
  rowAlt:        '#F8FAFC',

  /** Watermark text colour (very low opacity). */
  watermark:     'rgba(15, 23, 42, 0.045)',
} as const

export type DocColor = keyof typeof DOC_COLORS
