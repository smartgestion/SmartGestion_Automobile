import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bell, BellOff, CheckCheck, Clock, AlertTriangle, X } from 'lucide-react'
import { useNotifications, Notification } from '@/contexts/NotificationsContext'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

const typeConfig: Record<string, { icon: typeof Bell; bg: string; dot: string }> = {
  warning: { icon: AlertTriangle, bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',   dot: 'bg-amber-500'   },
  error:   { icon: X,             bg: 'bg-red-500/10 border-red-500/20 text-red-400',         dot: 'bg-red-500'     },
  success: { icon: CheckCheck,    bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', dot: 'bg-emerald-500' },
  info:    { icon: Bell,          bg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',      dot: 'bg-blue-500'    },
}

function getTypeIcon(type: Notification['type']) {
  return typeConfig[type]?.icon || Bell
}

// ─── Locale-aware date helpers ───────────────────────────────────────────────

const localeMap: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  ar: 'ar-MA',
}

function resolveBcp47(lang: string | undefined): string {
  if (!lang) return 'fr-FR'
  if (lang.startsWith('ar')) return localeMap.ar
  if (lang.startsWith('en')) return localeMap.en
  return localeMap.fr
}

// ─── Relative time label (i18n) ──────────────────────────────────────────────

function TimeAgo({ date }: { date: string }) {
  const { t, i18n } = useTranslation()
  const [label, setLabel] = useState('')

  useEffect(() => {
    const update = () => {
      const now = Date.now()
      const then = new Date(date).getTime()
      const diff = now - then
      const mins  = Math.floor(diff / 60000)
      const hours = Math.floor(diff / 3600000)
      const days  = Math.floor(diff / 86400000)

      if (mins < 1)       setLabel(t('notifications.time.just_now'))
      else if (mins < 60) setLabel(t('notifications.time.minutes_ago', { count: mins }))
      else if (hours < 24)setLabel(t('notifications.time.hours_ago',   { count: hours }))
      else if (days < 7)  setLabel(t('notifications.time.days_ago',    { count: days }))
      else setLabel(
        new Date(date).toLocaleDateString(resolveBcp47(i18n.language), {
          day: 'numeric',
          month: 'short',
        })
      )
    }

    update()
    const interval = setInterval(update, 30000)
    return () => clearInterval(interval)
  }, [date, t, i18n.language])

  return <span className="text-xs text-muted-foreground">{label}</span>
}

interface NotificationDropdownProps {
  open: boolean
  onClose: () => void
  enabled: boolean
}

export function NotificationDropdown({ open, onClose, enabled }: NotificationDropdownProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications()
  const { t, i18n } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const isRTL = i18n.language?.startsWith('ar')

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const hasHighPriority = notifications.some(n => !n.is_read && (n.type === 'error' || n.type === 'warning'))

  // ─── Subtitle resolver (i18n-aware pluralization) ───────────────────────────
  let subtitle: string
  if (!enabled) {
    subtitle = t('notifications.disabled_short')
  } else if (unreadCount > 0) {
    subtitle = unreadCount === 1
      ? t('notifications.unread_one',   { count: unreadCount })
      : t('notifications.unread_other', { count: unreadCount })
  } else {
    subtitle = t('notifications.all_caught_up')
  }

  // ─── Footer count (i18n-aware pluralization) ────────────────────────────────
  const footerLabel = notifications.length === 1
    ? t('notifications.footer_count_one',   { count: notifications.length })
    : t('notifications.footer_count_other', { count: notifications.length })

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={ref}
        // RTL Note: end-0 (logical) anchors to the correct edge in LTR and RTL.
        className={cn(
          'absolute end-0 top-full mt-2 z-50 w-[420px] max-w-[calc(100vw-2rem)] animate-scale-in',
          isRTL ? 'origin-top-left' : 'origin-top-right',
        )}
      >
        <div className="bg-popover rounded-[12px] shadow-xl border border-border overflow-hidden">
          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Bell className={cn(
                  'h-5 w-5 transition-colors',
                  enabled ? 'text-popover-foreground' : 'text-muted-foreground',
                )} />
                {enabled && unreadCount > 0 && (
                  <span className={cn(
                    // RTL Note: -end-1.5 anchors the badge to the logical end of the bell.
                    'absolute -top-1.5 -end-1.5 min-w-[18px] h-[18px] px-1 rounded-full ring-2 ring-popover',
                    'flex items-center justify-center text-[10px] leading-none font-bold tabular-nums text-white',
                    hasHighPriority ? 'bg-red-500' : 'bg-emerald-500',
                  )} dir="ltr">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-popover-foreground">
                  {t('notifications.title')}
                </h3>
                <p className="text-[10px] text-muted-foreground font-medium">
                  {subtitle}
                </p>
              </div>
            </div>
            {enabled && unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-2.5 py-1.5 rounded-[6px] transition-colors flex items-center gap-1.5"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t('notifications.mark_all_read')}
              </button>
            )}
          </div>

          {/* ── List ────────────────────────────────────────────────────── */}
          <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
            {!enabled ? (
              <div className="p-8 text-center">
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <BellOff className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-popover-foreground">
                  {t('notifications.disabled_title')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('notifications.disabled_subtitle')}
                </p>
              </div>
            ) : loading ? (
              <div className="p-8 text-center">
                <div className="flex justify-center mb-3">
                  <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('notifications.loading')}
                </p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Bell className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-popover-foreground">
                  {t('notifications.empty_title')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('notifications.empty_subtitle')}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((n) => {
                  const config = typeConfig[n.type] || typeConfig.info
                  const Icon = getTypeIcon(n.type)
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        'px-5 py-3.5 transition-colors relative group',
                        !n.is_read ? 'bg-muted' : 'hover:bg-muted/50',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'mt-0.5 h-8 w-8 rounded-[10px] border-border border flex items-center justify-center shrink-0',
                          config.bg,
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn(
                              'text-sm leading-snug',
                              !n.is_read ? 'font-bold text-popover-foreground' : 'text-muted-foreground',
                            )}>
                              {n.title}
                            </p>
                            {!n.is_read && (
                              <span className={cn(
                                'mt-1 h-2 w-2 rounded-full shrink-0',
                                config.dot,
                              )} />
                            )}
                          </div>
                          {n.message && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                            <TimeAgo date={n.created_at} />
                            {!n.is_read && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  markAsRead(n.id)
                                }}
                                // RTL Note: ms-auto = margin-inline-start auto pushes to logical end
                                className="ms-auto text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity relative z-20"
                              >
                                {t('notifications.mark_one_read')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {n.link && (
                        <Link
                          to={n.link}
                          onClick={() => markAsRead(n.id)}
                          className="absolute inset-0 z-10"
                          aria-label={n.title}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          {enabled && notifications.length > 0 && (
            <div className="px-5 py-3 border-t border-border bg-muted/50">
              <p className="text-[10px] text-muted-foreground font-medium text-center">
                {footerLabel}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Bell Button ─────────────────────────────────────────────────────────────

export function NotificationBell() {
  const { t } = useTranslation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('notifications-enabled') !== 'false'
  })
  const { unreadCount, notifications, refreshNotifications } = useNotifications()
  const bellRef = useRef<HTMLButtonElement>(null)

  const hasHighPriority = notifications.some(n => !n.is_read && (n.type === 'error' || n.type === 'warning'))

  useEffect(() => {
    function handleToggle(e: Event) {
      const detail = (e as CustomEvent).detail
      setNotificationsEnabled(detail.enabled)
      if (detail.enabled) {
        refreshNotifications()
      }
    }
    window.addEventListener('notifications-toggle', handleToggle)
    return () => window.removeEventListener('notifications-toggle', handleToggle)
  }, [refreshNotifications])

  // ─── Accessible label (i18n) ──────────────────────────────────────────────
  const ariaLabel = !notificationsEnabled
    ? t('notifications.disabled_aria')
    : unreadCount > 0
      ? t('notifications.aria_with_count', { count: unreadCount })
      : t('notifications.aria_no_count')

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={() => {
          setDropdownOpen(!dropdownOpen)
          if (!dropdownOpen && notificationsEnabled) refreshNotifications()
        }}
        className={cn(
          'relative p-2 rounded-[10px] transition-all duration-200',
          dropdownOpen
            ? 'bg-emerald-500/10 text-emerald-400'
            : notificationsEnabled
              ? 'hover:bg-muted text-muted-foreground hover:text-popover-foreground'
              : 'text-muted-foreground/50 hover:text-muted-foreground cursor-pointer',
        )}
        aria-label={ariaLabel}
      >
        {notificationsEnabled ? (
          <Bell className="h-5 w-5" />
        ) : (
          <BellOff className="h-5 w-5" />
        )}
        {notificationsEnabled && unreadCount > 0 && (
          <>
            {hasHighPriority && (
              // RTL Note: -end-1 = logical end (right in LTR, left in RTL)
              <span className="absolute -top-1 -end-1 h-5 w-5 animate-ping rounded-full bg-red-400 opacity-50" />
            )}
            <span className={cn(
              'absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full',
              'ring-2 ring-white shadow-sm shadow-black/20',
              'flex items-center justify-center text-[10px] leading-none font-bold tabular-nums text-white',
              hasHighPriority ? 'bg-red-500' : 'bg-emerald-500',
            )} dir="ltr">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </>
        )}
      </button>

      <NotificationDropdown
        open={dropdownOpen}
        onClose={() => setDropdownOpen(false)}
        enabled={notificationsEnabled}
      />
    </div>
  )
}
