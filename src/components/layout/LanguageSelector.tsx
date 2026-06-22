import type { FC, PropsWithChildren } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'

// ─── Premium inline SVG flags ─────────────────────────────────────────────────
// Inline SVGs render crisp at any size, are theme-independent, and avoid the
// notorious Windows emoji-flag fallback bug (where 🇫🇷 renders as "FR" letters).
// Each flag is a self-contained component with overflow-clipped rounded edges,
// a subtle inner border (ring) for definition, and a soft shadow for depth.

type FlagProps = { className?: string }

const FlagWrapper: FC<PropsWithChildren<FlagProps>> = ({ children, className }) => (
  <span
    className={cn(
      'relative inline-flex shrink-0 overflow-hidden rounded-[4px]',
      'ring-1 ring-black/10 dark:ring-white/15',
      'shadow-[0_1px_2px_rgba(0,0,0,0.08)]',
      // subtle inner highlight on top edge for a "glass" look
      'after:absolute after:inset-x-0 after:top-0 after:h-1/2',
      'after:bg-gradient-to-b after:from-white/15 after:to-transparent after:pointer-events-none',
      className,
    )}
  >
    {children}
  </span>
)

// French flag — vertical tricolour (blue / white / red)
const FlagFR: FC<FlagProps> = ({ className }) => (
  <FlagWrapper className={className}>
    <svg viewBox="0 0 3 2" className="h-full w-full block" preserveAspectRatio="none" aria-hidden="true">
      <rect width="1" height="2" x="0" fill="#0055A4" />
      <rect width="1" height="2" x="1" fill="#FFFFFF" />
      <rect width="1" height="2" x="2" fill="#EF4135" />
    </svg>
  </FlagWrapper>
)

// US flag — simplified but recognisable (13 stripes + canton with star pattern)
const FlagUS: FC<FlagProps> = ({ className }) => (
  <FlagWrapper className={className}>
    <svg viewBox="0 0 19 10" className="h-full w-full block" preserveAspectRatio="none" aria-hidden="true">
      <rect width="19" height="10" fill="#B22234" />
      {/* white stripes (rows 1, 3, 5, 7, 9) */}
      {[1, 3, 5, 7, 9].map((y) => (
        <rect key={y} y={y - 0.231} width="19" height="0.769" fill="#FFFFFF" />
      ))}
      {/* canton */}
      <rect width="7.6" height="5.385" fill="#3C3B6E" />
      {/* simplified star grid (9 rows alternating 6/5 stars; we render a 5x4 grid as a stylised approximation) */}
      <g fill="#FFFFFF">
        {Array.from({ length: 4 }).map((_, row) =>
          Array.from({ length: row % 2 === 0 ? 6 : 5 }).map((_, col) => {
            const x = (col + (row % 2 === 0 ? 0.5 : 1)) * 1.15
            const y = 0.6 + row * 1.2
            return <circle key={`${row}-${col}`} cx={x} cy={y} r="0.32" />
          }),
        )}
      </g>
    </svg>
  </FlagWrapper>
)

// Moroccan flag (used for Arabic locale) — red field with green pentagram
const FlagMA: FC<FlagProps> = ({ className }) => (
  <FlagWrapper className={className}>
    <svg viewBox="0 0 30 20" className="h-full w-full block" preserveAspectRatio="none" aria-hidden="true">
      <rect width="30" height="20" fill="#C1272D" />
      {/* Green pentagram (outline only, as on the real flag) */}
      <path
        d="M15 6.5l1.176 3.618h3.804l-3.078 2.236 1.176 3.618L15 13.736l-3.078 2.236 1.176-3.618-3.078-2.236h3.804z"
        fill="none"
        stroke="#006233"
        strokeWidth="0.55"
        strokeLinejoin="miter"
      />
    </svg>
  </FlagWrapper>
)

// ─── Language registry ───────────────────────────────────────────────────────

