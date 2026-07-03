import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
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
import { ProductSearchSelect } from '@/components/ui/ProductSearchSelect'
import { HtFromTtcButton } from '@/components/ui/HtFromTtcButton'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { updateStockAndNotify, ensureLowStockNotifications } from '@/lib/notifications'

interface BCFormProps {
  initialData?: any;
  onSuccess: () => void;
}

export function BonCommandeForm({ initialData, onSuccess }: BCFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  // Editing an existing document vs creating a new one. New documents are
  // forced to "brouillon" (the default value) and the status dropdown is
  // hidden during creation.
  const isEditing = !!initialData?.id;
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  const [parametres, setParametres] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const ligneSchema = z.object({
    produitId: z.string().optional(),
    reference: z.string().optional(),
    designation: z.string().min(1, t('shared.validation.designation_required')),
    quantite: z.number().min(0.01, t('shared.validation.qty_min')),
    prixUnitaireHt: z.number().min(0, t('shared.validation.price_positive')),
    tva: z.number().min(0, t('shared.validation.vat_positive')),
  });

  const bcSchema = z.object({
    fournisseurId: z.string().optional(),
    dateEmission: z.string().min(1, t('shared.validation.emission_date_required')),
    dateLivraisonPrevue: z.string().optional(),
    statut: z.string().optional(),
    modePaiement: z.string().optional(),
    notes: z.string().optional(),
    lignes: z.array(ligneSchema).min(1, t('shared.validation.lines_min')),
  });

  type BCFormValues = z.infer<typeof bcSchema>;

  const form = useForm<BCFormValues>({
    resolver: zodResolver(bcSchema),
    defaultValues: {
      fournisseurId: '',
      dateEmission: new Date().toISOString().split('T')[0],
      dateLivraisonPrevue: '',
      statut: 'brouillon',
      modePaiement: 'Virement',
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
        const [{ data: fournisseursData }, { data: produitsData }, { data: parametresData }] = await Promise.all([
          supabase.from('fournisseurs').select('*').eq('user_id', user.id).order('nom'),
          supabase.from('produits').select('*').eq('user_id', user.id).order('designation'),
          supabase.from('parametres').select('*').eq('user_id', user.id).limit(1)
        ]);
        
        setFournisseurs(fournisseursData || []);
        setProduits(produitsData || []);
        setParametres(parametresData?.[0] || null);

        if (initialData?.id) {
          form.reset({
            ...initialData,
            fournisseurId: initialData.fournisseurId?.toString() || '',
            dateEmission: initialData.dateCommande ? new Date(initialData.dateCommande).toISOString().split('T')[0] : '',
            dateLivraisonPrevue: initialData.dateLivraisonPrevue ? new Date(initialData.dateLivraisonPrevue).toISOString().split('T')[0] : '',
            lignes: initialData.lignes?.map((l: any) => ({
              ...l,
              produitId: l.produitId?.toString() || '',
              prixUnitaireHt: Number(l.prixUnitaireHt || 0),
              quantite: Number(l.quantite || 0),
              tva: Number(l.tva || 0),
              montantHt: Number(l.montantHt || 0),
              montantTtc: Number(l.montantTtc || 0)
            })) || []
          });
        } else {
          form.reset({
            fournisseurId: '',
            dateEmission: new Date().toISOString().split('T')[0],
            dateLivraisonPrevue: '',
            statut: 'brouillon',
            modePaiement: 'Virement',
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

  async function generateBCReference(): Promise<string> {
    const year = new Date().getFullYear();
    const { data: existing } = await supabase
      .from('bons_commande')
      .select('numero')
      .like('numero', `BC-${year}-%`)
      .not('numero', 'is', null)
      .eq('user_id', user?.id);
    let maxNum = 0;
    if (existing) {
      for (const b of existing) {
        const match = b.numero?.match(new RegExp(`^BC-${year}-(\\d+)$`));
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }
    return `BC-${year}-${String(maxNum + 1).padStart(4, '0')}`;
  }

  const onSubmit = async (data: BCFormValues) => {
    setIsLoading(true);
    try {
      let bonId = initialData?.id;
      let numero;

      if (!bonId) {
        let attempts = 0;
        while (attempts < 10) {
          const candidate = await generateBCReference();
          const { data: dup } = await supabase.from('bons_commande').select('id').eq('numero', candidate).eq('user_id', user?.id).maybeSingle();
          if (!dup) {
            numero = candidate;
            break;
          }
          attempts++;
        }
      }

      const fournisseurId = data.fournisseurId && data.fournisseurId !== 'none' && data.fournisseurId !== '' 
        ? parseInt(data.fournisseurId) 
        : null;

      const payload: any = {
        date_commande: new Date(data.dateEmission).toISOString(),
        date_livraison_prevue: data.dateLivraisonPrevue ? new Date(data.dateLivraisonPrevue).toISOString() : null,
        statut: data.statut || 'brouillon',
        montant_ht: Number(totals.ht),
        montant_tva: Number(totals.tva),
        montant_ttc: Number(totals.ttc),
        numero: numero || initialData?.numero,
      };

      if (fournisseurId) {
        payload.fournisseur_id = fournisseurId;
      }

      // Snapshot the previous stock_updated flag BEFORE the row gets
      // updated, so we can decide whether stock needs to move now.
      // For new rows the flag starts at 0 by definition.
      let priorStockUpdated = 0;
      if (bonId) {
        const { data: prior } = await supabase
          .from('bons_commande')
          .select('stock_updated')
          .eq('id', bonId)
          .single();
        priorStockUpdated = Number(prior?.stock_updated || 0);
      }

      if (!bonId) {
        let { data: newBon, error } = await supabase.from('bons_commande').insert([{ ...payload, user_id: user?.id }]).select().single();
        if (error?.message?.includes('duplicate key') || error?.code === '23505') {
          numero = await generateBCReference();
          payload.numero = numero;
          const retry = await supabase.from('bons_commande').insert([{ ...payload, user_id: user?.id }]).select().single();
          newBon = retry.data;
          error = retry.error;
        }
        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        bonId = newBon.id;
      } else {
        const { error } = await supabase.from('bons_commande').update(payload).eq('id', bonId);
        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        await supabase.from('bon_commande_lignes').delete().eq('bon_commande_id', bonId);
      }

      const lignesPayload = data.lignes.map((ligne, index) => {
        const mht = Number(ligne.quantite || 0) * Number(ligne.prixUnitaireHt || 0);
        const mtva = mht * (Number(ligne.tva || 0) / 100);
        const mttc = mht + mtva;
        const produitId = ligne.produitId && ligne.produitId !== 'none' && ligne.produitId !== '' 
          ? parseInt(ligne.produitId) 
          : null;
        return {
          bon_commande_id: bonId,
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
        const { error: lignesError } = await supabase.from('bon_commande_lignes').insert(lignesPayload);
        if (lignesError) {
          console.error('Lignes insert error:', lignesError);
          throw lignesError;
        }

        // Stock side-effect — **idempotent**: only fire when the target
        // statut is "livré"/"livrée" AND the row was not already flagged
        // stock_updated. Re-saving the same BC without changing status
        // therefore never double-adds stock. If the user moves a "livré"
        // BC to a non-livré status via this form, the stock is reverted
        // exactly once (same semantics as the status dropdown helper).
        const isLivréStatus = (s?: string) => s === 'livré' || s === 'livrée';
        const wantStock = isLivréStatus(data.statut);

        if (wantStock && priorStockUpdated === 0) {
          const changedIds: (number | string)[] = [];
          for (const ligne of lignesPayload) {
            if (ligne.produit_id) {
              await updateStockAndNotify(user?.id, ligne.produit_id, Number(ligne.quantite));
              changedIds.push(ligne.produit_id);
            }
          }
          await ensureLowStockNotifications(user?.id, changedIds);
          await supabase.from('bons_commande').update({ stock_updated: 1 }).eq('id', bonId);
        } else if (!wantStock && priorStockUpdated === 1) {
          // Revert stock — clamped to zero so already-consumed inventory
          // doesn't block the administrative status change. We bypass
          // `updateStockAndNotify` here because that helper refuses to go
          // negative, which would silently skip the revert.
          for (const ligne of lignesPayload) {
            if (!ligne.produit_id) continue;
            const { data: produit } = await supabase
              .from('produits')
              .select('stock_actuel')
              .eq('id', ligne.produit_id)
              .single();
            if (!produit) continue;
            const current = Number(produit.stock_actuel || 0);
            const next = Math.max(0, current - Number(ligne.quantite || 0));
            await supabase
              .from('produits')
              .update({ stock_actuel: next })
              .eq('id', ligne.produit_id);
          }
          await supabase.from('bons_commande').update({ stock_updated: 0 }).eq('id', bonId);
          // The auto-generated BL (if any) should disappear with the revert
          // so the two views stay in sync.
          await supabase.from('bons_livraison').delete().eq('bon_commande_id', bonId);
        }
      }

      toast.success(initialData ? 'Bon de commande modifié' : 'Bon de commande créé');
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
      form.setValue(`lignes.${index}.prixUnitaireHt`, Number(produit.prix_achat_ht || produit.prixAchatHt || 0));
      form.setValue(`lignes.${index}.tva`, Number(produit.taux_tva || produit.tva || 20));
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 dark:bg-slate-900/60 dark:border-white/10 dark:rounded-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold dark:text-slate-300">{t('shared.form.supplier_label')}</Label>
            <Select
              value={form.watch('fournisseurId') || ""}
              onValueChange={(val) => form.setValue('fournisseurId', val)}
            >
              <SelectTrigger className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white [&_.lucide-chevron-down]:dark:text-slate-500">
                <SelectValue placeholder={t('shared.form.select_supplier')} />
              </SelectTrigger>
              <SelectContent>
                {fournisseurs.map((f) => (
                  <SelectItem key={f.id} value={f.id.toString()}>
                    {f.nomSociete || f.nom || '-'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.fournisseurId && (
              <p className="text-xs text-red-500 font-medium">{form.formState.errors.fournisseurId.message}</p>
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
            <Label className="text-slate-700 font-semibold dark:text-slate-300">{t('shared.form.planned_delivery')}</Label>
            <Input type="date" className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white dark:[color-scheme:dark]" {...form.register('dateLivraisonPrevue')} />
          </div>

          {isEditing && (
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
                  <SelectItem value="en_attente">{t('shared.status.pending')}</SelectItem>
                  <SelectItem value="confirmé">{t('shared.status.confirmed')}</SelectItem>
                  <SelectItem value="livré">{t('shared.status.delivered')}</SelectItem>
                  <SelectItem value="annulé">{t('shared.status.cancelled')}</SelectItem>
                  <SelectItem value="refusé">{t('shared.status.refused')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2 dark:border-white/5">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t('shared.form.lines_section')}</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-500/30 dark:text-orange-400 dark:hover:bg-orange-500/10"
            onClick={() =>
              append({ designation: '', quantite: 1, prixUnitaireHt: 0, tva: 20 })
            }
          >
            <Plus className="h-4 w-4 mr-2" />
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
                <th className="p-3 text-start font-semibold text-slate-600 dark:text-slate-400">{t('shared.table.product')}</th>
                <th className="p-3 text-start font-semibold text-slate-600 dark:text-slate-400">{t('shared.form.description_label')}</th>
                <th className="p-3 text-right font-semibold text-slate-600 dark:text-slate-400 w-24">{t('shared.form.qty_label')}</th>
                <th className="p-3 text-right font-semibold text-slate-600 dark:text-slate-400 w-32">{t('shared.form.price_ht_label')}</th>
                <th className="p-3 text-right font-semibold text-slate-600 dark:text-slate-400 w-24">{t('shared.form.vat_pct_label')}</th>
                <th className="p-3 text-right font-semibold text-slate-600 dark:text-slate-400 w-32">{t('shared.form.subtotal_ht')}</th>
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
                      <ProductSearchSelect
                        produits={produits}
                        value={form.watch(`lignes.${index}.produitId`) || ''}
                        onSelect={(val) => handleProduitSelect(index, val)}
                        priceMode="purchase"
                      />
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
                        className="h-9 text-right bg-white border-slate-200 dark:bg-slate-950/50 dark:border-white/10 dark:text-white"
                        {...form.register(`lignes.${index}.quantite`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-9 text-right bg-white border-slate-200 dark:bg-slate-950/50 dark:border-white/10 dark:text-white"
                          {...form.register(`lignes.${index}.prixUnitaireHt`, { valueAsNumber: true })}
                        />
                        <HtFromTtcButton
                          defaultTva={Number(form.watch(`lignes.${index}.tva`) ?? 20)}
                          onResult={(ht) => form.setValue(`lignes.${index}.prixUnitaireHt`, ht, { shouldValidate: true, shouldDirty: true })}
                        />
                      </div>
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-9 text-right bg-white border-slate-200 dark:bg-slate-950/50 dark:border-white/10 dark:text-white"
                        {...form.register(`lignes.${index}.tva`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="p-2 text-right font-semibold text-slate-700 align-middle dark:text-white">
                      {formatCurrency(totalHt)}
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
              placeholder={t('bons_commande.form_notes_ph')} 
              className="min-h-[100px] bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white"
            />
          </div>
        </div>

        <div className="w-full md:w-80">
          <div className="bg-slate-50 p-6 rounded-[6px] border border-slate-200 space-y-4 dark:bg-slate-900/60 dark:border-white/10 dark:rounded-sm">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium dark:text-slate-400">{t('shared.form.subtotal_ht')}</span>
              <span className="font-bold text-slate-800 dark:text-white" dir="ltr">{formatCurrency(totals.ht)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium dark:text-slate-400">{t('shared.form.total_vat')}</span>
              <span className="font-bold text-slate-800 dark:text-white" dir="ltr">{formatCurrency(totals.tva)}</span>
            </div>
            <div className="h-px bg-slate-200 my-2 dark:bg-white/10" />
            <div className="flex justify-between items-center">
              <span className="text-slate-900 font-bold text-lg dark:text-white">{t('shared.form.total_ttc')}</span>
              <span className="text-2xl font-black text-orange-600 dark:text-orange-400" dir="ltr">{formatCurrency(totals.ttc)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end items-center space-x-4 pt-6 border-t dark:border-white/5">
        <Button type="button" variant="ghost" onClick={() => onSuccess()} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          {t('shared.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 h-10 rounded-[4px] shadow-none dark:rounded-sm">
          {isLoading ? t('shared.actions.saving') : t('shared.actions.save')}
        </Button>
      </div>
    </form>
  );
}
