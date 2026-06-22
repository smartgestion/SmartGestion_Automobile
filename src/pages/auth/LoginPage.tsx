import React, { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { LanguageSelector } from '@/components/layout/LanguageSelector'
import { toast } from 'sonner'
import {
  Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, ShieldCheck, HeartPulse,
} from 'lucide-react'

export function LoginPage() {
  const { t, i18n } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const { user } = useAuth()
  const navigate = useNavigate()

  // The login page is ALWAYS rendered in light mode, regardless of the app's
  // persisted theme (`pg_theme`). We strip the `.dark` class from <html> while
  // this page is mounted and restore the user's preference on unmount so the
  // rest of the app keeps whatever mode they chose.
  useEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains('dark')
    root.classList.remove('dark')
    return () => {
      if (hadDark) root.classList.add('dark')
    }
  }, [])

  if (user) {
    return <Navigate to="/" replace />
  }

  const isRtl = i18n.language?.startsWith('ar')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        // Map the Supabase generic "Invalid login credentials" string to a
        // localized message; surface any other server-side message verbatim
        // (translating arbitrary backend strings is out of scope).
        const msg = error.message === 'Invalid login credentials'
          ? t('auth.toast_invalid')
          : error.message
        toast.error(msg)
        return
      }
      toast.success(t('auth.toast_success'))
      navigate('/')
    } catch {
      toast.error(t('auth.toast_error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col mx-2 sm:mx-4"
      style={{
        background: 'radial-gradient(ellipse at center, #eff6ff 0%, #ffffff 70%)',
      }}
    >
      {/* ── Top-right control (language selector) ─────────────────────────
        Position-fixed to the PHYSICAL top-right corner of the viewport in
        every language (FR/EN/AR). We use `right-*` (not the logical
        `end-*`) because the user wants the control pinned to the screen's
        right edge regardless of the active text direction.

        We also force `dir="ltr"` on this container so the LanguageSelector's
        internal dropdown panel — which anchors with logical `end-0` — opens
        leftward into the viewport in every language. */}
      <div
        dir="ltr"
        className="fixed top-4 right-4 sm:top-6 sm:right-6 lg:top-8 lg:right-8 z-50 flex items-center gap-2"
      >
        <LanguageSelector />
      </div>

      {/* `pt-20 sm:pt-4` reserves headroom on mobile so the fixed top-right
          control (language) never overlaps the login card on short screens.
          From sm up the original centred layout is restored. */}
      <div className="flex-1 flex items-center justify-center p-3 sm:p-4 pt-20 sm:pt-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-[0_20px_50px_rgba(8,112,184,0.07)] p-6 sm:p-8 md:p-10">
          {/* Logo + headline */}
          <div className="flex flex-col items-center text-center mb-8">
            <img
              src="/logo.png"
              alt="SmartGestion"
              className="h-16 w-auto max-w-[180px] object-contain mb-4"
            />
            <h1 className="text-xl font-bold text-slate-900">{t('auth.login_title')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('auth.login_subtitle')}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Field — uses logical start/ps so the icon flips in RTL. */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-slate-500">
                {t('auth.email_label')}
              </Label>
              <div className="relative">
                <Mail className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  // Email addresses are always LTR by convention even on RTL pages.
                  dir="ltr"
                  placeholder={t('auth.email_placeholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="h-11 ps-11 bg-slate-50 border-slate-200 rounded-[4px] focus:bg-white focus:border-[#1d4ed8] focus:ring-0 focus-visible:border-[#1d4ed8] focus-visible:ring-[#1d4ed8]/20 aria-invalid:border-slate-200 aria-invalid:ring-0 shadow-none text-sm text-slate-900 placeholder:text-slate-400 caret-[#1d4ed8] transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-500">
                {t('auth.password_label')}
              </Label>
              <div className="relative">
                <Lock className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  // Passwords are always LTR. Native password masking dots are
                  // direction-neutral, but keeping this explicit prevents any
                  // user-typed mixed-script content from flipping.
                  dir="ltr"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="h-11 ps-11 pe-11 bg-slate-50 border-slate-200 rounded-[4px] focus:bg-white focus:border-[#1d4ed8] focus:ring-0 focus-visible:border-[#1d4ed8] focus-visible:ring-[#1d4ed8]/20 aria-invalid:border-slate-200 aria-invalid:ring-0 shadow-none text-sm text-slate-900 placeholder:text-slate-400 caret-[#1d4ed8] transition-colors [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('auth.password_label') : t('auth.password_label')}
                  className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                className="rounded-[4px] border-slate-300 data-checked:bg-[#1d4ed8] data-checked:border-[#1d4ed8] h-4 w-4"
              />
              <label
                htmlFor="remember"
                className="text-sm text-slate-500 leading-none cursor-pointer select-none"
              >
                {t('auth.remember_me')}
              </label>
            </div>

            {/* Submit Button — ArrowRight is mirrored in RTL so it visually
                points to the "go forward" direction of the active script. */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gradient-to-r from-[#1e40af] to-[#2563eb] hover:from-[#1e3a8a] hover:to-[#1d4ed8] text-white font-semibold rounded-[4px] shadow-[0_4px_14px_rgba(29,78,216,0.4)] hover:shadow-[0_6px_22px_rgba(29,78,216,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t('auth.signing_in')}
                </>
              ) : (
                <>
                  {t('auth.sign_in')}
                  <ArrowRight className={`ms-2 h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
                </>
              )}
            </Button>
          </form>

          {/* Trust badges */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-center gap-8 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#1d4ed8]" />
                {t('auth.badge_secure')}
              </span>
              <span className="flex items-center gap-1.5">
                <HeartPulse className="h-3.5 w-3.5 text-[#1d4ed8]" />
                {t('auth.badge_pharmacy')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="pb-6 text-center text-xs text-slate-400 font-light">
        {t('auth.footer_copyright', { year: new Date().getFullYear() })}
      </p>
    </div>
  )
}
