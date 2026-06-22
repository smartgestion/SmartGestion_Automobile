import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { formatCurrencyLocale } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// Client-facing delivery note (bon de livraison client). It mirrors the
// supplier delivery-note form's design but is tied to a CLIENT and never
// touches stock — no stock import, no stock mutation anywhere below.

interface BLCFormProps {
  initialData?: any;
  onSuccess: () => void;
}

export function BonLivraisonClientForm({ initialData, onSuccess }: BLCFormProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  const [parametres, setParametres] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Localized Zod schema — rebuilt when language changes so error messages
  // appear in the active locale.
  const blSchema = useMemo(
    () =>
      z.object({
        clientId: z.string().optional(),
        dateEmission: z.string().min(1, t('shared.validation.emission_date_required')),
        statut: z.string().optional(),
        modePaiement: z.string().optional(),
        voiture: z.string().optional(),
        matricule1: z.string().optional(),
        matricule2: z.string().optional(),
        matricule3: z.string().optional(),
        notes: z.string().optional(),
        lignes: z
          .array(
            z.object({
              produitId: z.string().optional(),
              reference: z.string().optional(),
              designation: z.string().min(1, t('shared.validation.designation_required')),
              quantite: z.number().min(0.01, t('shared.validation.qty_min')),
              prixUnitaireHt: z.number().min(0, t('shared.validation.price_positive')).optional(),
              tva: z.number().min(0, t('shared.validation.vat_positive')).optional(),
            }),
          )
          .min(1, t('shared.validation.lines_min')),
      }),
    [i18n.language, t],
  );

  type BLCFormValues = z.infer<typeof blSchema>;

  const form = useForm<BLCFormValues>({
    resolver: zodResolver(blSchema),
    defaultValues: {
      clientId: '',
      dateEmission: new Date().toISOString().split('T')[0],
      statut: 'en_attente',
      modePaiement: 'Virement',
      voiture: '',
      matricule1: '',
      matricule2: '',
      matricule3: '',
      notes: '',
      lignes: [
        {
          designation: '',
          quantite: 1,
          prixUnitaireHt: 0,
          tva: 20,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lignes',
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      try {
        const [{ data: clientsData }, { data: produitsData }, { data: parametresData }] = await Promise.all([
          supabase.from('clients').select('*').eq('user_id', user.id).order('nom'),
          supabase.from('produits').select('*').eq('user_id', user.id).order('designation'),
          supabase.from('parametres').select('*').eq('user_id', user.id).limit(1)
        ]);

        setClients(clientsData || []);
        setProduits(produitsData || []);
        setParametres(parametresData?.[0] || null);

        if (initialData?.id) {
          const matriculeRaw = initialData.matricule ?? initialData.matricule1 ?? '';
          const matriculeParts = String(matriculeRaw).split('/').map((p: string) => p.trim());
          form.reset({
            ...initialData,
            clientId: initialData.clientId?.toString() || '',
            voiture: initialData.voiture || '',
            matricule1: initialData.matricule1 ?? matriculeParts[0] ?? '',
            matricule2: initialData.matricule2 ?? matriculeParts[1] ?? '',
            matricule3: initialData.matricule3 ?? matriculeParts[2] ?? '',
            dateEmission: initialData.dateCommande || initialData.dateLivraisonPrevue || new Date().toISOString().split('T')[0],
            lignes: initialData.lignes?.map((l: any) => ({
              ...l,
              produitId: l.produitId?.toString() || '',
              prixUnitaireHt: Number(l.prixUnitaireHt || 0),
              quantite: Number(l.quantite || 0),
              tva: Number(l.tva || 20),
              montantHt: Number(l.montantHt || 0),
              montantTtc: Number(l.montantTtc || 0)
            })) || []
          });
        } else {
          form.reset({
            clientId: '',
            dateEmission: new Date().toISOString().split('T')[0],
            statut: 'en_attente',
            modePaiement: 'Virement',
            voiture: '',
            matricule1: '',
            matricule2: '',
            matricule3: '',
            notes: parametresData?.[0]?.pied_page_defaut || '',
            lignes: [
              {
                designation: '',
                quantite: 1,
                prixUnitaireHt: 0,
                tva: 20,
              },
            ],
          });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error(t('shared.toast.loading_error'));
      }
    };
    fetchData();
    // We intentionally omit `t` from deps — toast text is only emitted once on
    // mount; re-running this effect when language changes would refetch all
    // clients/products needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.id]);

  const watchLignes = form.watch('lignes');

  const totals = watchLignes.reduce(
    (acc, ligne) => {
      const montantHt = (ligne.quantite || 0) * (ligne.prixUnitaireHt || 0);
      const montantTva = montantHt * ((ligne.tva || 0) / 100);
      return {
        ht: acc.ht + montantHt,
        tva: acc.tva + montantTva,
        ttc: acc.ttc + montantHt + montantTva,
      };
    },
    { ht: 0, tva: 0, ttc: 0 }
  );

  async function generateBLCRef(): Promise<string> {
    const year = new Date().getFullYear();
    const { data: existing } = await supabase
      .from('bons_livraison_client')
      .select('numero')
      .like('numero', `BLC-${year}-%`)
      .eq('user_id', user?.id);
    let maxNum = 0;
    for (const b of existing || []) {
      const match = b.numero?.match(new RegExp(`^BLC-${year}-(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return `BLC-${year}-${String(maxNum + 1).padStart(4, '0')}`;
  }

  const onSubmit = async (data: BLCFormValues) => {
    setIsLoading(true);
    try {
      let bonId = initialData?.id;
      let numero;

      if (!bonId) {
        let attempts = 0;
        while (attempts < 10) {
          const candidate = await generateBLCRef();
          const { data: dup } = await supabase.from('bons_livraison_client').select('id').eq('numero', candidate).eq('user_id', user?.id).maybeSingle();
          if (!dup) { numero = candidate; break; }
          attempts++;
        }
      }

      const clientId = data.clientId && data.clientId !== 'none' && data.clientId !== ''
        ? parseInt(data.clientId)
        : null;

      const payload: any = {
        date_livraison: new Date(data.dateEmission).toISOString(),
        statut: data.statut || 'en_attente',
        voiture: data.voiture || '',
        matricule: [data.matricule1, data.matricule2, data.matricule3]
          .map((p) => (p || '').trim())
          .join(' / '),
        montant_ht: Number(totals.ht),
        montant_tva: Number(totals.tva),
        montant_ttc: Number(totals.ttc),
        notes: data.notes || '',
        numero: numero || initialData?.numero,
      };

      if (clientId) {
        payload.client_id = clientId;
      }

      if (!bonId) {
        let { data: newBon, error } = await supabase.from('bons_livraison_client').insert([{ ...payload, user_id: user?.id }]).select().single();
        if (error?.message?.includes('duplicate key') || error?.code === '23505') {
          numero = await generateBLCRef();
          payload.numero = numero;
          const retry = await supabase.from('bons_livraison_client').insert([{ ...payload, user_id: user?.id }]).select().single();
          newBon = retry.data;
          error = retry.error;
        }
        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        bonId = newBon.id;
      } else {
        const { error } = await supabase.from('bons_livraison_client').update(payload).eq('id', bonId);
        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        await supabase.from('bon_livraison_client_lignes').delete().eq('bon_livraison_client_id', bonId);
      }

      const lignesPayload = data.lignes.map((ligne, index) => {
        const mht = Number(ligne.quantite || 0) * Number(ligne.prixUnitaireHt || 0);
        const mtva = mht * (Number(ligne.tva || 0) / 100);
        const mttc = mht + mtva;
        const produitId = ligne.produitId && ligne.produitId !== 'none' && ligne.produitId !== ''
          ? parseInt(ligne.produitId)
          : null;
        return {
          bon_livraison_client_id: bonId,
          produit_id: produitId,
          designation: ligne.designation || '',
          quantite: Number(ligne.quantite || 0),
          prix_unitaire_ht: Number(ligne.prixUnitaireHt || 0),
          tva: Number(ligne.tva || 20),
          montant_ht: mht,
          montant_ttc: mttc,
          ordre: index,
        };
      });

      if (lignesPayload.length > 0) {
        const { error: lignesError } = await supabase.from('bon_livraison_client_lignes').insert(lignesPayload);
        if (lignesError) {
          console.error('Lignes insert error:', lignesError);
          throw lignesError;
        }
        // NOTE: client delivery notes never affect stock — no stock update here.
      }

      toast.success(
        initialData
          ? t('bons_livraison_client.toast_updated')
          : t('bons_livraison_client.toast_created'),
      );
      onSuccess();
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast.error(error?.message || error?.details || t('shared.toast.save_error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleProduitSelect = (index: number, produitId: string) => {
    const produit = produits.find((p) => p.id.toString() === produitId);
    if (produit) {
      form.setValue(`lignes.${index}.produitId`, produit.id.toString());
      form.setValue(`lignes.${index}.reference`, produit.reference || '');
      form.setValue(`lignes.${index}.designation`, produit.designation || produit.nom || '');
      form.setValue(`lignes.${index}.quantite`, 1);
      form.setValue(`lignes.${index}.prixUnitaireHt`, Number(produit.prix_vente_ht || produit.prixVenteHt || produit.prix_achat_ht || produit.prixAchatHt || 0));
      form.setValue(`lignes.${index}.tva`, Number(produit.taux_tva || produit.tva || 20));
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 dark:bg-slate-900/60 dark:border-white/10 dark:rounded-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold dark:text-slate-300">{t('shared.form.client_label')}</Label>
            <Select
              value={form.watch('clientId') || ""}
              onValueChange={(val) => form.setValue('clientId', val)}
            >
              <SelectTrigger className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white [&_.lucide-chevron-down]:dark:text-slate-500">
                <SelectValue placeholder={t('shared.form.select_client')} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.nomSociete || c.nom_societe || c.nom || '-'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.clientId && (
              <p className="text-xs text-red-500 font-medium">{form.formState.errors.clientId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold dark:text-slate-300">{t('shared.form.emission_date')}</Label>
            <Input type="date" className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white dark:[color-scheme:dark]" {...form.register('dateEmission')} />
            {form.formState.errors.dateEmission && (
              <p className="text-xs text-red-500 font-medium">{form.formState.errors.dateEmission.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold dark:text-slate-300">{t('shared.form.status_label')}</Label>
            <Select
              value={form.watch('statut') || ""}
              onValueChange={(val) => form.setValue('statut', val)}
            >
              <SelectTrigger className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white [&_.lucide-chevron-down]:dark:text-slate-500">
                <SelectValue placeholder={t('shared.form.select_status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en_attente">{t('bons_livraison.status_pending')}</SelectItem>
                <SelectItem value="livré">{t('bons_livraison.status_delivered')}</SelectItem>
                <SelectItem value="annulé">{t('bons_livraison.status_cancelled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-start-1">
            <Label className="text-slate-700 font-semibold dark:text-slate-300">{t('shared.form.vehicle')}</Label>
            <Input
              type="text"
              placeholder={t('shared.form.vehicle_placeholder')}
              className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white"
              {...form.register('voiture')}
            />
          </div>

          <div className="space-y-2 md:col-start-2">
            <Label className="text-slate-700 font-semibold dark:text-slate-300">{t('shared.form.matricule')}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white text-center"
                {...form.register('matricule1')}
              />
              <span className="text-slate-500 font-semibold">/</span>
              <Input
                type="text"
                className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white text-center"
                {...form.register('matricule2')}
              />
              <span className="text-slate-500 font-semibold">/</span>
              <Input
                type="text"
                className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white text-center"
                {...form.register('matricule3')}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2 dark:border-white/5">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t('bons_livraison.form_lines_section')}</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-400 dark:hover:bg-blue-500/10"
            onClick={() =>
              append({ designation: '', quantite: 1, prixUnitaireHt: 0, tva: 20 })
            }
          >
            <Plus className="h-4 w-4 me-2" />
            {t('shared.form.add_line')}
          </Button>
        </div>

        {/* Line items grid — wrapped in `overflow-x-auto` so the wide row
            scrolls horizontally on phones instead of overflowing the page. */}
        <div className="border border-slate-200 rounded-[6px] overflow-hidden dark:border-white/10 dark:rounded-sm">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-slate-100 border-b border-slate-200 dark:bg-slate-900/60 dark:border-white/10">
              <tr>
                <th className="p-3 text-start font-semibold text-slate-600 dark:text-slate-400">{t('bons_livraison.detail_col_product')}</th>
                <th className="p-3 text-start font-semibold text-slate-600 dark:text-slate-400">{t('shared.form.description_label')} *</th>
                <th className="p-3 text-end font-semibold text-slate-600 dark:text-slate-400 w-24">{t('shared.form.qty_label')} *</th>
                <th className="p-3 text-end font-semibold text-slate-600 dark:text-slate-400 w-32">{t('shared.form.price_ht_label')}</th>
                <th className="p-3 text-end font-semibold text-slate-600 dark:text-slate-400 w-24">{t('shared.form.vat_pct_label')}</th>
                <th className="p-3 text-end font-semibold text-slate-600 dark:text-slate-400 w-32">{t('shared.form.subtotal_ht')}</th>
                <th className="p-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {fields.map((field, index) => {
                const ligne = watchLignes[index];
                const totalHt = (ligne?.quantite || 0) * (ligne?.prixUnitaireHt || 0);

                return (
                  <tr key={field.id} className="hover:bg-slate-50/50 transition-colors dark:hover:bg-white/[0.03]">
                    <td className="p-2">
                      <Select
                        value={form.watch(`lignes.${index}.produitId`) || ""}
                        onValueChange={(val) => handleProduitSelect(index, val)}
                      >
                        <SelectTrigger className="h-9 bg-white border-slate-200 dark:bg-slate-950/50 dark:border-white/10 [&_.lucide-chevron-down]:dark:text-slate-500">
                          <SelectValue placeholder={t('shared.form.choose_product')} />
                        </SelectTrigger>
                        <SelectContent>
                          {produits.map((p) => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                              {p.designation || p.nom || '-'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <Input
                        className="h-9 bg-white border-slate-200 dark:bg-slate-950/50 dark:border-white/10 dark:text-white"
                        {...form.register(`lignes.${index}.designation`)}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-9 text-end bg-white border-slate-200 dark:bg-slate-950/50 dark:border-white/10 dark:text-white"
                        {...form.register(`lignes.${index}.quantite`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-9 text-end bg-white border-slate-200 dark:bg-slate-950/50 dark:border-white/10 dark:text-white"
                        {...form.register(`lignes.${index}.prixUnitaireHt`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-9 text-end bg-white border-slate-200 dark:bg-slate-950/50 dark:border-white/10 dark:text-white"
                        {...form.register(`lignes.${index}.tva`, { valueAsNumber: true })}
                      />
                    </td>
                    <td
                      dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                      className="p-2 text-end font-semibold text-slate-700 align-middle dark:text-white"
                    >
                      {formatCurrencyLocale(totalHt, i18n.language)}
                    </td>
                    <td className="p-2 text-center align-middle">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 dark:text-rose-500/70 dark:hover:text-rose-500 dark:hover:bg-white/5"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1">
          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold dark:text-slate-300">{t('shared.form.notes')}</Label>
            <Textarea
              {...form.register('notes')}
              placeholder={t('bons_livraison.form_notes_placeholder')}
              className="min-h-[100px] bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white"
            />
          </div>
        </div>

        <div className="w-full md:w-80">
          <div className="bg-slate-50 p-6 rounded-[6px] border border-slate-200 space-y-4 dark:bg-slate-900/60 dark:border-white/10 dark:rounded-sm">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium dark:text-slate-400">{t('shared.form.subtotal_ht')}</span>
              <span
                dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                className="font-bold text-slate-800 dark:text-white"
              >
                {formatCurrencyLocale(totals.ht, i18n.language)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium dark:text-slate-400">{t('shared.form.total_vat')}</span>
              <span
                dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                className="font-bold text-slate-800 dark:text-white"
              >
                {formatCurrencyLocale(totals.tva, i18n.language)}
              </span>
            </div>
            <div className="h-px bg-slate-200 my-2 dark:bg-white/10" />
            <div className="flex justify-between items-center">
              <span className="text-slate-900 font-bold text-lg dark:text-white">{t('shared.form.total_ttc')}</span>
              <span
                dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                className="text-2xl font-black text-blue-600 dark:text-blue-400"
              >
                {formatCurrencyLocale(totals.ttc, i18n.language)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end items-center gap-4 pt-6 border-t dark:border-white/5">
        <Button type="button" variant="ghost" onClick={() => onSuccess()} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          {t('shared.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 h-10 rounded-[4px] shadow-none dark:rounded-sm">
          {isLoading ? t('shared.actions.saving') : t('bons_livraison.form_save_button')}
        </Button>
      </div>
    </form>
  );
}
