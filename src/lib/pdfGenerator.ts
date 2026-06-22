import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
// Use the server-side Supabase client. The browser client (./supabase.js)
// relies on `import.meta.env` which is undefined in the Node.js runtime
// used by Vercel serverless functions and the local Express server, and
// throws at module-load time.
import { supabase } from './supabase.server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DocumentLabels {
  title: string;
  entityLabel: string;
  labels: Record<string, string>;
  itemCols: string[];
  totals: { ht: string; ttc: string; vatPrefix: string; dhs: string };
  words: { arrête: string; dirhams: string; centimes: string };
  signature: { client: string; company: string };
  footer: { generatedBy: string };
  devis: { validité: string; conditions: string };
  notes: string;
  payment: string;
  headerIce: string;
}

const DOCUMENT_LABELS: Record<string, Record<string, DocumentLabels>> = {
  fr: {
    facture: {
      title: 'FACTURE',
      entityLabel: 'Client',
      labels: { numero: 'Numéro', date: 'Date', reference: 'Référence', modePaiement: 'Mode de Règlement', echeance: 'Échéance', agent: 'Agent' },
      itemCols: ['Référence', 'Désignation', 'Qté', 'PU HT', 'Montant HT'],
      totals: { ht: 'Total HT', ttc: 'Total TTC', vatPrefix: 'TVA', dhs: 'DHS' },
      words: { arrête: 'Arrêté le présent document à la somme de :', dirhams: 'dirhams', centimes: 'centimes' },
      signature: { client: 'Cachet et Signature du Client', company: 'Cachet et Signature de la Société' },
      footer: { generatedBy: 'Généré par SmartGestion' },
      devis: { validité: "Validité de l'offre:", conditions: 'Conditions de règlement:' },
      notes: 'Notes:',
      payment: 'Mode de paiement:',
      headerIce: 'I.C.E:',
    },
    devis: {
      title: 'DEVIS',
      entityLabel: 'Client',
      labels: { numero: 'Numéro', date: 'Date', reference: 'Référence', modePaiement: 'Mode de Règlement', echeance: 'Échéance', agent: 'Agent' },
      itemCols: ['Référence', 'Désignation', 'Qté', 'PU HT', 'Montant HT'],
      totals: { ht: 'Total HT', ttc: 'Total TTC', vatPrefix: 'TVA', dhs: 'DHS' },
      words: { arrête: 'Arrêté le présent document à la somme de :', dirhams: 'dirhams', centimes: 'centimes' },
      signature: { client: 'Cachet et Signature du Client', company: 'Cachet et Signature de la Société' },
      footer: { generatedBy: 'Généré par SmartGestion' },
      devis: { validité: "Validité de l'offre:", conditions: 'Conditions de règlement:' },
      notes: 'Notes:',
      payment: 'Mode de paiement:',
      headerIce: 'I.C.E:',
    },
    bon_commande: {
      title: 'BON DE COMMANDE',
      entityLabel: 'Fournisseur',
      labels: { numero: 'Numéro', date: 'Date', reference: 'Référence', modePaiement: 'Mode de Règlement', echeance: 'Échéance', agent: 'Agent' },
      itemCols: ['Référence', 'Désignation', 'Qté', 'PU HT', 'Montant HT'],
      totals: { ht: 'Total HT', ttc: 'Total TTC', vatPrefix: 'TVA', dhs: 'DHS' },
      words: { arrête: 'Arrêté le présent document à la somme de :', dirhams: 'dirhams', centimes: 'centimes' },
      signature: { client: 'Cachet et Signature du Fournisseur', company: 'Cachet et Signature de la Société' },
      footer: { generatedBy: 'Généré par SmartGestion' },
      devis: { validité: "Validité de l'offre:", conditions: 'Conditions de règlement:' },
      notes: 'Notes:',
      payment: 'Mode de paiement:',
      headerIce: 'I.C.E:',
    },
    bon_livraison: {
      title: 'BON DE LIVRAISON',
      entityLabel: 'Fournisseur',
      labels: { numero: 'Numéro', date: 'Date', reference: 'Référence', modePaiement: 'Mode de Règlement', echeance: 'Échéance', agent: 'Agent' },
      itemCols: ['Référence', 'Désignation', 'Qté', 'PU HT', 'Montant HT'],
      totals: { ht: 'Total HT', ttc: 'Total TTC', vatPrefix: 'TVA', dhs: 'DHS' },
      words: { arrête: 'Arrêté le présent document à la somme de :', dirhams: 'dirhams', centimes: 'centimes' },
      signature: { client: 'Cachet et Signature du Fournisseur', company: 'Cachet et Signature de la Société' },
      footer: { generatedBy: 'Généré par SmartGestion' },
      devis: { validité: "Validité de l'offre:", conditions: 'Conditions de règlement:' },
      notes: 'Notes:',
      payment: 'Mode de paiement:',
      headerIce: 'I.C.E:',
    },
  },
  en: {
    facture: {
      title: 'INVOICE',
      entityLabel: 'Client',
      labels: { numero: 'No.', date: 'Date', reference: 'Reference', modePaiement: 'Payment Method', echeance: 'Due Date', agent: 'Agent' },
      itemCols: ['Reference', 'Description', 'Qty', 'Unit Price', 'Total'],
      totals: { ht: 'Total (excl. tax)', ttc: 'Total (incl. tax)', vatPrefix: 'VAT', dhs: 'MAD' },
      words: { arrête: 'Total amount in words:', dirhams: 'MAD', centimes: 'Centimes' },
      signature: { client: 'Client Signature & Stamp', company: 'Company Signature & Stamp' },
      footer: { generatedBy: 'Generated by SmartGestion' },
      devis: { validité: 'Offer validity:', conditions: 'Payment terms:' },
      notes: 'Notes:',
      payment: 'Payment method:',
      headerIce: 'ICE:',
    },
    devis: {
      title: 'QUOTE',
      entityLabel: 'Client',
      labels: { numero: 'No.', date: 'Date', reference: 'Reference', modePaiement: 'Payment Method', echeance: 'Valid Until', agent: 'Agent' },
      itemCols: ['Reference', 'Description', 'Qty', 'Unit Price', 'Total'],
      totals: { ht: 'Total (excl. tax)', ttc: 'Total (incl. tax)', vatPrefix: 'VAT', dhs: 'MAD' },
      words: { arrête: 'Total amount in words:', dirhams: 'MAD', centimes: 'Centimes' },
      signature: { client: 'Client Signature & Stamp', company: 'Company Signature & Stamp' },
      footer: { generatedBy: 'Generated by SmartGestion' },
      devis: { validité: 'Offer validity:', conditions: 'Payment terms:' },
      notes: 'Notes:',
      payment: 'Payment method:',
      headerIce: 'ICE:',
    },
    bon_commande: {
      title: 'PURCHASE ORDER',
      entityLabel: 'Supplier',
      labels: { numero: 'No.', date: 'Date', reference: 'Reference', modePaiement: 'Payment Method', echeance: 'Due Date', agent: 'Agent' },
      itemCols: ['Reference', 'Description', 'Qty', 'Unit Price', 'Total'],
      totals: { ht: 'Total (excl. tax)', ttc: 'Total (incl. tax)', vatPrefix: 'VAT', dhs: 'MAD' },
      words: { arrête: 'Total amount in words:', dirhams: 'MAD', centimes: 'Centimes' },
      signature: { client: 'Supplier Signature & Stamp', company: 'Company Signature & Stamp' },
      footer: { generatedBy: 'Generated by SmartGestion' },
      devis: { validité: 'Offer validity:', conditions: 'Payment terms:' },
      notes: 'Notes:',
      payment: 'Payment method:',
      headerIce: 'ICE:',
    },
    bon_livraison: {
      title: 'DELIVERY NOTE',
      entityLabel: 'Supplier',
      labels: { numero: 'No.', date: 'Date', reference: 'Reference', modePaiement: 'Payment Method', echeance: 'Due Date', agent: 'Agent' },
      itemCols: ['Reference', 'Description', 'Qty', 'Unit Price', 'Total'],
      totals: { ht: 'Total (excl. tax)', ttc: 'Total (incl. tax)', vatPrefix: 'VAT', dhs: 'MAD' },
      words: { arrête: 'Total amount in words:', dirhams: 'MAD', centimes: 'Centimes' },
      signature: { client: 'Supplier Signature & Stamp', company: 'Company Signature & Stamp' },
      footer: { generatedBy: 'Generated by SmartGestion' },
      devis: { validité: 'Offer validity:', conditions: 'Payment terms:' },
      notes: 'Notes:',
      payment: 'Payment method:',
      headerIce: 'ICE:',
    },
  },
  ar: {
    facture: {
      title: 'فاتورة',
      entityLabel: 'العميل',
      labels: { numero: 'الرقم', date: 'التاريخ', reference: 'المرجع', modePaiement: 'طريقة الدفع', echeance: 'تاريخ الاستحقاق', agent: 'الوكيل' },
      itemCols: ['المرجع', 'البيان', 'الكمية', 'ثمن الوحدة', 'المبلغ'],
      totals: { ht: 'المجموع (خ.ض)', ttc: 'المجموع شامل الرسوم', vatPrefix: 'ض.ق.م', dhs: 'درهم' },
      words: { arrête: 'المبلغ الإجمالي بالحروف:', dirhams: 'درهما', centimes: 'سنتيما' },
      signature: { client: 'ختم وتوقيع العميل', company: 'ختم وتوقيع الشركة' },
      footer: { generatedBy: 'تم الإنشاء بواسطة SmartGestion' },
      devis: { validité: 'صلاحية العرض:', conditions: 'شروط الدفع:' },
      notes: 'ملاحظات:',
      payment: 'طريقة الدفع:',
      headerIce: 'I.C.E:',
    },
    devis: {
      title: 'عرض سعر',
      entityLabel: 'العميل',
      labels: { numero: 'الرقم', date: 'التاريخ', reference: 'المرجع', modePaiement: 'طريقة الدفع', echeance: 'تاريخ الصلاحية', agent: 'الوكيل' },
      itemCols: ['المرجع', 'البيان', 'الكمية', 'ثمن الوحدة', 'المبلغ'],
      totals: { ht: 'المجموع (خ.ض)', ttc: 'المجموع شامل الرسوم', vatPrefix: 'ض.ق.م', dhs: 'درهم' },
      words: { arrête: 'المبلغ الإجمالي بالحروف:', dirhams: 'درهما', centimes: 'سنتيما' },
      signature: { client: 'ختم وتوقيع العميل', company: 'ختم وتوقيع الشركة' },
      footer: { generatedBy: 'تم الإنشاء بواسطة SmartGestion' },
      devis: { validité: 'صلاحية العرض:', conditions: 'شروط الدفع:' },
      notes: 'ملاحظات:',
      payment: 'طريقة الدفع:',
      headerIce: 'I.C.E:',
    },
    bon_commande: {
      title: 'أمر شراء',
      entityLabel: 'المورد',
      labels: { numero: 'الرقم', date: 'التاريخ', reference: 'المرجع', modePaiement: 'طريقة الدفع', echeance: 'تاريخ الاستحقاق', agent: 'الوكيل' },
      itemCols: ['المرجع', 'البيان', 'الكمية', 'ثمن الوحدة', 'المبلغ'],
      totals: { ht: 'المجموع (خ.ض)', ttc: 'المجموع شامل الرسوم', vatPrefix: 'ض.ق.م', dhs: 'درهم' },
      words: { arrête: 'المبلغ الإجمالي بالحروف:', dirhams: 'درهما', centimes: 'سنتيما' },
      signature: { client: 'ختم وتوقيع المورد', company: 'ختم وتوقيع الشركة' },
      footer: { generatedBy: 'تم الإنشاء بواسطة SmartGestion' },
      devis: { validité: 'صلاحية العرض:', conditions: 'شروط الدفع:' },
      notes: 'ملاحظات:',
      payment: 'طريقة الدفع:',
      headerIce: 'I.C.E:',
    },
    bon_livraison: {
      title: 'إيصال تسليم',
      entityLabel: 'المورد',
      labels: { numero: 'الرقم', date: 'التاريخ', reference: 'المرجع', modePaiement: 'طريقة الدفع', echeance: 'تاريخ الاستحقاق', agent: 'الوكيل' },
      itemCols: ['المرجع', 'البيان', 'الكمية', 'ثمن الوحدة', 'المبلغ'],
      totals: { ht: 'المجموع (خ.ض)', ttc: 'المجموع شامل الرسوم', vatPrefix: 'ض.ق.م', dhs: 'درهم' },
      words: { arrête: 'المبلغ الإجمالي بالحروف:', dirhams: 'درهما', centimes: 'سنتيما' },
      signature: { client: 'ختم وتوقيع المورد', company: 'ختم وتوقيع الشركة' },
      footer: { generatedBy: 'تم الإنشاء بواسطة SmartGestion' },
      devis: { validité: 'صلاحية العرض:', conditions: 'شروط الدفع:' },
      notes: 'ملاحظات:',
      payment: 'طريقة الدفع:',
      headerIce: 'I.C.E:',
    },
  },
};

