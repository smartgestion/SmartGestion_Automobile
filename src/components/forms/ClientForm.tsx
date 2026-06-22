import { useEffect, useRef } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Building2, User, Mail, Phone, MapPin, CreditCard, Save, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface ClientFormProps {
  initialData?: any;
  onSuccess?: () => void;
}

export function ClientForm({ initialData, onSuccess }: ClientFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const clientSchema = z.object({
    nom: z.string().min(2, { message: t('shared.validation.name_min') }),
    nomSociete: z.string().optional().or(z.literal('')),
    type: z.enum(['particulier', 'entreprise']),
    email: z.string().optional().or(z.literal('')),
    telephone: z.string().optional().or(z.literal('')),
    adresse: z.string().optional().or(z.literal('')),
    ville: z.string().optional().or(z.literal('')),
    codePostal: z.string().optional().or(z.literal('')),
    pays: z.string().optional().or(z.literal('')),
    ice: z.string().optional().or(z.literal('')),
    rc: z.string().optional().or(z.literal('')),
    ifIdentifiant: z.string().optional().or(z.literal('')),
    patente: z.string().optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
  });

  type ClientFormValues = z.infer<typeof clientSchema>;
  
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      nom: '',
      nomSociete: '',
      type: 'entreprise',
      email: '',
      telephone: '',
      adresse: '',
      ville: '',
      codePostal: '',
      pays: 'Maroc',
      ice: '',
      rc: '',
      ifIdentifiant: '',
      patente: '',
      notes: '',
    },
  });

  const formRef = useRef<HTMLFormElement>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (initialData?.id && !isInitialized.current) {
      form.reset({
        nom: initialData.nom || '',
        nomSociete: initialData.nomSociete || initialData.nom_societe || '',
        type: initialData.type || 'entreprise',
        email: initialData.email || '',
        telephone: initialData.telephone || '',
        adresse: initialData.adresse || '',
        ville: initialData.ville || '',
        codePostal: initialData.codePostal || initialData.code_postal || '',
        pays: initialData.pays || 'Maroc',
        ice: initialData.ice || '',
        rc: initialData.rc || '',
        ifIdentifiant: initialData.ifIdentifiant || initialData.if_identifiant || '',
        patente: initialData.patente || '',
        notes: initialData.notes || '',
      });
      isInitialized.current = true;
    } else if (!initialData?.id && !isInitialized.current) {
      form.reset({
        nom: '',
        nomSociete: '',
        type: 'entreprise',
        email: '',
        telephone: '',
        adresse: '',
        ville: '',
        codePostal: '',
        pays: 'Maroc',
        ice: '',
        rc: '',
        ifIdentifiant: '',
        patente: '',
        notes: '',
      });
      isInitialized.current = true;
    }
    
    return () => {
      isInitialized.current = false;
    };
  }, [initialData, form]);

  const isEntreprise = form.watch('type') === 'entreprise';

  async function onSubmit(data: ClientFormValues) {
    try {
      const isEditing = initialData?.id;
      
      const payload = {
        nom: data.nom,
        nom_societe: data.nomSociete || null,
        type: data.type,
        email: data.email || null,
        telephone: data.telephone || null,
        adresse: data.adresse || null,
        ville: data.ville || null,
        code_postal: data.codePostal || null,
        pays: data.pays || 'Maroc',
        ice: data.ice || null,
        rc: data.rc || null,
        if_identifiant: data.ifIdentifiant || null,
        patente: data.patente || null,
        notes: data.notes || null,
      };
      
      if (isEditing) {
        const { error } = await supabase.from('clients').update(payload).eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clients').insert([{ ...payload, user_id: user?.id }]);
        if (error) throw error;
      }

      toast.success(isEditing ? 'Client modifié avec succès' : 'Client créé avec succès');
      isInitialized.current = false;
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast.error(error.message || t('shared.toast.save_error'));
      console.error(error);
    }
  }

  return (
    <Form {...form}>
      <form ref={formRef} onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Type Selection — single column on phones, two on tablets+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-semibold dark:text-slate-300">{t('shared.form.type_label')}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-12 rounded-xl border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/10 dark:bg-slate-950/50 dark:border-white/10 dark:text-white [&_.lucide-chevron-down]:dark:text-slate-500">
                      <SelectValue placeholder={t('shared.form.select_placeholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="dark:bg-slate-900 dark:border-white/10">
                    <SelectItem value="entreprise" className="dark:text-white dark:focus:bg-white/5">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        <span>{t('clients.type_company')}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="particulier" className="dark:text-white dark:focus:bg-white/5">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-emerald-600" />
                        <span>{t('clients.type_individual')}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="nom"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-semibold dark:text-slate-300">
                  {isEntreprise ? t('shared.form.company_name') : t('shared.form.full_name')}
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder={isEntreprise ? 'Tech Solutions SARL' : 'Ahmed Benali'} 
                    className="h-12 rounded-xl border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/10 dark:bg-slate-950/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Mail className="h-4 w-4 text-primary" />
            {t('shared.form.contact_info')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-muted-foreground dark:text-slate-300">{t('shared.form.email')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-slate-500" />
                      <Input
                        type="email"
                        placeholder={t('shared.form.email_ph_client')}
                        className="h-12 ps-12 rounded-xl border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/10 dark:bg-slate-950/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="telephone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-muted-foreground dark:text-slate-300">{t('shared.form.phone')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Phone className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-slate-500" />
                      <Input
                        type="tel"
                        dir="ltr"
                        placeholder="+212 6 00 00 00 00"
                        className="h-12 ps-12 rounded-xl border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/10 dark:bg-slate-950/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            {t('shared.form.address_section')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="adresse"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel className="text-sm font-medium text-muted-foreground dark:text-slate-300">{t('shared.form.full_address')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <MapPin className="absolute start-4 top-4 h-4 w-4 text-muted-foreground dark:text-slate-500" />
                      <Textarea
                        placeholder={t('shared.form.address_ph_client')}
                        className="min-h-[80px] ps-12 rounded-xl border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none dark:bg-slate-950/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
                        {...field}
                      />
                    </div>
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
                  <FormLabel className="text-sm font-medium text-muted-foreground dark:text-slate-300">{t('shared.form.city')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('shared.form.city_ph')}
                      className="h-12 rounded-xl border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/10 dark:bg-slate-950/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Enterprise-specific fields */}
        {isEntreprise && (
          <div className="space-y-4 p-4 rounded-[6px] bg-indigo-50/30 border border-indigo-200/50 dark:bg-[#0F172A] dark:border-white/10">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground dark:text-white">
              <CreditCard className="h-4 w-4 text-primary" />
              {t('shared.form.fiscal_info')}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-muted-foreground dark:text-slate-300">ICE</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('shared.form.ice_digits_ph')}
                        dir="ltr"
                        className="h-12 rounded-xl border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/10 font-mono dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pt-6 border-t border-border/50 dark:border-white/10">
          <Button 
            type="submit"
            disabled={form.formState.isSubmitting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 h-10 rounded-[4px] shadow-none"
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('shared.actions.saving')}
              </>
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" />
                {initialData?.id ? t('clients.dialog_edit') : t('clients.dialog_create')}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
