import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSelector } from '@/components/layout/LanguageSelector'

/**
 * Shared chrome for every authentication-related page (login, forgot
 * password, check email, reset password). Centralises:
 *
 *   • the soft radial emerald gradient background
 *   • the fixed-right LanguageSelector (locked to the physical right
 *     corner in every language — see the wrapper's `dir="ltr"` below)
 *   • the bottom copyright line
 *
 * Keeping this in one place means every auth screen stays visually in
 * sync; touching the brand colour, padding, or footer only requires
 * editing this file.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()

  return (
    <div
      className="min-h-screen flex flex-col mx-4"
      style={{ background: 'radial-gradient(ellipse at center, #fef2f2 0%, #ffffff 70%)' }}
    >
      {/* Language selector — pinned to the PHYSICAL top-right in every
          language. `dir="ltr"` on the wrapper keeps the internal dropdown
          panel anchored to the trigger's right edge in RTL too, so it
          always grows leftward into the viewport. See LoginPage for the
          long-form explanation of this trick. */}
      <div dir="ltr" className="fixed top-4 right-4 sm:top-6 sm:right-6 lg:top-8 lg:right-8 z-50">
        <LanguageSelector />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-[0_20px_50px_rgba(8,112,184,0.07)] p-8 md:p-10">
          {children}
        </div>
      </div>

      <p className="pb-6 text-center text-xs text-slate-400 font-light">
        {t('auth.footer_copyright', { year: new Date().getFullYear() })}
      </p>
    </div>
  )
}

/**
 * Reusable circular emerald icon shown at the top of every auth card.
 * Accepts any lucide-react icon as a child via a `render` prop so each
 * page can convey its own intent (mail icon for "check email", key icon
 * for "reset password", etc.) while inheriting the same visual weight.
 */
export function AuthHero({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode
  title: string
  subtitle: string
}) {
  return (
    <div className="flex flex-col items-center text-center mb-8">
      <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 shadow-[0_4px_12px_rgba(209,58,46,0.3)] mb-4">
        {icon}
      </div>
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-500 mt-1 max-w-xs">{subtitle}</p>
    </div>
  )
}