function getDocumentLabels(docType: string, language: string = 'fr'): DocumentLabels {
  const lang = language?.startsWith('ar') ? 'ar' : language?.startsWith('en') ? 'en' : 'fr';
  return DOCUMENT_LABELS[lang]?.[docType] || DOCUMENT_LABELS.fr.facture;
}

const NUMBER_UNITS = [
  '', 'mille', 'million', 'milliard',
];
const NUMBER_WORDS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
  'vingt', 'vingt et un', 'vingt-deux', 'vingt-trois', 'vingt-quatre', 'vingt-cinq', 'vingt-six', 'vingt-sept', 'vingt-huit', 'vingt-neuf',
  'trente', 'trente et un', 'trente-deux', 'trente-trois', 'trente-quatre', 'trente-cinq', 'trente-six', 'trente-sept', 'trente-huit', 'trente-neuf',
  'quarante', 'quarante et un', 'quarante-deux', 'quarante-trois', 'quarante-quatre', 'quarante-cinq', 'quarante-six', 'quarante-sept', 'quarante-huit', 'quarante-neuf',
  'cinquante', 'cinquante et un', 'cinquante-deux', 'cinquante-trois', 'cinquante-quatre', 'cinquante-cinq', 'cinquante-six', 'cinquante-sept', 'cinquante-huit', 'cinquante-neuf',
  'soixante', 'soixante et un', 'soixante-deux', 'soixante-trois', 'soixante-quatre', 'soixante-cinq', 'soixante-six', 'soixante-sept', 'soixante-huit', 'soixante-neuf',
  'soixante-dix', 'soixante et onze', 'soixante-douze', 'soixante-treize', 'soixante-quatorze', 'soixante-quinze', 'soixante-seize', 'soixante-dix-sept', 'soixante-dix-huit', 'soixante-dix-neuf',
  'quatre-vingts', 'quatre-vingt-un', 'quatre-vingt-deux', 'quatre-vingt-trois', 'quatre-vingt-quatre', 'quatre-vingt-cinq', 'quatre-vingt-six', 'quatre-vingt-sept', 'quatre-vingt-huit', 'quatre-vingt-neuf',
  'quatre-vingt-dix', 'quatre-vingt-onze', 'quatre-vingt-douze', 'quatre-vingt-treize', 'quatre-vingt-quatorze', 'quatre-vingt-quinze', 'quatre-vingt-seize', 'quatre-vingt-dix-sept', 'quatre-vingt-dix-huit', 'quatre-vingt-dix-neuf',
];

