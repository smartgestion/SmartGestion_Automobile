import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  Tabs,
  TabsContent,
} from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import Cropper from 'react-easy-crop'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { readDocAccent, writeDocAccent, DEFAULT_DOC_ACCENT } from '@/components/documents/docColors'
import { COMPANY_PARAMS_UPDATED_EVENT } from '@/hooks/useCompanyName'
import { 
  Building2, 
  CreditCard, 
  Palette, 
  Save, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  FileText, 
  Hash,
  Landmark,
  CheckCircle2,
  Sun,
  Moon,
  Monitor,
  Upload,
  ImageIcon,
  Check,
  ChevronRight,
  Crop,
  Receipt
} from 'lucide-react';
import { TicketSettingsDialog } from '@/components/parametres/TicketSettingsDialog';

interface ParametresFormValues {
  nomSociete: string;
  adresse: string;
  ville: string;
  codePostal: string;
  telephone: string;
  email: string;
  siteWeb: string;
  ice: string;
  rc: string;
  ifNumber: string;
  tpPatente: string;
  cnss: string;
  capitalSocial: string;
  formeJuridique: string;
  banque: string;
  rib: string;
  swift: string;
  logoUrl: string;
  couleurPrincipale: string;
  conditionsPaiementDefaut: string;
  piedPageDefaut: string;
  activerDroitTimbre: boolean;
  watermarkText: string;
  activerFiligrane: boolean;
}

