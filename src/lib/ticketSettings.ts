/**
 * Ticket settings — local persistence + types
 * ─────────────────────────────────────────────────────────────────────
 * Settings the user can customise for the printed cash-register ticket
 * (used by VentesPassagers). Persisted in localStorage under
 * `pg_ticket_settings` — same per-device strategy as `pg_theme`.
 *
 * Why localStorage and not the `parametres` Supabase row?
 *   • These are presentation preferences, not legal/fiscal data.
 *   • Tickets are printed locally per terminal — different shops on the
 *     same account may want different ticket looks (front-desk vs.
 *     stockroom printer). Per-device fits that mental model.
 *   • Zero migration cost.
 *
 * If you later want cloud-sync, add corresponding columns to the
 * `parametres` table and wrap `readTicketSettings` to fall back to the
 * remote value when localStorage is empty.
 */

/**
 * Font tokens for the ticket body.
 *
 * Each value maps to a concrete font-family stack in `fontToFamily()`.
 * The list intentionally favours fonts that are pre-installed on every
 * desktop OS so the printed ticket renders identically across machines
 * without webfont loading delays.
 *
 *   • monospace — the till-roll classic, fixed-width columns
 *   • arial     — clean, universally readable sans
 *   • segoe     — modern Windows default; falls back to system UI
 *   • tahoma    — compact sans, ideal for narrow thermal paper
 *   • verdana   — bold, generously spaced — easy to read at a glance
 *   • sans      — generic sans fallback (kept for backwards compat)
 *   • serif     — classic serif (kept for backwards compat)
 */
export type TicketFont =
  | 'monospace'
  | 'arial'
  | 'segoe'
  | 'tahoma'
  | 'verdana'
  | 'sans'
  | 'serif'
export type TicketSize = 'small' | 'medium' | 'large'
export type TicketWeight = 'normal' | 'bold'

export interface TicketSettings {
  /** Big centred title at the top of the ticket — usually the trading name. */
  storeName: string
  /** Single-line tagline rendered immediately under the store name. */
  subtitle: string
  /** Phone number printed in the header block. */
  phone: string
  /** Postal / street address printed in the header block. */
  address: string
  /** Free-text farewell message at the bottom (above the QR/barcode area). */
  footer: string
  /** Font family — monospace is the till-roll default. */
  font: TicketFont
  /** Body font size — affects every line uniformly. */
  size: TicketSize
  /** Text weight — `bold` for high-visibility receipts on faded thermal paper. */
  weight: TicketWeight
  /** Optional logo data-URL (base64) shown above the store name. */
  logoUrl: string
}

const STORAGE_KEY = 'pg_ticket_settings'

/** Sensible defaults shown the first time the user opens the dialog. */
export const DEFAULT_TICKET_SETTINGS: TicketSettings = {
  storeName: 'SmartGestion',
  subtitle:  'Automobile',
  phone:     '06xxxxxxxxx',
  address:   'SmartGestion Address',
  footer:    'Merci de votre visite !',
  font:      'monospace',
  size:      'large',
  weight:    'bold',
  logoUrl:   '',
}

/**
 * Read the saved settings, merging with defaults so missing fields don't
 * crash older clients. Returns the defaults verbatim if nothing's saved.
 */
export function readTicketSettings(): TicketSettings {
  if (typeof window === 'undefined') return DEFAULT_TICKET_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_TICKET_SETTINGS
    const parsed = JSON.parse(raw) as Partial<TicketSettings>
    // Spread over defaults to gracefully add new fields in future versions.
    return { ...DEFAULT_TICKET_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_TICKET_SETTINGS
  }
}

/** Persist the full settings object. */
export function writeTicketSettings(s: TicketSettings): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* quota / private mode — silently no-op */
  }
}

/**
 * Resolve the size token to a concrete CSS `font-size` for the ticket body.
 * Sizes are deliberately chunky — receipts are thermal-printed at low DPI
 * and shoppers read them at arm's length.
 */
export function sizeToPx(size: TicketSize): number {
  switch (size) {
    case 'small':  return 11
    case 'medium': return 12
    case 'large':  return 14
  }
}

/**
 * Resolve the font token to a concrete CSS `font-family` stack.
 *
 * Each stack lists the primary face first and progressively safer
 * fallbacks afterwards, so even on a machine that doesn't ship the
 * preferred face the ticket still renders in a sensible alternative
 * from the same family (e.g. Segoe UI → system-ui → sans-serif).
 */
export function fontToFamily(font: TicketFont): string {
  switch (font) {
    case 'monospace': return "'Courier New', 'Consolas', 'Menlo', monospace"
    case 'arial':     return "'Arial', 'Helvetica', sans-serif"
    case 'segoe':     return "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', sans-serif"
    case 'tahoma':    return "'Tahoma', 'Geneva', 'Verdana', sans-serif"
    case 'verdana':   return "'Verdana', 'Geneva', 'Tahoma', sans-serif"
    case 'sans':      return "'Helvetica', 'Arial', sans-serif"
    case 'serif':     return "'Georgia', 'Times New Roman', serif"
  }
}