function convertBelow1000(n: number): string {
  if (n === 0) return '';
  let result = '';
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;

  if (hundreds > 0) {
    if (hundreds === 1) {
      result += 'cent';
    } else {
      result += NUMBER_WORDS[hundreds] + ' cent';
    }
    if (remainder === 0 && hundreds > 1) {
      result += 's';
    }
  }

  if (remainder > 0) {
    if (result) result += ' ';
    if (remainder < 20) {
      result += NUMBER_WORDS[remainder];
    } else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      if (tens === 8) {
        result += NUMBER_WORDS[18 + ones];
      } else if (tens === 9) {
        result += NUMBER_WORDS[18 + 10 + ones];
      } else {
        result += NUMBER_WORDS[tens * 10];
        if (ones > 0) {
          result += '-' + NUMBER_WORDS[ones];
        }
      }
    }
  }

  return result;
}

function numberToWords(n: number): string {
  if (n === 0) return NUMBER_WORDS[0];

  const negative = n < 0;
  n = Math.abs(n);

  const parts: string[] = [];
  let unitIndex = 0;

  while (n > 0) {
    const chunk = n % 1000;
    if (chunk > 0) {
      let chunkStr = convertBelow1000(chunk);
      if (unitIndex === 1 && chunk === 1) {
        chunkStr = 'mille';
      } else if (unitIndex > 0) {
        chunkStr += ' ' + NUMBER_UNITS[unitIndex];
        if (chunk > 1 && unitIndex > 1) {
          chunkStr += 's';
        }
      }
      parts.unshift(chunkStr);
    }
    n = Math.floor(n / 1000);
    unitIndex++;
  }

  let result = parts.join(' ');
  if (negative) result = 'moins ' + result;
  return result.trim();
}

