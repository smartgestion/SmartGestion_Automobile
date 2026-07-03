import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Plus, Trash2 } from 'lucide-react'
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
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { updateStockAndNotify } from '@/lib/notifications'

interface AvoirFormProps {
  onSuccess: () => void;
}

// Manual credit note form.
//
// Unlike facture-linked credit notes (created automatically when an invoice
// is cancelled), a manual avoir has NO `facture_id`. This distinction is what
// the Dashboard uses to decide whether the credit note should be subtracted
// from revenue: manual avoirs reduce revenue (nothing reduced it yet), while
// facture-linked avoirs are skipped because the invoice already reflects the
// deduction.
export function AvoirForm({ onSuccess }: AvoirFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const ligneSchema = z.object({
    produitId: z.string().optional(),
    reference: z.string().optional(),
    designation: z.string().min(1, t('shared.validation.designation_required')),
    quantite: z.number().min(0.01, t('shared.validation.qty_min')),
    prixUnitaireHt: z.number().min(0, t('shared.validation.price_positive')),
    tva: z.number().min(0, t('shared.validation.vat_positive')),
  });

  const avoirSchema = z.object({
    clientId: z.string().min(1, t('shared.validation.client_required')),
    dateEmission: z.string().min(1, t('shared.validation.emission_date_required')),
    voiture: z.string().optional(),
    matricule1: z.string().optional(),
    matricule2: z.string().optional(),
    matricule3: z.string().optional(),
    notes: z.string().optional(),
    lignes: z.array(ligneSchema).min(1, t('shared.validation.lines_min')),
  });

  type AvoirFormValues = z.infer<typeof avoirSchema>;

  const form = useForm<AvoirFormValues>({
    resolver: zodResolver(avoirSchema),
    defaultValues: {
      clientId: '',
      dateEmission: new Date().toISOString().split('T')[0],
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
        const [{ data: clientsData }, { data: produitsData }] = await Promise.all([
          supabase.from('clients').select('*').eq('user_id', user.id).order('nom'),
          supabase.from('produits').select('*').eq('user_id', user.id).order('nom'),
        ]);
        setClients(clientsData || []);
        setProduits(produitsData || []);
      } catch (error) {
        toast.error(t('shared.toast.loading_error'));
      }
    };
    fetchData();
  }, []);

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

  async function generateAvoirRef(): Promise<string> {
    const year = new Date().getFullYear();
    const { data: existing } = await supabase
      .from('avoirs')
      .select('numero')
      .like('numero', `AV-${year}-%`)
      .eq('user_id', user?.id);
    let maxNum = 0;
    for (const a of existing || []) {
      const match = a.numero?.match(new RegExp(`^AV-${year}-(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return `AV-${year}-${String(maxNum + 1).padStart(4, '0')}`;
  }

  const onSubmit = async (data: AvoirFormValues) => {
    setIsLoading(true);
    try {
      let avoirNum: string | undefined;
      let attempts = 0;
      while (attempts < 10) {
        const candidate = await generateAvoirRef();
        const { data: dup } = await supabase.from('avoirs').select('id').eq('numero', candidate).eq('user_id', user?.id).maybeSingle();
        if (!dup) { avoirNum = candidate; break; }
        attempts++;
      }

      const payload = {
        user_id: user?.id,
        numero: avoirNum,
        // Manual avoir: not linked to any invoice. This is what makes it
        // count against revenue on the Dashboard.
        facture_id: null,
        client_id: data.clientId === 'none' ? null : Number(data.clientId),
        date_emission: new Date(data.dateEmission).toISOString(),
        voiture: data.voiture || '',
        matricule: [data.matricule1, data.matricule2, data.matricule3]
          .map((p) => (p || '').trim())
          .join(' / '),
        montant_ht: Number(totals.ht) || 0,
        montant_tva: Number(totals.tva) || 0,
        montant_ttc: Number(totals.ttc) || 0,
        statut: 'émis',
        notes: data.notes || '',
      };

      let { data: newAvoir, error } = await supabase.from('avoirs').insert([payload]).select().single();
      if (error?.message?.includes('duplicate key') || error?.code === '23505') {
        avoirNum = await generateAvoirRef();
        payload.numero = avoirNum;
        const retry = await supabase.from('avoirs').insert([payload]).select().single();
        newAvoir = retry.data;
        error = retry.error;
      }
      if (error) throw error;

      const lignesPayload = (data.lignes || []).map((ligne: any, index: number) => ({
        avoir_id: Number(newAvoir.id),
        produit_id: ligne.produitId ? Number(ligne.produitId) : null,
        designation: ligne.designation || 'Article sans désignation',
        quantite: Number(ligne.quantite) || 1,
        prix_unitaire_ht: Number(ligne.prixUnitaireHt) || 0,
        tva: Number(ligne.tva) || 20,
        montant_ht: Number(ligne.prixUnitaireHt || 0) * Number(ligne.quantite || 1) || 0,
        montant_ttc: (Number(ligne.prixUnitaireHt || 0) * Number(ligne.quantite || 1)) * (1 + Number(ligne.tva || 20) / 100) || 0,
        ordre: index,
      }));

      if (lignesPayload.length > 0) {
        const { error: lignesError } = await supabase.from('avoir_lignes').insert(lignesPayload);
        if (lignesError) throw lignesError;
      }

      // Return stock: a manual credit note represents goods coming back, so
      // each line that references a product ADDS its quantity back to stock
      // (positive delta — the inverse of a facture which subtracts stock).
      for (const ligne of lignesPayload) {
        if (ligne.produit_id) {
          await updateStockAndNotify(user?.id, ligne.produit_id, Number(ligne.quantite));
        }
      }

      toast.success(t('avoirs.toast_created'));
      onSuccess();
    } catch (error: any) {
      console.error('Avoir save error:', error);
      toast.error(error.message || t('shared.toast.save_error'));
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
      form.setValue(`lignes.${index}.prixUnitaireHt`, Number(produit.prixVenteHt || produit.prix_vente_ht || 0));
      form.setValue(`lignes.${index}.tva`, Number(produit.taux_tva ?? produit.tauxTva ?? produit.tva ?? 20));
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      <div className="dark:bg-slate-900/40 dark:border-white/10 bg-slate-50 p-4 rounded-sm border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label className="dark:text-slate-400 text-slate-700 font-semibold">{t('shared.form.client_label')}</Label>
            <Select
              value={form.watch('clientId') || ""}
              onValueChange={(val) => form.setValue('clientId', val)}
            >
              <SelectTrigger className="dark:bg-slate-950/50 dark:border-white/10 bg-white border-slate-300">
                <SelectValue placeholder={t('shared.form.select_client')} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.nom || client.nomSociete || '-'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.clientId && (
              <p className="text-xs text-red-500 font-medium">{form.formState.errors.clientId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="dark:text-slate-400 text-slate-700 font-semibold">{t('shared.form.emission_date')}</Label>
            <Input type="date" className="dark:bg-slate-950/50 dark:border-white/10 dark:focus:border-[#267E54] bg-white border-slate-300" {...form.register('dateEmission')} />
            {form.formState.errors.dateEmission && (
              <p className="text-xs text-red-500 font-medium">{form.formState.errors.dateEmission.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="dark:text-slate-400 text-slate-700 font-semibold">{t('shared.form.vehicle')}</Label>
            <Input
              type="text"
              placeholder={t('shared.form.vehicle_placeholder')}
              className="dark:bg-slate-950/50 dark:border-white/10 dark:focus:border-[#267E54] bg-white border-slate-300"
              {...form.register('voiture')}
            />
          </div>

          <div className="space-y-2 md:col-start-3">
            <Label className="dark:text-slate-400 text-slate-700 font-semibold">{t('shared.form.matricule')}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                className="dark:bg-slate-950/50 dark:border-white/10 dark:focus:border-[#267E54] bg-white border-slate-300 text-center"
                {...form.register('matricule1')}
              />
              <span className="text-slate-500 font-semibold">/</span>
              <Input
                type="text"
                className="dark:bg-slate-950/50 dark:border-white/10 dark:focus:border-[#267E54] bg-white border-slate-300 text-center"
                {...form.register('matricule2')}
              />
              <span className="text-slate-500 font-semibold">/</span>
              <Input
                type="text"
                className="dark:bg-slate-950/50 dark:border-white/10 dark:focus:border-[#267E54] bg-white border-slate-300 text-center"
                {...form.register('matricule3')}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b dark:border-white/10 pb-2">
          <h3 className="text-lg font-bold dark:text-card-foreground text-slate-800">{t('shared.form.lines_section')}</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="dark:border-white/10 dark:text-muted-foreground dark:hover:bg-white/5 border-orange-200 text-orange-700 hover:bg-orange-50"
            onClick={() =>
              append({ designation: '', quantite: 1, prixUnitaireHt: 0, tva: 20 })
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('shared.form.add_line')}
          </Button>
        </div>

        <div className="border dark:border-white/10 border-slate-200 rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="border-b dark:border-white/10">
              <tr>
                <th className="p-3 text-start font-semibold dark:text-muted-foreground text-slate-600">{t('shared.table.product')}</th>
                <th className="p-3 text-start font-semibold dark:text-muted-foreground text-slate-600">{t('shared.form.description_label')}</th>
                <th className="p-3 text-right font-semibold dark:text-muted-foreground text-slate-600 w-24">{t('shared.form.qty_label')}</th>
                <th className="p-3 text-right font-semibold dark:text-muted-foreground text-slate-600 w-32">{t('shared.form.price_ht_label')}</th>
                <th className="p-3 text-right font-semibold dark:text-muted-foreground text-slate-600 w-24">{t('shared.form.vat_pct_label')}</th>
                <th className="p-3 text-right font-semibold dark:text-muted-foreground text-slate-600 w-32">{t('shared.form.subtotal_ht')}</th>
                <th className="p-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-white/10 divide-slate-100">
              {fields.map((field, index) => {
                const ligne = watchLignes[index];
                const totalHt = (ligne?.quantite || 0) * (ligne?.prixUnitaireHt || 0);
                const selectedProductId = form.watch(`lignes.${index}.produitId`);

                return (
                  <tr key={field.id}>
                    <td className="p-2">
                      <ProductSearchSelect
                        produits={produits}
                        value={selectedProductId || ''}
                        onSelect={(val) => handleProduitSelect(index, val)}
                        priceMode="sale"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        className="h-9 dark:bg-slate-950/50 dark:border-white/10 dark:focus:border-[#267E54] bg-white border-slate-200"
                        {...form.register(`lignes.${index}.designation`)}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-9 text-right dark:bg-slate-950/50 dark:border-white/10 dark:focus:border-[#267E54] bg-white border-slate-200"
                        {...form.register(`lignes.${index}.quantite`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-9 text-right dark:bg-slate-950/50 dark:border-white/10 dark:focus:border-[#267E54] bg-white border-slate-200"
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
                        className="h-9 text-right dark:bg-slate-950/50 dark:border-white/10 dark:focus:border-[#267E54] bg-white border-slate-200"
                        {...form.register(`lignes.${index}.tva`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="p-2 text-right font-semibold dark:text-card-foreground text-slate-700 align-middle">
                      {formatCurrency(totalHt)}
                    </td>
                    <td className="p-2 text-center align-middle">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 dark:text-muted-foreground dark:hover:text-red-400 dark:hover:bg-red-500/10 text-red-400 hover:text-red-600 hover:bg-red-50"
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
        {form.formState.errors.lignes && (
          <p className="text-sm text-red-500 font-medium">{form.formState.errors.lignes.message}</p>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1">
          <div className="space-y-2">
            <Label className="dark:text-slate-400 text-slate-700 font-semibold">{t('shared.form.notes')}</Label>
            <Textarea
              {...form.register('notes')}
              placeholder={t('shared.form.notes_placeholder')}
              className="min-h-[100px] dark:bg-slate-950/50 dark:border-white/10 dark:focus:border-[#267E54] bg-white border-slate-300"
            />
          </div>
        </div>

        <div className="w-full md:w-80">
          <div className="dark:bg-slate-900/60 dark:border-white/10 bg-slate-50 p-6 rounded-sm border border-slate-200 space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="dark:text-muted-foreground text-slate-500 font-medium">{t('shared.form.subtotal_ht')}</span>
              <span className="font-bold dark:text-card-foreground text-slate-800" dir="ltr">{formatCurrency(totals.ht)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="dark:text-muted-foreground text-slate-500 font-medium">{t('shared.form.total_vat')}</span>
              <span className="font-bold dark:text-card-foreground text-slate-800" dir="ltr">{formatCurrency(totals.tva)}</span>
            </div>
            <div className="h-px dark:bg-white/10 bg-slate-200 my-2" />
            <div className="flex justify-between items-center">
              <span className="dark:text-card-foreground text-slate-900 font-bold text-lg">{t('shared.form.total_ttc')}</span>
              <span className="text-2xl font-black text-red-500" dir="ltr">{formatCurrency(totals.ttc)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end items-center space-x-4 pt-6 border-t dark:border-white/10">
        <Button type="button" variant="ghost" onClick={() => onSuccess()} className="dark:text-muted-foreground dark:hover:text-card-foreground text-slate-500 hover:text-slate-700">
          {t('shared.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 h-10 rounded-sm shadow-none">
          {isLoading ? t('shared.actions.saving') : t('shared.actions.save')}
        </Button>
      </div>
    </form>
  );
}