export function Parametres() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [parametresId, setParametresId] = useState<string | null>(null);
  const [isModified, setIsModified] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const CACHED_PARAMS_KEY = 'pg_cached_params';
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('pg_theme') as 'light' | 'dark' | 'system') || 'light';
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  /** Controls the ticket-customisation modal opened from the Apparence tab.
      Settings are persisted by the dialog itself in localStorage
      (`pg_ticket_settings`) — no extra wiring needed here. */
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  // Document accent colour (Factures / Devis / BC / BL / Avoirs). Persisted
  // per-device in localStorage via docColors helpers — applied immediately.
  const [docAccent, setDocAccent] = useState<string>(() => readDocAccent());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const parametresSchema = z.object({
    nomSociete: z.string().min(2, t('parametres.validation.name_required')),
    adresse: z.string().min(5, t('parametres.validation.address_required')),
    ville: z.string().min(2, t('parametres.validation.city_required')),
    codePostal: z.string().min(4, t('parametres.validation.postal_required')),
    telephone: z.string().min(8, t('parametres.validation.phone_required')),
    email: z.string().email(t('parametres.validation.email_invalid')),
    siteWeb: z.string(),
    ice: z.string(),
    rc: z.string(),
    ifNumber: z.string(),
    tpPatente: z.string(),
    cnss: z.string(),
    capitalSocial: z.string(),
    formeJuridique: z.string(),
    banque: z.string(),
    rib: z.string(),
    swift: z.string(),
    logoUrl: z.string(),
    couleurPrincipale: z.string(),
    conditionsPaiementDefaut: z.string(),
    piedPageDefaut: z.string(),
    activerDroitTimbre: z.boolean(),
    watermarkText: z.string(),
    activerFiligrane: z.boolean(),
  });
  
  const form = useForm<ParametresFormValues>({
    resolver: zodResolver(parametresSchema),
    defaultValues: {
      nomSociete: '',
      adresse: '',
      ville: '',
      codePostal: '',
      telephone: '',
      email: '',
      siteWeb: '',
      ice: '',
      rc: '',
      ifNumber: '',
      tpPatente: '',
      cnss: '',
      capitalSocial: '',
      formeJuridique: '',
      banque: '',
      rib: '',
      swift: '',
      logoUrl: '',
      couleurPrincipale: '#C63C4E',
      conditionsPaiementDefaut: '',
      piedPageDefaut: '',
      activerDroitTimbre: true,
      watermarkText: 'SmartGestion',
      activerFiligrane: true,
    },
  });

  const errors = form.formState.errors;

  const tabErrors = useMemo(() => ({
    general: ['nomSociete', 'adresse', 'ville', 'codePostal', 'telephone', 'email', 'siteWeb', 'formeJuridique', 'capitalSocial'].some(f => errors[f]),
    fiscal: ['ice', 'rc', 'ifNumber', 'tpPatente', 'cnss', 'banque', 'rib', 'swift'].some(f => errors[f]),
    personalisation: ['couleurPrincipale', 'logoUrl', 'conditionsPaiementDefaut', 'piedPageDefaut', 'watermarkText', 'activerFiligrane'].some(f => errors[f]),
  }), [errors]);

  const STORAGE_KEY = 'sf_params_modified';

  useEffect(() => {
    const subscription = form.watch(() => {
      if (!isLoading && !isSavingRef.current) {
        setIsModified(true);
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
      }
    });
    return () => subscription.unsubscribe();
  }, [form, isLoading]);

  useEffect(() => {
    const fetchParametres = async () => {
      if (authLoading) return;
      
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      
      try {
        const cached = localStorage.getItem(CACHED_PARAMS_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            // Coerce boolean fields: older caches may store SQLite 0/1, which
            // would fail z.boolean() validation on save.
            if ('activerDroitTimbre' in parsed) parsed.activerDroitTimbre = Boolean(parsed.activerDroitTimbre);
            if ('activerFiligrane' in parsed) parsed.activerFiligrane = Boolean(parsed.activerFiligrane);
            form.reset(parsed);
          } catch {}
        }
        
        const { data, error } = await supabase
          .from('parametres')
          .select('id,user_id,nom_societe,nom,adresse,ville,code_postale,telephone,email,site_web,ice,rc,if_number,tp_patente,cnss,capital_social,forme_juridique,logo_url,couleur_principale,banque,rib,swift,devise,conditions_paiement_defaut,pied_page_defaut,activer_droit_timbre,activer_filigrane,texte_filigrane,watermark_text,created_at,updated_at')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching parametres:', error);
        }
        
        if (data) {
          setParametresId(data.id);
          const mapped = {
            nomSociete: data.nom_societe || data.nom || '',
            adresse: data.adresse || '',
            ville: data.ville || '',
            codePostal: data.code_postale || '',
            telephone: data.telephone || '',
            email: data.email || '',
            siteWeb: data.site_web || '',
            ice: data.ice || '',
            rc: data.rc || '',
            ifNumber: data.if_number || '',
            tpPatente: data.tp_patente || '',
            cnss: data.cnss || '',
            capitalSocial: data.capital_social || '',
            formeJuridique: data.forme_juridique || '',
            banque: data.banque || '',
            rib: data.rib || '',
            swift: data.swift || '',
            logoUrl: data.logo_url || '',
            couleurPrincipale: data.couleur_principale || '#C63C4E',
            conditionsPaiementDefaut: data.conditions_paiement_defaut || '',
            piedPageDefaut: data.pied_page_defaut || '',
            activerDroitTimbre: data.activer_droit_timbre !== undefined ? Boolean(data.activer_droit_timbre) : true,
            watermarkText: data.watermark_text || data.texte_filigrane || 'SmartGestion',
            activerFiligrane: data.activer_filigrane !== undefined ? Boolean(data.activer_filigrane) : true,
          };
          form.reset(mapped);
          localStorage.setItem(CACHED_PARAMS_KEY, JSON.stringify(mapped));
          setLogoPreview(null);
        }
      } catch (error) {
        console.error('Failed to fetch parametres', error);
        toast.error(t('parametres.toast_load_error'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchParametres();
  }, [form, user, authLoading]);

  useEffect(() => {
    const applyTheme = (mode: 'light' | 'dark' | 'system') => {
      const root = document.documentElement;
      if (mode === 'dark') {
        root.classList.add('dark');
      } else if (mode === 'light') {
        root.classList.remove('dark');
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', prefersDark);
      }
      localStorage.setItem('pg_theme', mode);
    };

    applyTheme(themeMode);

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        document.documentElement.classList.toggle('dark', e.matches);
      };
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [themeMode]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('pg_watermark', JSON.stringify(form.watch('activerFiligrane')));
    }
  }, [form.watch('activerFiligrane'), isLoading]);

  useEffect(() => {
    setLogoError(false);
  }, [form.watch('logoUrl'), logoPreview]);

  const onInvalid = (formErrors: any) => {
    const fieldNames = Object.keys(formErrors)
    const tabs: string[] = []
    if (fieldNames.some(f => ['nomSociete', 'adresse', 'ville', 'codePostal', 'telephone', 'email', 'siteWeb', 'formeJuridique', 'capitalSocial'].includes(f))) tabs.push(t('parametres.tab_info'))
    if (fieldNames.some(f => ['ice', 'rc', 'ifNumber', 'tpPatente', 'cnss', 'banque', 'rib', 'swift'].includes(f))) tabs.push(t('parametres.tab_fiscal'))
    if (fieldNames.some(f => ['couleurPrincipale', 'logoUrl', 'conditionsPaiementDefaut', 'piedPageDefaut', 'watermarkText', 'activerFiligrane'].includes(f))) tabs.push(t('parametres.tab_appearance'))

    const first = tabs[0]
    if (first === t('parametres.tab_info')) setActiveTab('general')
    else if (first === t('parametres.tab_fiscal')) setActiveTab('fiscal')
    else if (first === t('parametres.tab_appearance')) setActiveTab('personalisation')

    toast.error(t('parametres.toast_validation_error', { tabs: tabs.join(', ') }))
  }

  async function onSubmit(data: ParametresFormValues) {
    if (!user?.id) {
      toast.error(t('parametres.toast_must_login'));
      return;
    }
    
    setIsSaving(true);
    isSavingRef.current = true;
    try {
      const fields = {
        user_id: user.id,
        nom_societe: data.nomSociete,
        nom: data.nomSociete,
        adresse: data.adresse,
        ville: data.ville,
        code_postale: data.codePostal,
        telephone: data.telephone,
        email: data.email,
        site_web: data.siteWeb,
        ice: data.ice,
        rc: data.rc,
        if_number: data.ifNumber,
        tp_patente: data.tpPatente,
        cnss: data.cnss,
        capital_social: data.capitalSocial,
        forme_juridique: data.formeJuridique,
        banque: data.banque,
        rib: data.rib,
        swift: data.swift,
        logo_url: data.logoUrl,
        couleur_principale: data.couleurPrincipale,
        conditions_paiement_defaut: data.conditionsPaiementDefaut,
        pied_page_defaut: data.piedPageDefaut,
        activer_droit_timbre: data.activerDroitTimbre,
        activer_filigrane: data.activerFiligrane,
        texte_filigrane: data.watermarkText,
        watermark_text: data.watermarkText,
      };

      localStorage.setItem('pg_watermark', JSON.stringify(data.activerFiligrane));

      console.log('Saving parametres for user:', user.id);
      console.log('Record ID:', parametresId);

      let result, error;
      if (parametresId) {
        const response = await supabase
          .from('parametres')
          .update(fields)
          .eq('id', parametresId)
          .select('id,user_id,nom_societe,nom,adresse,ville,code_postale,telephone,email,site_web,ice,rc,if_number,tp_patente,cnss,capital_social,forme_juridique,logo_url,couleur_principale,banque,rib,swift,devise,conditions_paiement_defaut,pied_page_defaut,activer_droit_timbre,activer_filigrane,texte_filigrane,watermark_text,created_at,updated_at')
          .maybeSingle();
        result = response.data;
        error = response.error;
      } else {
        const response = await supabase
          .from('parametres')
          .insert([{ ...fields, user_id: user.id }])
          .select('id,user_id,nom_societe,nom,adresse,ville,code_postale,telephone,email,site_web,ice,rc,if_number,tp_patente,cnss,capital_social,forme_juridique,logo_url,couleur_principale,banque,rib,swift,devise,conditions_paiement_defaut,pied_page_defaut,activer_droit_timbre,activer_filigrane,texte_filigrane,watermark_text,created_at,updated_at')
          .maybeSingle();
        result = response.data;
        error = response.error;
        if (result) setParametresId(result.id);
      }

      console.log('Save result:', { result, error });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      localStorage.removeItem(STORAGE_KEY);
      setIsModified(false);
      form.reset(data);
      localStorage.setItem(CACHED_PARAMS_KEY, JSON.stringify(data));
      // Notify same-tab listeners (e.g. sidebar BrandLogo) that the company
      // name / settings changed so the styled logo updates immediately.
      window.dispatchEvent(new Event(COMPANY_PARAMS_UPDATED_EVENT));
      toast.success(t('parametres.toast_saved'));
    } catch (err: any) {
      console.error('Error saving parametres:', err);
      toast.error(`${t('parametres.toast_load_error')}: ${err.message || ''}`);
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  }

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const getCroppedImg = useCallback(async (imageSrc: string, pixelCrop: { x: number; y: number; width: number; height: number }): Promise<string> => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageSrc;
    });

    const canvas = document.createElement('canvas');
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(
      image,
      pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
      0, 0, pixelCrop.width, pixelCrop.height
    );

    return canvas.toDataURL('image/png');
  }, []);

  const handleCropConfirm = useCallback(async () => {
    if (!logoPreview || !croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(logoPreview, croppedAreaPixels);
      setLogoPreview(croppedImage);
      form.setValue('logoUrl', croppedImage);
      setCropDialogOpen(false);
    } catch (e) {
      console.error('Crop failed', e);
      toast.error(t('parametres.toast_crop_error'));
    }
  }, [logoPreview, croppedAreaPixels, form, getCroppedImg]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground font-medium">{t('parametres.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500 bg-white dark:bg-[#0F172A]">
      {/* Breadcrumb */}
      <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-500">
        {t('parametres.breadcrumb')}
      </p>

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t('parametres.page_title')}</h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5">
          {t('parametres.page_subtitle')}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">
          {/* Navigation Cards — responsive
              ─────────────────────────────────────────────────────────────
              Mobile (<sm): single column stack, tighter padding, the chevron
              hides since the active state is now visually clear with the
              full-width emphasis.
              Tablet (sm-md): 3 small icon-only buttons in a row (subtitle/title
              hidden) keep the picker compact while content gets more room.
              Desktop (md+): the original 3-column card layout with full text. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
                            className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-5 rounded-2xl border text-start w-full bg-white border-slate-200 dark:bg-[#0F172A] dark:border-white/5 ${
                activeTab === 'general' ? 'ring-2 ring-primary/20 border-primary bg-slate-50 dark:border-primary/50 dark:bg-slate-800/50' : ''
              }`}
            >
              <div className="relative flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-slate-100 dark:bg-slate-800/50 shrink-0">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500 dark:text-blue-400" />
                {tabErrors.general && <span className="absolute top-0 end-0 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-[#0F172A]" />}
              </div>
              {/* On tablets we hide the description block to keep the row
                  compact; mobile and desktop both show full text. */}
              <div className="flex-1 min-w-0 sm:hidden md:block">
                <p className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base">{t('parametres.nav_profile')}</p>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">{t('parametres.nav_profile_sub')}</p>
              </div>
              <ChevronRight className="hidden md:block h-5 w-5 text-slate-300 dark:text-slate-600 shrink-0 rtl:rotate-180" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('fiscal')}
              className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-5 rounded-2xl border text-start w-full bg-white border-slate-200 dark:bg-[#0F172A] dark:border-white/5 ${
                activeTab === 'fiscal' ? 'ring-2 ring-primary/20 border-primary bg-slate-50 dark:border-primary/50 dark:bg-slate-800/50' : ''
              }`}
            >
              <div className="relative flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-slate-100 dark:bg-slate-800/50 shrink-0">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500 dark:text-emerald-400" />
                {tabErrors.fiscal && <span className="absolute top-0 end-0 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-[#0F172A]" />}
              </div>
              <div className="flex-1 min-w-0 sm:hidden md:block">
                <p className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base">{t('parametres.nav_fiscal')}</p>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">{t('parametres.nav_fiscal_sub')}</p>
              </div>
              <ChevronRight className="hidden md:block h-5 w-5 text-slate-300 dark:text-slate-600 shrink-0 rtl:rotate-180" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('personalisation')}
              className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-5 rounded-2xl border text-start w-full bg-white border-slate-200 dark:bg-[#0F172A] dark:border-white/5 ${
                activeTab === 'personalisation' ? 'ring-2 ring-primary/20 border-primary bg-slate-50 dark:border-primary/50 dark:bg-slate-800/50' : ''
              }`}
            >
              <div className="relative flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-slate-100 dark:bg-slate-800/50 shrink-0">
                <Palette className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500 dark:text-purple-400" />
                {tabErrors.personalisation && <span className="absolute top-0 end-0 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-[#0F172A]" />}
              </div>
              <div className="flex-1 min-w-0 sm:hidden md:block">
                <p className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base">{t('parametres.nav_appearance')}</p>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">{t('parametres.nav_appearance_sub')}</p>
              </div>
              <ChevronRight className="hidden md:block h-5 w-5 text-slate-300 dark:text-slate-600 shrink-0 rtl:rotate-180" />
            </button>
          </div>

          {/* Content Area */}
          <div className="p-3 sm:p-4 lg:p-6 rounded-2xl border border-slate-200 bg-white dark:bg-[#0F172A] dark:border-white/5">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsContent value="general" className="mt-0">
              <Card className="border border-slate-100 rounded-2xl dark:bg-[#0F172A] dark:border-white/5">
                <CardHeader className="border-b border-slate-100 px-4 sm:px-6 py-4 sm:py-5 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800/50">
                      <Building2 className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('parametres.general.company_info_title')}</CardTitle>
                      <CardDescription>{t('parametres.general.company_info_sub')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="nomSociete"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.general.company_name')}</FormLabel>
                          <FormControl>
                            <Input className="h-11 bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="formeJuridique"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.general.legal_form')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('parametres.general.legal_form_ph')} className="h-11 bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="capitalSocial"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.general.share_capital')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('parametres.general.capital_ph')} className="h-11 bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.general.email')}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-slate-500" />
                              <Input type="email" className="pl-10 h-11 bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="telephone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.general.phone')}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-slate-500" />
                              <Input className="pl-10 h-11 bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="siteWeb"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.general.website')}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-slate-500" />
                              <Input placeholder={t('parametres.general.website_ph')} className="ps-10 h-11 bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="adresse"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.general.address')}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground dark:text-slate-500" />
                            <Input className="pl-10 h-11 bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="codePostal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.general.postal_code')}</FormLabel>
                          <FormControl>
                            <Input className="h-11 bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ville"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.general.city')}</FormLabel>
                          <FormControl>
                            <Input className="h-11 bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fiscal" className="mt-0 space-y-6">
              <Card className="border border-slate-100 rounded-2xl dark:bg-[#0F172A] dark:border-white/5">
                <CardHeader className="border-b border-slate-100 px-4 sm:px-6 py-4 sm:py-5 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800/50">
                      <FileText className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('parametres.fiscal.ids_title')}</CardTitle>
                      <CardDescription>{t('parametres.fiscal.ids_sub')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="ice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.fiscal.ice')}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-slate-500" />
                              <Input className="pl-10 h-11 bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500 font-mono" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="rc"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.fiscal.rc')}</FormLabel>
                          <FormControl>
                            <Input className="h-11 bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="ifNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.fiscal.if')}</FormLabel>
                          <FormControl>
                            <Input className="h-11 bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500 font-mono" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tpPatente"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.fiscal.tp')}</FormLabel>
                          <FormControl>
                            <Input className="h-11 bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cnss"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.fiscal.cnss')}</FormLabel>
                          <FormControl>
                            <Input className="h-11 bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500 font-mono" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-100 rounded-2xl dark:bg-[#0F172A] dark:border-white/5">
                <CardHeader className="border-b border-slate-100 px-4 sm:px-6 py-4 sm:py-5 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800/50">
                      <Landmark className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('parametres.fiscal.bank_title')}</CardTitle>
                      <CardDescription>{t('parametres.fiscal.bank_sub')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="banque"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.fiscal.bank_name')}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-slate-500" />
                              <Input placeholder={t('parametres.fiscal.bank_name_ph')} className="ps-10 h-11 bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="swift"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.fiscal.swift')}</FormLabel>
                          <FormControl>
                            <Input className="h-11 bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500 font-mono uppercase" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="rib"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.fiscal.rib')}</FormLabel>
                        <FormControl>
                            <Input placeholder={t('parametres.fiscal.rib_ph')} dir="ltr" className="h-11 bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500 font-mono" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="personalisation" className="mt-0 space-y-6">
              <Card className="border border-slate-100 rounded-2xl dark:bg-[#0F172A] dark:border-white/5">
                <CardHeader className="border-b border-slate-100 px-4 sm:px-6 py-4 sm:py-5 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800/50">
                      <Palette className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('parametres.tab_appearance')}</CardTitle>
                      <CardDescription>{t('parametres.appearance.theme_sub')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-8">
                  {/* Theme Selection Cards */}
                  <div className="space-y-3">
                    <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.appearance.theme')}</FormLabel>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Light Mode */}
                      <div
                        onClick={() => setThemeMode('light')}
                        className={`relative cursor-pointer rounded-xl border-2 p-4 ${
                          themeMode === 'light'
                            ? 'border-primary bg-primary/5 dark:bg-primary/10'
                            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/5 dark:bg-[#0F172A] dark:hover:border-white/10'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="h-20 rounded-lg bg-gradient-to-b from-white to-slate-50 border border-slate-200 flex items-center justify-center">
                            <div className="w-full px-3 space-y-1.5">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="h-2 w-2 rounded-full bg-slate-300" />
                                <div className="h-2 w-2 rounded-full bg-slate-300" />
                                <div className="h-2 w-2 rounded-full bg-slate-300" />
                                <div className="ms-auto h-2 w-8 rounded bg-slate-300" />
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-slate-200" />
                              <div className="h-1.5 w-3/4 rounded-full bg-slate-200" />
                              <div className="h-1.5 w-1/2 rounded-full bg-slate-200" />
                              <div className="h-1.5 w-full rounded-full bg-slate-200" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Sun className="h-4 w-4 text-amber-500" />
                              <span className="text-sm font-medium text-foreground dark:text-white">Light Mode</span>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              themeMode === 'light' ? 'border-primary bg-primary' : 'border-slate-300'
                            }`}>
                              {themeMode === 'light' && <Check className="h-3 w-3 text-white" />}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Dark Mode */}
                      <div
                        onClick={() => setThemeMode('dark')}
                        className={`relative cursor-pointer rounded-xl border-2 p-4 ${
                          themeMode === 'dark'
                            ? 'border-primary bg-primary/5 dark:bg-primary/10'
                            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/5 dark:bg-[#0F172A] dark:hover:border-white/10'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="h-20 rounded-lg bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center">
                            <div className="w-full px-3 space-y-1.5">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="h-2 w-2 rounded-full bg-slate-600" />
                                <div className="h-2 w-2 rounded-full bg-slate-600" />
                                <div className="h-2 w-2 rounded-full bg-slate-600" />
                                <div className="ms-auto h-2 w-8 rounded bg-slate-600" />
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-slate-700" />
                              <div className="h-1.5 w-3/4 rounded-full bg-slate-700" />
                              <div className="h-1.5 w-1/2 rounded-full bg-slate-700" />
                              <div className="h-1.5 w-full rounded-full bg-slate-700" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Moon className="h-4 w-4 text-indigo-400" />
                              <span className="text-sm font-medium text-foreground dark:text-white">Dark Mode</span>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              themeMode === 'dark' ? 'border-primary bg-primary' : 'border-slate-300'
                            }`}>
                              {themeMode === 'dark' && <Check className="h-3 w-3 text-white" />}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* System Preferences */}
                      <div
                        onClick={() => setThemeMode('system')}
                        className={`relative cursor-pointer rounded-xl border-2 p-4 ${
                          themeMode === 'system'
                            ? 'border-primary bg-primary/5 dark:bg-primary/10'
                            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/5 dark:bg-[#0F172A] dark:hover:border-white/10'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="h-20 rounded-lg bg-gradient-to-b from-slate-100 to-slate-200 border border-slate-300 flex items-center justify-center">
                            <div className="w-full px-3 space-y-1.5">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="h-2 w-2 rounded-full bg-slate-400" />
                                <div className="h-2 w-2 rounded-full bg-slate-400" />
                                <div className="h-2 w-2 rounded-full bg-slate-400" />
                                <div className="ms-auto flex gap-1">
                                  <div className="h-2 w-2 rounded-full bg-slate-400" />
                                  <div className="h-2 w-2 rounded-full bg-slate-400" />
                                </div>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-slate-300" />
                              <div className="h-1.5 w-3/4 rounded-full bg-slate-300" />
                              <div className="h-1.5 w-1/2 rounded-full bg-slate-300" />
                              <div className="h-1.5 w-full rounded-full bg-slate-300" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Monitor className="h-4 w-4 text-slate-500" />
                              <span className="text-sm font-medium text-foreground dark:text-white">{t('parametres.appearance.system')}</span>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              themeMode === 'system' ? 'border-primary bg-primary' : 'border-slate-300'
                            }`}>
                              {themeMode === 'system' && <Check className="h-3 w-3 text-white" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Logo Management */}
                  <div className="space-y-3">
                    <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.appearance.logo')}</FormLabel>
                    <div className="flex flex-col md:flex-row gap-6">
                      {/* Logo Preview */}
                      <div className="flex-shrink-0">
                        <div className="w-36 h-36 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-center overflow-hidden dark:border-white/5 dark:bg-[#0F172A]/40">
                          {(form.watch('logoUrl') || logoPreview) && !logoError ? (
                            <img
                              src={logoPreview || form.watch('logoUrl')}
                              alt="Logo"
                              className="w-full h-full object-contain p-2"
                              onError={() => setLogoError(true)}
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                              <ImageIcon className="h-10 w-10" />
                              <span className="text-xs font-medium">No Logo</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Upload and Crop Controls */}
                      <div className="flex-1 space-y-4">
                        <div className="flex flex-col gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-10 rounded-xl border-slate-200 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 self-start"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {t('parametres.appearance.change_logo')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!form.watch('logoUrl') && !logoPreview}
                            onClick={() => setCropDialogOpen(true)}
                            className="h-10 rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-emerald-800/50 dark:text-emerald-400 dark:hover:bg-emerald-900/20 dark:disabled:hover:bg-transparent self-start"
                          >
                            <Crop className="h-4 w-4 mr-2" />
                            {t('parametres.appearance.crop_image')}
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  const dataUrl = ev.target?.result as string;
                                  setLogoPreview(dataUrl);
                                  form.setValue('logoUrl', dataUrl);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Document accent colour (Factures / Devis / BC / BL / Avoirs) */}
                  <div className="space-y-3">
                    <div>
                      <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.appearance.doc_color')}</FormLabel>
                      <p className="text-sm text-muted-foreground mt-0.5">{t('parametres.appearance.doc_color_desc')}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      {['#E63946', '#267E54', '#2563EB', '#7C3AED', '#0F766E', '#EA580C', '#0F172A'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => { writeDocAccent(preset); setDocAccent(preset); }}
                          className={`h-9 w-9 rounded-lg border-2 transition-all ${
                            docAccent.toLowerCase() === preset.toLowerCase()
                              ? 'border-foreground scale-110'
                              : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: preset }}
                          aria-label={preset}
                        >
                          {docAccent.toLowerCase() === preset.toLowerCase() && (
                            <Check className="h-4 w-4 text-white mx-auto" />
                          )}
                        </button>
                      ))}
                      <div className="flex items-center gap-2 ms-1">
                        <input
                          type="color"
                          value={docAccent}
                          onChange={(e) => { writeDocAccent(e.target.value); setDocAccent(e.target.value); }}
                          className="h-9 w-9 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent cursor-pointer p-0.5"
                          aria-label={t('parametres.appearance.doc_color_custom')}
                        />
                        <Input
                          value={docAccent}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDocAccent(v);
                            if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v)) writeDocAccent(v);
                          }}
                          className="h-9 w-28 font-mono text-sm dark:bg-[#12141C]/50 dark:border-white/10"
                          dir="ltr"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 text-xs text-muted-foreground"
                          onClick={() => { writeDocAccent(DEFAULT_DOC_ACCENT); setDocAccent(DEFAULT_DOC_ACCENT); }}
                        >
                          {t('parametres.appearance.doc_color_reset')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Crop Dialog */}
              <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{t('parametres.appearance.crop_title')}</DialogTitle>
                  </DialogHeader>
                  <div className="relative w-full h-80 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900">
                    {logoPreview && (
                      <Cropper
                        image={logoPreview}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500 dark:text-slate-400">{t('parametres.appearance.zoom')}</span>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.1}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="flex-1 h-2 rounded-full appearance-none cursor-pointer bg-slate-200 dark:bg-slate-700 accent-emerald-500"
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCropDialogOpen(false)}
                      className="rounded-xl"
                    >
                      {t('shared.actions.cancel')}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleCropConfirm}
                      className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {t('parametres.appearance.confirm_crop')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Card className="border border-slate-100 rounded-2xl dark:bg-[#0F172A] dark:border-white/5">
                <CardHeader className="border-b border-slate-100 px-4 sm:px-6 py-4 sm:py-5 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800/50">
                      <FileText className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('parametres.appearance.doc_content_title')}</CardTitle>
                      <CardDescription>{t('parametres.appearance.doc_content_sub')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <FormField
                    control={form.control}
                    name="conditionsPaiementDefaut"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.appearance.payment_conditions')}</FormLabel>
                        <FormControl>
                            <Input placeholder={t('parametres.appearance.payment_terms_ph')} className="h-11 bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="piedPageDefaut"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold dark:text-slate-300">{t('parametres.appearance.footer')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('parametres.appearance.footer_ph')}
                            className="min-h-[80px] bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="activerFiligrane"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/30 dark:border-white/5 dark:bg-[#0F172A]">
                          <div className="space-y-0.5 flex-1">
                            <FormLabel className="text-base font-semibold cursor-pointer">{t('parametres.appearance.watermark')}</FormLabel>
                            <p className="text-sm text-muted-foreground">
                              {t('parametres.appearance.watermark_desc')}
                            </p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="data-[state=checked]:bg-primary"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="watermarkText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={`text-foreground font-semibold ${!form.watch('activerFiligrane') ? 'text-muted-foreground' : ''}`}>
                            {t('parametres.appearance.watermark_text')}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t('parametres.appearance.watermark_text_ph')}
                              className={`h-11 bg-white border-border/50 focus:border-primary dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500 transition-all ${
                                !form.watch('activerFiligrane') ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              disabled={!form.watch('activerFiligrane')}
                              {...field}
                            />
                          </FormControl>
                          <p className="text-sm text-muted-foreground">{t('parametres.appearance.watermark_hint')}</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* ── Ticket settings card ───────────────────────────────
                   Opens the full TicketSettingsDialog (split-pane modal
                   with a live preview). Settings persist to localStorage
                   (`pg_ticket_settings`) and are picked up automatically
                   by VentesPassagers' print action. */}
              <Card className="border border-slate-100 rounded-2xl dark:bg-[#0F172A] dark:border-white/5">
                <CardHeader className="border-b border-slate-100 px-4 sm:px-6 py-4 sm:py-5 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800/50">
                      <Receipt className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {t('parametres.ticket.trigger_label')}
                      </CardTitle>
                      <CardDescription>
                        {t('parametres.ticket.trigger_description')}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-5 pb-5">
                  <Button
                    type="button"
                    onClick={() => setTicketDialogOpen(true)}
                    className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 px-5 rounded-[6px] shadow-none"
                  >
                    <Receipt className="me-2 h-4 w-4" />
                    {t('parametres.ticket.trigger_button')}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          </div>

          <div className="flex justify-end pt-6 border-t border-slate-200 dark:border-white/5">
            <Button 
              type="submit" 
              disabled={isSaving}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl h-10 px-6 shadow-none"
            >
              {isSaving ? (
                <>
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  {t('parametres.saving_button')}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-5 w-5" />
                  {t('parametres.save_button')}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>

      {/* Ticket settings modal — portalled, position in the tree
          is purely organisational. Triggered from the Apparence tab. */}
      <TicketSettingsDialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen} />
    </div>
  );
}
