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
import { Building2, User, Mail, Phone, MapPin, CreditCard, Save, Loader2, Truck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface FournisseurFormProps {
  initialData?: any;
  onSuccess?: () => void;
}

export function FournisseurForm({ initialData, onSuccess }: FournisseurFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const fournisseurSchema = z.object({
    nom: z.string().min(2, { message: t('shared.validation.name_min') }),
    type: z.enum(['particulier', 'entreprise']),
    contact: z.string().optional().or(z.literal('')),
    email: z.string().optional().or(z.literal('')),
    telephone: z.string().optional().or(z.literal('')),
    adresse: z.string().optional().or(z.literal('')),
    ville: z.string().optional().or(z.literal('')),
    ice: z.string().optional().or(z.literal('')),
  });

  type FournisseurFormValues = z.infer<typeof fournisseurSchema>;
  
  const form = useForm<FournisseurFormValues>({
    resolver: zodResolver(fournisseurSchema),
    defaultValues: {
      nom: '',
      type: 'entreprise',
      contact: '',
      email: '',
      telephone: '',
      adresse: '',
      ville: '',
      ice: '',
    },
  });

  const isInitialized = useRef(false);

  useEffect(() => {
    if (initialData?.id && !isInitialized.current) {
      form.reset({
        nom: initialData.nom || initialData.nomSociete || '',
        type: initialData.type || 'entreprise',
        contact: initialData.contact || '',
        email: initialData.email || '',
        telephone: initialData.telephone || '',
        adresse: initialData.adresse || '',
        ville: initialData.ville || '',
        ice: initialData.ice || '',
      });
      isInitialized.current = true;
    } else if (!initialData?.id && !isInitialized.current) {
      form.reset({
        nom: '',
        type: 'entreprise',
        contact: '',
        email: '',
        telephone: '',
        adresse: '',
        ville: '',
        ice: '',
      });
      isInitialized.current = true;
    }
    
    return () => {
      isInitialized.current = false;
    };
  }, [initialData, form]);

  const isEntreprise = form.watch('type') === 'entreprise';

  async function onSubmit(data: FournisseurFormValues) {
    try {
      const isEditing = initialData?.id;

      if (isEditing) {
        const { error } = await supabase.from('fournisseurs').update(data).eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fournisseurs').insert([{ ...data, user_id: user?.id }]);
        if (error) throw error;
      }

      toast.success(isEditing ? 'Fournisseur modifié avec succès' : 'Fournisseur créé avec succès');
      isInitialized.current = false;
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast.error(error.message || t('shared.toast.save_error'));
      console.error(error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                    <SelectTrigger className="h-12 rounded-xl border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/10 dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white [&_.lucide-chevron-down]:dark:text-slate-500">
                      <SelectValue placeholder={t('shared.form.select_placeholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="dark:bg-[#0F172A] dark:border-white/10">
                    <SelectItem value="entreprise" className="dark:text-white dark:focus:bg-white/5">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-purple-500" />
                        <span>{t('fournisseurs.type_company')}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="particulier" className="dark:text-white dark:focus:bg-white/5">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-amber-500" />
                        <span>{t('fournisseurs.type_individual')}</span>
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
                  <div className="relative">
                    <Truck className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-slate-500" />
                    <Input 
                      placeholder={isEntreprise ? 'Fournisseur SARL' : 'Ahmed Benali'} 
                      className="h-12 pl-12 rounded-xl border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/10 dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
                      {...field} 
                    />
                  </div>
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
                        placeholder={t('shared.form.email_ph_supplier')}
                        className="h-12 ps-12 rounded-xl border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/10 dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
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
                        placeholder="+212 5 00 00 00 00"
                        className="h-12 ps-12 rounded-xl border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/10 dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
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
                        placeholder={t('shared.form.address_ph_supplier')}
                        className="min-h-[80px] ps-12 rounded-xl border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
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
                      className="h-12 rounded-xl border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/10 dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
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
          <div className="space-y-4 p-4 rounded-[6px] bg-sky-50/30 border border-sky-200/50 dark:bg-[#0F172A] dark:border-white/10">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground dark:text-white">
              <CreditCard className="h-4 w-4 text-purple-500" />
              {t('shared.form.fiscal_info_short')}
            </div>
            
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
        )}

        {/* Contact Person */}
        <FormField
          control={form.control}
          name="contact"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-semibold dark:text-slate-300">{t('shared.form.contact_person')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('shared.form.contact_person_ph')}
                  className="h-12 rounded-xl border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/10 dark:bg-[#12141C]/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit Button */}
        <div className="flex justify-end pt-6 border-t border-border/50 dark:border-white/10">
          <Button 
            type="submit"
            disabled={form.formState.isSubmitting}
            className="bg-sky-500 hover:bg-sky-600 text-white font-semibold px-6 h-10 rounded-[4px] shadow-none"
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('shared.actions.saving')}
              </>
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" />
                {initialData?.id ? t('fournisseurs.dialog_edit') : t('fournisseurs.dialog_create')}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
