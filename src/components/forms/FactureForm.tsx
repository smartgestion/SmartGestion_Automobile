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
import { updateStockAndNotify, ensureLowStockNotifications } from '@/lib/notifications'

interface FactureFormProps {
  initialData?: any;
  onSuccess: () => void;
}

export function FactureForm({ initialData, onSuccess }: FactureFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  // Editing an existing document vs creating a new one. New documents are
  // forced to "brouillon" (the default value) and the status dropdown is
  // hidden during creation.
  const isEditing = !!initialData?.id;
  const [clients, setClients] = useState<any[]>([]);
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

  const factureSchema = z.object({
    clientId: z.string().min(1, t('shared.validation.client_required')),
    dateEmission: z.string().min(1, t('shared.validation.emission_date_required')),
    dateEcheance: z.string().optional(),
    statut: z.string().min(1, t('shared.validation.status_required')),
    modePaiement: z.string().optional(),
    voiture: z.string().optional(),
    matricule1: z.string().optional(),
    matricule2: z.string().optional(),
    matricule3: z.string().optional(),
    notes: z.string().optional(),
    conditionsPaiement: z.string().optional(),
    resteAPayer: z.number().min(0, t('shared.validation.balance_positive')).optional(),
    lignes: z.array(ligneSchema).min(1, t('shared.validation.lines_min')),
  });

  type FactureFormValues = z.infer<typeof factureSchema>;

  const form = useForm<FactureFormValues>({
    resolver: zodResolver(factureSchema),
    defaultValues: initialData || {
      clientId: '',
      dateEmission: new Date().toISOString().split('T')[0],
      dateEcheance: '',
      statut: 'brouillon',
      modePaiement: 'Virement',
      voiture: '',
      matricule1: '',
      matricule2: '',
      matricule3: '',
      notes: '',
      conditionsPaiement: '',
      resteAPayer: 0,
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
          supabase.from('produits').select('*').eq('user_id', user.id).order('nom'),
          supabase.from('parametres').select('*').eq('user_id', user.id).limit(1)
        ]);
        
        setClients(clientsData || []);
        setProduits(produitsData || []);
        setParametres(parametresData?.[0] || null);
        
        if (initialData) {
          const matriculeRaw = initialData.matricule ?? initialData.matricule1 ?? '';
          const matriculeParts = String(matriculeRaw).split('/').map((p: string) => p.trim());
          form.reset({
            ...initialData,
            clientId: initialData.clientId?.toString() || '',
            voiture: initialData.voiture || '',
            matricule1: initialData.matricule1 ?? matriculeParts[0] ?? '',
            matricule2: initialData.matricule2 ?? matriculeParts[1] ?? '',
            matricule3: initialData.matricule3 ?? matriculeParts[2] ?? '',
            dateEmission: initialData.dateEmission ? new Date(initialData.dateEmission).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            dateEcheance: initialData.dateEcheance ? new Date(initialData.dateEcheance).toISOString().split('T')[0] : '',
            lignes: initialData.lignes?.map((l: any) => ({
              ...l,
              produitId: l.produitId?.toString() || '',
            })) || [],
          });
        } else if (parametresData?.[0]) {
          form.setValue('conditionsPaiement', parametresData[0].conditions_paiement_defaut || '');
          form.setValue('notes', parametresData[0].pied_page_defaut || '');
        }
      } catch (error) {
        toast.error(t('shared.toast.loading_error'));
      }
    };
    fetchData();
  }, []);

  const watchLignes = form.watch('lignes');
  const watchStatut = form.watch('statut');
  const watchResteAPayer = form.watch('resteAPayer');
  const watchModePaiement = form.watch('modePaiement');

  // Calculate totals
  const baseTotals = watchLignes.reduce(
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

  const totals = {
    ...baseTotals,
  };

  // Update reste à payer when total changes or status changes
  useEffect(() => {
    if (!initialData) {
      form.setValue('resteAPayer', totals.ttc);
    } else if (watchStatut === 'payée') {
      form.setValue('resteAPayer', 0);
    }
  }, [totals.ttc, watchStatut, initialData]);

  async function generateFactureRef(): Promise<string> {
    const year = new Date().getFullYear();
    const { data: existing } = await supabase
      .from('factures')
      .select('numero')
      .like('numero', `FAC-${year}-%`)
      .eq('user_id', user?.id);
    let maxNum = 0;
    for (const f of existing || []) {
      const match = f.numero?.match(new RegExp(`^FAC-${year}-(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return `FAC-${year}-${String(maxNum + 1).padStart(4, '0')}`;
  }

  const onSubmit = async (data: FactureFormValues) => {
    setIsLoading(true);
    try {
      let invoiceNum: string | undefined;
      if (!initialData?.id) {
        let attempts = 0;
        while (attempts < 10) {
          const candidate = await generateFactureRef();
          const { data: dup } = await supabase.from('factures').select('id').eq('numero', candidate).eq('user_id', user?.id).maybeSingle();
          if (!dup) { invoiceNum = candidate; break; }
          attempts++;
        }
      }

      const payload = {
        client_id: data.clientId === 'none' ? null : Number(data.clientId),
        date_emission: new Date(data.dateEmission).toISOString(),
        date_echeance: data.dateEcheance ? new Date(data.dateEcheance).toISOString() : null,
        numero: invoiceNum || initialData?.numero,
        statut: data.statut || 'brouillon',
        mode_paiement: data.modePaiement || 'Virement',
        voiture: data.voiture || '',
        matricule: [data.matricule1, data.matricule2, data.matricule3]
          .map((p) => (p || '').trim())
          .join(' / '),
        notes: data.notes || '',
        conditions_paiement: data.conditionsPaiement || '',
        montant_ht: Number(totals.ht) || 0,
        montant_tva: Number(totals.tva) || 0,
        montant_ttc: Number(totals.ttc) || 0,
        reste_a_payer: data.statut === 'payée' ? 0 : (Number(data.resteAPayer) || Number(totals.ttc) || 0),
      };

      let factureId = initialData?.id;

      if (!factureId) {
        let { data: newFacture, error } = await supabase.from('factures').insert([{ ...payload, user_id: user?.id }]).select().single();
        if (error?.message?.includes('duplicate key') || error?.code === '23505') {
          invoiceNum = await generateFactureRef();
          payload.numero = invoiceNum;
          const retry = await supabase.from('factures').insert([{ ...payload, user_id: user?.id }]).select().single();
          newFacture = retry.data;
          error = retry.error;
        }
        if (error) throw error;
        factureId = newFacture.id;
      } else {
        const { error } = await supabase.from('factures').update(payload).eq('id', factureId).eq('user_id', user?.id);
        if (error) throw error;
        await supabase.from('facture_lignes').delete().eq('facture_id', factureId);
      }

      const lignesPayload = (data.lignes || []).map((ligne: any, index: number) => ({
        facture_id: Number(factureId),
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
        const { error: lignesError } = await supabase.from('facture_lignes').insert(lignesPayload);
        if (lignesError) throw lignesError;
      }

      const activeStatuses = ['payée', 'reste_a_payer'];
      if (activeStatuses.includes(data.statut)) {
        const changedIds: (number | string)[] = [];
        for (const ligne of lignesPayload) {
          if (ligne.produit_id) {
            await updateStockAndNotify(user?.id, ligne.produit_id, -Number(ligne.quantite));
            changedIds.push(ligne.produit_id);
          }
        }
        await ensureLowStockNotifications(user?.id, changedIds);
      }

      toast.success(initialData ? 'Facture modifiée' : 'Facture créée');
      onSuccess();
    } catch (error: any) {
      console.error('Facture save error:', error);
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
            <Label className="dark:text-slate-400 text-slate-700 font-semibold">{t('shared.form.due_date')}</Label>
            <Input type="date" className="dark:bg-slate-950/50 dark:border-white/10 dark:focus:border-[#267E54] bg-white border-slate-300" {...form.register('dateEcheance')} />
          </div>

          {isEditing && (
            <div className="space-y-2">
              <Label className="dark:text-slate-400 text-slate-700 font-semibold">{t('shared.form.status_label')}</Label>
              <Select
                value={form.watch('statut') || ""}
                onValueChange={(val) => form.setValue('statut', val)}
              >
                <SelectTrigger className="dark:bg-slate-950/50 dark:border-white/10 bg-white border-slate-300">
                  <SelectValue placeholder={t('shared.form.select_status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brouillon">{t('shared.status.draft')}</SelectItem>
                  <SelectItem value="en_attente">{t('shared.status.pending')}</SelectItem>
                  <SelectItem value="payée">{t('shared.status.paid')}</SelectItem>
                  <SelectItem value="reste_a_payer">{t('shared.status.partial')}</SelectItem>
                  <SelectItem value="annulée">{t('shared.status.cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="dark:text-slate-400 text-slate-700 font-semibold">{t('shared.form.payment_mode')}</Label>
            <Select
              value={form.watch('modePaiement') || ""}
              onValueChange={(val) => form.setValue('modePaiement', val)}
            >
              <SelectTrigger className="dark:bg-slate-950/50 dark:border-white/10 bg-white border-slate-300">
                <SelectValue placeholder={t('shared.form.select_mode')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Virement">{t('shared.payment_modes.bank_transfer')}</SelectItem>
                <SelectItem value="Chèque">{t('shared.payment_modes.cheque')}</SelectItem>
                <SelectItem value="Espèces">{t('shared.payment_modes.cash')}</SelectItem>
                <SelectItem value="Carte">{t('shared.payment_modes.card')}</SelectItem>
                <SelectItem value="Effet">{t('shared.payment_modes.bill_of_exchange')}</SelectItem>
              </SelectContent>
            </Select>
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
            className="dark:border-white/10 dark:text-muted-foreground dark:hover:bg-white/5 border-purple-200 text-purple-700 hover:bg-purple-50"
            onClick={() =>
              append({ designation: '', quantite: 1, prixUnitaireHt: 0, tva: 20 })
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('shared.form.add_line')}
          </Button>
        </div>

        {/* Line items grid — wrapped in `overflow-x-auto` so the wide row
            of product/description/qty/price/vat/subtotal inputs scrolls
            horizontally on phones instead of overflowing the page. The
            `min-w-[720px]` keeps each cell readable while scrolling. */}
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
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="dark:text-slate-400 text-slate-700 font-semibold">{t('shared.form.notes')}</Label>
            <Textarea 
              {...form.register('notes')} 
              placeholder={t('shared.form.notes_placeholder')} 
              className="min-h-[100px] dark:bg-slate-950/50 dark:border-white/10 dark:focus:border-[#267E54] bg-white border-slate-300"
            />
          </div>
          <div className="space-y-2">
            <Label className="dark:text-slate-400 text-slate-700 font-semibold">{t('shared.form.conditions')}</Label>
            <Textarea
              {...form.register('conditionsPaiement')}
              placeholder={t('shared.form.payment_terms_ph')}
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
              <span className="text-2xl font-black text-[#267E54]" dir="ltr">{formatCurrency(totals.ttc)}</span>
            </div>
            
            {watchStatut !== 'payée' && (
              <div className="pt-4 border-t dark:border-white/10 border-slate-200">
                <Label className="dark:text-slate-400 text-slate-700 font-semibold mb-2 block">{t('shared.form.balance_due')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="dark:bg-slate-950/50 dark:border-white/10 dark:focus:border-[#267E54] bg-white border-slate-300 font-bold text-red-600"
                  {...form.register('resteAPayer', { valueAsNumber: true })}
                />
                <p className="text-[10px] dark:text-muted-foreground text-slate-500 mt-1">
                  {t('shared.form.balance_note')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end items-center space-x-4 pt-6 border-t dark:border-white/10">
        <Button type="button" variant="ghost" onClick={() => onSuccess()} className="dark:text-muted-foreground dark:hover:text-card-foreground text-slate-500 hover:text-slate-700">
          {t('shared.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading} className="bg-rose-500 hover:bg-rose-600 text-white font-semibold px-6 h-10 rounded-sm shadow-none">
          {isLoading ? t('shared.actions.saving') : t('shared.actions.save')}
        </Button>
      </div>
    </form>
  );
}