const languages = [
  { code: 'fr', Flag: FlagFR, label: 'FR', name: 'Français' },
  { code: 'en', Flag: FlagUS, label: 'EN', name: 'English'  },
  { code: 'ar', Flag: FlagMA, label: 'AR', name: 'العربية'  },
] as const

// ─── Component ───────────────────────────────────────────────────────────────

export function LanguageSelector() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const currentLang = i18n.language?.startsWith('ar') ? 'ar'
    : i18n.language?.startsWith('en') ? 'en'
    : 'fr'
  const current = languages.find(l => l.code === currentLang) || languages[0]
  const CurrentFlag = current.Flag

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code)
    localStorage.setItem('pg_language', code)
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr'
    setOpen(false)
  }

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Escape key to close
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      {/* ── Trigger button ──────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Language: ${current.name}`}
        className={cn(
          'group relative flex items-center gap-2.5 ps-2 pe-2.5 py-1.5 cursor-pointer',
          'rounded-[10px] border transition-all duration-200',
          // base state
          'bg-white dark:bg-[#0F172A]',
          'border-slate-200 dark:border-white/8',
          'shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.3)]',
          // hover state
          'hover:border-slate-300 dark:hover:border-white/15',
          'hover:shadow-[0_2px_8px_rgba(15,23,42,0.06)] dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.4)]',
          // open state
          open && [
            'bg-slate-50 dark:bg-slate-800/40',
            'border-slate-300 dark:border-white/15',
            'shadow-[0_2px_12px_rgba(15,23,42,0.08)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.5)]',
          ],
        )}
      >
        <CurrentFlag className="h-4 w-5" />
        <span className="text-xs font-bold tracking-[0.04em] text-slate-700 dark:text-slate-100 uppercase tabular-nums">
          {current.label}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-slate-400 dark:text-slate-500',
            'transition-transform duration-200 ease-out',
            open && 'rotate-180 text-slate-600 dark:text-slate-300',
          )}
        />
      </button>

      {/* ── Dropdown panel ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,   scale: 1    }}
            exit={{    opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            role="listbox"
            aria-label="Select language"
            className={cn(
              // RTL-aware positioning: end-0 anchors to the logical end (right in LTR, left in RTL)
              'absolute end-0 top-full mt-2 z-50 min-w-[200px]',
              'rounded-xl border overflow-hidden',
              'bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-xl',
              'border-slate-200 dark:border-white/10',
              'shadow-[0_8px_32px_rgba(15,23,42,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]',
              // subtle ring for crispness on light bg
              'ring-1 ring-black/[0.02] dark:ring-white/5',
            )}
          >
            {/* Header label */}
            <div className="px-3 pt-2.5 pb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">
                Language / Langue
              </span>
            </div>

            <div className="px-1 pb-1">
              {languages.map((lang) => {
                const isActive = currentLang === lang.code
                const Flag = lang.Flag
                return (
                  <button
                    key={lang.code}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleSelect(lang.code)}
                    className={cn(
                      'group w-full flex items-center gap-3 px-2.5 py-2 rounded-[8px]',
                      'text-sm transition-all duration-150 cursor-pointer',
                      'text-slate-700 dark:text-slate-200',
                      // hover
                      'hover:bg-slate-100/80 dark:hover:bg-slate-800/60',
                      // active
                      isActive && [
                        'bg-emerald-50/60 dark:bg-emerald-500/10',
                        'text-slate-900 dark:text-white',
                      ],
                    )}
                  >
                    <Flag className="h-5 w-7 transition-transform duration-200 group-hover:scale-105" />
                    <div className="flex flex-col items-start min-w-0 flex-1 text-start">
                      <span className="text-[13px] font-semibold leading-tight">
                        {lang.name}
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500 leading-tight mt-0.5">
                        {lang.label}
                      </span>
                    </div>
                    {isActive && (
                      <motion.span
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="ms-auto flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500/15 dark:bg-emerald-500/25 shrink-0"
                      >
                        <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                      </motion.span>
                    )}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
