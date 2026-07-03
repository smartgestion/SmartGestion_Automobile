import { useState, useEffect, useRef, useCallback } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { NotificationBell } from './NotificationDropdown'
import { LanguageSelector } from './LanguageSelector'
import { TvaCalculator } from './TvaCalculator'
import { Menu, ChevronDown, Settings, LogOut, Maximize2, Minimize2, Calculator } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationsContext'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

const routeMeta: Record<string, { titleKey: string; subtitleKey: string }> = {
  '/':                { titleKey: 'navigation.workspace',      subtitleKey: 'header.subtitles.workspace'      },
  '/dashboard':       { titleKey: 'navigation.dashboard',      subtitleKey: 'header.subtitles.dashboard'      },
  '/factures':        { titleKey: 'navigation.invoices',       subtitleKey: 'header.subtitles.invoices'       },
  '/devis':           { titleKey: 'navigation.quotes',         subtitleKey: 'header.subtitles.quotes'         },
  '/ventes-passagers':{ titleKey: 'navigation.counter_sales',  subtitleKey: 'header.subtitles.counter_sales'  },
  '/avoirs':          { titleKey: 'navigation.credit_notes',   subtitleKey: 'header.subtitles.credit_notes'   },
  '/bons-livraison':  { titleKey: 'navigation.delivery_notes', subtitleKey: 'header.subtitles.delivery_notes' },
  '/bons-livraison-client': { titleKey: 'navigation.delivery_notes_client', subtitleKey: 'header.subtitles.delivery_notes_client' },
  '/bons-commande':   { titleKey: 'navigation.purchase_orders',subtitleKey: 'header.subtitles.purchase_orders'},
  '/depenses':        { titleKey: 'navigation.expenses',       subtitleKey: 'header.subtitles.expenses'       },
  '/avoirs-fournisseur': { titleKey: 'navigation.supplier_credit_notes', subtitleKey: 'header.subtitles.supplier_credit_notes' },
  '/clients':         { titleKey: 'navigation.clients',        subtitleKey: 'header.subtitles.clients'        },
  '/fournisseurs':    { titleKey: 'navigation.suppliers',      subtitleKey: 'header.subtitles.suppliers'      },
  '/produits':        { titleKey: 'navigation.products',       subtitleKey: 'header.subtitles.products'       },
  '/parametres':      { titleKey: 'navigation.settings',       subtitleKey: 'header.subtitles.settings'       },
  '/transactions':    { titleKey: 'navigation.transactions',   subtitleKey: 'header.subtitles.transactions'   },
  '/portefeuille':    { titleKey: 'navigation.portefeuille',   subtitleKey: 'header.subtitles.portefeuille'   },
};

