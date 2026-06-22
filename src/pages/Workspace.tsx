import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import {
  Plus, FileText, Users, Package, CheckCircle2, TrendingUp,
  Trash2, ShoppingCart, Box, CreditCard, Bell,
  DollarSign, AlertTriangle, Target, ChevronRight, TrendingDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from 'react-i18next'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Task {
  id: string | number;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
}

type StockStatus = 'rupture' | 'critique' | 'faible' | 'moyen' | 'stable';

interface InventoryItem {
  id: string;
  name: string;
  reference: string;
  stockActuel: number;
  stockMin: number;
  unite: string;
  status: StockStatus;
  percentage: number;
}

// ─── Stock Config ─────────────────────────────────────────────────────────────
// Labels are now resolved dynamically via t() at render time; only styling here.

const stockStyleConfig: Record<StockStatus, { barColor: string; badgeClass: string }> = {
  rupture:  { barColor: 'bg-[#B84A59]',   badgeClass: 'bg-[#B84A59]/10 text-[#C63C4E] border-[#B84A59]/20 dark:text-[#E2828F]' },
  critique: { barColor: 'bg-[#B84A59]',   badgeClass: 'bg-[#B84A59]/10 text-[#C63C4E] border-[#B84A59]/20 dark:text-[#E2828F]' },
  faible:   { barColor: 'bg-amber-500',   badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  moyen:    { barColor: 'bg-blue-500',    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  stable:   { barColor: 'bg-[#0EA5E9]',   badgeClass: 'bg-[#0EA5E9]/10 text-[#0EA5E9] border-[#0EA5E9]/20' },
};

function getStockInfo(actuel: number, min: number): { status: StockStatus; percentage: number } {
  if (actuel <= 0) return { status: 'rupture', percentage: 0 };
  const max = Math.max(min * 3, 1);
  const pct = Math.min(100, Math.round((actuel / max) * 100));
  if (actuel <= min)        return { status: 'critique', percentage: pct };
  if (actuel <= min * 1.5)  return { status: 'faible',   percentage: pct };
  if (actuel <= min * 2.5)  return { status: 'moyen',    percentage: pct };
  return { status: 'stable', percentage: pct };
}

// ─── Quick Action & AI Reco configs (labels resolved via t() at render time) ──

type QuickActionKey = 'invoice' | 'quote' | 'order' | 'delivery' | 'expense' | 'customer';

const quickActionDefs: Array<{
  key: QuickActionKey;
  icon: React.ElementType;
  href: string;
  iconBg: string;
  iconColor: string;
}> = [
  { key: 'invoice',  icon: FileText,     href: '/factures',       iconBg: 'bg-blue-500/10 dark:bg-blue-500/20',    iconColor: 'text-blue-600 dark:text-blue-400' },
  { key: 'quote',    icon: TrendingUp,   href: '/devis',          iconBg: 'bg-violet-500/10 dark:bg-violet-500/20', iconColor: 'text-violet-600 dark:text-violet-400' },
  { key: 'order',    icon: ShoppingCart, href: '/bons-commande',  iconBg: 'bg-amber-500/10 dark:bg-amber-500/20',  iconColor: 'text-amber-600 dark:text-amber-400' },
  { key: 'delivery', icon: Box,          href: '/bons-livraison', iconBg: 'bg-[#0EA5E9]/10 dark:bg-[#0EA5E9]/20', iconColor: 'text-[#0EA5E9] dark:text-[#0EA5E9]' },
  { key: 'expense',  icon: CreditCard,   href: '/depenses',       iconBg: 'bg-rose-500/10 dark:bg-rose-500/20',   iconColor: 'text-rose-600 dark:text-rose-400' },
  { key: 'customer', icon: Users,        href: '/clients',        iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/20', iconColor: 'text-indigo-600 dark:text-indigo-400' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function Workspace() {
  const { t, i18n } = useTranslation()

  // Derive direction from live language for sub-component layout decisions
  const isRTL = i18n.language?.startsWith('ar')

  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const { user } = useAuth();

  const [stats, setStats] = useState({
    invoiced: 0,
    pending: 0,
    clients: 0,
    products: 0,
    monthlyGrowth: 12.5,
  });
  const [changeStats, setChangeStats] = useState({
    invoicedChange: 0,
    invoicedPositive: true,
    clientsChange: 0,
    productsChange: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedRange, setSelectedRange] = useState('6m');
  const [isLoading, setIsLoading] = useState(true);
  const [newClients, setNewClients] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('notifications-enabled') !== 'false';
  });

  // ─── Month name map (i18n-aware) ───────────────────────────────────────────
  // Used to build chart data labels; re-evaluated when language changes.
  const monthNames = [
    t('workspace.chart.months.jan'),
    t('workspace.chart.months.feb'),
    t('workspace.chart.months.mar'),
    t('workspace.chart.months.apr'),
    t('workspace.chart.months.may'),
    t('workspace.chart.months.jun'),
    t('workspace.chart.months.jul'),
    t('workspace.chart.months.aug'),
    t('workspace.chart.months.sep'),
    t('workspace.chart.months.oct'),
    t('workspace.chart.months.nov'),
    t('workspace.chart.months.dec'),
  ];

  // ─── Notification toggle ───────────────────────────────────────────────────
  const handleToggleNotifications = (checked: boolean) => {
    setNotificationsEnabled(checked);
    localStorage.setItem('notifications-enabled', String(checked));
    window.dispatchEvent(new CustomEvent('notifications-toggle', { detail: { enabled: checked } }));
    toast.success(checked
      ? t('workspace.tasks.notifications_on')
      : t('workspace.tasks.notifications_off')
    );
  };

  // ─── Data fetching ─────────────────────────────────────────────────────────
  const fetchData = async () => {
    if (!user?.id) return;
    try {
      setIsLoading(true);

      const [factRes, vpRes, depRes, prodRes, cliRes] = await Promise.all([
        supabase.from('factures').select('*').eq('user_id', user.id),
        supabase.from('ventes_passagers').select('*').eq('user_id', user.id),
        supabase.from('depenses').select('*').eq('user_id', user.id),
        supabase.from('produits').select('*').eq('user_id', user.id),
        supabase.from('clients').select('*').eq('user_id', user.id),
      ]);

      const factures  = (factRes.data  || []);
      const vp        = (vpRes.data    || []);
      const depenses  = (depRes.data   || []);
      const produits  = (prodRes.data  || []);
      const clients   = (cliRes.data   || []);

      const facturesValides = factures.filter((f: any) =>
        ['pay\u00E9e', 'reste_a_payer'].includes(f.statut)
      );
      const totalRevenue  = vp.reduce((sum: number, v: any) => sum + Number(v.montant_ttc || 0), 0)
        + facturesValides.reduce((sum: number, f: any) => sum + Number(f.montant_ttc || 0), 0);

      const monthsToShow = selectedRange === '1m' ? 1 : selectedRange === '1y' ? 12 : 6;
      const chartDataCalc: any[] = [];

      // BC statuses that count toward expense totals. Rule:
      //   brouillon / en_attente / envoyé / annulé / refusé → excluded
      //   confirmé + livré / livrée                          → included
      // Stock effects are still gated to livré only (handled elsewhere).
      const { data: bonsCommande } = await supabase.from('bons_commande').select('*').in('statut', ['confirm\u00E9', 'livr\u00E9', 'livr\u00E9e']);

      for (let i = monthsToShow - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const month = d.getMonth();
        const year  = d.getFullYear();

        const monthRevenue = [
          ...facturesValides.filter((f: any) => new Date(f.date_emission).getMonth() === month && new Date(f.date_emission).getFullYear() === year),
          ...vp.filter((v: any) => new Date(v.date).getMonth() === month && new Date(v.date).getFullYear() === year),
        ].reduce((s: number, f: any) => s + Number(f.montant_ttc || 0), 0);

        const monthExpense = [
          ...depenses.filter((dep: any) =>
            new Date(dep.date_depense).getMonth() === month && new Date(dep.date_depense).getFullYear() === year
          ),
          ...(bonsCommande || []).filter((bc: any) =>
            new Date(bc.date_commande).getMonth() === month && new Date(bc.date_commande).getFullYear() === year
          ),
        ].reduce((s: number, entry: any) => s + Number(entry.montant_ttc || 0), 0);

        chartDataCalc.push({
          name: monthNames[month],
          revenue: monthRevenue,
          expenses: monthExpense,
        });
      }

      const periodRevenue  = chartDataCalc.reduce((sum, m) => sum + m.revenue, 0);
      const revenueGrowth  = chartDataCalc.length >= 2
        ? ((chartDataCalc[chartDataCalc.length - 1].revenue - chartDataCalc[chartDataCalc.length - 2].revenue)
           / (chartDataCalc[chartDataCalc.length - 2].revenue || 1)) * 100
        : 0;

      const invoicedPrev = chartDataCalc.length >= 2 ? chartDataCalc[chartDataCalc.length - 2].revenue : 0;
      const invoicedCurr = chartDataCalc.length >= 1 ? chartDataCalc[chartDataCalc.length - 1].revenue : 0;

      setStats({
        invoiced: periodRevenue,
        pending: factures.filter((f: any) => f.statut === 'en_attente' || f.statut === 'reste_a_payer').length,
        clients: clients.length,
        products: produits.length,
        monthlyGrowth: revenueGrowth,
      });

      setChangeStats({
        invoicedChange: invoicedPrev > 0 ? ((invoicedCurr - invoicedPrev) / invoicedPrev) * 100 : 0,
        invoicedPositive: invoicedCurr >= invoicedPrev,
        clientsChange: 0,
        productsChange: 0,
      });

      setChartData(chartDataCalc);

      const invItems: InventoryItem[] = (produits || []).map((p: any) => {
        const info = getStockInfo(Number(p.stock_actuel) || 0, Number(p.stock_min) || 1);
        return {
          id: p.id,
          name: p.nom || p.designation || '',
          reference: p.reference || '',
          stockActuel: Number(p.stock_actuel) || 0,
          stockMin: Number(p.stock_min) || 1,
          unite: p.unite || 'pcs',
          ...info,
        };
      }).sort((a, b) => a.percentage - b.percentage).slice(0, 6);

      setInventoryItems(invItems);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentClients = clients.filter((c: any) => {
        const d = c.created_at || c.date_creation;
        return d && new Date(d) >= thirtyDaysAgo;
      });
      setNewClients(recentClients.length);
    } catch (error) {
      console.error('Error fetching workspace data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Load saved tasks on mount ─────────────────────────────────────────────
  const fetchTasks = async () => {
    try {
      const { data: tasksData } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
      setTasks(tasksData || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    fetchData();
    fetchTasks();
  }, [user, selectedRange, i18n.language]); // re-fetch when language changes to get translated month names

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('workspace-changes')
      .on('postgres_changes', { event: '*', schema: 'public', filter: `user_id=eq.${user.id}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedRange]);

  // ─── Tasks ─────────────────────────────────────────────────────────────────
  const addTask = async () => {
    if (!newTask.trim()) return;
    try {
      const { error } = await supabase.from('tasks').insert([{ title: newTask, completed: false, priority: 'medium' }]);
      if (error) throw error;
      const { data: tasksData } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
      setTasks(tasksData || []);
      setNewTask('');
      toast.success(t('workspace.tasks.task_added'));
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error(t('workspace.tasks.error_add'));
    }
  };

  const toggleTask = async (id: string | number) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    try {
      await supabase.from('tasks').update({ completed: !task.completed }).eq('id', id);
      setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    } catch (error) {
      console.error('Error toggling task:', error);
      toast.error(t('workspace.tasks.error_update'));
    }
  };

  const deleteTask = async (id: string | number) => {
    try {
      await supabase.from('tasks').delete().eq('id', id);
      setTasks(tasks.filter(t => t.id !== id));
      toast.info(t('workspace.tasks.task_deleted'));
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error(t('workspace.tasks.error_delete'));
    }
  };

  // ─── Resolved quick actions ───────────────────────────────────────────────
  const quickActions = quickActionDefs.map(({ key, icon, href, iconBg, iconColor }) => ({
    icon,
    href,
    iconBg,
    iconColor,
    label: t(`workspace.quick_actions.${key}`),
  }));

  // ─── Stock status label (via t) ────────────────────────────────────────────
  const stockStatusLabel = (status: StockStatus) => t(`workspace.stock_table.status_${status}`);

  // ─── Chart subtitle ────────────────────────────────────────────────────────
  const chartSubtitle =
    selectedRange === '1m' ? t('workspace.chart.subtitle_1m') :
    selectedRange === '1y' ? t('workspace.chart.subtitle_1y') :
    t('workspace.chart.subtitle_6m');

  // ─── Custom chart tooltip ─────────────────────────────────────────────────
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="rounded-[8px] border p-4"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          // Tooltips should always be LTR-oriented for number readability
          dir="ltr"
        >
          <p className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>{label}</p>
          {payload.map((entry: any, idx: number) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: entry.color }} />
              <span style={{ color: 'var(--muted-foreground)' }}>
                {entry.name === 'revenue'
                  ? t('workspace.chart.tooltip_revenue')
                  : t('workspace.chart.tooltip_expenses')}:
              </span>
              <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="space-y-4 sm:space-y-6 pb-6 sm:pb-8 animate-in fade-in duration-500"
      /*
       * RTL Note: `dir` is already set on <html> by DashboardLayout / App.tsx.
       * We set it here too so this component is self-contained and correct even
       * when rendered in isolation (tests, Storybook, etc.).
       */
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* ── Main 12-col Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">

        {/* ── Left / Start Column (7 cols) ─────────────────────────────────
         *  RTL Note: CSS Grid column flow reverses automatically with dir=rtl.
         *  `lg:col-span-7` will correctly appear on the RIGHT side in Arabic.
         *  `min-w-0` prevents wide tables/charts inside from forcing the
         *  column wider than its grid track on small screens.
         */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-6 min-w-0">

          {/* Performance Chart */}
          <Card className="shadow-none hover:shadow-none rounded-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2 flex-wrap">
              {/*
               * RTL Note: `flex-row` items auto-reverse in RTL via dir attribute.
               * ms-auto (margin-inline-start) keeps the Tabs at the logical end.
               * On mobile, flex-wrap lets the range tabs drop to a new line so
               * they aren't crammed next to the title.
               */}
              <div className="min-w-0">
                <CardTitle className="text-sm sm:text-base font-semibold text-card-foreground">
                  {t('workspace.chart.title')}
                </CardTitle>
                <CardDescription className="text-[11px] sm:text-xs mt-0.5">
                  {chartSubtitle}
                </CardDescription>
              </div>
              <Tabs value={selectedRange} onValueChange={setSelectedRange} className="ms-auto">
                <TabsList className="bg-muted dark:bg-white/5 rounded-[4px] p-0.5">
                  <TabsTrigger value="1m" className="text-xs px-2 sm:px-3 py-1.5 data-[state=active]:bg-card rounded-[4px]">
                    {t('workspace.chart.filter_1m')}
                  </TabsTrigger>
                  <TabsTrigger value="6m" className="text-xs px-2 sm:px-3 py-1.5 data-[state=active]:bg-card rounded-[4px]">
                    {t('workspace.chart.filter_6m')}
                  </TabsTrigger>
                  <TabsTrigger value="1y" className="text-xs px-2 sm:px-3 py-1.5 data-[state=active]:bg-card rounded-[4px]">
                    {t('workspace.chart.filter_1y')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className={cn("h-[240px] sm:h-[280px] lg:h-[300px] pt-4 transition-opacity duration-300", isLoading && "opacity-40")}>
              {/*
               * RTL Note: Recharts itself doesn't natively support RTL axis mirroring.
               * We keep the chart container dir=ltr so axes and data flow are correct.
               * The surrounding UI text already inherits RTL from the parent dir.
               */}
              <div dir="ltr">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      dx={-4}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                    <Area
                      type="monotone" dataKey="revenue" stroke="#0EA5E9" strokeWidth={2.5}
                      fillOpacity={1} fill="url(#revenueGrad)" dot={false}
                      activeDot={{ r: 5, fill: '#0EA5E9', stroke: 'white', strokeWidth: 2 }}
                    />
                    <Area
                      type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2}
                      fillOpacity={1} fill="url(#expenseGrad)" dot={false}
                      activeDot={{ r: 4, fill: '#ef4444', stroke: 'white', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Priority Inventory Table */}
          <Card className="shadow-none hover:shadow-none rounded-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-card-foreground">
                    {t('workspace.stock_table.title')}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {t('workspace.stock_table.subtitle')}
                  </CardDescription>
                </div>
                {/*
                 * RTL Note: ms-auto pushes button to logical end (right in LTR, left in RTL).
                 * ChevronRight flip: in RTL arrow pointing ← means "forward"; Tailwind's
                 * `rtl:rotate-180` handles this transparently.
                 */}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 bg-transparent border border-white/20 text-white hover:bg-white/10 rounded-sm transition-all duration-200 ms-auto"
                  onClick={() => window.location.href = '/produits'}
                >
                  {t('workspace.stock_table.view_all')}
                  <ChevronRight className="h-3 w-3 ms-1 rtl:rotate-180" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Horizontal scroll wrapper: keeps the table layout on small
                  screens (rather than collapsing to cards) while letting users
                  swipe to see the secondary columns. */}
              <div className="overflow-x-auto">
              <Table className="min-w-[480px]">
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs font-medium text-card-foreground h-9 px-3 sm:px-5">
                      {t('workspace.stock_table.col_product')}
                    </TableHead>
                    <TableHead className="text-xs font-medium text-card-foreground h-9">
                      {t('workspace.stock_table.col_reference')}
                    </TableHead>
                    <TableHead className="text-xs font-medium text-card-foreground h-9">
                      {t('workspace.stock_table.col_stock')}
                    </TableHead>
                    <TableHead className="text-xs font-medium text-card-foreground h-9 hidden md:table-cell">
                      {t('workspace.stock_table.col_level')}
                    </TableHead>
                    {/*
                     * RTL Note: `text-end` (logical) aligns to the correct edge
                     * in both LTR and RTL, unlike `text-right` which is physical.
                     */}
                    <TableHead className="text-xs font-medium text-card-foreground h-9 text-end pe-5">
                      {t('workspace.stock_table.col_status')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-card-foreground/60 text-sm">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-30 text-card-foreground" />
                        {t('workspace.stock_table.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    inventoryItems.slice(0, 4).map((item) => {
                      const cfg = stockStyleConfig[item.status];
                      return (
                        <TableRow key={item.id} className="border-border">
                          <TableCell className="py-3.5 px-5">
                            <p className="text-sm font-medium text-card-foreground">{item.name}</p>
                            <p className="text-xs text-card-foreground/70 mt-0.5" dir="ltr">
                              {item.stockActuel} / {Math.max(item.stockMin * 3, 1)} {t('workspace.stock_table.unit')}
                            </p>
                          </TableCell>
                          <TableCell className="py-3.5">
                            <span className="text-xs text-card-foreground/70 font-mono" dir="ltr">
                              {item.reference || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="py-3.5">
                            <div className="flex items-center gap-2" dir="ltr">
                              <span className={cn(
                                "text-sm font-semibold",
                                item.status === 'rupture' || item.status === 'critique' ? 'text-red-400' :
                                item.status === 'faible' ? 'text-amber-400' : 'text-card-foreground'
                              )}>
                                {item.stockActuel}
                              </span>
                              <span className="text-xs text-card-foreground/70">{item.unite}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3.5 hidden md:table-cell">
                            <div className="w-28">
                              {/*
                               * RTL Note: Progress bar fill direction.
                               * We keep dir=ltr on this element so the bar always
                               * fills left-to-right visually (conventional for progress).
                               */}
                              <div className="h-1.5 rounded-full bg-muted dark:bg-white/10 overflow-hidden" dir="ltr">
                                <div
                                  className={cn("h-full rounded-full transition-all duration-500", cfg.barColor)}
                                  style={{ width: `${item.percentage}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3.5 text-end pe-5">
                            <span className={cn(
                              "inline-block text-xs font-semibold px-2 py-0.5 rounded-[4px] border",
                              cfg.badgeClass
                            )}>
                              {stockStatusLabel(item.status)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-[8px] bg-card p-4 border border-border flex items-center gap-3">
              <div className="h-10 w-10 rounded-[8px] bg-violet-500/10 text-violet-400 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('workspace.summary.pending_invoices')}</p>
                <p className="text-lg font-bold text-card-foreground" dir="ltr">{stats.pending}</p>
              </div>
            </div>
            <div className="rounded-[8px] bg-card p-4 border border-border flex items-center gap-3">
              <div className="h-10 w-10 rounded-[8px] bg-[#0EA5E9]/10 text-[#0EA5E9] flex items-center justify-center shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('workspace.summary.new_clients')}</p>
                <p className="text-lg font-bold text-card-foreground" dir="ltr">{newClients}</p>
              </div>
            </div>
            {/* col-span-2 sm:col-span-1: on the 2-col mobile grid this stat
                spans the full width so we don't get a lonely card on its own
                second row. On tablets+ we revert to a normal cell. */}
            <div className="col-span-2 sm:col-span-1 rounded-[8px] bg-card p-4 border border-border flex items-center gap-3">
              <div className="h-10 w-10 rounded-[8px] bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('workspace.summary.stock_alerts')}</p>
                <p className="text-lg font-bold text-card-foreground" dir="ltr">
                  {inventoryItems.filter(i => i.status === 'critique' || i.status === 'rupture').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right / End Column (5 cols) ──────────────────────────────────── */}
        <div className="lg:col-span-5 space-y-4 sm:space-y-6 min-w-0">

          {/* Quick Actions */}
          <Card className="shadow-none hover:shadow-none rounded-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-card-foreground">
                {t('workspace.quick_actions.section_title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => window.location.href = action.href}
                  className="flex flex-col items-center justify-center p-4 rounded-sm border border-border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className={cn("p-2.5 rounded-sm mb-3", action.iconBg)}>
                    <action.icon className={cn("w-5 h-5", action.iconColor)} />
                  </div>
                  <span className="text-xs font-medium text-foreground text-center">{action.label}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Task Manager */}
          <Card className="shadow-none hover:shadow-none rounded-[8px] overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-card-foreground">
                  {t('workspace.tasks.section_title')}
                </CardTitle>
                <Badge className="bg-[#B84A59] hover:bg-[#B84A59] text-white text-[10px] font-semibold px-2 py-0.5 rounded-[4px]">
                  {tasks.filter(t => !t.completed).length}
                </Badge>
              </div>
              {/*
               * RTL Note: Input and button use flex-row which mirrors in RTL.
               * The plus button appears on the LEFT in Arabic (logical end of input).
               */}
              <div className="flex gap-2 mt-3">
                <Input
                  placeholder={t('workspace.tasks.input_placeholder')}
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTask()}
                  className="focus-visible:ring-[#B84A59]/30 h-9 text-sm rounded-[4px]"
                />
                <Button
                  size="icon"
                  onClick={addTask}
                  className="bg-[#B84A59] hover:bg-[#C63C4E] shrink-0 h-9 w-9 rounded-[4px]"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[320px] overflow-y-auto">
                <AnimatePresence initial={false}>
                  {tasks.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground/60">
                      <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-20 text-muted-foreground" />
                      <p className="text-sm">{t('workspace.tasks.empty_state')}</p>
                    </div>
                  ) : (
                    tasks.map((task) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: isRTL ? -20 : 20 }}
                        className={cn(
                          "group flex items-center justify-between px-5 py-3 border-b border-border last:border-0",
                          task.completed ? "bg-muted" : ""
                        )}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <button
                            onClick={() => toggleTask(task.id)}
                            className={cn(
                              "h-5 w-5 rounded-[4px] border-2 flex items-center justify-center transition-all shrink-0",
                              task.completed
                                ? "bg-[#0EA5E9] border-[#0EA5E9] text-white"
                                : "border-border"
                            )}
                          >
                            {task.completed && <CheckCircle2 className="h-3 w-3" />}
                          </button>
                          <span className={cn(
                            "text-sm font-medium truncate transition-all",
                            task.completed ? "text-muted-foreground line-through" : "text-card-foreground"
                          )}>
                            {task.title}
                          </span>
                        </div>
                        {/*
                         * RTL Note: opacity-0 group-hover:opacity-100 with ms-auto
                         * ensures the delete button is always at the logical end.
                         */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 ms-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0 rounded-[4px]"
                          onClick={() => deleteTask(task.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>

          {/* ────────────────────────────────────────────────────────────────
            * Notification Toggle Card — RTL-aware layout
            *
            * Structure (works identically in LTR and RTL because every spacing
            * primitive used here is "logical"):
            *
            *   ┌──────────────────────────────────────────────────────────────┐
            *   │  [icon]  Title              ............................  [⏻] │   LTR
            *   │          Subtitle                                            │
            *   └──────────────────────────────────────────────────────────────┘
            *
            *   ┌──────────────────────────────────────────────────────────────┐
            *   │ [⏻]  ............................            Title  [icon]   │   RTL
            *   │                                            Subtitle          │
            *   └──────────────────────────────────────────────────────────────┘
            *
            * Key Tailwind primitives:
            *   - `flex` + `justify-between`  → naturally mirrors with dir=rtl
            *   - `gap-3` / `gap-4`           → direction-agnostic spacing (no `space-x-*` needed)
            *   - `text-start`                → logical text alignment (left in LTR, right in RTL)
            *   - `min-w-0` on text wrapper   → allows long Arabic words to truncate cleanly
            *   - NO `ml-*` / `mr-*` / `left-*` / `right-*` / `space-x-reverse`
            */}
          <div
            className={cn(
              "rounded-sm border p-4 transition-colors duration-200",
              // Flex row — auto-reverses under dir=rtl. justify-between guarantees
              // the icon-group and the switch always sit at OPPOSITE edges of the card.
              "flex flex-row items-center justify-between gap-4",
              notificationsEnabled
                ? "bg-[#0EA5E9]/10 border-[#0EA5E9]/20"
                : "bg-muted border-border",
            )}
          >
            {/* ── Icon + Text group (logical start edge) ───────────────── */}
            <div className="flex flex-row items-center gap-3 min-w-0 flex-1">
              <div
                className={cn(
                  "h-9 w-9 rounded-[8px] flex items-center justify-center shrink-0 transition-colors duration-200",
                  notificationsEnabled ? "bg-[#0EA5E9]/15" : "bg-muted",
                )}
              >
                <Bell
                  className={cn(
                    "h-4.5 w-4.5 transition-colors duration-200",
                    notificationsEnabled ? "text-[#0EA5E9]" : "text-muted-foreground",
                  )}
                />
              </div>

              {/*
               * Text block:
               *   - `text-start` is the logical equivalent of `text-left` in LTR
               *     and `text-right` in RTL — flips automatically.
               *   - `min-w-0` lets the parent flex item shrink so the switch
               *     never gets pushed off-screen by a long Arabic label.
               */}
              <div className="flex flex-col text-start min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium transition-colors duration-200 leading-tight",
                    notificationsEnabled ? "text-card-foreground" : "text-muted-foreground",
                  )}
                >
                  {t('workspace.tasks.notifications_active')}
                </p>
                <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                  {t('workspace.tasks.notifications_subtitle')}
                </p>
              </div>
            </div>

            {/*
             * Switch — sits at the logical end edge thanks to `justify-between`.
             * `shrink-0` prevents Radix's flex sibling from squashing it.
             * No margin utilities needed; the parent's gap-4 + justify-between
             * handles spacing in both directions cleanly.
             *
             * Note: switch.tsx was updated to mirror the thumb transform under
             * `dir=rtl` so the toggle animation reads correctly in Arabic.
             */}
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={handleToggleNotifications}
              className={cn(
                "shrink-0",
                "data-[state=checked]:bg-[#0EA5E9] data-[state=unchecked]:bg-muted",
                "data-[state=unchecked]:border-[#0EA5E9]/40 dark:data-[state=unchecked]:border-[#0EA5E9]/40",
              )}
              thumbClassName="data-[state=checked]:bg-white data-[state=unchecked]:bg-[#0EA5E9] dark:data-[state=unchecked]:bg-[#0EA5E9]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
