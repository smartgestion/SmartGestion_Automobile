import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import writtenNumber from 'written-number'
import { format } from 'date-fns'
import { fr, enUS, ar as arLocale, type Locale } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return "0,00 DH";
  }
  
  return new Intl.NumberFormat('fr-MA', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount)) + ' DH';
}

/**
 * Locale-aware currency formatter.
 *
 * All three supported locales use the Moroccan dirham (MAD / DH) as the
 * primary currency.  The only thing that changes per locale is:
 *   - The decimal / grouping separator convention
 *   - Whether the currency symbol sits before or after the number
 *
 * | Locale | Example output      |
 * |--------|---------------------|
 * | fr     | 1 234,56 DH         |
 * | en     | DH 1,234.56         |
 * | ar     | ١٬٢٣٤٫٥٦ درهم  (eastern-arabic numerals, suffix symbol) |
 *
 * Using `style: 'decimal'` + manual prefix/suffix gives us full control
 * regardless of how the browser's Intl implementation handles MAD.
 */
export function formatCurrencyLocale(
  amount: number | string | null | undefined,
  locale: string,
): string {
  const n = Number(amount);
  if (amount === null || amount === undefined || isNaN(n)) {
    return locale.startsWith('ar') ? '٠٫٠٠ درهم' : locale.startsWith('en') ? 'DH 0.00' : '0,00 DH';
  }

  if (locale.startsWith('ar')) {
    // Arabic: eastern-arabic numerals, suffix symbol, Arabic decimal separator
    const formatted = new Intl.NumberFormat('ar-MA', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
    return `${formatted} درهم`;
  }

  if (locale.startsWith('en')) {
    // English: western numerals, period decimal, prefix symbol
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
    return `DH ${formatted}`;
  }

  // French (default): western numerals, comma decimal, suffix DH
  const formatted = new Intl.NumberFormat('fr-MA', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${formatted} DH`;
}

/**
 * Returns the date-fns Locale object that matches the active i18n language.
 *
 * Usage:
 *   import { getDateLocale, formatDate } from '@/lib/utils'
 *   const locale = getDateLocale(i18n.language)
 *   formatDate(someDate, 'dd MMM yyyy', i18n.language) // → "١٥ يناير ٢٠٢٥" in AR
 */
export function getDateLocale(lang: string | undefined): Locale {
  if (!lang) return fr
  if (lang.startsWith('ar')) return arLocale
  if (lang.startsWith('en')) return enUS
  return fr
}

/**
 * Locale-aware date formatter built on top of date-fns `format()`.
 *
 * @param date   - Any value accepted by `new Date()` (string, number, Date)
 * @param fmt    - date-fns format string, e.g. 'dd MMM yyyy'
 * @param lang   - i18n language code from `i18n.language` ('fr' | 'en' | 'ar')
 * @returns      Formatted string in the target language/script, or '-' on error
 *
 * Example outputs for the same date (2025-01-15):
 *   FR → "15 janv. 2025"
 *   EN → "Jan 15, 2025"   (format 'MMM dd, yyyy')
 *   AR → "١٥ يناير ٢٠٢٥"
 */
export function formatDate(
  date: string | number | Date | null | undefined,
  fmt: string,
  lang: string | undefined,
): string {
  if (!date) return '-'
  try {
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return '-'
    return format(d, fmt, { locale: getDateLocale(lang) })
  } catch {
    return '-'
  }
}

export function numberToFrenchWords(amount: number): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "";
  
  writtenNumber.defaults.lang = 'fr';
  
  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);
  
  let result = writtenNumber(integerPart);
  
  if (decimalPart > 0) {
    result += ` dirhams et ${writtenNumber(decimalPart)} centimes`;
  } else {
    result += ` dirhams`;
  }
  
  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
}