export function DashboardLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Keep the fullscreen toggle icon in sync with the actual browser state
  // (covers the user pressing Esc or F11 directly).
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { t, i18n } = useTranslation();

  const currentRoute = routeMeta[location.pathname] || { titleKey: 'app.name', subtitleKey: '' };
  const routeTitle = t(currentRoute.titleKey);
  const subtitle = currentRoute.subtitleKey ? t(currentRoute.subtitleKey) : '';

  const userInitial = user?.email?.charAt(0)?.toUpperCase() || 'P';
  const displayName = user?.email?.split('@')[0] || 'SmartGestion';
  const { unreadCount, notifications } = useNotifications();

  const currentLang = i18n.language?.startsWith('ar') ? 'ar' : i18n.language?.startsWith('en') ? 'en' : 'fr';

  const hasHighPriority = notifications.some(n => !n.is_read && (n.type === 'error' || n.type === 'warning'));

  const handleLogout = useCallback(async () => {
    setProfileDropdownOpen(false);
    await signOut();
    navigate('/login');
  }, [signOut, navigate]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileDropdownOpen]);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (hasHighPriority && unreadCount > 0) {
      document.title = `Action requise - SmartGestion`;
    } else if (unreadCount > 0) {
      document.title = `(${unreadCount}) SmartGestion`;
    } else {
      document.title = 'SmartGestion';
    }
  }, [hasHighPriority, unreadCount]);

  return (
    <div dir={currentLang === 'ar' ? 'rtl' : 'ltr'} className="flex h-screen overflow-hidden bg-white dark:bg-[#0F172A]">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Header — responsive layout
           ─────────────────────────────────────────────────────────────
           Mobile (<lg): the mobile menu trigger lives INSIDE the header
           on the leading edge so it doesn't overlap content. We use
           logical `start/end` so RTL flips correctly. The right cluster
           drops its name/role text and divider on small screens to keep
           the row compact. Subtitle wraps to two lines and remains
           readable on phones. */}
        <header className="bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-white/10 px-3 sm:px-4 lg:px-8 py-3 sm:py-4 shrink-0">
          <div className="flex items-center justify-between gap-2 sm:gap-4 lg:gap-6">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              {/* In-flow mobile menu trigger (replaces the previous fixed-position one). */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileOpen(true)}
                aria-label="Open menu"
                className="lg:hidden h-9 w-9 shrink-0 -ms-1 rounded-[6px] text-foreground hover:bg-muted"
              >
                <Menu className="h-5 w-5" />
              </Button>

              <div className="min-w-0">
                <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-foreground tracking-tight truncate">
                  {routeTitle}
                </h1>
                <p className="text-[11px] sm:text-xs lg:text-sm text-muted-foreground mt-0.5 truncate">
                  {subtitle && <span className="hidden sm:inline">{subtitle} - </span>}
                  <span className="text-[#0EA5E9] font-medium">{t('header.system_active')}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 shrink-0">
              {/* On the smallest screens we hide the language selector to
                  keep room for the bell + avatar. It's still reachable via
                  /parametres. From sm up everything is shown. */}
              <div className="hidden sm:block">
                <LanguageSelector />
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                onClick={toggleFullscreen}
                title={isFullscreen ? t('header.fullscreen_exit') : t('header.fullscreen_enter')}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-9 w-9 text-muted-foreground hover:text-foreground',
                  calculatorOpen && 'bg-emerald-500/10 text-emerald-500 hover:text-emerald-500',
                )}
                onClick={() => setCalculatorOpen((o) => !o)}
                title={t('calculator.title')}
                aria-label={t('calculator.title')}
              >
                <Calculator className="h-4 w-4" />
              </Button>

              <NotificationBell />

              <div className="hidden lg:block w-px h-8 bg-border" />

              <div className="relative" ref={profileRef}>
                <div
                  className="flex items-center gap-2 lg:gap-3 cursor-pointer group"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                >
                  <div className="text-end hidden lg:block">
                    <p className="text-sm font-semibold text-foreground transition-colors">
                      {displayName}
                    </p>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('header.administrator')}
                    </p>
                  </div>
                  <Avatar className="h-9 w-9 border-2 border-primary/30 group-hover:border-primary/60 transition-colors">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} />
                    <AvatarFallback className={cn(
                      "bg-primary/10 text-primary font-bold text-sm dark:text-primary",
                      "group-hover:bg-primary/20 dark:group-hover:bg-primary/30 transition-colors"
                    )}>
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground group-hover:text-foreground transition-all duration-200 hidden lg:block",
                    profileDropdownOpen && "rotate-180"
                  )} />
                </div>

                {profileDropdownOpen && (
                  /* `end-0` is RTL-aware: anchors to the right in LTR, left in RTL. */
                  <div className="absolute end-0 top-full mt-2 z-50 w-52 bg-popover border border-border rounded-[4px] shadow-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-semibold text-popover-foreground truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>

                    <div className="py-1">
                      {/* Mobile-only entry to switch language since the selector
                          is hidden in the header below sm. We just navigate to
                          settings where the locale picker also lives. */}
                      <button
                        onClick={() => { setProfileDropdownOpen(false); navigate('/parametres'); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-popover-foreground hover:bg-muted transition-colors"
                      >
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        {t('header.settings')}
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        {t('header.logout')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main content — `min-w-0` on the wrapper above prevents wide
            children (tables, charts) from forcing the whole flex column
            wider than the viewport and pushing the layout horizontally. */}
        <main className="flex-1 h-full overflow-y-auto overscroll-none p-3 sm:p-4 lg:p-8 bg-white dark:bg-[#0F172A]">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Floating Quick TVA calculator — stays open while working. */}
      <TvaCalculator open={calculatorOpen} onClose={() => setCalculatorOpen(false)} />
    </div>
  );
}