function numberToWordsCurrency(amount: number, labels?: DocumentLabels): string {
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  const d = labels?.words.dirhams || 'dirhams';
  const c = labels?.words.centimes || 'centimes';

  let result = numberToWords(whole) + ' ' + d;
  if (cents > 0) {
    result += ' et ' + numberToWords(cents) + ' ' + c;
  }
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function formatCurrency(value: number, decimals: number = 2): string {
  // Strip trailing zeros: integers show no decimals, floats keep up to 2
  // significant fraction digits (e.g. 269 -> "269", 53.8 -> "53,8",
  // 53.85 -> "53,85"). The `decimals` argument now only caps the maximum.
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(decimals, 2),
  }).format(value);
}

function formatDate(dateStr: string, language?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const locale = language?.startsWith('ar') ? 'ar-MA' : language?.startsWith('en') ? 'en-US' : 'fr-FR';
  return new Intl.DateTimeFormat(locale).format(d);
}

interface TvaBucket {
  rate: number
  baseHt: number
  montantTva: number
}

function computeTvaBuckets(items: DocumentItem[]): TvaBucket[] {
  const map = new Map<number, TvaBucket>()
  for (const item of items) {
    const qte = Number(item.quantite) || 0
    const pu = Number(item.prix_unitaire_ht) || 0
    const totalHt = qte * pu
    const tvaRate = Number(item.tva ?? 20)
    const existing = map.get(tvaRate)
    if (existing) {
      existing.baseHt += totalHt
      existing.montantTva += totalHt * (tvaRate / 100)
    } else {
      map.set(tvaRate, { rate: tvaRate, baseHt: totalHt, montantTva: totalHt * (tvaRate / 100) })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.rate - a.rate)
}

export interface DocumentItem {
  reference?: string;
  designation: string;
  quantite: number;
  prix_unitaire_ht: number;
  tva?: number;
}

export interface DocumentData {
  documentType: 'facture' | 'devis' | 'bon_commande' | 'bon_livraison';
  language?: string;
  userId?: string;
  numero: string;
  date: string;
  reference?: string;
  modePaiement?: string;
  echeance?: string;
  agent?: string;
  client: {
    nom: string;
    adresse?: string;
    ville?: string;
    ice?: string;
    rc?: string;
    telephone?: string;
    email?: string;
  };
  company: {
    nom: string;
    adresse: string;
    ville: string;
    codePostal?: string;
    telephone?: string;
    email?: string;
    siteWeb?: string;
    rc: string;
    if_number: string;
    ice: string;
    capital?: string;
    formeJuridique?: string;
    logo?: string;
  };
  items: DocumentItem[];
  notes?: string;
  conditionsPaiement?: string;
  watermarkText?: string;
}

function generateHTML(data: DocumentData): string {
  const L = getDocumentLabels(data.documentType, data.language);
  const title = L.title;
  const entityLabel = L.entityLabel;

  let totalHT = 0;
  let totalTVA = 0;
  let totalTTC = 0;

  const ITEMS_PER_PDF_PAGE = 8;
  const singleRow = (item: DocumentItem) => {
    const qte = Number(item.quantite) || 0;
    const pu = Number(item.prix_unitaire_ht) || 0;
    const montantHT = qte * pu;
    const tvaRate = Number(item.tva ?? 20);
    const montantTVA = montantHT * (tvaRate / 100);
    const montantTTC = montantHT + montantTVA;

    totalHT += montantHT;
    totalTVA += montantTVA;
    totalTTC += montantTTC;

    return `
      <tr>
        <td style="padding:5px 6px;font-size:9pt;text-align:left;border-bottom:0.5pt solid #E5E7EB;">${item.reference || '-'}</td>
        <td style="padding:5px 6px;font-size:9pt;text-align:left;border-bottom:0.5pt solid #E5E7EB;">${item.designation}</td>
        <td style="padding:5px 6px;font-size:9pt;text-align:right;border-bottom:0.5pt solid #E5E7EB;">${formatCurrency(qte)}</td>
        <td style="padding:5px 6px;font-size:9pt;text-align:right;border-bottom:0.5pt solid #E5E7EB;">${formatCurrency(pu, 4)}</td>
        <td style="padding:5px 6px;font-size:9pt;text-align:right;font-weight:600;border-bottom:0.5pt solid #E5E7EB;">${formatCurrency(montantHT)}</td>
      </tr>`;
  };

  // Split products into chunks of 8 so each page holds exactly 8 products.
  // The page break is placed on the wrapping <div> (reliable in Chromium),
  // instead of on a <tr> (which Chromium ignores).
  const itemChunks: DocumentItem[][] = [];
  for (let i = 0; i < data.items.length; i += ITEMS_PER_PDF_PAGE) {
    itemChunks.push(data.items.slice(i, i + ITEMS_PER_PDF_PAGE));
  }
  const itemsTable = itemChunks.map((chunk, chunkIndex) => {
    const isLastChunk = chunkIndex === itemChunks.length - 1;
    const wrapStyle = isLastChunk ? '' : ' style="page-break-after:always;"';
    const rows = chunk.map(singleRow).join('');
    return `
  <div class="items-block"${wrapStyle}>
    <table class="items-table">
      <thead>
        <tr>
          <th class="ref">${L.itemCols[0]}</th>
          <th class="des">${L.itemCols[1]}</th>
          <th class="qty">${L.itemCols[2]}</th>
          <th class="pu">${L.itemCols[3]}</th>
          <th class="mht">${L.itemCols[4]}</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>`;
  }).join('');

  const tvaBuckets = computeTvaBuckets(data.items);
  const dhs = L.totals.dhs;
  const tvaRows = tvaBuckets.length > 0
    ? tvaBuckets.map(b => `
      <tr>
        <td style="padding:4px 8px;border:1px solid #000;text-align:left;">${L.totals.vatPrefix} ${b.rate}%</td>
        <td style="padding:4px 8px;border:1px solid #000;text-align:right;font-weight:600;">${formatCurrency(b.montantTva)} ${dhs}</td>
      </tr>`).join('')
    : `
      <tr>
        <td style="padding:4px 8px;border:1px solid #000;text-align:left;">${L.totals.vatPrefix} 0%</td>
        <td style="padding:4px 8px;border:1px solid #000;text-align:right;font-weight:600;">0,00 ${dhs}</td>
      </tr>`;

  const amountInWords = numberToWordsCurrency(totalTTC, L);
  const echeance = data.echeance ? formatDate(data.echeance, data.language) : null;

  const clientLines = [
    `<strong>${entityLabel}:</strong> ${data.client.nom}`,
    data.client.adresse ? data.client.adresse : null,
    data.client.ville ? data.client.ville : null,
    data.client.telephone ? (data.language?.startsWith('ar') ? 'هاتف: ' : data.language?.startsWith('en') ? 'Tel: ' : 'Tél: ') + data.client.telephone : null,
    data.client.email ? 'Email: ' + data.client.email : null,
    data.client.ice ? (data.language?.startsWith('ar') ? 'I.C.E: ' : 'ICE: ') + data.client.ice : null,
  ].filter(Boolean).join('<br>');

  const itemCols = L.itemCols;

  const isFirstPage = true;
  const htmlLang = data.language?.startsWith('ar') ? 'ar' : data.language?.startsWith('en') ? 'en' : 'fr';
  const htmlDir = htmlLang === 'ar' ? 'rtl' : 'ltr';

  return `<!DOCTYPE html>
<html lang="${htmlLang}" dir="${htmlDir}">
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: A4;
    margin: 15mm;
  }
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Helvetica', 'Arial', sans-serif;
  }
  body {
    font-size: 10pt;
    line-height: 1.4;
    color: #000;
  }
  .items-table {
    width: 100%;
    border-collapse: collapse;
  }
  .items-table thead {
    display: table-header-group;
  }
  .items-table th {
    padding: 6px 8px;
    font-size: 12pt;
    font-weight: 700;
    color: #000;
    border-bottom: 1.5pt solid #000;
  }
  .items-table th.ref { width: 15%; text-align: left; }
  .items-table th.des { width: 45%; text-align: left; }
  .items-table th.qty { width: 10%; text-align: right; }
  .items-table th.pu { width: 15%; text-align: right; }
  .items-table th.mht { width: 15%; text-align: right; }
  .items-table td {
    font-size: 9pt;
    border-bottom: 0.5pt solid #E5E7EB;
  }
  .totals-wrapper {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 10px;
  }
  .words-block {
    max-width: 50%;
    font-size: 9pt;
  }
  .words-block .label {
    font-weight: 700;
    margin: 0;
    font-size: 9pt;
  }
  .words-block .amount {
    font-weight: 700;
    margin: 4px 0 0;
    font-style: italic;
    font-size: 9pt;
  }
  .words-block .payment {
    margin: 6px 0 0;
    font-size: 9pt;
    font-weight: 600;
    color: #374151;
  }
  .totals-table {
    border-collapse: collapse;
    width: 220px;
  }
  .totals-table td {
    border: 1px solid #000;
    padding: 4px 8px;
    font-size: 9pt;
  }
  .totals-table .value-cell {
    text-align: right;
    font-weight: 600;
  }
  .totals-table .total-ttc td {
    font-weight: 700;
    font-size: 10pt;
  }
  .totals-table .total-ttc .value-cell {
    font-weight: 800;
  }
  .devis-extra {
    margin-top: 8px;
    padding: 6px 8px;
    font-size: 9pt;
    border: 1px solid #000;
    display: flex;
    gap: 24px;
  }
  .notes-section {
    margin-top: 6px;
    padding: 4px 6px;
    font-size: 8pt;
    color: #475569;
    border-top: 1px solid #000;
  }
  .signatures {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dotted #000;
  }
  .signature-box {
    text-align: center;
    flex: 1;
  }
  .signature-line {
    width: 160px;
    height: 50px;
    border-bottom: 2px dashed #000;
    margin: 0 auto 4px;
  }
  .signature-label {
    font-size: 9pt;
  }
  .footer {
    margin-top: 8px;
    padding-top: 5px;
    border-top: 1px solid #000;
    text-align: center;
    font-size: 7pt;
    line-height: 1.5;
    color: #475569;
  }
  .footer .app-credit {
    font-size: 6pt;
    color: #94a3b8;
  }
</style>
</head>
<body>
<div class="page">
  <div class="watermark">${data.watermarkText || 'SmartGestion'}</div>

  <!-- HEADER -->
  <div class="header-section">
    <div class="brand-left">
      ${data.company.logo
        ? `<img src="${data.company.logo}" alt="Logo" style="width:120px;height:60px;object-fit:contain;display:block;margin-bottom:4px;" />`
        : `<div style="font-size:18pt;font-weight:700;color:#000;letter-spacing:1px;margin-bottom:4px;">${(data.company.nom || 'PARAGESTION').substring(0, 4).toUpperCase()}</div>`
      }
      <div>
        <div class="brand-name">${data.company.nom || 'SmartGestion'}</div>
        <div class="brand-sub">${data.language?.startsWith('ar') ? 'حل الإدارة' : data.language?.startsWith('en') ? 'Management Solution' : 'Solution de Gestion'}</div>
      </div>
    </div>
    <div class="title-right">
      <div class="doc-title">${title}</div>
      <div class="doc-ice">${L.headerIce} ${data.company.ice}</div>
    </div>
  </div>

  <!-- METADATA TABLE -->
  <table class="metadata-table">
    <thead>
      <tr>
        ${Object.values(L.labels).map(l => `<th>${l}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${data.numero}</td>
        <td>${formatDate(data.date, data.language)}</td>
        <td>${data.reference || '-'}</td>
        <td>${data.modePaiement || '-'}</td>
        <td>${echeance || '-'}</td>
        <td>${data.agent || '-'}</td>
      </tr>
    </tbody>
  </table>

  <!-- CLIENT BOX -->
  <div class="client-box">
    ${clientLines}
  </div>

  <!-- ITEMS TABLE -->
  ${itemsTable}

  <!-- TOTALS + WORDS -->
  <div class="totals-wrapper">
    <div class="words-block">
      <p class="label">${L.words.arrête}</p>
      <p class="amount">${amountInWords}</p>
      ${data.modePaiement ? '<p class="payment">' + L.payment + ' ' + data.modePaiement + '</p>' : ''}
    </div>
    <table class="totals-table">
      <tr>
        <td>${L.totals.ht}</td>
        <td class="value-cell">${formatCurrency(totalHT)} ${dhs}</td>
      </tr>
      ${tvaRows}
      <tr class="total-ttc">
        <td>${L.totals.ttc}</td>
        <td class="value-cell">${formatCurrency(totalTTC)} ${dhs}</td>
      </tr>
    </table>
  </div>

  <!-- DEVIS-SPECIFIC -->
  ${data.documentType === 'devis' && (data.echeance || data.conditionsPaiement) ? `
  <div class="devis-extra">
    ${data.echeance ? '<div><strong>' + L.devis.validité + '</strong> ' + formatDate(data.echeance, data.language) + '</div>' : ''}
    ${data.conditionsPaiement ? '<div><strong>' + L.devis.conditions + '</strong> ' + data.conditionsPaiement + '</div>' : ''}
  </div>
  ` : ''}

  <!-- NOTES -->
  ${data.notes ? `
  <div class="notes-section">
    <strong>${L.notes}</strong> ${data.notes}
  </div>
  ` : ''}

  <!-- SIGNATURES -->
  <div class="signatures">
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">${L.signature.client}</div>
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">${L.signature.company}</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    ${data.company.formeJuridique && data.company.capital ? data.company.formeJuridique + (data.language?.startsWith('en') ? ' with capital of ' : ' au Capital de ') + data.company.capital + ' — ' : ''}
    ${data.company.rc ? 'R.C: ' + data.company.rc + ' — ' : ''}
    ${data.company.if_number ? (data.language?.startsWith('ar') ? 'I.F: ' : 'I.F: ') + data.company.if_number + ' — ' : ''}
    ${data.company.ice ? (data.language?.startsWith('ar') ? 'I.C.E: ' : 'ICE: ') + data.company.ice : ''}
    <br>
    <span class="app-credit">${L.footer.generatedBy}</span>
  </div>
</div>
</body>
</html>`;
}

async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    if (url.startsWith('data:')) return url;
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

async function resolveLogo(data: DocumentData): Promise<string | undefined> {
  if (data.company.logo) {
    console.log('[PDF] Logo already provided in request data');
    return data.company.logo;
  }
  if (!data.userId) {
    console.log('[PDF] No userId provided, skipping logo fetch');
    return undefined;
  }
  try {
    const { data: row } = await supabase
      .from('parametres')
      .select('logo_url')
      .eq('user_id', data.userId)
      .maybeSingle();
    if (row?.logo_url) {
      console.log('[PDF] Logo URL retrieved from parametres');
      const base64 = await imageUrlToBase64(row.logo_url);
      if (base64) {
        console.log('[PDF] Logo converted to Base64 successfully');
        return base64;
      }
      console.warn('[PDF] Base64 conversion failed, falling back to raw URL');
      return null;
    }
    console.log('[PDF] No logo_url found in parametres');
  } catch (err) {
    console.error('[PDF] Error fetching logo:', err);
  }
  return undefined;
}

export async function generatePDF(data: DocumentData): Promise<Buffer> {
  const html = generateHTML(data);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' as any });

    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      printBackground: true,
      preferCSSPageSize: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function generatePDFController(req: any, res: any) {
  try {
    const data = req.body as DocumentData;

    if (!data.documentType || !data.items || !data.numero || !data.date) {
      return res.status(400).json({
        error: 'Missing required fields: documentType, items, numero, date',
      });
    }

    const supportedTypes = ['facture', 'devis', 'bon_commande', 'bon_livraison'];
    if (!supportedTypes.includes(data.documentType)) {
      return res.status(400).json({
        error: `Type de document invalide: ${data.documentType}. Types supportés: ${supportedTypes.join(', ')}`,
      });
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
      return res.status(400).json({
        error: 'Items list is empty or invalid',
      });
    }

    if (!data.client?.nom) {
      return res.status(400).json({ error: 'Client name is required' });
    }

    if (!data.company?.rc || !data.company?.if_number || !data.company?.ice) {
      return res.status(400).json({
        error: 'Company info required: rc, if_number, ice',
      });
    }

    data.company.logo = await resolveLogo(data);

    const pdfBuffer = await generatePDF(data);

    const L = getDocumentLabels(data.documentType, data.language);
    const filename = `${L.title.replace(/\s+/g, '_')}_${data.numero.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      error: 'Erreur lors de la génération du PDF',
      details: error.message,
    });
  }
}
