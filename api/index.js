import{createRequire}from'module';const require=createRequire(import.meta.url);

// scripts/api-entry.ts
import "dotenv/config";
import express from "express";

// src/routes/api.ts
import { Router } from "express";

// src/lib/supabase.server.ts
import { createClient } from "@supabase/supabase-js";
function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}
var SUPABASE_URL = requireEnv("VITE_SUPABASE_URL");
var SUPABASE_ANON_KEY = requireEnv("VITE_SUPABASE_ANON_KEY");
var SUPABASE_SERVICE_KEY = requireEnv("VITE_SUPABASE_SERVICE_KEY");
var supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
var supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// src/lib/pdfGenerator.ts
import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var DOCUMENT_LABELS = {
  fr: {
    facture: {
      title: "FACTURE",
      entityLabel: "Client",
      labels: { numero: "Num\xE9ro", date: "Date", reference: "R\xE9f\xE9rence", modePaiement: "Mode de R\xE8glement", echeance: "\xC9ch\xE9ance", agent: "Agent" },
      itemCols: ["R\xE9f\xE9rence", "D\xE9signation", "Qt\xE9", "PU HT", "Montant HT"],
      totals: { ht: "Total HT", ttc: "Total TTC", vatPrefix: "TVA", dhs: "DHS" },
      words: { arr\u00EAte: "Arr\xEAt\xE9 le pr\xE9sent document \xE0 la somme de :", dirhams: "dirhams", centimes: "centimes" },
      signature: { client: "Cachet et Signature du Client", company: "Cachet et Signature de la Soci\xE9t\xE9" },
      footer: { generatedBy: "G\xE9n\xE9r\xE9 par ParaGestion" },
      devis: { validit\u00E9: "Validit\xE9 de l'offre:", conditions: "Conditions de r\xE8glement:" },
      notes: "Notes:",
      payment: "Mode de paiement:",
      headerIce: "I.C.E:"
    },
    devis: {
      title: "DEVIS",
      entityLabel: "Client",
      labels: { numero: "Num\xE9ro", date: "Date", reference: "R\xE9f\xE9rence", modePaiement: "Mode de R\xE8glement", echeance: "\xC9ch\xE9ance", agent: "Agent" },
      itemCols: ["R\xE9f\xE9rence", "D\xE9signation", "Qt\xE9", "PU HT", "Montant HT"],
      totals: { ht: "Total HT", ttc: "Total TTC", vatPrefix: "TVA", dhs: "DHS" },
      words: { arr\u00EAte: "Arr\xEAt\xE9 le pr\xE9sent document \xE0 la somme de :", dirhams: "dirhams", centimes: "centimes" },
      signature: { client: "Cachet et Signature du Client", company: "Cachet et Signature de la Soci\xE9t\xE9" },
      footer: { generatedBy: "G\xE9n\xE9r\xE9 par ParaGestion" },
      devis: { validit\u00E9: "Validit\xE9 de l'offre:", conditions: "Conditions de r\xE8glement:" },
      notes: "Notes:",
      payment: "Mode de paiement:",
      headerIce: "I.C.E:"
    },
    bon_commande: {
      title: "BON DE COMMANDE",
      entityLabel: "Fournisseur",
      labels: { numero: "Num\xE9ro", date: "Date", reference: "R\xE9f\xE9rence", modePaiement: "Mode de R\xE8glement", echeance: "\xC9ch\xE9ance", agent: "Agent" },
      itemCols: ["R\xE9f\xE9rence", "D\xE9signation", "Qt\xE9", "PU HT", "Montant HT"],
      totals: { ht: "Total HT", ttc: "Total TTC", vatPrefix: "TVA", dhs: "DHS" },
      words: { arr\u00EAte: "Arr\xEAt\xE9 le pr\xE9sent document \xE0 la somme de :", dirhams: "dirhams", centimes: "centimes" },
      signature: { client: "Cachet et Signature du Fournisseur", company: "Cachet et Signature de la Soci\xE9t\xE9" },
      footer: { generatedBy: "G\xE9n\xE9r\xE9 par ParaGestion" },
      devis: { validit\u00E9: "Validit\xE9 de l'offre:", conditions: "Conditions de r\xE8glement:" },
      notes: "Notes:",
      payment: "Mode de paiement:",
      headerIce: "I.C.E:"
    },
    bon_livraison: {
      title: "BON DE LIVRAISON",
      entityLabel: "Fournisseur",
      labels: { numero: "Num\xE9ro", date: "Date", reference: "R\xE9f\xE9rence", modePaiement: "Mode de R\xE8glement", echeance: "\xC9ch\xE9ance", agent: "Agent" },
      itemCols: ["R\xE9f\xE9rence", "D\xE9signation", "Qt\xE9", "PU HT", "Montant HT"],
      totals: { ht: "Total HT", ttc: "Total TTC", vatPrefix: "TVA", dhs: "DHS" },
      words: { arr\u00EAte: "Arr\xEAt\xE9 le pr\xE9sent document \xE0 la somme de :", dirhams: "dirhams", centimes: "centimes" },
      signature: { client: "Cachet et Signature du Fournisseur", company: "Cachet et Signature de la Soci\xE9t\xE9" },
      footer: { generatedBy: "G\xE9n\xE9r\xE9 par ParaGestion" },
      devis: { validit\u00E9: "Validit\xE9 de l'offre:", conditions: "Conditions de r\xE8glement:" },
      notes: "Notes:",
      payment: "Mode de paiement:",
      headerIce: "I.C.E:"
    }
  },
  en: {
    facture: {
      title: "INVOICE",
      entityLabel: "Client",
      labels: { numero: "No.", date: "Date", reference: "Reference", modePaiement: "Payment Method", echeance: "Due Date", agent: "Agent" },
      itemCols: ["Reference", "Description", "Qty", "Unit Price", "Total"],
      totals: { ht: "Total (excl. tax)", ttc: "Total (incl. tax)", vatPrefix: "VAT", dhs: "MAD" },
      words: { arr\u00EAte: "Total amount in words:", dirhams: "MAD", centimes: "Centimes" },
      signature: { client: "Client Signature & Stamp", company: "Company Signature & Stamp" },
      footer: { generatedBy: "Generated by ParaGestion" },
      devis: { validit\u00E9: "Offer validity:", conditions: "Payment terms:" },
      notes: "Notes:",
      payment: "Payment method:",
      headerIce: "ICE:"
    },
    devis: {
      title: "QUOTE",
      entityLabel: "Client",
      labels: { numero: "No.", date: "Date", reference: "Reference", modePaiement: "Payment Method", echeance: "Valid Until", agent: "Agent" },
      itemCols: ["Reference", "Description", "Qty", "Unit Price", "Total"],
      totals: { ht: "Total (excl. tax)", ttc: "Total (incl. tax)", vatPrefix: "VAT", dhs: "MAD" },
      words: { arr\u00EAte: "Total amount in words:", dirhams: "MAD", centimes: "Centimes" },
      signature: { client: "Client Signature & Stamp", company: "Company Signature & Stamp" },
      footer: { generatedBy: "Generated by ParaGestion" },
      devis: { validit\u00E9: "Offer validity:", conditions: "Payment terms:" },
      notes: "Notes:",
      payment: "Payment method:",
      headerIce: "ICE:"
    },
    bon_commande: {
      title: "PURCHASE ORDER",
      entityLabel: "Supplier",
      labels: { numero: "No.", date: "Date", reference: "Reference", modePaiement: "Payment Method", echeance: "Due Date", agent: "Agent" },
      itemCols: ["Reference", "Description", "Qty", "Unit Price", "Total"],
      totals: { ht: "Total (excl. tax)", ttc: "Total (incl. tax)", vatPrefix: "VAT", dhs: "MAD" },
      words: { arr\u00EAte: "Total amount in words:", dirhams: "MAD", centimes: "Centimes" },
      signature: { client: "Supplier Signature & Stamp", company: "Company Signature & Stamp" },
      footer: { generatedBy: "Generated by ParaGestion" },
      devis: { validit\u00E9: "Offer validity:", conditions: "Payment terms:" },
      notes: "Notes:",
      payment: "Payment method:",
      headerIce: "ICE:"
    },
    bon_livraison: {
      title: "DELIVERY NOTE",
      entityLabel: "Supplier",
      labels: { numero: "No.", date: "Date", reference: "Reference", modePaiement: "Payment Method", echeance: "Due Date", agent: "Agent" },
      itemCols: ["Reference", "Description", "Qty", "Unit Price", "Total"],
      totals: { ht: "Total (excl. tax)", ttc: "Total (incl. tax)", vatPrefix: "VAT", dhs: "MAD" },
      words: { arr\u00EAte: "Total amount in words:", dirhams: "MAD", centimes: "Centimes" },
      signature: { client: "Supplier Signature & Stamp", company: "Company Signature & Stamp" },
      footer: { generatedBy: "Generated by ParaGestion" },
      devis: { validit\u00E9: "Offer validity:", conditions: "Payment terms:" },
      notes: "Notes:",
      payment: "Payment method:",
      headerIce: "ICE:"
    }
  },
  ar: {
    facture: {
      title: "\u0641\u0627\u062A\u0648\u0631\u0629",
      entityLabel: "\u0627\u0644\u0639\u0645\u064A\u0644",
      labels: { numero: "\u0627\u0644\u0631\u0642\u0645", date: "\u0627\u0644\u062A\u0627\u0631\u064A\u062E", reference: "\u0627\u0644\u0645\u0631\u062C\u0639", modePaiement: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062F\u0641\u0639", echeance: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642", agent: "\u0627\u0644\u0648\u0643\u064A\u0644" },
      itemCols: ["\u0627\u0644\u0645\u0631\u062C\u0639", "\u0627\u0644\u0628\u064A\u0627\u0646", "\u0627\u0644\u0643\u0645\u064A\u0629", "\u062B\u0645\u0646 \u0627\u0644\u0648\u062D\u062F\u0629", "\u0627\u0644\u0645\u0628\u0644\u063A"],
      totals: { ht: "\u0627\u0644\u0645\u062C\u0645\u0648\u0639 (\u062E.\u0636)", ttc: "\u0627\u0644\u0645\u062C\u0645\u0648\u0639 \u0634\u0627\u0645\u0644 \u0627\u0644\u0631\u0633\u0648\u0645", vatPrefix: "\u0636.\u0642.\u0645", dhs: "\u062F\u0631\u0647\u0645" },
      words: { arr\u00EAte: "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A \u0628\u0627\u0644\u062D\u0631\u0648\u0641:", dirhams: "\u062F\u0631\u0647\u0645\u0627", centimes: "\u0633\u0646\u062A\u064A\u0645\u0627" },
      signature: { client: "\u062E\u062A\u0645 \u0648\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0639\u0645\u064A\u0644", company: "\u062E\u062A\u0645 \u0648\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0634\u0631\u0643\u0629" },
      footer: { generatedBy: "\u062A\u0645 \u0627\u0644\u0625\u0646\u0634\u0627\u0621 \u0628\u0648\u0627\u0633\u0637\u0629 ParaGestion" },
      devis: { validit\u00E9: "\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0639\u0631\u0636:", conditions: "\u0634\u0631\u0648\u0637 \u0627\u0644\u062F\u0641\u0639:" },
      notes: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A:",
      payment: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062F\u0641\u0639:",
      headerIce: "I.C.E:"
    },
    devis: {
      title: "\u0639\u0631\u0636 \u0633\u0639\u0631",
      entityLabel: "\u0627\u0644\u0639\u0645\u064A\u0644",
      labels: { numero: "\u0627\u0644\u0631\u0642\u0645", date: "\u0627\u0644\u062A\u0627\u0631\u064A\u062E", reference: "\u0627\u0644\u0645\u0631\u062C\u0639", modePaiement: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062F\u0641\u0639", echeance: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629", agent: "\u0627\u0644\u0648\u0643\u064A\u0644" },
      itemCols: ["\u0627\u0644\u0645\u0631\u062C\u0639", "\u0627\u0644\u0628\u064A\u0627\u0646", "\u0627\u0644\u0643\u0645\u064A\u0629", "\u062B\u0645\u0646 \u0627\u0644\u0648\u062D\u062F\u0629", "\u0627\u0644\u0645\u0628\u0644\u063A"],
      totals: { ht: "\u0627\u0644\u0645\u062C\u0645\u0648\u0639 (\u062E.\u0636)", ttc: "\u0627\u0644\u0645\u062C\u0645\u0648\u0639 \u0634\u0627\u0645\u0644 \u0627\u0644\u0631\u0633\u0648\u0645", vatPrefix: "\u0636.\u0642.\u0645", dhs: "\u062F\u0631\u0647\u0645" },
      words: { arr\u00EAte: "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A \u0628\u0627\u0644\u062D\u0631\u0648\u0641:", dirhams: "\u062F\u0631\u0647\u0645\u0627", centimes: "\u0633\u0646\u062A\u064A\u0645\u0627" },
      signature: { client: "\u062E\u062A\u0645 \u0648\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0639\u0645\u064A\u0644", company: "\u062E\u062A\u0645 \u0648\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0634\u0631\u0643\u0629" },
      footer: { generatedBy: "\u062A\u0645 \u0627\u0644\u0625\u0646\u0634\u0627\u0621 \u0628\u0648\u0627\u0633\u0637\u0629 ParaGestion" },
      devis: { validit\u00E9: "\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0639\u0631\u0636:", conditions: "\u0634\u0631\u0648\u0637 \u0627\u0644\u062F\u0641\u0639:" },
      notes: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A:",
      payment: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062F\u0641\u0639:",
      headerIce: "I.C.E:"
    },
    bon_commande: {
      title: "\u0623\u0645\u0631 \u0634\u0631\u0627\u0621",
      entityLabel: "\u0627\u0644\u0645\u0648\u0631\u062F",
      labels: { numero: "\u0627\u0644\u0631\u0642\u0645", date: "\u0627\u0644\u062A\u0627\u0631\u064A\u062E", reference: "\u0627\u0644\u0645\u0631\u062C\u0639", modePaiement: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062F\u0641\u0639", echeance: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642", agent: "\u0627\u0644\u0648\u0643\u064A\u0644" },
      itemCols: ["\u0627\u0644\u0645\u0631\u062C\u0639", "\u0627\u0644\u0628\u064A\u0627\u0646", "\u0627\u0644\u0643\u0645\u064A\u0629", "\u062B\u0645\u0646 \u0627\u0644\u0648\u062D\u062F\u0629", "\u0627\u0644\u0645\u0628\u0644\u063A"],
      totals: { ht: "\u0627\u0644\u0645\u062C\u0645\u0648\u0639 (\u062E.\u0636)", ttc: "\u0627\u0644\u0645\u062C\u0645\u0648\u0639 \u0634\u0627\u0645\u0644 \u0627\u0644\u0631\u0633\u0648\u0645", vatPrefix: "\u0636.\u0642.\u0645", dhs: "\u062F\u0631\u0647\u0645" },
      words: { arr\u00EAte: "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A \u0628\u0627\u0644\u062D\u0631\u0648\u0641:", dirhams: "\u062F\u0631\u0647\u0645\u0627", centimes: "\u0633\u0646\u062A\u064A\u0645\u0627" },
      signature: { client: "\u062E\u062A\u0645 \u0648\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0645\u0648\u0631\u062F", company: "\u062E\u062A\u0645 \u0648\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0634\u0631\u0643\u0629" },
      footer: { generatedBy: "\u062A\u0645 \u0627\u0644\u0625\u0646\u0634\u0627\u0621 \u0628\u0648\u0627\u0633\u0637\u0629 ParaGestion" },
      devis: { validit\u00E9: "\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0639\u0631\u0636:", conditions: "\u0634\u0631\u0648\u0637 \u0627\u0644\u062F\u0641\u0639:" },
      notes: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A:",
      payment: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062F\u0641\u0639:",
      headerIce: "I.C.E:"
    },
    bon_livraison: {
      title: "\u0625\u064A\u0635\u0627\u0644 \u062A\u0633\u0644\u064A\u0645",
      entityLabel: "\u0627\u0644\u0645\u0648\u0631\u062F",
      labels: { numero: "\u0627\u0644\u0631\u0642\u0645", date: "\u0627\u0644\u062A\u0627\u0631\u064A\u062E", reference: "\u0627\u0644\u0645\u0631\u062C\u0639", modePaiement: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062F\u0641\u0639", echeance: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642", agent: "\u0627\u0644\u0648\u0643\u064A\u0644" },
      itemCols: ["\u0627\u0644\u0645\u0631\u062C\u0639", "\u0627\u0644\u0628\u064A\u0627\u0646", "\u0627\u0644\u0643\u0645\u064A\u0629", "\u062B\u0645\u0646 \u0627\u0644\u0648\u062D\u062F\u0629", "\u0627\u0644\u0645\u0628\u0644\u063A"],
      totals: { ht: "\u0627\u0644\u0645\u062C\u0645\u0648\u0639 (\u062E.\u0636)", ttc: "\u0627\u0644\u0645\u062C\u0645\u0648\u0639 \u0634\u0627\u0645\u0644 \u0627\u0644\u0631\u0633\u0648\u0645", vatPrefix: "\u0636.\u0642.\u0645", dhs: "\u062F\u0631\u0647\u0645" },
      words: { arr\u00EAte: "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A \u0628\u0627\u0644\u062D\u0631\u0648\u0641:", dirhams: "\u062F\u0631\u0647\u0645\u0627", centimes: "\u0633\u0646\u062A\u064A\u0645\u0627" },
      signature: { client: "\u062E\u062A\u0645 \u0648\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0645\u0648\u0631\u062F", company: "\u062E\u062A\u0645 \u0648\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0634\u0631\u0643\u0629" },
      footer: { generatedBy: "\u062A\u0645 \u0627\u0644\u0625\u0646\u0634\u0627\u0621 \u0628\u0648\u0627\u0633\u0637\u0629 ParaGestion" },
      devis: { validit\u00E9: "\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0639\u0631\u0636:", conditions: "\u0634\u0631\u0648\u0637 \u0627\u0644\u062F\u0641\u0639:" },
      notes: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A:",
      payment: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062F\u0641\u0639:",
      headerIce: "I.C.E:"
    }
  }
};
function getDocumentLabels(docType, language = "fr") {
  const lang = language?.startsWith("ar") ? "ar" : language?.startsWith("en") ? "en" : "fr";
  return DOCUMENT_LABELS[lang]?.[docType] || DOCUMENT_LABELS.fr.facture;
}
var NUMBER_UNITS = [
  "",
  "mille",
  "million",
  "milliard"
];
var NUMBER_WORDS = [
  "z\xE9ro",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
  "dix-sept",
  "dix-huit",
  "dix-neuf",
  "vingt",
  "vingt et un",
  "vingt-deux",
  "vingt-trois",
  "vingt-quatre",
  "vingt-cinq",
  "vingt-six",
  "vingt-sept",
  "vingt-huit",
  "vingt-neuf",
  "trente",
  "trente et un",
  "trente-deux",
  "trente-trois",
  "trente-quatre",
  "trente-cinq",
  "trente-six",
  "trente-sept",
  "trente-huit",
  "trente-neuf",
  "quarante",
  "quarante et un",
  "quarante-deux",
  "quarante-trois",
  "quarante-quatre",
  "quarante-cinq",
  "quarante-six",
  "quarante-sept",
  "quarante-huit",
  "quarante-neuf",
  "cinquante",
  "cinquante et un",
  "cinquante-deux",
  "cinquante-trois",
  "cinquante-quatre",
  "cinquante-cinq",
  "cinquante-six",
  "cinquante-sept",
  "cinquante-huit",
  "cinquante-neuf",
  "soixante",
  "soixante et un",
  "soixante-deux",
  "soixante-trois",
  "soixante-quatre",
  "soixante-cinq",
  "soixante-six",
  "soixante-sept",
  "soixante-huit",
  "soixante-neuf",
  "soixante-dix",
  "soixante et onze",
  "soixante-douze",
  "soixante-treize",
  "soixante-quatorze",
  "soixante-quinze",
  "soixante-seize",
  "soixante-dix-sept",
  "soixante-dix-huit",
  "soixante-dix-neuf",
  "quatre-vingts",
  "quatre-vingt-un",
  "quatre-vingt-deux",
  "quatre-vingt-trois",
  "quatre-vingt-quatre",
  "quatre-vingt-cinq",
  "quatre-vingt-six",
  "quatre-vingt-sept",
  "quatre-vingt-huit",
  "quatre-vingt-neuf",
  "quatre-vingt-dix",
  "quatre-vingt-onze",
  "quatre-vingt-douze",
  "quatre-vingt-treize",
  "quatre-vingt-quatorze",
  "quatre-vingt-quinze",
  "quatre-vingt-seize",
  "quatre-vingt-dix-sept",
  "quatre-vingt-dix-huit",
  "quatre-vingt-dix-neuf"
];
function convertBelow1000(n) {
  if (n === 0) return "";
  let result = "";
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  if (hundreds > 0) {
    if (hundreds === 1) {
      result += "cent";
    } else {
      result += NUMBER_WORDS[hundreds] + " cent";
    }
    if (remainder === 0 && hundreds > 1) {
      result += "s";
    }
  }
  if (remainder > 0) {
    if (result) result += " ";
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
          result += "-" + NUMBER_WORDS[ones];
        }
      }
    }
  }
  return result;
}
function numberToWords(n) {
  if (n === 0) return NUMBER_WORDS[0];
  const negative = n < 0;
  n = Math.abs(n);
  const parts = [];
  let unitIndex = 0;
  while (n > 0) {
    const chunk = n % 1e3;
    if (chunk > 0) {
      let chunkStr = convertBelow1000(chunk);
      if (unitIndex === 1 && chunk === 1) {
        chunkStr = "mille";
      } else if (unitIndex > 0) {
        chunkStr += " " + NUMBER_UNITS[unitIndex];
        if (chunk > 1 && unitIndex > 1) {
          chunkStr += "s";
        }
      }
      parts.unshift(chunkStr);
    }
    n = Math.floor(n / 1e3);
    unitIndex++;
  }
  let result = parts.join(" ");
  if (negative) result = "moins " + result;
  return result.trim();
}
function numberToWordsCurrency(amount, labels) {
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  const d = labels?.words.dirhams || "dirhams";
  const c = labels?.words.centimes || "centimes";
  let result = numberToWords(whole) + " " + d;
  if (cents > 0) {
    result += " et " + numberToWords(cents) + " " + c;
  }
  return result.charAt(0).toUpperCase() + result.slice(1);
}
function formatCurrency(value, decimals = 2) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(decimals, 2)
  }).format(value);
}
function formatDate(dateStr, language) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const locale = language?.startsWith("ar") ? "ar-MA" : language?.startsWith("en") ? "en-US" : "fr-FR";
  return new Intl.DateTimeFormat(locale).format(d);
}
function computeTvaBuckets(items) {
  const map = /* @__PURE__ */ new Map();
  for (const item of items) {
    const qte = Number(item.quantite) || 0;
    const pu = Number(item.prix_unitaire_ht) || 0;
    const totalHt = qte * pu;
    const tvaRate = Number(item.tva ?? 20);
    const existing = map.get(tvaRate);
    if (existing) {
      existing.baseHt += totalHt;
      existing.montantTva += totalHt * (tvaRate / 100);
    } else {
      map.set(tvaRate, { rate: tvaRate, baseHt: totalHt, montantTva: totalHt * (tvaRate / 100) });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.rate - a.rate);
}
function generateHTML(data) {
  const L = getDocumentLabels(data.documentType, data.language);
  const title = L.title;
  const entityLabel = L.entityLabel;
  let totalHT = 0;
  let totalTVA = 0;
  let totalTTC = 0;
  const ITEMS_PER_PDF_PAGE = 8;
  const singleRow = (item) => {
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
        <td style="padding:5px 6px;font-size:9pt;text-align:left;border-bottom:0.5pt solid #E5E7EB;">${item.reference || "-"}</td>
        <td style="padding:5px 6px;font-size:9pt;text-align:left;border-bottom:0.5pt solid #E5E7EB;">${item.designation}</td>
        <td style="padding:5px 6px;font-size:9pt;text-align:right;border-bottom:0.5pt solid #E5E7EB;">${formatCurrency(qte)}</td>
        <td style="padding:5px 6px;font-size:9pt;text-align:right;border-bottom:0.5pt solid #E5E7EB;">${formatCurrency(pu, 4)}</td>
        <td style="padding:5px 6px;font-size:9pt;text-align:right;font-weight:600;border-bottom:0.5pt solid #E5E7EB;">${formatCurrency(montantHT)}</td>
      </tr>`;
  };
  const itemChunks = [];
  for (let i = 0; i < data.items.length; i += ITEMS_PER_PDF_PAGE) {
    itemChunks.push(data.items.slice(i, i + ITEMS_PER_PDF_PAGE));
  }
  const itemsTable = itemChunks.map((chunk, chunkIndex) => {
    const isLastChunk = chunkIndex === itemChunks.length - 1;
    const wrapStyle = isLastChunk ? "" : ' style="page-break-after:always;"';
    const rows = chunk.map(singleRow).join("");
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
  }).join("");
  const tvaBuckets = computeTvaBuckets(data.items);
  const dhs = L.totals.dhs;
  const tvaRows = tvaBuckets.length > 0 ? tvaBuckets.map((b) => `
      <tr>
        <td style="padding:4px 8px;border:1px solid #000;text-align:left;">${L.totals.vatPrefix} ${b.rate}%</td>
        <td style="padding:4px 8px;border:1px solid #000;text-align:right;font-weight:600;">${formatCurrency(b.montantTva)} ${dhs}</td>
      </tr>`).join("") : `
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
    data.client.telephone ? (data.language?.startsWith("ar") ? "\u0647\u0627\u062A\u0641: " : data.language?.startsWith("en") ? "Tel: " : "T\xE9l: ") + data.client.telephone : null,
    data.client.email ? "Email: " + data.client.email : null,
    data.client.ice ? (data.language?.startsWith("ar") ? "I.C.E: " : "ICE: ") + data.client.ice : null
  ].filter(Boolean).join("<br>");
  const itemCols = L.itemCols;
  const isFirstPage = true;
  const htmlLang = data.language?.startsWith("ar") ? "ar" : data.language?.startsWith("en") ? "en" : "fr";
  const htmlDir = htmlLang === "ar" ? "rtl" : "ltr";
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
  <div class="watermark">${data.watermarkText || "ParaGestion"}</div>

  <!-- HEADER -->
  <div class="header-section">
    <div class="brand-left">
      ${data.company.logo ? `<img src="${data.company.logo}" alt="Logo" style="width:120px;height:60px;object-fit:contain;display:block;margin-bottom:4px;" />` : `<div style="font-size:18pt;font-weight:700;color:#000;letter-spacing:1px;margin-bottom:4px;">${(data.company.nom || "PARAGESTION").substring(0, 4).toUpperCase()}</div>`}
      <div>
        <div class="brand-name">${data.company.nom || "ParaGestion"}</div>
        <div class="brand-sub">${data.language?.startsWith("ar") ? "\u062D\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629" : data.language?.startsWith("en") ? "Management Solution" : "Solution de Gestion"}</div>
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
        ${Object.values(L.labels).map((l) => `<th>${l}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${data.numero}</td>
        <td>${formatDate(data.date, data.language)}</td>
        <td>${data.reference || "-"}</td>
        <td>${data.modePaiement || "-"}</td>
        <td>${echeance || "-"}</td>
        <td>${data.agent || "-"}</td>
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
      <p class="label">${L.words.arr\u00EAte}</p>
      <p class="amount">${amountInWords}</p>
      ${data.modePaiement ? '<p class="payment">' + L.payment + " " + data.modePaiement + "</p>" : ""}
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
  ${data.documentType === "devis" && (data.echeance || data.conditionsPaiement) ? `
  <div class="devis-extra">
    ${data.echeance ? "<div><strong>" + L.devis.validit\u00E9 + "</strong> " + formatDate(data.echeance, data.language) + "</div>" : ""}
    ${data.conditionsPaiement ? "<div><strong>" + L.devis.conditions + "</strong> " + data.conditionsPaiement + "</div>" : ""}
  </div>
  ` : ""}

  <!-- NOTES -->
  ${data.notes ? `
  <div class="notes-section">
    <strong>${L.notes}</strong> ${data.notes}
  </div>
  ` : ""}

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
    ${data.company.formeJuridique && data.company.capital ? data.company.formeJuridique + (data.language?.startsWith("en") ? " with capital of " : " au Capital de ") + data.company.capital + " \u2014 " : ""}
    ${data.company.rc ? "R.C: " + data.company.rc + " \u2014 " : ""}
    ${data.company.if_number ? (data.language?.startsWith("ar") ? "I.F: " : "I.F: ") + data.company.if_number + " \u2014 " : ""}
    ${data.company.ice ? (data.language?.startsWith("ar") ? "I.C.E: " : "ICE: ") + data.company.ice : ""}
    <br>
    <span class="app-credit">${L.footer.generatedBy}</span>
  </div>
</div>
</body>
</html>`;
}
async function imageUrlToBase64(url) {
  try {
    if (url.startsWith("data:")) return url;
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/png";
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}
async function resolveLogo(data) {
  if (data.company.logo) {
    console.log("[PDF] Logo already provided in request data");
    return data.company.logo;
  }
  if (!data.userId) {
    console.log("[PDF] No userId provided, skipping logo fetch");
    return void 0;
  }
  try {
    const { data: row } = await supabase.from("parametres").select("logo_url").eq("user_id", data.userId).maybeSingle();
    if (row?.logo_url) {
      console.log("[PDF] Logo URL retrieved from parametres");
      const base64 = await imageUrlToBase64(row.logo_url);
      if (base64) {
        console.log("[PDF] Logo converted to Base64 successfully");
        return base64;
      }
      console.warn("[PDF] Base64 conversion failed, falling back to raw URL");
      return null;
    }
    console.log("[PDF] No logo_url found in parametres");
  } catch (err) {
    console.error("[PDF] Error fetching logo:", err);
  }
  return void 0;
}
async function generatePDF(data) {
  const html = generateHTML(data);
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "15mm", bottom: "15mm", left: "15mm", right: "15mm" },
      printBackground: true,
      preferCSSPageSize: true
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
async function generatePDFController(req, res) {
  try {
    const data = req.body;
    if (!data.documentType || !data.items || !data.numero || !data.date) {
      return res.status(400).json({
        error: "Missing required fields: documentType, items, numero, date"
      });
    }
    const supportedTypes = ["facture", "devis", "bon_commande", "bon_livraison"];
    if (!supportedTypes.includes(data.documentType)) {
      return res.status(400).json({
        error: `Type de document invalide: ${data.documentType}. Types support\xE9s: ${supportedTypes.join(", ")}`
      });
    }
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return res.status(400).json({
        error: "Items list is empty or invalid"
      });
    }
    if (!data.client?.nom) {
      return res.status(400).json({ error: "Client name is required" });
    }
    if (!data.company?.rc || !data.company?.if_number || !data.company?.ice) {
      return res.status(400).json({
        error: "Company info required: rc, if_number, ice"
      });
    }
    data.company.logo = await resolveLogo(data);
    const pdfBuffer = await generatePDF(data);
    const L = getDocumentLabels(data.documentType, data.language);
    const filename = `${L.title.replace(/\s+/g, "_")}_${data.numero.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": pdfBuffer.length
    });
    res.send(pdfBuffer);
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(500).json({
      error: "Erreur lors de la g\xE9n\xE9ration du PDF",
      details: error.message
    });
  }
}

// src/routes/api.ts
var router = Router();
router.post("/create-user", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe sont requis" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caract\xC3\xA8res" });
    }
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (error) {
      console.error("Error creating user:", error);
      return res.status(400).json({ error: error.message });
    }
    res.status(201).json({
      success: true,
      user: { id: data.user.id, email: data.user.email },
      message: "Utilisateur cr\xC3\xA9\xC3\xA9 avec succ\xC3\xA8s"
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/users", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    res.json(data.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "ID utilisateur requis" });
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    res.json({ success: true, message: "Utilisateur et toutes ses donn\xC3\xA9es supprim\xC3\xA9s avec succ\xC3\xA8s" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: error.message });
  }
});
var initializeDatabase = async () => {
  try {
    const { error: paramError } = await supabaseAdmin.from("parametres").select("activer_droit_timbre").limit(1);
    if (paramError && paramError.message.includes("'activer_droit_timbre'")) {
      console.warn("Table parametres is missing columns, will use fallback defaults");
    }
    console.log("Database schema check complete");
  } catch (error) {
    console.warn("Database initialization note:", error);
  }
};
initializeDatabase();
router.post("/fix-schema", async (req, res) => {
  const sql = `
-- Fix all line tables columns
DO $$
BEGIN
  -- bons_livraison (add montant columns if not exist)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bons_livraison' AND column_name = 'montant_ht') THEN
    ALTER TABLE bons_livraison ADD COLUMN montant_ht DECIMAL(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bons_livraison' AND column_name = 'montant_tva') THEN
    ALTER TABLE bons_livraison ADD COLUMN montant_tva DECIMAL(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bons_livraison' AND column_name = 'montant_ttc') THEN
    ALTER TABLE bons_livraison ADD COLUMN montant_ttc DECIMAL(12,2) DEFAULT 0;
  END IF;
  
  -- bon_commande_lignes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bon_commande_lignes' AND column_name = 'montant_ht') THEN
    ALTER TABLE bon_commande_lignes ADD COLUMN montant_ht DECIMAL(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bon_commande_lignes' AND column_name = 'montant_ttc') THEN
    ALTER TABLE bon_commande_lignes ADD COLUMN montant_ttc DECIMAL(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bon_commande_lignes' AND column_name = 'ordre') THEN
    ALTER TABLE bon_commande_lignes ADD COLUMN ordre INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bon_commande_lignes' AND column_name = 'reference') THEN
    ALTER TABLE bon_commande_lignes ADD COLUMN reference TEXT;
  END IF;
  
  -- bon_livraison_lignes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bon_livraison_lignes' AND column_name = 'montant_ht') THEN
    ALTER TABLE bon_livraison_lignes ADD COLUMN montant_ht DECIMAL(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bon_livraison_lignes' AND column_name = 'montant_ttc') THEN
    ALTER TABLE bon_livraison_lignes ADD COLUMN montant_ttc DECIMAL(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bon_livraison_lignes' AND column_name = 'ordre') THEN
    ALTER TABLE bon_livraison_lignes ADD COLUMN ordre INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bon_livraison_lignes' AND column_name = 'reference') THEN
    ALTER TABLE bon_livraison_lignes ADD COLUMN reference TEXT;
  END IF;
  
  -- ventes_passagers_lignes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ventes_passagers_lignes' AND column_name = 'vp_id') THEN
    ALTER TABLE ventes_passagers_lignes ADD COLUMN vp_id BIGINT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ventes_passagers_lignes' AND column_name = 'montant_tva') THEN
    ALTER TABLE ventes_passagers_lignes ADD COLUMN montant_tva DECIMAL(12,2) DEFAULT 0;
  END IF;
  
  -- depenses
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'depenses' AND column_name = 'montant_tva') THEN
    ALTER TABLE depenses ADD COLUMN montant_tva DECIMAL(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'depenses' AND column_name = 'fournisseur_id') THEN
    ALTER TABLE depenses ADD COLUMN fournisseur_id BIGINT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'depenses' AND column_name = 'reference') THEN
    ALTER TABLE depenses ADD COLUMN reference TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'depenses' AND column_name = 'date_depense') THEN
    ALTER TABLE depenses ADD COLUMN date_depense DATE DEFAULT CURRENT_DATE;
  END IF;
  
  -- parametres (add ALL missing columns if not exist)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres' AND column_name = 'nom') THEN
    ALTER TABLE parametres ADD COLUMN nom TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres' AND column_name = 'nom_societe') THEN
    ALTER TABLE parametres ADD COLUMN nom_societe TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres' AND column_name = 'ville') THEN
    ALTER TABLE parametres ADD COLUMN ville TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres' AND column_name = 'code_postale') THEN
    ALTER TABLE parametres ADD COLUMN code_postale TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres' AND column_name = 'site_web') THEN
    ALTER TABLE parametres ADD COLUMN site_web TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres' AND column_name = 'rc') THEN
    ALTER TABLE parametres ADD COLUMN rc TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres' AND column_name = 'if_number') THEN
    ALTER TABLE parametres ADD COLUMN if_number TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres' AND column_name = 'tp_patente') THEN
    ALTER TABLE parametres ADD COLUMN tp_patente TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres' AND column_name = 'capital_social') THEN
    ALTER TABLE parametres ADD COLUMN capital_social TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres' AND column_name = 'forme_juridique') THEN
    ALTER TABLE parametres ADD COLUMN forme_juridique TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres' AND column_name = 'activer_droit_timbre') THEN
    ALTER TABLE parametres ADD COLUMN activer_droit_timbre BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres' AND column_name = 'conditions_paiement_defaut') THEN
    ALTER TABLE parametres ADD COLUMN conditions_paiement_defaut TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres' AND column_name = 'pied_page_defaut') THEN
    ALTER TABLE parametres ADD COLUMN pied_page_defaut TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres' AND column_name = 'logo_url') THEN
    ALTER TABLE parametres ADD COLUMN logo_url TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres' AND column_name = 'banque') THEN
    ALTER TABLE parametres ADD COLUMN banque TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres' AND column_name = 'rib') THEN
    ALTER TABLE parametres ADD COLUMN rib TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres' AND column_name = 'swift') THEN
    ALTER TABLE parametres ADD COLUMN swift TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres' AND column_name = 'couleur_principale') THEN
    ALTER TABLE parametres ADD COLUMN couleur_principale TEXT DEFAULT '#267E54';
  END IF;
END $$;

-- DISABLE RLS FOR ALL KEY TABLES (CRITICAL FOR DATA PERSISTENCE)
ALTER TABLE parametres DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE fournisseurs DISABLE ROW LEVEL SECURITY;
ALTER TABLE produits DISABLE ROW LEVEL SECURITY;
ALTER TABLE factures DISABLE ROW LEVEL SECURITY;
ALTER TABLE devis DISABLE ROW LEVEL SECURITY;
ALTER TABLE bons_livraison DISABLE ROW LEVEL SECURITY;
ALTER TABLE bons_commande DISABLE ROW LEVEL SECURITY;
ALTER TABLE depenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE avoirs DISABLE ROW LEVEL SECURITY;
ALTER TABLE facture_lignes DISABLE ROW LEVEL SECURITY;
ALTER TABLE devis_lignes DISABLE ROW LEVEL SECURITY;
ALTER TABLE bon_livraison_lignes DISABLE ROW LEVEL SECURITY;
ALTER TABLE bon_commande_lignes DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_mouvements DISABLE ROW LEVEL SECURITY;

-- Create notifications table if not exists
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info' CHECK (type IN ('success', 'error', 'warning', 'info')),
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Create logs_activites if not exists
CREATE TABLE IF NOT EXISTS logs_activites (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  details TEXT,
  entite_type TEXT,
  entite_id TEXT,
  utilisateur TEXT,
  date_action TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE logs_activites DISABLE ROW LEVEL SECURITY;

-- Create mouvements_stock if not exists
CREATE TABLE IF NOT EXISTS mouvements_stock (
  id BIGSERIAL PRIMARY KEY,
  produit_id BIGINT,
  type TEXT NOT NULL,
  quantite DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  reference_document TEXT,
  entite_nom TEXT,
  prix_unitaire DECIMAL(12,2) DEFAULT 0,
  date_mouvement TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE mouvements_stock DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
  `;
  res.json({
    message: "Run this SQL in Supabase SQL Editor",
    sql
  });
});
router.post("/generate-pdf", generatePDFController);
var toCamel = (obj) => {
  if (Array.isArray(obj)) return obj.map(toCamel);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      acc[camelKey] = toCamel(obj[key]);
      return acc;
    }, {});
  }
  return obj;
};
var toSnake = (obj) => {
  if (Array.isArray(obj)) return obj.map(toSnake);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      acc[snakeKey] = toSnake(obj[key]);
      return acc;
    }, {});
  }
  return obj;
};
var formatError = (error) => {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const msg = error.message || error.error_description || error.error;
    const details = error.details ? ` (${error.details})` : "";
    const hint = error.hint ? ` [Hint: ${error.hint}]` : "";
    if (msg) return `${msg}${details}${hint}`;
    try {
      return JSON.stringify(error);
    } catch (e) {
      return String(error);
    }
  }
  return String(error);
};
var logActivity = async (action, details) => {
  try {
    await supabase.from("logs_activites").insert([{ action, details }]);
  } catch (error) {
    console.error("Error logging activity:", error);
  }
};
var createNotification = async (userId, title, message, type = "info", link) => {
  if (!userId) return;
  try {
    await supabase.from("notifications").insert([{
      user_id: userId,
      title,
      message,
      type,
      is_read: false,
      link: link || null
    }]);
  } catch (error) {
    console.error("Error creating notification:", error);
  }
};
var updateProductStock = async (produitId, delta, type = "ajustement", referenceDocument, notes, entiteNom, prixUnitaire) => {
  if (!produitId) return;
  const { data: produit, error: fetchError } = await supabaseAdmin.from("produits").select("stock_actuel, stock_min, designation, nom, user_id").eq("id", produitId).single();
  if (fetchError || !produit) {
    console.error(`Error fetching product ${produitId} for stock update:`, fetchError);
    throw new Error(`Produit introuvable: ${produitId}`);
  }
  const currentStock = Number(produit.stock_actuel || 0);
  const newStock = currentStock + delta;
  const { error: updateError } = await supabaseAdmin.from("produits").update({ stock_actuel: newStock }).eq("id", produitId);
  if (updateError) {
    console.error(`Error updating stock for product ${produitId}:`, updateError);
    throw updateError;
  }
  const mData = {
    produit_id: parseInt(produitId),
    type,
    quantite: delta,
    notes: notes || "",
    reference_document: referenceDocument,
    entite_nom: entiteNom,
    prix_unitaire: prixUnitaire || 0,
    date_mouvement: /* @__PURE__ */ new Date()
  };
  const { error: mError } = await supabaseAdmin.from("mouvements_stock").insert([mData]);
  if (mError) {
    console.warn(`Stock movement not recorded (table may not exist): ${mError.message}`);
  }
  if (delta < 0 && newStock <= Number(produit.stock_min) && Number(produit.stock_min) > 0 && produit.user_id) {
    try {
      const designation = produit.designation || produit.nom || "Produit";
      const { data: recentNotifs } = await supabaseAdmin.from("notifications").select("id").eq("user_id", produit.user_id).eq("title", "Stock Faible").ilike("message", `${designation} - %`).gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString()).limit(1);
      if (!recentNotifs || recentNotifs.length === 0) {
        await createNotification(
          produit.user_id,
          "Stock Faible",
          `${designation} - ${newStock} unit\xC3\xA9s restantes`,
          "warning",
          "/produits"
        );
      }
    } catch (err) {
      console.error("Error creating low stock notification:", err);
    }
  }
};
var updateProductStockSafe = async (produitId, delta, type = "ajustement", referenceDocument, notes, entiteNom, prixUnitaire) => {
  if (!produitId) return;
  const { data: produit, error: fetchError } = await supabaseAdmin.from("produits").select("stock_actuel, stock_min, designation, nom, user_id").eq("id", produitId).single();
  if (fetchError || !produit) {
    console.warn(`updateProductStockSafe: product ${produitId} not found \xE2\u20AC\u201D skipping`);
    return;
  }
  const currentStock = Number(produit.stock_actuel || 0);
  const newStock = Math.max(0, currentStock + delta);
  if (newStock < currentStock + delta) {
    console.warn(
      `updateProductStockSafe: stock clamped to 0 for product ${produitId}. currentStock=${currentStock}, delta=${delta}. Likely the stock was already consumed after receipt.`
    );
  }
  const { error: updateError } = await supabaseAdmin.from("produits").update({ stock_actuel: newStock }).eq("id", produitId);
  if (updateError) {
    console.error(`updateProductStockSafe: failed to update product ${produitId}:`, updateError);
    return;
  }
  const mData = {
    produit_id: parseInt(produitId),
    type,
    quantite: delta,
    notes: notes || "",
    reference_document: referenceDocument,
    entite_nom: entiteNom,
    prix_unitaire: prixUnitaire || 0,
    date_mouvement: /* @__PURE__ */ new Date()
  };
  const { error: mError } = await supabaseAdmin.from("mouvements_stock").insert([mData]);
  if (mError) {
    console.warn(`Stock movement not recorded: ${mError.message}`);
  }
};
var handleAvoirLogic = async (factureId, newStatut, oldStatut) => {
  if (newStatut === "annul\xC3\xA9e" && oldStatut !== "annul\xC3\xA9e") {
    const { data: existingAvoir } = await supabase.from("avoirs").select("id").eq("facture_id", factureId).single();
    if (!existingAvoir) {
      const { count: avoirCount } = await supabase.from("avoirs").select("*", { count: "exact", head: true });
      const avoirNumero = `AVO/${(/* @__PURE__ */ new Date()).getFullYear()}/${String((avoirCount || 0) + 1).padStart(5, "0")}`;
      const { data: facture } = await supabase.from("factures").select("*").eq("id", factureId).single();
      const { data: factureLignes } = await supabase.from("facture_lignes").select("*").eq("facture_id", factureId);
      if (facture) {
        const avoirData = {
          numero: avoirNumero,
          facture_id: factureId,
          client_id: facture.client_id,
          date_emission: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          montant_ht: Number(facture.montant_ht || 0),
          montant_tva: Number(facture.montant_tva || 0),
          montant_ttc: Number(facture.montant_ttc || 0),
          notes: `Avoir pour annulation de la facture ${facture.numero}`,
          statut: "G\xC3\xA9n\xC3\xA9r\xC3\xA9"
        };
        const { data: newAvoir, error: avoirError } = await supabase.from("avoirs").insert([avoirData]).select().single();
        if (avoirError) throw new Error(`Erreur lors de la cr\xC3\xA9ation de l'avoir: ${avoirError.message}`);
        if (newAvoir && factureLignes) {
          const avoirLignesData = factureLignes.map((l) => ({
            avoir_id: newAvoir.id,
            produit_id: l.produit_id,
            reference: l.reference,
            designation: l.designation,
            quantite: Number(l.quantite || 0),
            prix_unitaire_ht: l.prix_unitaire_ht,
            tva: l.tva,
            montant_ht: Number(l.montant_ht || 0),
            montant_ttc: Number(l.montant_ttc || 0),
            ordre: l.ordre
          }));
          const { error: lignesError } = await supabase.from("avoir_lignes").insert(avoirLignesData);
          if (lignesError) throw new Error(`Erreur lors de la cr\xC3\xA9ation des lignes d'avoir: ${lignesError.message}`);
          await logActivity("cr\xC3\xA9ation avoir", `Avoir ${avoirNumero} cr\xC3\xA9\xC3\xA9 pour la facture ${facture.numero}`);
        }
      }
    }
  } else if (oldStatut === "annul\xC3\xA9e" && (newStatut === "pay\xC3\xA9e" || newStatut === "reste_a_payer")) {
    const { data: avoir } = await supabase.from("avoirs").select("numero").eq("facture_id", factureId).single();
    if (avoir) {
      await supabase.from("avoirs").delete().eq("facture_id", factureId);
      await logActivity("suppression avoir", `Avoir ${avoir.numero} supprim\xC3\xA9 car la facture ${factureId} est revenue au statut ${newStatut}`);
    }
  }
};
router.get("/dashboard-data", async (req, res) => {
  try {
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const applyDateFilter = (q, field) => {
      if (startDate) q = q.gte(field, startDate);
      if (endDate) q = q.lte(field, endDate);
      return q;
    };
    const validFactureStatuses = ["pay\xC3\xA9e", "reste_a_payer"];
    let factQuery = supabase.from("factures").select("*").in("statut", validFactureStatuses);
    let vpQuery = supabase.from("ventes_passagers").select("*");
    let bcQuery = supabase.from("bons_commande").select("*").in("statut", ["livr\xE9", "livr\xE9e"]);
    let depQuery = supabase.from("depenses").select("*");
    if (startDate || endDate) {
      factQuery = applyDateFilter(factQuery, "date_emission");
      vpQuery = applyDateFilter(vpQuery, "date");
      bcQuery = applyDateFilter(bcQuery, "date_commande");
      depQuery = applyDateFilter(depQuery, "date_depense");
    }
    const [factures, ventesPassagers, bonsCommande, depenses, produits] = (await Promise.all([
      factQuery, vpQuery, bcQuery, depQuery,
      supabase.from("produits").select("*"),
    ])).map((r) => r.data || []);
    const caVP = (ventesPassagers || []).reduce((sum, vp) => sum + Number(vp.montant_ttc || 0), 0);
    const caFactures = (factures || []).reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0);
    const totalRevenue = caVP + caFactures;
    const unpaidRevenue = (factures || []).filter((f) => f.statut === "reste_a_payer").reduce((sum, f) => sum + Number(f.reste_a_payer || 0), 0);
    const depensesTTC = (depenses || []).reduce((sum, d) => sum + Number(d.montant_ttc || 0), 0);
    const bcDepensesTTC = (bonsCommande || []).reduce((sum, bc) => sum + Number(bc.montant_ttc || 0), 0);
    const totalDepenses = depensesTTC + bcDepensesTTC;
    const profit = totalRevenue - totalDepenses;
    const tvaVP = (ventesPassagers || []).reduce((sum, vp) => sum + Number(vp.montant_tva || 0), 0);
    const tvaFactures = (factures || []).reduce((sum, f) => sum + Number(f.montant_tva || 0), 0);
    const totalTvaCollectee = tvaVP + tvaFactures;
    const tvaDepenses = (depenses || []).reduce((sum, d) => sum + Number(d.montant_tva || 0), 0);
    const tvaBC = (bonsCommande || []).reduce((sum, bc) => sum + Number(bc.montant_tva || 0), 0);
    const totalTvaDeductible = tvaDepenses + tvaBC;
    const tvaNet = totalTvaCollectee - totalTvaDeductible;
    const range = req.query.range || "6m";
    const monthlyData = [];
    const monthNames = ["Jan", "F\xC3\xA9v", "Mar", "Avr", "Mai", "Juin", "Juil", "Ao\xC3\xBB", "Sep", "Oct", "Nov", "D\xC3\xA9c"];
    if (range === "1m") {
      for (let i = 29; i >= 0; i--) {
        const d = /* @__PURE__ */ new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const dayFactures = (factures || []).filter((f) => {
          const fDate = new Date(f.date_emission).toISOString().split("T")[0];
          return fDate === dateStr;
        });
        const dayVP = (ventesPassagers || []).filter((vp) => {
          const vpDate = new Date(vp.date).toISOString().split("T")[0];
          return vpDate === dateStr;
        });
        const dayDepenses = (depenses || []).filter((d2) => {
          const dDate = new Date(d2.date_depense).toISOString().split("T")[0];
          return dDate === dateStr;
        });
        const dayBC = (bonsCommande || []).filter((bc) => {
          const bcDate = new Date(bc.date_commande).toISOString().split("T")[0];
          return bcDate === dateStr;
        });
        monthlyData.push({
          name: d.getDate().toString(),
          revenue: dayFactures.reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0) + dayVP.reduce((sum, vp) => sum + Number(vp.montant_ttc || 0), 0),
          expenses: dayDepenses.reduce((sum, d2) => sum + Number(d2.montant_ttc || 0), 0) + dayBC.reduce((sum, bc) => sum + Number(bc.montant_ttc || 0), 0)
        });
      }
    } else {
      const monthsCount = range === "1y" ? 12 : 6;
      for (let i = monthsCount - 1; i >= 0; i--) {
        const d = /* @__PURE__ */ new Date();
        d.setMonth(d.getMonth() - i);
        const month = d.getMonth();
        const year = d.getFullYear();
        const monthFactures = (factures || []).filter((f) => {
          const fDate = new Date(f.date_emission);
          return fDate.getMonth() === month && fDate.getFullYear() === year;
        });
        const monthVP = (ventesPassagers || []).filter((vp) => {
          const vpDate = new Date(vp.date);
          return vpDate.getMonth() === month && vpDate.getFullYear() === year;
        });
        const monthDepenses = (depenses || []).filter((d2) => {
          const dDate = new Date(d2.date_depense);
          return dDate.getMonth() === month && dDate.getFullYear() === year;
        });
        const monthBC = (bonsCommande || []).filter((bc) => {
          const bcDate = new Date(bc.date_commande);
          return bcDate.getMonth() === month && bcDate.getFullYear() === year;
        });
        monthlyData.push({
          name: monthNames[month],
          revenue: monthFactures.reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0) + monthVP.reduce((sum, vp) => sum + Number(vp.montant_ttc || 0), 0),
          expenses: monthDepenses.reduce((sum, d2) => sum + Number(d2.montant_ttc || 0), 0) + monthBC.reduce((sum, bc) => sum + Number(bc.montant_ttc || 0), 0)
        });
      }
    }
    const lowStockProduits = (produits || []).filter((p) => Number(p.stock_actuel) <= Number(p.stock_min)).slice(0, 5);
    let recentQuery = supabase.from("factures").select("*, client:clients(*)").order("date_emission", { ascending: false }).limit(5);
    if (startDate || endDate) {
      recentQuery = applyDateFilter(recentQuery, "date_emission");
    }
    const { data: recentFactures } = await recentQuery;
    let clientsQuery = supabase.from("clients").select("*", { count: "exact", head: true });
    if (startDate || endDate) {
      clientsQuery = applyDateFilter(clientsQuery, "created_at");
    }
    const clientsCount = (await clientsQuery).count || 0;
    res.json({
      clientsCount,
      facturesCount: factures?.length || 0,
      produitsCount: produits?.length || 0,
      totalRevenue,
      unpaidRevenue,
      totalDepenses,
      profit,
      totalTvaCollectee,
      totalTvaDeductible,
      tvaNet,
      monthlyData,
      lowStockProduits: toCamel((lowStockProduits || []).map((p) => ({ ...p, nom: p.designation || p.nom }))) || [],
      recentFactures: toCamel(recentFactures) || []
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});
router.get("/clients", async (req, res) => {
  try {
    const { data: clients, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error("Error fetching clients:", error);
      throw error;
    }
    res.json(toCamel(clients));
  } catch (error) {
    console.error("Failed to fetch clients:", error);
    res.status(500).json({ error: "Failed to fetch clients", details: formatError(error) });
  }
});
router.post("/clients", async (req, res) => {
  try {
    const { count } = await supabase.from("clients").select("*", { count: "exact", head: true });
    const code = `C${String((count || 0) + 1).padStart(3, "0")}`;
    const clientData = {
      nom: req.body.nom || req.body.nomSociete,
      email: req.body.email,
      telephone: req.body.telephone,
      adresse: req.body.adresse,
      ville: req.body.ville,
      code_postal: req.body.codePostal,
      pays: req.body.pays || "Maroc",
      ice: req.body.ice,
      rc: req.body.rc,
      if_identifiant: req.body.ifIdentifiant,
      patente: req.body.patente,
      notes: req.body.notes,
      type: req.body.type || "entreprise"
    };
    const { data: client, error } = await supabase.from("clients").insert([clientData]).select().single();
    if (error) {
      console.error("Error creating client:", error);
      throw error;
    }
    res.status(201).json(toCamel(client));
  } catch (error) {
    console.error("Error creating client:", error);
    res.status(500).json({ error: "Failed to create client", details: formatError(error) });
  }
});
router.put("/clients/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid client ID" });
    }
    const updateData = {};
    if (req.body.nom !== void 0) updateData.nom = req.body.nom;
    if (req.body.email !== void 0) updateData.email = req.body.email || null;
    if (req.body.telephone !== void 0) updateData.telephone = req.body.telephone || null;
    if (req.body.adresse !== void 0) updateData.adresse = req.body.adresse || null;
    if (req.body.ville !== void 0) updateData.ville = req.body.ville || null;
    if (req.body.pays !== void 0) updateData.pays = req.body.pays || "Maroc";
    if (req.body.ice !== void 0) updateData.ice = req.body.ice || null;
    if (req.body.rc !== void 0) updateData.rc = req.body.rc || null;
    if (req.body.if_identifiant !== void 0) updateData.if_identifiant = req.body.if_identifiant || null;
    if (req.body.patente !== void 0) updateData.patente = req.body.patente || null;
    if (req.body.notes !== void 0) updateData.notes = req.body.notes || null;
    if (req.body.type !== void 0) updateData.type = req.body.type;
    console.log("Updating client ID:", id, "with data:", updateData);
    const { data: existing, error: checkError } = await supabase.from("clients").select("id, nom").eq("id", id).single();
    if (checkError || !existing) {
      console.error("Client not found:", id, checkError);
      return res.status(404).json({ error: "Client not found" });
    }
    console.log("Found existing client:", existing);
    const { data: client, error } = await supabase.from("clients").update(updateData).eq("id", id).select().single();
    if (error) {
      console.error("Update error:", error);
      throw error;
    }
    console.log("Updated client:", client);
    res.json(toCamel(client));
  } catch (error) {
    console.error("Error updating client:", error);
    res.status(500).json({ error: "Failed to update client", details: formatError(error) });
  }
});
router.delete("/clients/:id", async (req, res) => {
  try {
    const { error } = await supabase.from("clients").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete client" });
  }
});
router.get("/fournisseurs", async (req, res) => {
  try {
    const { data: fournisseurs, error } = await supabase.from("fournisseurs").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error("Error fetching fournisseurs:", error);
      res.status(500).json({ error: "Failed to fetch fournisseurs", details: error.message });
      return;
    }
    res.json(toCamel(fournisseurs || []));
  } catch (error) {
    console.error("Error fetching fournisseurs:", error);
    res.status(500).json({ error: "Failed to fetch fournisseurs", details: error.message });
  }
});
router.post("/fournisseurs", async (req, res) => {
  try {
    const { count } = await supabase.from("fournisseurs").select("*", { count: "exact", head: true });
    const code = `F${String((count || 0) + 1).padStart(3, "0")}`;
    const data = {
      nom: req.body.nom,
      email: req.body.email || null,
      telephone: req.body.telephone || null,
      adresse: req.body.adresse || null,
      ville: req.body.ville || null,
      ice: req.body.ice || null
    };
    try {
      if (req.body.contact !== void 0) data.contact = req.body.contact;
      if (req.body.type !== void 0) data.type = req.body.type || "entreprise";
      if (req.body.codePostale !== void 0) data.code_postale = req.body.codePostale;
    } catch (e) {
    }
    const { data: fournisseur, error } = await supabase.from("fournisseurs").insert([data]).select().single();
    if (error) {
      console.error("Error creating fournisseur:", error);
      res.status(400).json({ error: "Failed to create fournisseur", details: error.message });
      return;
    }
    res.status(201).json(toCamel(fournisseur));
  } catch (error) {
    console.error("Error creating fournisseur:", error);
    res.status(500).json({ error: "Failed to create fournisseur", details: error.message });
  }
});
router.put("/fournisseurs/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid fournisseur ID" });
    }
    const updateData = {};
    if (req.body.nom !== void 0) updateData.nom = req.body.nom;
    if (req.body.email !== void 0) updateData.email = req.body.email || null;
    if (req.body.telephone !== void 0) updateData.telephone = req.body.telephone || null;
    if (req.body.adresse !== void 0) updateData.adresse = req.body.adresse || null;
    if (req.body.ville !== void 0) updateData.ville = req.body.ville || null;
    if (req.body.ice !== void 0) updateData.ice = req.body.ice || null;
    if (req.body.contact !== void 0) updateData.contact = req.body.contact || null;
    if (req.body.type !== void 0) updateData.type = req.body.type;
    const { data: existing, error: checkError } = await supabase.from("fournisseurs").select("id, nom").eq("id", id).single();
    if (checkError || !existing) {
      return res.status(404).json({ error: "Fournisseur not found" });
    }
    const { data: fournisseur, error } = await supabase.from("fournisseurs").update(updateData).eq("id", id).select().single();
    if (error) {
      res.status(400).json({ error: "Failed to update fournisseur", details: error.message });
      return;
    }
    res.json(toCamel(fournisseur));
  } catch (error) {
    console.error("Error updating fournisseur:", error);
    res.status(500).json({ error: "Failed to update fournisseur", details: error.message });
  }
});
router.delete("/fournisseurs/:id", async (req, res) => {
  try {
    const { error } = await supabase.from("fournisseurs").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete fournisseur" });
  }
});
router.get("/produits", async (req, res) => {
  try {
    const { data: produits, error } = await supabase.from("produits").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    const mappedProduits = (produits || []).map((p) => ({
      ...p,
      nom: p.designation || p.nom
    }));
    res.json(toCamel(mappedProduits));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch produits" });
  }
});
router.post("/produits", async (req, res) => {
  try {
    let reference = req.body.reference;
    if (!reference) {
      const { count } = await supabase.from("produits").select("*", { count: "exact", head: true });
      reference = `REF-${String((count || 0) + 1).padStart(6, "0")}`;
      let isUnique = false;
      let attempt = 0;
      while (!isUnique && attempt < 10) {
        const { data: existing, error: checkError } = await supabase.from("produits").select("id").eq("reference", reference).maybeSingle();
        if (!existing && !checkError) {
          isUnique = true;
        } else {
          attempt++;
          reference = `REF-${String((count || 0) + 1 + attempt).padStart(6, "0")}`;
        }
      }
    }
    const data = {
      reference,
      designation: req.body.designation || req.body.nom || "Produit sans nom",
      nom: req.body.nom || req.body.designation || "Produit sans nom",
      description: req.body.description,
      categorie: req.body.categorie,
      marque: req.body.marque,
      barcode: req.body.barcode,
      image_url: req.body.imageUrl,
      prix_achat_ht: Number(req.body.prixAchatHt || 0),
      prix_vente_ht: Number(req.body.prixVenteHt || 0),
      tva: req.body.tauxTva !== void 0 ? Number(req.body.tauxTva) : req.body.tva !== void 0 ? Number(req.body.tva) : 20,
      stock_actuel: Number(req.body.stockActuel || 0),
      stock_min: Number(req.body.stockMin || 5),
      unite: req.body.unite || "unit\xC3\xA9"
    };
    let { data: produit, error } = await supabase.from("produits").insert([data]).select().single();
    if (error) {
      console.error("Supabase error creating produit:", error);
      if (error.code === "428C9" || error.message?.includes("generated column")) {
        const cleanedData = { ...data };
        delete cleanedData.prix_achat_ttc;
        delete cleanedData.prix_vente_ttc;
        const { data: pRetry, error: eRetry } = await supabase.from("produits").insert([cleanedData]).select().single();
        if (eRetry) {
          if (eRetry.message?.includes('column "nom" does not exist')) {
            delete cleanedData.nom;
            const { data: p3, error: e3 } = await supabase.from("produits").insert([cleanedData]).select().single();
            if (e3) throw e3;
            produit = p3;
            error = null;
          } else if (eRetry.message?.includes('column "designation" does not exist')) {
            delete cleanedData.designation;
            const { data: p3, error: e3 } = await supabase.from("produits").insert([cleanedData]).select().single();
            if (e3) throw e3;
            produit = p3;
            error = null;
          } else {
            throw eRetry;
          }
        } else {
          produit = pRetry;
          error = null;
        }
      } else if (error.message?.includes('column "nom" does not exist')) {
        const fallbackData = { ...data };
        delete fallbackData.nom;
        const { data: p2, error: e2 } = await supabase.from("produits").insert([fallbackData]).select().single();
        if (e2) throw e2;
        produit = p2;
        error = null;
      } else if (error.message?.includes('column "designation" does not exist')) {
        const fallbackData = { ...data };
        delete fallbackData.designation;
        const { data: p2, error: e2 } = await supabase.from("produits").insert([fallbackData]).select().single();
        if (e2) throw e2;
        produit = p2;
        error = null;
      } else if (error.message?.includes('column "updated_at" does not exist') || error.message?.includes("'updated_at' column") || error.message?.includes("schema cache")) {
        const fallbackData = { ...data };
        delete fallbackData.updated_at;
        const { data: p2, error: e2 } = await supabase.from("produits").insert([fallbackData]).select().single();
        if (e2) throw e2;
        produit = p2;
        error = null;
      } else if (error.message?.includes('column "created_at" does not exist') || error.message?.includes("'created_at' column")) {
        const fallbackData = { ...data };
        delete fallbackData.created_at;
        const { data: p2, error: e2 } = await supabase.from("produits").insert([fallbackData]).select().single();
        if (e2) throw e2;
        produit = p2;
        error = null;
      } else {
        throw error;
      }
    }
    if (produit && req.body.stockActuel > 0) {
      try {
        await supabase.from("mouvements_stock").insert([{
          produit_id: produit.id,
          type: "initial",
          quantite: req.body.stockActuel,
          notes: "Stock initial \xC3\xA0 la cr\xC3\xA9ation du produit",
          date_mouvement: /* @__PURE__ */ new Date()
        }]);
      } catch (mError) {
        console.error("Error recording initial stock movement:", mError);
      }
    }
    const mappedProduit = { ...produit, nom: produit.designation || produit.nom };
    res.status(201).json(toCamel(mappedProduit));
  } catch (error) {
    console.error("Unexpected error in POST /produits:", formatError(error));
    res.status(500).json({
      error: "Failed to create produit",
      details: formatError(error)
    });
  }
});
router.get("/produits/:id", async (req, res) => {
  try {
    const { data: produit, error } = await supabase.from("produits").select("*").eq("id", req.params.id).single();
    if (error) throw error;
    const mappedProduit = {
      ...produit,
      nom: produit.designation || produit.nom
    };
    res.json(toCamel(mappedProduit));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch produit" });
  }
});
router.put("/produits/:id", async (req, res) => {
  try {
    const { id: _, created_at: __, ...updateData } = req.body;
    const data = {};
    if (updateData.reference !== void 0) data.reference = updateData.reference;
    if (updateData.nom !== void 0) {
      data.designation = updateData.nom;
      data.nom = updateData.nom;
    }
    if (updateData.designation !== void 0) {
      data.designation = updateData.designation;
      data.nom = updateData.designation;
    }
    if (updateData.description !== void 0) data.description = updateData.description;
    if (updateData.categorie !== void 0) data.categorie = updateData.categorie;
    if (updateData.marque !== void 0) data.marque = updateData.marque;
    if (updateData.barcode !== void 0) data.barcode = updateData.barcode;
    if (updateData.imageUrl !== void 0) data.image_url = updateData.imageUrl;
    if (updateData.prixAchatHt !== void 0) data.prix_achat_ht = Number(updateData.prixAchatHt || 0);
    if (updateData.prixVenteHt !== void 0) data.prix_vente_ht = Number(updateData.prixVenteHt || 0);
    if (updateData.tauxTva !== void 0) data.tva = Number(updateData.tauxTva || 0);
    if (updateData.tva !== void 0) data.tva = Number(updateData.tva || 0);
    if (updateData.stockActuel !== void 0) data.stock_actuel = Number(updateData.stockActuel || 0);
    if (updateData.stockMin !== void 0) data.stock_min = Number(updateData.stockMin || 0);
    if (updateData.unite !== void 0) data.unite = updateData.unite;
    if (updateData.isActive !== void 0) data.is_active = updateData.isActive;
    data.updated_at = /* @__PURE__ */ new Date();
    let { data: produit, error } = await supabase.from("produits").update(data).eq("id", req.params.id).select().single();
    if (error) {
      console.error("Supabase error updating produit:", error);
      if (error.code === "428C9" || error.message?.includes("generated column")) {
        const cleanedData = { ...data };
        delete cleanedData.prix_achat_ttc;
        delete cleanedData.prix_vente_ttc;
        const { data: pRetry, error: eRetry } = await supabase.from("produits").update(cleanedData).eq("id", req.params.id).select().single();
        if (eRetry) {
          if (eRetry.message?.includes('column "nom" does not exist')) {
            delete cleanedData.nom;
            const { data: p3, error: e3 } = await supabase.from("produits").update(cleanedData).eq("id", req.params.id).select().single();
            if (e3) throw e3;
            produit = p3;
            error = null;
          } else if (eRetry.message?.includes('column "designation" does not exist')) {
            delete cleanedData.designation;
            const { data: p3, error: e3 } = await supabase.from("produits").update(cleanedData).eq("id", req.params.id).select().single();
            if (e3) throw e3;
            produit = p3;
            error = null;
          } else {
            throw eRetry;
          }
        } else {
          produit = pRetry;
          error = null;
        }
      } else if (error.message?.includes('column "nom" does not exist')) {
        const fallbackData = { ...data };
        delete fallbackData.nom;
        const { data: p2, error: e2 } = await supabase.from("produits").update(fallbackData).eq("id", req.params.id).select().single();
        if (e2) throw e2;
        produit = p2;
        error = null;
      } else if (error.message?.includes('column "designation" does not exist')) {
        const fallbackData = { ...data };
        delete fallbackData.designation;
        const { data: p2, error: e2 } = await supabase.from("produits").update(fallbackData).eq("id", req.params.id).select().single();
        if (e2) throw e2;
        produit = p2;
        error = null;
      } else if (error.message?.includes('column "updated_at" does not exist') || error.message?.includes("'updated_at' column") || error.message?.includes("schema cache")) {
        const fallbackData = { ...data };
        delete fallbackData.updated_at;
        const { data: p2, error: e2 } = await supabase.from("produits").update(fallbackData).eq("id", req.params.id).select().single();
        if (e2) throw e2;
        produit = p2;
        error = null;
      } else if (error.message?.includes('column "created_at" does not exist') || error.message?.includes("'created_at' column")) {
        const fallbackData = { ...data };
        delete fallbackData.created_at;
        const { data: p2, error: e2 } = await supabase.from("produits").update(fallbackData).eq("id", req.params.id).select().single();
        if (e2) throw e2;
        produit = p2;
        error = null;
      } else {
        throw error;
      }
    }
    const mappedProduit = { ...produit, nom: produit.designation || produit.nom };
    res.json(toCamel(mappedProduit));
  } catch (error) {
    console.error("Error updating produit:", formatError(error));
    res.status(500).json({
      error: "Failed to update produit",
      details: formatError(error)
    });
  }
});
router.delete("/produits/:id", async (req, res) => {
  try {
    const { error } = await supabase.from("produits").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete produit" });
  }
});
router.get("/factures", async (req, res) => {
  try {
    const { data: factures, error } = await supabase.from("factures").select("*, client:clients(*)").order("created_at", { ascending: false });
    if (error) throw error;
    res.json(toCamel(factures));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch factures" });
  }
});
router.post("/factures", async (req, res) => {
  try {
    const { lignes, ...factureData } = req.body;
    const { count, error: countError } = await supabase.from("factures").select("*", { count: "exact", head: true });
    if (countError) {
      console.error("Error counting factures:", countError);
      return res.status(500).json({ error: "Failed to generate invoice number", details: countError.message });
    }
    const numero = `FAC/${(/* @__PURE__ */ new Date()).getFullYear()}/${String((count || 0) + 1).padStart(5, "0")}`;
    const data = {
      numero,
      client_id: factureData.clientId,
      date_emission: factureData.dateEmission,
      date_echeance: factureData.dateEcheance,
      statut: factureData.statut || "brouillon",
      mode_paiement: factureData.modePaiement,
      montant_ht: Number(factureData.montantHt || 0),
      montant_tva: Number(factureData.montantTva || 0),
      montant_ttc: Number(factureData.montantTtc || 0),
      reste_a_payer: Number(factureData.resteAPayer || factureData.montantTtc || 0),
      notes: factureData.notes,
      conditions_paiement: factureData.conditionsPaiement,
      stock_updated: false
    };
    const { data: facture, error: factureError } = await supabase.from("factures").insert([data]).select().single();
    if (factureError) {
      console.error("Error creating facture:", factureError);
      return res.status(400).json({ error: "Failed to create facture", details: formatError(factureError) });
    }
    await logActivity("cr\xC3\xA9ation facture", `Facture ${numero} cr\xC3\xA9\xC3\xA9e`);
    if (lignes && lignes.length > 0) {
      const lignesData = lignes.map((l, index) => {
        const qte = Number(l.quantite || 0);
        const pu = Number(l.prix_unitaire || l.prix_unitaire_ht || 0);
        const tva = Number(l.tva || 0);
        const mht = Number(l.montant_ht || qte * pu);
        const mttc = Number(l.montant_ttc || mht * (1 + tva / 100));
        return {
          facture_id: facture.id,
          produit_id: l.produit_id || null,
          reference: l.reference || null,
          designation: l.designation || l.description || "",
          quantite: qte,
          prix_unitaire_ht: pu,
          tva,
          montant_ht: mht,
          montant_ttc: mttc,
          ordre: l.ordre !== void 0 ? Number(l.ordre) : index
        };
      });
      const { error: lignesError } = await supabase.from("facture_lignes").insert(lignesData);
      if (lignesError) {
        console.error("Error creating facture lines:", JSON.stringify(lignesError, null, 2));
        await supabase.from("factures").delete().eq("id", facture.id);
        return res.status(400).json({ error: "Error creating facture lines", details: lignesError.message || JSON.stringify(lignesError) });
      }
      if (["pay\xC3\xA9e", "reste_a_payer"].includes(facture.statut)) {
        const { data: client } = await supabase.from("clients").select("nom").eq("id", facture.client_id).single();
        for (const l of lignesData) {
          if (l.produit_id) {
            await updateProductStock(
              l.produit_id,
              -Number(l.quantite || 0),
              "vente",
              facture.numero,
              `Vente Facture ${facture.numero}`,
              client?.nom,
              l.prix_unitaire_ht
            );
          }
        }
        await supabase.from("factures").update({ stock_updated: true }).eq("id", facture.id);
      }
    }
    const { data: completeFacture, error: fetchError } = await supabase.from("factures").select("*, lignes:facture_lignes(*), client:clients(*)").eq("id", facture.id).single();
    if (fetchError) {
      console.error("Error fetching complete facture:", fetchError);
      return res.status(201).json(toCamel(facture));
    }
    res.status(201).json(toCamel(completeFacture));
  } catch (error) {
    console.error("Unexpected error in POST /factures:", error);
    res.status(500).json({ error: "Internal server error", details: formatError(error) });
  }
});
router.get("/factures/:id", async (req, res) => {
  try {
    const { data: facture, error } = await supabase.from("factures").select("*, client:clients(*), lignes:facture_lignes(*)").eq("id", req.params.id).single();
    if (error) throw error;
    if (!facture) return res.status(404).json({ error: "Not found" });
    res.json(toCamel(facture));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch facture" });
  }
});
router.put("/factures/:id", async (req, res) => {
  try {
    const { lignes, ...factureData } = req.body;
    const id = req.params.id;
    const { data: oldFacture } = await supabase.from("factures").select("statut, stock_updated, client_id").eq("id", id).single();
    const oldStatut = oldFacture?.statut;
    const oldStockUpdated = oldFacture?.stock_updated;
    const updateData = {};
    if (factureData.clientId !== void 0) updateData.client_id = factureData.clientId;
    if (factureData.dateEmission !== void 0) updateData.date_emission = factureData.dateEmission;
    if (factureData.dateEcheance !== void 0) updateData.date_echeance = factureData.dateEcheance;
    if (factureData.statut !== void 0) updateData.statut = factureData.statut;
    if (factureData.modePaiement !== void 0) updateData.mode_paiement = factureData.modePaiement;
    if (factureData.montantHt !== void 0) updateData.montant_ht = Number(factureData.montantHt || 0);
    if (factureData.montantTva !== void 0) updateData.montant_tva = Number(factureData.montantTva || 0);
    if (factureData.montantTtc !== void 0) updateData.montant_ttc = Number(factureData.montantTtc || 0);
    if (factureData.resteAPayer !== void 0) updateData.reste_a_payer = Number(factureData.resteAPayer || 0);
    if (factureData.notes !== void 0) updateData.notes = factureData.notes;
    if (factureData.conditionsPaiement !== void 0) updateData.conditions_paiement = factureData.conditionsPaiement;
    const newStatut = updateData.statut;
    if (newStatut === "annul\xC3\xA9e" && oldStatut && oldStatut !== "annul\xC3\xA9e") {
      await handleAvoirLogic(id, newStatut, oldStatut);
    }
    const { error: updateError } = await supabase.from("factures").update(updateData).eq("id", id);
    if (updateError) {
      console.error("Error updating facture:", updateError);
      return res.status(400).json({ error: "Failed to update facture", details: formatError(updateError) });
    }
    if (newStatut && newStatut !== oldStatut) {
      const { data: currentLignes } = await supabase.from("facture_lignes").select("*").eq("facture_id", id);
      if (currentLignes && currentLignes.length > 0) {
        const isActive = ["pay\xC3\xA9e", "reste_a_payer"].includes(newStatut);
        const isCancelled = newStatut === "annul\xC3\xA9e";
        if (!oldStockUpdated && isActive) {
          const { data: client } = await supabase.from("clients").select("nom").eq("id", oldFacture.client_id || updateData.client_id).single();
          const { data: f } = await supabase.from("factures").select("numero").eq("id", id).single();
          for (const l of currentLignes) {
            if (l.produit_id) await updateProductStock(
              l.produit_id,
              -Number(l.quantite || 0),
              "vente",
              f?.numero,
              `Vente Facture ${f?.numero}`,
              client?.nom,
              l.prix_unitaire_ht
            );
          }
          await supabase.from("factures").update({ stock_updated: true }).eq("id", id);
        } else if (oldStockUpdated && isCancelled) {
          const { data: client } = await supabase.from("clients").select("nom").eq("id", oldFacture.client_id || updateData.client_id).single();
          const { data: f } = await supabase.from("factures").select("numero").eq("id", id).single();
          for (const l of currentLignes) {
            if (l.produit_id) await updateProductStock(
              l.produit_id,
              Number(l.quantite || 0),
              "ajustement",
              f?.numero,
              `Annulation Facture ${f?.numero}`,
              client?.nom,
              l.prix_unitaire_ht
            );
          }
          await supabase.from("factures").update({ stock_updated: false }).eq("id", id);
        }
      }
    }
    if (oldStatut === "annul\xC3\xA9e" && newStatut && newStatut !== "annul\xC3\xA9e") {
      await handleAvoirLogic(id, newStatut, oldStatut);
    }
    if (lignes !== void 0) {
      await supabase.from("facture_lignes").delete().eq("facture_id", id);
      if (lignes && lignes.length > 0) {
        const lignesData = lignes.map((l, index) => {
          const qte = Number(l.quantite || 0);
          const pu = Number(l.prix_unitaire || l.prix_unitaire_ht || 0);
          const tva = Number(l.tva || 0);
          const mht = Number(l.montant_ht || qte * pu);
          const mttc = Number(l.montant_ttc || mht * (1 + tva / 100));
          return {
            facture_id: id,
            produit_id: l.produit_id || null,
            reference: l.reference || null,
            designation: l.designation || l.description || "",
            quantite: qte,
            prix_unitaire_ht: pu,
            tva,
            montant_ht: mht,
            montant_ttc: mttc,
            ordre: l.ordre !== void 0 ? Number(l.ordre) : index
          };
        });
        const { error: lignesError } = await supabase.from("facture_lignes").insert(lignesData);
        if (lignesError) {
          console.error("Error updating facture lines:", JSON.stringify(lignesError, null, 2));
          return res.status(400).json({ error: "Error updating facture lines", details: lignesError.message || JSON.stringify(lignesError) });
        }
      }
    }
    const { data: updatedFacture, error: fetchError } = await supabase.from("factures").select("*, lignes:facture_lignes(*), client:clients(*)").eq("id", id).single();
    if (fetchError) {
      console.error("Error fetching updated facture:", fetchError);
      return res.status(200).json({ id });
    }
    res.json(toCamel(updatedFacture));
  } catch (error) {
    console.error("Unexpected error in PUT /factures/:id:", error);
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
});
router.delete("/factures/:id", async (req, res) => {
  try {
    const { data: facture } = await supabase.from("factures").select("statut").eq("id", req.params.id).single();
    if (facture && facture.statut !== "brouillon") {
      return res.status(400).json({ error: "Impossible de supprimer une facture valid\xC3\xA9e. Veuillez l'annuler." });
    }
    const { error } = await supabase.from("factures").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete facture" });
  }
});
router.put("/factures/:id/statut", async (req, res) => {
  try {
    const { statut } = req.body;
    const id = req.params.id;
    const { data: oldFacture } = await supabase.from("factures").select("statut, stock_updated, client_id, numero").eq("id", id).single();
    const oldStatut = oldFacture?.statut;
    const oldStockUpdated = oldFacture?.stock_updated;
    if (statut === "annul\xC3\xA9e" && oldStatut && oldStatut !== "annul\xC3\xA9e") {
      await handleAvoirLogic(id, statut, oldStatut);
    }
    const updatePayload = { statut };
    if (["pay\xC3\xA9e", "annul\xC3\xA9e"].includes(statut)) {
      updatePayload.reste_a_payer = 0;
    }
    const { data: facture, error } = await supabase.from("factures").update(updatePayload).eq("id", id).select().single();
    if (error) throw error;
    if (statut && statut !== oldStatut) {
      const { data: currentLignes } = await supabase.from("facture_lignes").select("*").eq("facture_id", id);
      if (currentLignes && currentLignes.length > 0) {
        const isActive = ["pay\xC3\xA9e", "reste_a_payer"].includes(statut);
        const isCancelled = statut === "annul\xC3\xA9e";
        if (!oldStockUpdated && isActive) {
          const { data: client } = await supabase.from("clients").select("nom").eq("id", oldFacture.client_id).single();
          for (const l of currentLignes) {
            if (l.produit_id) await updateProductStock(
              l.produit_id,
              -Number(l.quantite || 0),
              "vente",
              oldFacture.numero,
              `Vente Facture ${oldFacture.numero}`,
              client?.nom,
              l.prix_unitaire_ht
            );
          }
          await supabase.from("factures").update({ stock_updated: true }).eq("id", id);
        } else if (oldStockUpdated && isCancelled) {
          const { data: client } = await supabase.from("clients").select("nom").eq("id", oldFacture.client_id).single();
          for (const l of currentLignes) {
            if (l.produit_id) await updateProductStock(
              l.produit_id,
              Number(l.quantite || 0),
              "ajustement",
              oldFacture.numero,
              `Annulation Facture ${oldFacture.numero}`,
              client?.nom,
              l.prix_unitaire_ht
            );
          }
          await supabase.from("factures").update({ stock_updated: false }).eq("id", id);
        }
      }
    }
    if (oldStatut === "annul\xC3\xA9e" && statut && statut !== "annul\xC3\xA9e") {
      await handleAvoirLogic(id, statut, oldStatut);
    }
    await logActivity("changement de statut facture", `Facture ${oldFacture?.numero || id} : ${oldStatut} -> ${statut}`);
    res.json(toCamel(facture));
  } catch (error) {
    console.error("Error updating facture status:", error);
    res.status(500).json({ error: error.message || "Failed to update facture status" });
  }
});
router.get("/avoirs", async (req, res) => {
  try {
    const { data: avoirs, error } = await supabase.from("avoirs").select("*, client:clients(*), facture:factures(numero, statut)").order("created_at", { ascending: false });
    if (error) throw error;
    res.json(toCamel(avoirs || []));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch avoirs" });
  }
});
router.get("/avoirs/:id", async (req, res) => {
  try {
    const { data: avoir, error } = await supabase.from("avoirs").select("*, client:clients(*), facture:factures(*), lignes:avoir_lignes(*)").eq("id", req.params.id).single();
    if (error) throw error;
    if (!avoir) return res.status(404).json({ error: "Not found" });
    res.json(toCamel(avoir));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch avoir" });
  }
});
router.delete("/avoirs/:id", async (req, res) => {
  try {
    const { data: avoir, error: fetchError } = await supabase.from("avoirs").select("facture:factures(statut)").eq("id", req.params.id).single();
    if (fetchError || !avoir) return res.status(404).json({ error: "Avoir non trouv\xC3\xA9" });
    const fStatut = avoir.facture?.statut;
    if (fStatut !== "pay\xC3\xA9e" && fStatut !== "reste_a_payer") {
      return res.status(400).json({ error: "Impossible de supprimer un avoir si la facture n'est pas pay\xC3\xA9e ou reste \xC3\xA0 payer" });
    }
    const { error } = await supabase.from("avoirs").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error("Error deleting avoir:", error);
    res.status(500).json({ error: "Failed to delete avoir" });
  }
});
router.get("/devis", async (req, res) => {
  try {
    const { data: devis, error } = await supabase.from("devis").select("*, client:clients(*)").order("created_at", { ascending: false });
    if (error) throw error;
    res.json(toCamel(devis));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch devis" });
  }
});
router.post("/devis", async (req, res) => {
  try {
    const { lignes, ...devisData } = req.body;
    const { count, error: countError } = await supabase.from("devis").select("*", { count: "exact", head: true });
    if (countError) {
      console.error("Error counting devis:", countError);
      return res.status(500).json({ error: "Failed to generate devis number", details: countError.message });
    }
    const numero = `DEV/${(/* @__PURE__ */ new Date()).getFullYear()}/${String((count || 0) + 1).padStart(5, "0")}`;
    const data = {
      numero,
      client_id: devisData.clientId,
      date_emission: devisData.dateEmission,
      date_validite: devisData.dateValidite,
      statut: devisData.statut || "brouillon",
      mode_paiement: devisData.modePaiement,
      montant_ht: Number(devisData.montantHt || 0),
      montant_tva: Number(devisData.montantTva || 0),
      montant_ttc: Number(devisData.montantTtc || 0),
      notes: devisData.notes
    };
    const { data: devis, error: devisError } = await supabase.from("devis").insert([data]).select().single();
    if (devisError) {
      console.error("Error creating devis:", devisError);
      return res.status(400).json({ error: "Failed to create devis", details: devisError.message });
    }
    await logActivity("cr\xC3\xA9ation devis", `Devis ${numero} cr\xC3\xA9\xC3\xA9`);
    if (lignes && lignes.length > 0) {
      const lignesData = lignes.map((l, index) => {
        const qte = Number(l.quantite || 0);
        const pu = Number(l.prix_unitaire || l.prix_unitaire_ht || 0);
        const tva = Number(l.tva || 0);
        const mht = Number(l.montant_ht || qte * pu);
        const mttc = Number(l.montant_ttc || mht * (1 + tva / 100));
        return {
          devis_id: devis.id,
          produit_id: l.produit_id || null,
          reference: l.reference || null,
          designation: l.designation || l.description || "",
          quantite: qte,
          prix_unitaire_ht: pu,
          tva,
          montant_ht: mht,
          montant_ttc: mttc,
          ordre: l.ordre !== void 0 ? Number(l.ordre) : index
        };
      });
      const { error: lignesError } = await supabase.from("devis_lignes").insert(lignesData);
      if (lignesError) {
        console.error("Error creating devis lines:", JSON.stringify(lignesError, null, 2));
        await supabase.from("devis").delete().eq("id", devis.id);
        return res.status(400).json({ error: "Error creating devis lines", details: lignesError.message || JSON.stringify(lignesError) });
      }
    }
    const { data: completeDevis, error: fetchError } = await supabase.from("devis").select("*, lignes:devis_lignes(*), client:clients(*)").eq("id", devis.id).single();
    if (fetchError) {
      return res.status(201).json(toCamel(devis));
    }
    res.status(201).json(toCamel(completeDevis));
  } catch (error) {
    console.error("Unexpected error in POST /devis:", error);
    res.status(500).json({ error: "Internal server error", details: formatError(error) });
  }
});
router.put("/devis/:id/statut", async (req, res) => {
  try {
    const { statut } = req.body;
    const { data: devis, error } = await supabase.from("devis").update({ statut }).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json(toCamel(devis));
  } catch (error) {
    res.status(500).json({ error: "Failed to update devis status" });
  }
});
router.get("/devis/:id", async (req, res) => {
  try {
    const { data: devis, error } = await supabase.from("devis").select("*, client:clients(*), lignes:devis_lignes(*)").eq("id", req.params.id).single();
    if (error) throw error;
    if (!devis) return res.status(404).json({ error: "Not found" });
    res.json(toCamel(devis));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch devis" });
  }
});
router.put("/devis/:id", async (req, res) => {
  try {
    const { lignes, ...devisData } = req.body;
    const id = req.params.id;
    const updateData = {};
    if (devisData.clientId !== void 0) updateData.client_id = devisData.clientId;
    if (devisData.dateEmission !== void 0) updateData.date_emission = devisData.dateEmission;
    if (devisData.dateValidite !== void 0) updateData.date_validite = devisData.dateValidite;
    if (devisData.statut !== void 0) updateData.statut = devisData.statut;
    if (devisData.modePaiement !== void 0) updateData.mode_paiement = devisData.modePaiement;
    if (devisData.montantHt !== void 0) updateData.montant_ht = Number(devisData.montantHt || 0);
    if (devisData.montantTva !== void 0) updateData.montant_tva = Number(devisData.montantTva || 0);
    if (devisData.montantTtc !== void 0) updateData.montant_ttc = Number(devisData.montantTtc || 0);
    if (devisData.notes !== void 0) updateData.notes = devisData.notes;
    const { error: updateError } = await supabase.from("devis").update(updateData).eq("id", id);
    if (updateError) {
      console.error("Error updating devis:", updateError);
      return res.status(400).json({ error: "Failed to update devis", details: formatError(updateError) });
    }
    if (updateData.statut) {
      await logActivity("changement de statut devis", `Devis ${id} : statut mis \xC3\xA0 jour vers ${updateData.statut}`);
    }
    if (lignes !== void 0) {
      await supabase.from("devis_lignes").delete().eq("devis_id", id);
      if (lignes && lignes.length > 0) {
        const lignesData = lignes.map((l, index) => {
          const qte = Number(l.quantite || 0);
          const pu = Number(l.prix_unitaire || l.prix_unitaire_ht || 0);
          const tva = Number(l.tva || 0);
          const mht = Number(l.montant_ht || qte * pu);
          const mttc = Number(l.montant_ttc || mht * (1 + tva / 100));
          return {
            devis_id: id,
            produit_id: l.produit_id || null,
            reference: l.reference || null,
            designation: l.designation || l.description || "",
            quantite: qte,
            prix_unitaire_ht: pu,
            tva,
            montant_ht: mht,
            montant_ttc: mttc,
            ordre: l.ordre !== void 0 ? Number(l.ordre) : index
          };
        });
        const { error: lignesError } = await supabase.from("devis_lignes").insert(lignesData);
        if (lignesError) {
          console.error("Error updating devis lines:", JSON.stringify(lignesError, null, 2));
          return res.status(400).json({ error: "Error updating devis lines", details: lignesError.message || JSON.stringify(lignesError) });
        }
      }
    }
    const { data: updatedDevis, error: fetchError } = await supabase.from("devis").select("*, lignes:devis_lignes(*), client:clients(*)").eq("id", id).single();
    if (fetchError) {
      return res.status(200).json({ id });
    }
    res.json(toCamel(updatedDevis));
  } catch (error) {
    console.error("Unexpected error in PUT /devis/:id:", error);
    res.status(500).json({ error: "Internal server error", details: formatError(error) });
  }
});
router.delete("/devis/:id", async (req, res) => {
  try {
    const { data: devis } = await supabase.from("devis").select("statut").eq("id", req.params.id).single();
    if (devis && devis.statut !== "brouillon") {
      return res.status(400).json({ error: "Impossible de supprimer un devis valid\xC3\xA9. Veuillez le refuser ou l'annuler." });
    }
    const { error } = await supabase.from("devis").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete devis" });
  }
});
router.post("/devis/:id/convert", async (req, res) => {
  try {
    const { data: devis, error: fetchError } = await supabase.from("devis").select("*, lignes:devis_lignes(*)").eq("id", req.params.id).single();
    if (fetchError) throw fetchError;
    if (!devis) return res.status(404).json({ error: "Devis not found" });
    const { count } = await supabase.from("factures").select("*", { count: "exact", head: true });
    const numero = `FAC/${(/* @__PURE__ */ new Date()).getFullYear()}/${String((count || 0) + 1).padStart(5, "0")}`;
    const { data: facture, error: factureError } = await supabase.from("factures").insert([{
      numero,
      client_id: devis.client_id,
      date_emission: (/* @__PURE__ */ new Date()).toISOString(),
      montant_ht: devis.montant_ht,
      montant_tva: devis.montant_tva,
      montant_ttc: devis.montant_ttc,
      statut: "en_attente",
      reste_a_payer: devis.montant_ttc,
      mode_paiement: devis.mode_paiement,
      notes: `Facture g\xC3\xA9n\xC3\xA9r\xC3\xA9e \xC3\xA0 partir du devis ${devis.numero}`
    }]).select().single();
    if (factureError) throw factureError;
    if (devis.lignes && devis.lignes.length > 0) {
      const lignesData = devis.lignes.map((l) => ({
        facture_id: facture.id,
        produit_id: l.produit_id,
        reference: l.reference,
        designation: l.designation,
        quantite: l.quantite,
        prix_unitaire_ht: l.prix_unitaire_ht,
        tva: l.tva,
        montant_ht: l.montant_ht,
        montant_ttc: l.montant_ttc,
        ordre: l.ordre
      }));
      const { error: lignesError } = await supabase.from("facture_lignes").insert(lignesData);
      if (lignesError) throw lignesError;
    }
    await supabase.from("devis").update({ statut: "converti" }).eq("id", devis.id);
    res.status(201).json(toCamel(facture));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to convert devis" });
  }
});
router.get("/bons-commande", async (req, res) => {
  try {
    const { data: bons, error } = await supabase.from("bons_commande").select("*, fournisseur:fournisseurs(*)").order("created_at", { ascending: false });
    if (error) throw error;
    res.json(toCamel(bons));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bons de commande" });
  }
});
router.get("/bons-commande/:id", async (req, res) => {
  try {
    const { data: bon, error } = await supabase.from("bons_commande").select("*, fournisseur:fournisseurs(*), lignes:bon_commande_lignes(*)").eq("id", req.params.id).single();
    if (error) throw error;
    res.json(toCamel(bon));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bon de commande" });
  }
});
router.post("/bons-commande", async (req, res) => {
  try {
    const { lignes, ...bonData } = req.body;
    const { count, error: countError } = await supabase.from("bons_commande").select("*", { count: "exact", head: true });
    if (countError) {
      console.error("Error counting bons de commande:", countError);
      return res.status(500).json({ error: "Failed to generate order number", details: countError.message });
    }
    const numero = `BC/${(/* @__PURE__ */ new Date()).getFullYear()}/${String((count || 0) + 1).padStart(5, "0")}`;
    const data = {
      numero,
      fournisseur_id: bonData.fournisseurId,
      date_commande: bonData.dateCommande,
      date_livraison_prevue: bonData.dateLivraisonPrevue,
      statut: bonData.statut || "en_attente",
      montant_ht: bonData.montantHt || 0,
      montant_tva: bonData.montantTva || 0,
      montant_ttc: bonData.montantTtc || 0
    };
    const { data: bon, error: bonError } = await supabase.from("bons_commande").insert([data]).select().single();
    if (bonError) {
      console.error("Error creating bon de commande:", bonError);
      return res.status(400).json({ error: "Failed to create bon de commande", details: bonError.message });
    }
    await logActivity("cr\xC3\xA9ation bon de commande", `Bon de Commande ${numero} cr\xC3\xA9\xC3\xA9`);
    if (lignes && lignes.length > 0) {
      const lignesData = lignes.map((l, index) => {
        const qte = Number(l.quantite || 0);
        const pu = Number(l.prix_unitaire || l.prix_unitaire_ht || 0);
        const tva = Number(l.tva || 0);
        const mht = Number(l.montant_ht || qte * pu);
        const mttc = Number(l.montant_ttc || mht * (1 + tva / 100));
        return {
          bon_commande_id: bon.id,
          produit_id: l.produit_id ? Number(l.produit_id) : null,
          reference: l.reference || null,
          designation: l.designation || l.description || "",
          quantite: qte,
          prix_unitaire_ht: pu,
          tva,
          montant_ht: mht,
          montant_ttc: mttc,
          ordre: l.ordre !== void 0 ? Number(l.ordre) : index
        };
      });
      const { error: lignesError } = await supabaseAdmin.from("bon_commande_lignes").insert(lignesData);
      if (lignesError) {
        console.error("Error creating bon de commande lines:", JSON.stringify(lignesError, null, 2));
        await supabaseAdmin.from("bons_commande").delete().eq("id", bon.id);
        return res.status(400).json({
          error: "Error creating bon de commande lines",
          details: lignesError.message,
          hint: "Run in Supabase SQL Editor: ALTER TABLE bon_commande_lignes ADD COLUMN IF NOT EXISTS montant_ht DECIMAL(12,2) DEFAULT 0;"
        });
      }
      const islivr\u00E9 = bon.statut === "livr\xE9e" || bon.statut === "livr\xE9";
      if (islivr\u00E9) {
        const { data: fournisseur } = await supabaseAdmin.from("fournisseurs").select("nom").eq("id", bon.fournisseur_id).single();
        for (const l of lignesData) {
          if (l.produit_id) {
            await updateProductStock(
              l.produit_id,
              Number(l.quantite || 0),
              "achat",
              bon.numero,
              `R\xC3\xA9ception Bon de Commande ${bon.numero}`,
              fournisseur?.nom,
              l.prix_unitaire_ht
            );
          }
        }
        const { count: blCount } = await supabaseAdmin.from("bons_livraison").select("*", { count: "exact", head: true });
        const blNumero = `BL/${(/* @__PURE__ */ new Date()).getFullYear()}/${String((blCount || 0) + 1).padStart(5, "0")}`;
        const blData = {
          numero: blNumero,
          fournisseur_id: bon.fournisseur_id,
          date_livraison: (/* @__PURE__ */ new Date()).toISOString(),
          statut: "livr\xE9",
          notes: `G\xC3\xA9n\xC3\xA9r\xC3\xA9 automatiquement depuis Bon de Commande ${bon.numero}`,
          montant_ht: bon.montant_ht || 0,
          montant_tva: bon.montant_tva || 0,
          montant_ttc: bon.montant_ttc || 0,
          bon_commande_id: bon.id
        };
        const { data: newBL, error: blError } = await supabaseAdmin.from("bons_livraison").insert([blData]).select().single();
        if (!blError && newBL && lignesData) {
          const blLignesData = lignesData.map((l, index) => ({
            bon_livraison_id: newBL.id,
            produit_id: l.produit_id,
            reference: l.reference,
            designation: l.designation,
            quantite: l.quantite,
            prix_unitaire_ht: l.prix_unitaire_ht,
            tva: l.tva,
            montant_ht: l.montant_ht,
            montant_ttc: l.montant_ttc,
            ordre: l.ordre !== void 0 ? l.ordre : index
          }));
          await supabaseAdmin.from("bon_livraison_lignes").insert(blLignesData);
        }
      }
    }
    const { data: completeBon, error: fetchError } = await supabase.from("bons_commande").select("*, fournisseur:fournisseurs(*), lignes:bon_commande_lignes(*)").eq("id", bon.id).single();
    if (fetchError) {
      return res.status(201).json(toCamel(bon));
    }
    res.status(201).json(toCamel(completeBon));
  } catch (error) {
    console.error("Unexpected error in POST /bons-commande:", error);
    res.status(500).json({ error: "Internal server error", details: formatError(error) });
  }
});
router.put("/bons-commande/:id", async (req, res) => {
  try {
    const { lignes, ...bonData } = req.body;
    const id = req.params.id;
    const { data: oldBon } = await supabaseAdmin.from("bons_commande").select("statut, fournisseur_id, numero").eq("id", id).single();
    const oldStatut = oldBon?.statut;
    const wasStockUpdated = oldStatut === "livr\xE9" || oldStatut === "livr\xE9e";
    const updateData = {};
    if (bonData.fournisseurId !== void 0) updateData.fournisseur_id = bonData.fournisseurId;
    if (bonData.dateCommande !== void 0) updateData.date_commande = bonData.dateCommande;
    if (bonData.dateLivraisonPrevue !== void 0) updateData.date_livraison_prevue = bonData.dateLivraisonPrevue;
    if (bonData.statut !== void 0) updateData.statut = bonData.statut;
    if (bonData.montantHt !== void 0) updateData.montant_ht = bonData.montantHt;
    if (bonData.montantTva !== void 0) updateData.montant_tva = bonData.montantTva;
    if (bonData.montantTtc !== void 0) updateData.montant_ttc = bonData.montantTtc;
    const { error: updateError } = await supabase.from("bons_commande").update(updateData).eq("id", id);
    if (updateError) {
      console.error("Error updating bon de commande:", updateError);
      return res.status(400).json({ error: "Failed to update bon de commande", details: formatError(updateError) });
    }
    if (updateData.statut) {
      await logActivity("changement de statut bon de commande", `Bon de Commande ${id} : statut mis \xC3\xA0 jour vers ${updateData.statut}`);
    }
    const newStatut = updateData.statut || oldStatut;
    const isNowLivr\u00E9 = newStatut === "livr\xE9e" || newStatut === "livr\xE9";
    const waslivr\u00E9 = oldStatut === "livr\xE9e" || oldStatut === "livr\xE9";
    if (isNowLivr\u00E9 && !waslivr\u00E9) {
      const { count: blCount } = await supabaseAdmin.from("bons_livraison").select("*", { count: "exact", head: true });
      const blNumero = `BL/${(/* @__PURE__ */ new Date()).getFullYear()}/${String((blCount || 0) + 1).padStart(5, "0")}`;
      const { data: bonDetails } = await supabaseAdmin.from("bons_commande").select("*").eq("id", id).single();
      const { data: bonLignes } = await supabaseAdmin.from("bon_commande_lignes").select("*").eq("bon_commande_id", id);
      if (bonDetails) {
        const blData = {
          numero: blNumero,
          fournisseur_id: bonDetails.fournisseur_id,
          date_livraison: (/* @__PURE__ */ new Date()).toISOString(),
          statut: "livr\xE9",
          notes: `G\xC3\xA9n\xC3\xA9r\xC3\xA9 automatiquement depuis Bon de Commande ${bonDetails.numero}`,
          montant_ht: bonDetails.montant_ht || 0,
          montant_tva: bonDetails.montant_tva || 0,
          montant_ttc: bonDetails.montant_ttc || 0,
          bon_commande_id: id
        };
        const { data: newBL, error: blError } = await supabaseAdmin.from("bons_livraison").insert([blData]).select().single();
        if (!blError && newBL && bonLignes) {
          const blLignesData = bonLignes.map((l, index) => ({
            bon_livraison_id: newBL.id,
            produit_id: l.produit_id,
            reference: l.reference,
            designation: l.designation,
            quantite: l.quantite,
            prix_unitaire_ht: l.prix_unitaire_ht,
            tva: l.tva,
            montant_ht: l.montant_ht || Number(l.quantite || 0) * Number(l.prix_unitaire_ht || 0),
            montant_ttc: l.montant_ttc || Number(l.quantite || 0) * Number(l.prix_unitaire_ht || 0) * (1 + Number(l.tva || 0) / 100),
            ordre: l.ordre !== void 0 ? l.ordre : index
          }));
          await supabaseAdmin.from("bon_livraison_lignes").insert(blLignesData);
        }
      }
    } else if (!isNowLivr\u00E9 && waslivr\u00E9) {
      await supabaseAdmin.from("bons_livraison").delete().eq("bon_commande_id", id);
    }
    if (isNowLivr\u00E9 && !wasStockUpdated) {
      const { data: currentLignes } = await supabaseAdmin.from("bon_commande_lignes").select("*").eq("bon_commande_id", id);
      const { data: fournisseur } = await supabaseAdmin.from("fournisseurs").select("nom").eq("id", oldBon.fournisseur_id || updateData.fournisseur_id).single();
      const { data: b } = await supabaseAdmin.from("bons_commande").select("numero").eq("id", id).single();
      if (currentLignes && currentLignes.length > 0) {
        for (const l of currentLignes) {
          if (l.produit_id) await updateProductStock(
            l.produit_id,
            Number(l.quantite || 0),
            "achat",
            b?.numero,
            `R\xC3\xA9ception Bon de Commande ${b?.numero}`,
            fournisseur?.nom,
            l.prix_unitaire_ht
          );
        }
      }
    } else if (!isNowLivr\u00E9 && wasStockUpdated) {
      const { data: currentLignes } = await supabaseAdmin.from("bon_commande_lignes").select("*").eq("bon_commande_id", id);
      const { data: fournisseur } = await supabaseAdmin.from("fournisseurs").select("nom").eq("id", oldBon.fournisseur_id || updateData.fournisseur_id).single();
      const { data: b } = await supabaseAdmin.from("bons_commande").select("numero").eq("id", id).single();
      if (currentLignes && currentLignes.length > 0) {
        for (const l of currentLignes) {
          if (l.produit_id) await updateProductStock(
            l.produit_id,
            -Number(l.quantite || 0),
            "ajustement",
            b?.numero,
            `Annulation R\xC3\xA9ception Bon de Commande ${b?.numero}`,
            fournisseur?.nom,
            l.prix_unitaire_ht
          );
        }
      }
    }
    if (lignes !== void 0) {
      await supabaseAdmin.from("bon_commande_lignes").delete().eq("bon_commande_id", id);
      if (lignes && lignes.length > 0) {
        const lignesData = lignes.map((l, index) => {
          const qte = Number(l.quantite || 0);
          const pu = Number(l.prix_unitaire || l.prix_unitaire_ht || 0);
          const tva = Number(l.tva || 0);
          const mht = Number(l.montant_ht || qte * pu);
          const mttc = Number(l.montant_ttc || mht * (1 + tva / 100));
          return {
            bon_commande_id: id,
            produit_id: l.produit_id ? Number(l.produit_id) : null,
            reference: l.reference || null,
            designation: l.designation || l.description || "",
            quantite: qte,
            prix_unitaire_ht: pu,
            tva,
            montant_ht: mht,
            montant_ttc: mttc,
            ordre: l.ordre !== void 0 ? Number(l.ordre) : index
          };
        });
        const { error: lignesError } = await supabaseAdmin.from("bon_commande_lignes").insert(lignesData);
        if (lignesError) {
          console.error("Error updating bon de commande lines:", JSON.stringify(lignesError, null, 2));
          return res.status(400).json({ error: "Error updating bon de commande lines", details: lignesError.message || JSON.stringify(lignesError) });
        }
      }
    }
    const { data: updatedBon, error: fetchError } = await supabase.from("bons_commande").select("*, fournisseur:fournisseurs(*), lignes:bon_commande_lignes(*)").eq("id", id).single();
    if (fetchError) {
      return res.status(200).json({ id });
    }
    res.json(toCamel(updatedBon));
  } catch (error) {
    console.error("Unexpected error in PUT /bons-commande:", error);
    res.status(500).json({ error: "Internal server error", details: formatError(error) });
  }
});
router.delete("/bons-commande/:id", async (req, res) => {
  try {
    const { data: bc } = await supabaseAdmin.from("bons_commande").select("statut").eq("id", req.params.id).single();
    if (bc && bc.statut !== "brouillon") {
      return res.status(400).json({ error: "Impossible de supprimer un bon de commande valid\xC3\xA9. Veuillez l'annuler." });
    }
    const { error } = await supabaseAdmin.from("bons_commande").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete bon de commande" });
  }
});
router.put(["/bons-commande/:id/statut", "/bons-commande/:id/status"], async (req, res) => {
  try {
    const { statut } = req.body ?? {};
    const rawId = req.params.id;
    const id = parseInt(rawId, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: `Invalid bon de commande id: "${rawId}"` });
    }
    if (typeof statut !== "string" || statut.trim() === "") {
      return res.status(400).json({ error: 'Field "statut" is required and must be a non-empty string' });
    }
    const { data: oldBon, error: fetchError } = await supabaseAdmin.from("bons_commande").select("statut, fournisseur_id, numero").eq("id", id).single();
    if (fetchError || !oldBon) {
      console.error("[PUT /bons-commande/:id/statut] fetch failed:", fetchError);
      return res.status(404).json({
        error: `Bon de commande ${id} introuvable`,
        details: fetchError?.message
      });
    }
    const isLivr\u00E9Status = (s) => s === "livr\xE9" || s === "livr\xE9e";
    const isNowLivr\u00E9 = isLivr\u00E9Status(statut);
    const wasLivr\u00E9 = isLivr\u00E9Status(oldBon.statut);
    const wasStockUpdated = wasLivr\u00E9;
    const { data: bon, error: updateError } = await supabaseAdmin.from("bons_commande").update({ statut }).eq("id", id).select().single();
    if (updateError || !bon) {
      console.error("[PUT /bons-commande/:id/statut] update failed:", updateError);
      return res.status(500).json({
        error: "Failed to update bon de commande status",
        details: updateError?.message,
        code: updateError?.code
      });
    }
    if (isNowLivr\u00E9 && !wasLivr\u00E9) {
      try {
        const { count: blCount } = await supabaseAdmin.from("bons_livraison").select("*", { count: "exact", head: true });
        const blNumero = `BL/${(/* @__PURE__ */ new Date()).getFullYear()}/${String((blCount || 0) + 1).padStart(5, "0")}`;
        const { data: bonDetails } = await supabaseAdmin.from("bons_commande").select("*").eq("id", id).single();
        const { data: bonLignes } = await supabaseAdmin.from("bon_commande_lignes").select("*").eq("bon_commande_id", id);
        if (bonDetails) {
          const blData = {
            numero: blNumero,
            fournisseur_id: bonDetails.fournisseur_id,
            date_livraison: (/* @__PURE__ */ new Date()).toISOString(),
            statut: "livr\xE9",
            notes: `G\xE9n\xE9r\xE9 automatiquement depuis Bon de Commande ${bonDetails.numero}`,
            montant_ht: bonDetails.montant_ht || 0,
            montant_tva: bonDetails.montant_tva || 0,
            montant_ttc: bonDetails.montant_ttc || 0,
            bon_commande_id: id
          };
          const { data: newBL, error: blError } = await supabaseAdmin.from("bons_livraison").insert([blData]).select().single();
          if (blError) {
            console.warn("[PUT /bons-commande/:id/statut] BL insert failed:", blError);
          } else if (newBL && bonLignes && bonLignes.length > 0) {
            const blLignesData = bonLignes.map((l, index) => ({
              bon_livraison_id: newBL.id,
              produit_id: l.produit_id,
              reference: l.reference,
              designation: l.designation,
              quantite: l.quantite,
              prix_unitaire_ht: l.prix_unitaire_ht,
              tva: l.tva,
              montant_ht: l.montant_ht || Number(l.quantite || 0) * Number(l.prix_unitaire_ht || 0),
              montant_ttc: l.montant_ttc || Number(l.quantite || 0) * Number(l.prix_unitaire_ht || 0) * (1 + Number(l.tva || 0) / 100),
              ordre: l.ordre !== void 0 ? l.ordre : index
            }));
            const { error: blLignesError } = await supabaseAdmin.from("bon_livraison_lignes").insert(blLignesData);
            if (blLignesError) {
              console.warn("[PUT /bons-commande/:id/statut] BL lignes insert failed:", blLignesError);
            }
          }
        }
      } catch (blSyncErr) {
        console.error("[PUT /bons-commande/:id/statut] BL sync error (non-fatal):", blSyncErr);
      }
    } else if (!isNowLivr\u00E9 && wasLivr\u00E9) {
      const { error: delErr } = await supabaseAdmin.from("bons_livraison").delete().eq("bon_commande_id", id);
      if (delErr) {
        console.warn("[PUT /bons-commande/:id/statut] BL delete failed:", delErr);
      }
    }
    if (isNowLivr\u00E9 && !wasStockUpdated) {
      const { data: currentLignes } = await supabaseAdmin.from("bon_commande_lignes").select("*").eq("bon_commande_id", id);
      const { data: b } = await supabaseAdmin.from("bons_commande").select("*, fournisseur:fournisseurs(nom)").eq("id", id).single();
      if (currentLignes && currentLignes.length > 0) {
        for (const l of currentLignes) {
          if (!l.produit_id) continue;
          try {
            await updateProductStock(
              l.produit_id,
              Number(l.quantite || 0),
              "achat",
              b?.numero,
              `R\xE9ception Bon de Commande ${b?.numero}`,
              b?.fournisseur?.nom,
              l.prix_unitaire_ht
            );
          } catch (stockErr) {
            console.error(
              `[PUT /bons-commande/:id/statut] stock increment failed for produit ${l.produit_id}:`,
              stockErr
            );
          }
        }
      }
    } else if (!isNowLivr\u00E9 && wasStockUpdated) {
      const { data: currentLignes } = await supabaseAdmin.from("bon_commande_lignes").select("*").eq("bon_commande_id", id);
      const { data: b } = await supabaseAdmin.from("bons_commande").select("*, fournisseur:fournisseurs(nom)").eq("id", id).single();
      if (currentLignes && currentLignes.length > 0) {
        for (const l of currentLignes) {
          if (!l.produit_id) continue;
          try {
            await updateProductStockSafe(
              l.produit_id,
              -Number(l.quantite || 0),
              "ajustement",
              b?.numero,
              `Annulation R\xE9ception Bon de Commande ${b?.numero}`,
              b?.fournisseur?.nom,
              l.prix_unitaire_ht
            );
          } catch (stockErr) {
            console.error(
              `[PUT /bons-commande/:id/statut] stock revert failed for produit ${l.produit_id}:`,
              stockErr
            );
          }
        }
      }
    }
    return res.json(toCamel(bon));
  } catch (error) {
    console.error("[PUT /bons-commande/:id/statut] unhandled error:", error);
    return res.status(500).json({
      error: "Failed to update bon de commande status",
      details: error?.message || String(error),
      code: error?.code
    });
  }
});
router.get("/bons-livraison", async (req, res) => {
  try {
    const { data: bons, error } = await supabase.from("bons_livraison").select("*, fournisseur:fournisseurs(*)").order("created_at", { ascending: false });
    if (error) throw error;
    res.json(toCamel(bons));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bons de livraison" });
  }
});
router.get("/bons-livraison/:id", async (req, res) => {
  try {
    const { data: bon, error } = await supabase.from("bons_livraison").select("*, fournisseur:fournisseurs(*), lignes:bon_livraison_lignes(*)").eq("id", req.params.id).single();
    if (error) throw error;
    res.json(toCamel(bon));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bon de livraison" });
  }
});
router.post("/bons-livraison", async (req, res) => {
  try {
    const { lignes, ...blData } = req.body;
    const { count, error: countError } = await supabase.from("bons_livraison").select("*", { count: "exact", head: true });
    if (countError) {
      console.error("Error counting bons de livraison:", countError);
      return res.status(500).json({ error: "Failed to generate order number", details: countError.message });
    }
    const numero = `BL/${(/* @__PURE__ */ new Date()).getFullYear()}/${String((count || 0) + 1).padStart(5, "0")}`;
    const data = {
      numero,
      fournisseur_id: blData.fournisseurId,
      date_livraison: blData.dateLivraison,
      statut: blData.statut || "en_attente",
      notes: blData.notes,
      montant_ht: blData.montantHt || 0,
      montant_tva: blData.montantTva || 0,
      montant_ttc: blData.montantTtc || 0
    };
    const { data: bon, error: bonError } = await supabase.from("bons_livraison").insert([data]).select().single();
    if (bonError) {
      console.error("Error creating bon de livraison:", bonError);
      return res.status(400).json({ error: "Failed to create bon de livraison", details: bonError.message });
    }
    if (lignes && lignes.length > 0) {
      const lignesData = lignes.map((l, index) => {
        const qte = Number(l.quantite || 0);
        const pu = Number(l.prix_unitaire || l.prix_unitaire_ht || 0);
        const tva = Number(l.tva || 0);
        const mht = Number(l.montant_ht || qte * pu);
        const mttc = Number(l.montant_ttc || mht * (1 + tva / 100));
        return {
          bon_livraison_id: bon.id,
          produit_id: l.produit_id ? Number(l.produit_id) : null,
          reference: l.reference || null,
          designation: l.designation || l.description || "",
          quantite: qte,
          prix_unitaire_ht: pu,
          tva,
          montant_ht: mht,
          montant_ttc: mttc,
          ordre: l.ordre !== void 0 ? Number(l.ordre) : index
        };
      });
      const { error: lignesError } = await supabase.from("bon_livraison_lignes").insert(lignesData);
      if (lignesError) {
        console.error("Error creating bon de livraison lines:", JSON.stringify(lignesError, null, 2));
        await supabase.from("bons_livraison").delete().eq("id", bon.id);
        return res.status(400).json({
          error: "Error creating bon de livraison lines",
          details: lignesError.message,
          hint: "Visit /api/fix-schema and run the SQL in Supabase"
        });
      }
      const totalHt = lignesData.reduce((sum, l) => sum + Number(l.montant_ht || 0), 0);
      const totalTva = lignesData.reduce((sum, l) => sum + Number(l.montant_ht || 0) * Number(l.tva || 20) / 100, 0);
      const totalTtc = lignesData.reduce((sum, l) => sum + Number(l.montant_ttc || 0), 0);
      await supabase.from("bons_livraison").update({
        montant_ht: totalHt,
        montant_tva: totalTva,
        montant_ttc: totalTtc
      }).eq("id", bon.id);
      const islivr\u00E9 = bon.statut === "livr\xE9e" || bon.statut === "livr\xE9";
      if (islivr\u00E9) {
        const { data: fournisseur } = await supabase.from("fournisseurs").select("nom").eq("id", bon.fournisseur_id).single();
        for (const l of lignesData) {
          if (l.produit_id) {
            await updateProductStock(
              l.produit_id,
              Number(l.quantite || 0),
              "achat",
              bon.numero,
              `R\xC3\xA9ception Bon de Livraison ${bon.numero}`,
              fournisseur?.nom,
              l.prix_unitaire_ht
            );
          }
        }
        await supabase.from("bons_livraison").update({ stock_updated: true }).eq("id", bon.id);
      }
    }
    const { data: completeBon, error: fetchError } = await supabase.from("bons_livraison").select("*, fournisseur:fournisseurs(*), lignes:bon_livraison_lignes(*)").eq("id", bon.id).single();
    if (fetchError) {
      return res.status(201).json(toCamel(bon));
    }
    res.status(201).json(toCamel(completeBon));
  } catch (error) {
    console.error("Unexpected error in POST /bons-livraison:", error);
    res.status(500).json({ error: "Internal server error", details: formatError(error) });
  }
});
router.put("/bons-livraison/:id", async (req, res) => {
  try {
    const { lignes, ...blData } = req.body;
    const id = req.params.id;
    const { data: oldBon } = await supabase.from("bons_livraison").select("statut, stock_updated, fournisseur_id, numero").eq("id", id).single();
    const oldStatut = oldBon?.statut;
    const wasStockUpdated = oldBon?.stock_updated;
    const updateData = {};
    if (blData.fournisseurId !== void 0) updateData.fournisseur_id = blData.fournisseurId;
    if (blData.dateLivraison !== void 0) updateData.date_livraison = blData.dateLivraison;
    if (blData.statut !== void 0) updateData.statut = blData.statut;
    if (blData.montantHt !== void 0) updateData.montant_ht = blData.montantHt;
    if (blData.montantTva !== void 0) updateData.montant_tva = blData.montantTva;
    if (blData.montantTtc !== void 0) updateData.montant_ttc = blData.montantTtc;
    const { error: updateError } = await supabase.from("bons_livraison").update(updateData).eq("id", id);
    if (updateError) {
      console.error("Error updating bon de livraison:", updateError);
      return res.status(400).json({ error: "Failed to update bon de livraison", details: formatError(updateError) });
    }
    const newStatut = updateData.statut || oldStatut;
    const isNowLivr\u00E9 = newStatut === "livr\xE9e" || newStatut === "livr\xE9";
    const waslivr\u00E9 = oldStatut === "livr\xE9e" || oldStatut === "livr\xE9";
    if (isNowLivr\u00E9 && !wasStockUpdated) {
      const { data: currentLignes } = await supabase.from("bon_livraison_lignes").select("*").eq("bon_livraison_id", id);
      const { data: fournisseur } = await supabase.from("fournisseurs").select("nom").eq("id", oldBon.fournisseur_id || updateData.fournisseur_id).single();
      const { data: b } = await supabase.from("bons_livraison").select("numero").eq("id", id).single();
      if (currentLignes && currentLignes.length > 0) {
        for (const l of currentLignes) {
          if (l.produit_id) await updateProductStock(
            l.produit_id,
            Number(l.quantite || 0),
            "achat",
            b?.numero,
            `R\xC3\xA9ception Bon de Livraison ${b?.numero}`,
            fournisseur?.nom,
            l.prix_unitaire_ht
          );
        }
        await supabase.from("bons_livraison").update({ stock_updated: true }).eq("id", id);
      }
    } else if (!isNowLivr\u00E9 && wasStockUpdated) {
      const { data: currentLignes } = await supabase.from("bon_livraison_lignes").select("*").eq("bon_livraison_id", id);
      const { data: fournisseur } = await supabase.from("fournisseurs").select("nom").eq("id", oldBon.fournisseur_id || updateData.fournisseur_id).single();
      const { data: b } = await supabase.from("bons_livraison").select("numero").eq("id", id).single();
      if (currentLignes && currentLignes.length > 0) {
        for (const l of currentLignes) {
          if (l.produit_id) await updateProductStock(
            l.produit_id,
            -Number(l.quantite || 0),
            "ajustement",
            b?.numero,
            `Annulation R\xC3\xA9ception Bon de Livraison ${b?.numero}`,
            fournisseur?.nom,
            l.prix_unitaire_ht
          );
        }
        await supabase.from("bons_livraison").update({ stock_updated: false }).eq("id", id);
      }
    }
    if (lignes !== void 0) {
      await supabase.from("bon_livraison_lignes").delete().eq("bon_livraison_id", id);
      if (lignes && lignes.length > 0) {
        const lignesData = lignes.map((l, index) => {
          const qte = Number(l.quantite || 0);
          const pu = Number(l.prix_unitaire || l.prix_unitaire_ht || 0);
          const tva = Number(l.tva || 0);
          const mht = Number(l.montant_ht || qte * pu);
          const mttc = Number(l.montant_ttc || mht * (1 + tva / 100));
          return {
            bon_livraison_id: id,
            produit_id: l.produit_id ? Number(l.produit_id) : null,
            reference: l.reference || null,
            designation: l.designation || l.description || "",
            quantite: qte,
            prix_unitaire_ht: pu,
            tva,
            montant_ht: mht,
            montant_ttc: mttc,
            ordre: l.ordre !== void 0 ? Number(l.ordre) : index
          };
        });
        const { error: lignesError } = await supabase.from("bon_livraison_lignes").insert(lignesData);
        if (lignesError) {
          console.error("Error updating bon de livraison lines:", JSON.stringify(lignesError, null, 2));
          return res.status(400).json({ error: "Error updating bon de livraison lines", details: lignesError.message || JSON.stringify(lignesError) });
        }
      }
    }
    const { data: updatedBon, error: fetchError } = await supabase.from("bons_livraison").select("*, fournisseur:fournisseurs(*), lignes:bon_livraison_lignes(*)").eq("id", id).single();
    if (fetchError) {
      return res.status(200).json({ id });
    }
    res.json(toCamel(updatedBon));
  } catch (error) {
    console.error("Unexpected error in PUT /bons-livraison:", error);
    res.status(500).json({ error: "Internal server error", details: formatError(error) });
  }
});
router.delete("/bons-livraison/:id", async (req, res) => {
  try {
    const { data: bl } = await supabase.from("bons_livraison").select("statut").eq("id", req.params.id).single();
    if (bl && bl.statut !== "en_attente" && bl.statut !== "brouillon") {
      return res.status(400).json({ error: "Impossible de supprimer un bon de livraison valid\xC3\xA9. Veuillez l'annuler." });
    }
    const { error } = await supabase.from("bons_livraison").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete bon de livraison" });
  }
});
router.put(["/bons-livraison/:id/statut", "/bons-livraison/:id/status"], async (req, res) => {
  try {
    const { statut } = req.body;
    const id = req.params.id;
    const { data: oldBon } = await supabase.from("bons_livraison").select("statut, stock_updated, fournisseur_id, numero").eq("id", id).single();
    const wasStockUpdated = oldBon?.stock_updated;
    const { data: bon, error } = await supabase.from("bons_livraison").update({ statut }).eq("id", id).select().single();
    if (error) throw error;
    const isNowLivr\u00E9 = statut === "livr\xE9" || statut === "livr\xE9e";
    const waslivr\u00E9 = oldBon?.statut === "livr\xE9" || oldBon?.statut === "livr\xE9e";
    if (isNowLivr\u00E9 && !wasStockUpdated) {
      const { data: currentLignes } = await supabase.from("bon_livraison_lignes").select("*").eq("bon_livraison_id", id);
      const { data: b } = await supabase.from("bons_livraison").select("*, fournisseur:fournisseurs(nom)").eq("id", id).single();
      if (currentLignes && currentLignes.length > 0) {
        for (const l of currentLignes) {
          if (l.produit_id) await updateProductStock(
            l.produit_id,
            Number(l.quantite || 0),
            "achat",
            b?.numero,
            `R\xC3\xA9ception Bon de Livraison ${b?.numero}`,
            b?.fournisseur?.nom,
            l.prix_unitaire_ht
          );
        }
        await supabase.from("bons_livraison").update({ stock_updated: true }).eq("id", id);
      }
    } else if (!isNowLivr\u00E9 && wasStockUpdated) {
      const { data: currentLignes } = await supabase.from("bon_livraison_lignes").select("*").eq("bon_livraison_id", id);
      const { data: b } = await supabase.from("bons_livraison").select("*, fournisseur:fournisseurs(nom)").eq("id", id).single();
      if (currentLignes && currentLignes.length > 0) {
        for (const l of currentLignes) {
          if (l.produit_id) await updateProductStock(
            l.produit_id,
            -Number(l.quantite || 0),
            "ajustement",
            b?.numero,
            `Annulation R\xC3\xA9ception Bon de Livraison ${b?.numero}`,
            b?.fournisseur?.nom,
            l.prix_unitaire_ht
          );
        }
        await supabase.from("bons_livraison").update({ stock_updated: false }).eq("id", id);
      }
    }
    res.json(toCamel(bon));
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ error: "Failed to update bon de livraison status" });
  }
});
router.get("/ventes-passagers", async (req, res) => {
  try {
    const { data, error } = await supabase.from("ventes_passagers").select("*, lignes:ventes_passagers_lignes(*)").order("date", { ascending: false });
    if (error) throw error;
    res.json(toCamel(data));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch ventes passagers" });
  }
});
router.post("/ventes-passagers", async (req, res) => {
  try {
    const { lignes, ...vpData } = req.body;
    const { count } = await supabase.from("ventes_passagers").select("*", { count: "exact", head: true });
    const numero = `VP/${(/* @__PURE__ */ new Date()).getFullYear()}/${String((count || 0) + 1).padStart(5, "0")}`;
    const { data: vp, error: vpError } = await supabase.from("ventes_passagers").insert([{
      numero,
      date: vpData.date || (/* @__PURE__ */ new Date()).toISOString(),
      montant_ht: vpData.montantHt || 0,
      montant_tva: vpData.montantTva || 0,
      montant_ttc: vpData.montantTtc || 0,
      cogs: vpData.cogs || 0
    }]).select().single();
    if (vpError) throw vpError;
    await logActivity("cr\xC3\xA9ation vente passager", `Vente Passager ${numero} cr\xC3\xA9\xC3\xA9e`);
    if (lignes && lignes.length > 0) {
      const lignesData = lignes.map((l) => ({
        vp_id: vp.id,
        produit_id: l.produitId,
        designation: l.designation,
        quantite: l.quantite,
        prix_unitaire_ht: l.prixUnitaireHt,
        tva: l.tva,
        montant_ht: l.montantHt,
        montant_tva: l.montantTva,
        montant_ttc: l.montantTtc
      }));
      const { error: lignesError } = await supabase.from("ventes_passagers_lignes").insert(lignesData);
      if (lignesError) throw lignesError;
      for (const l of lignesData) {
        if (l.produit_id) {
          await updateProductStock(
            l.produit_id,
            -l.quantite,
            "vente",
            numero,
            `Vente Passager ${numero}`,
            "Passager",
            l.prix_unitaire_ht
          );
        }
      }
    }
    res.status(201).json(toCamel(vp));
  } catch (error) {
    console.error("Error creating vente passager:", error);
    res.status(500).json({ error: "Failed to create vente passager" });
  }
});
router.delete("/ventes-passagers/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { data: lignes } = await supabase.from("ventes_passagers_lignes").select("*").eq("vp_id", id);
    const { data: vp } = await supabase.from("ventes_passagers").select("numero").eq("id", id).single();
    if (lignes && vp) {
      for (const l of lignes) {
        if (l.produit_id) {
          await updateProductStock(
            l.produit_id,
            l.quantite,
            "ajustement",
            vp.numero,
            `Annulation Vente Passager ${vp.numero}`,
            "Passager",
            l.prix_unitaire_ht
          );
        }
      }
    }
    const { error } = await supabase.from("ventes_passagers").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete vente passager" });
  }
});
router.get("/smart-insights", async (req, res) => {
  try {
    const { data: factures } = await supabase.from("factures").select("*").in("statut", ["pay\xC3\xA9e", "reste_a_payer"]);
    const { data: produits } = await supabase.from("produits").select("*");
    const { data: depenses } = await supabase.from("depenses").select("*");
    const { data: bonsCommande } = await supabase.from("bons_commande").select("*").in("statut", ["livr\xE9", "livr\xE9e"]);
    const insights = [];
    const totalVentes = (factures || []).reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0) + ((await supabase.from("ventes_passagers").select("montant_ttc")).data || []).reduce((s, vp) => s + Number(vp.montant_ttc || 0), 0);
    if (totalVentes > 1e5) {
      insights.push({
        type: "performance",
        title: "Excellente Performance",
        message: "Vos ventes ont d\xC3\xA9pass\xC3\xA9 100k MAD ce mois-ci. Continuez ainsi !",
        status: "success"
      });
    } else if (totalVentes < 1e4) {
      insights.push({
        type: "performance",
        title: "Ventes Faibles",
        message: "Vos ventes sont en dessous de la moyenne. Envisagez une promotion.",
        status: "warning"
      });
    }
    const lowStock = (produits || []).filter((p) => Number(p.stock_actuel) <= Number(p.stock_min));
    if (lowStock.length > 5) {
      insights.push({
        type: "stock",
        title: "Alerte Stock",
        message: `${lowStock.length} produits sont en rupture ou stock faible. Commandez rapidement.`,
        status: "danger"
      });
    }
    const tvaCollectee = (factures || []).reduce((sum, f) => sum + Number(f.montant_tva || 0), 0);
    const tvaDeductible = (bonsCommande || []).reduce((sum, bc) => sum + Number(bc.montant_tva || 0), 0) + (depenses || []).reduce((sum, d) => sum + Number(d.montant_tva || 0), 0);
    const tvaAPayer = tvaCollectee - tvaDeductible;
    if (tvaAPayer > 2e4) {
      insights.push({
        type: "finance",
        title: "TVA \xC3\x89lev\xC3\xA9e",
        message: `TVA \xC3\xA0 payer estim\xC3\xA9e: ${tvaAPayer.toFixed(2)} MAD. Pr\xC3\xA9voyez la tr\xC3\xA9sorerie.`,
        status: "warning"
      });
    }
    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch smart insights" });
  }
});
router.get("/parametres", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (!authError && user) {
          userId = user.id;
        }
      } catch (e) {
        console.warn("Could not verify token:", e);
      }
    }
    if (!userId) {
      return res.json({
        nomSociete: "",
        adresse: "",
        ville: "",
        codePostale: "",
        telephone: "",
        email: "",
        ice: "",
        formeJuridique: "",
        logoUrl: "",
        couleurPrincipale: "#267E54",
        watermarkText: "ParaGestion"
      });
    }
    const { data: params, error } = await supabase.from("parametres").select("id,user_id,nom_societe,nom,adresse,ville,code_postale,telephone,email,site_web,ice,rc,if_number,tp_patente,cnss,capital_social,forme_juridique,logo_url,couleur_principale,banque,rib,swift,devise,conditions_paiement_defaut,pied_page_defaut,activer_droit_timbre,created_at,updated_at").eq("user_id", userId).single();
    if (!params || error?.code === "PGRST116" || error) {
      return res.json({
        nomSociete: "",
        adresse: "",
        ville: "",
        codePostale: "",
        telephone: "",
        email: "",
        ice: "",
        formeJuridique: "",
        logoUrl: "",
        couleurPrincipale: "#267E54",
        watermarkText: "ParaGestion"
      });
    }
    if (params && params.logo_url) {
      if (params.logo_url === "image.png" || !params.logo_url.startsWith("http")) {
        params.logo_url = "";
      }
    }
    const mapped = {
      id: params.id,
      userId: params.user_id,
      nomSociete: params.nom_societe || params.nom || "",
      adresse: params.adresse || "",
      ville: params.ville || "",
      codePostale: params.code_postale || params.codePostale || "",
      telephone: params.telephone || "",
      email: params.email || "",
      siteWeb: params.site_web || params.siteWeb || "",
      ice: params.ice || "",
      rc: params.rc || "",
      ifNumber: params.if_number || params.ifNumber || "",
      tpPatente: params.tp_patente || params.tpPatente || "",
      cnss: params.cnss || "",
      capitalSocial: params.capital_social || params.capitalSocial || "",
      formeJuridique: params.forme_juridique || params.formeJuridique || "",
      banque: params.banque || "",
      rib: params.rib || "",
      swift: params.swift || "",
      logoUrl: params.logo_url || "",
      couleurPrincipale: params.couleur_principale || "#267E54",
      conditionsPaiementDefaut: params.conditions_paiement_defaut || "",
      piedPageDefaut: params.pied_page_defaut || "",
      activerDroitTimbre: params.activer_droit_timbre !== void 0 ? params.activer_droit_timbre : true,
      watermarkText: params.watermark_text || "ParaGestion"
    };
    res.json(mapped);
  } catch (error) {
    console.error("Error fetching parametres:", error);
    res.json({
      nomSociete: "",
      adresse: "",
      ville: "",
      codePostale: "",
      telephone: "",
      email: "",
      ice: "",
      formeJuridique: "",
      logoUrl: "",
      couleurPrincipale: "#267E54",
      watermarkText: "ParaGestion"
    });
  }
});
router.put("/parametres", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (!authError && user) {
          userId = user.id;
        }
      } catch (e) {
        console.warn("Could not verify token:", e);
      }
    }
    if (!userId) {
      return res.status(401).json({ error: "Non autoris\xC3\xA9" });
    }
    const safeFields = {
      user_id: userId
    };
    if (req.body.nomSociete !== void 0) {
      safeFields.nom_societe = req.body.nomSociete;
      safeFields.nom = req.body.nomSociete;
    }
    if (req.body.adresse !== void 0) safeFields.adresse = req.body.adresse;
    if (req.body.ville !== void 0) safeFields.ville = req.body.ville;
    if (req.body.codePostal !== void 0) safeFields.code_postale = req.body.codePostal;
    if (req.body.codePostale !== void 0) safeFields.code_postale = req.body.codePostale;
    if (req.body.telephone !== void 0) safeFields.telephone = req.body.telephone;
    if (req.body.email !== void 0) safeFields.email = req.body.email;
    if (req.body.siteWeb !== void 0) safeFields.site_web = req.body.siteWeb;
    if (req.body.ice !== void 0) safeFields.ice = req.body.ice;
    if (req.body.rc !== void 0) safeFields.rc = req.body.rc;
    if (req.body.cnss !== void 0) safeFields.cnss = req.body.cnss;
    if (req.body.ifNumber !== void 0) safeFields.if_number = req.body.ifNumber;
    if (req.body.tpPatente !== void 0) safeFields.tp_patente = req.body.tpPatente;
    if (req.body.capitalSocial !== void 0) safeFields.capital_social = req.body.capitalSocial;
    if (req.body.formeJuridique !== void 0) safeFields.forme_juridique = req.body.formeJuridique;
    if (req.body.banque !== void 0) safeFields.banque = req.body.banque;
    if (req.body.rib !== void 0) safeFields.rib = req.body.rib;
    if (req.body.swift !== void 0) safeFields.swift = req.body.swift;
    if (req.body.logoUrl !== void 0) safeFields.logo_url = req.body.logoUrl;
    if (req.body.couleurPrincipale !== void 0) safeFields.couleur_principale = req.body.couleurPrincipale;
    if (req.body.activerDroitTimbre !== void 0) safeFields.activer_droit_timbre = req.body.activerDroitTimbre;
    if (req.body.watermarkText !== void 0) safeFields.watermark_text = req.body.watermarkText;
    let { data: existingRows } = await supabase.from("parametres").select("id").eq("user_id", userId).limit(1);
    let recordId = existingRows && existingRows.length > 0 ? existingRows[0].id : null;
    let result;
    if (recordId) {
      const { data: updated, error } = await supabase.from("parametres").update(safeFields).eq("id", recordId).select("id,user_id,nom_societe,nom,adresse,ville,code_postale,telephone,email,site_web,ice,rc,if_number,tp_patente,cnss,capital_social,forme_juridique,logo_url,couleur_principale,banque,rib,swift,devise,conditions_paiement_defaut,pied_page_defaut,activer_droit_timbre,created_at,updated_at").single();
      if (error) {
        console.error("Update error:", error);
        return res.status(500).json({ error: "Failed to update", details: error.message });
      }
      result = updated;
    } else {
      const { data: created, error } = await supabase.from("parametres").insert([safeFields]).select("id,user_id,nom_societe,nom,adresse,ville,code_postale,telephone,email,site_web,ice,rc,if_number,tp_patente,cnss,capital_social,forme_juridique,logo_url,couleur_principale,banque,rib,swift,devise,conditions_paiement_defaut,pied_page_defaut,activer_droit_timbre,created_at,updated_at").single();
      if (error) {
        console.error("Insert error:", error);
        return res.status(500).json({ error: "Failed to insert", details: error.message });
      }
      result = created;
    }
    const mapped = {
      id: result.id,
      nomSociete: result.nom_societe || result.nom || "",
      adresse: result.adresse || "",
      ville: result.ville || "",
      codePostale: result.code_postale || "",
      telephone: result.telephone || "",
      email: result.email || "",
      siteWeb: result.site_web || "",
      ice: result.ice || "",
      rc: result.rc || "",
      ifNumber: result.if_number || "",
      tpPatente: result.tp_patente || "",
      cnss: result.cnss || "",
      capitalSocial: result.capital_social || "",
      formeJuridique: result.forme_juridique || "",
      banque: result.banque || "",
      rib: result.rib || "",
      swift: result.swift || "",
      logoUrl: result.logo_url || "",
      couleurPrincipale: result.couleur_principale || "#267E54",
      conditionsPaiementDefaut: result.conditions_paiement_defaut || "",
      piedPageDefaut: result.pied_page_defaut || "",
      activerDroitTimbre: result.activer_droit_timbre !== void 0 ? result.activer_droit_timbre : true,
      watermarkText: result.watermark_text || "ParaGestion"
    };
    res.json(mapped);
  } catch (error) {
    console.error("Error updating parametres:", error);
    res.status(500).json({ error: "Failed to update parametres", details: error.message });
  }
});
router.get("/depenses", async (req, res) => {
  try {
    const { data: depenses, error } = await supabase.from("depenses").select("*, fournisseur:fournisseurs(*)").order("date_depense", { ascending: false });
    if (error) throw error;
    res.json(toCamel(depenses));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch depenses" });
  }
});
router.post("/depenses", async (req, res) => {
  try {
    const { count, error: countError } = await supabase.from("depenses").select("*", { count: "exact", head: true });
    if (countError) {
      console.warn("Error counting depenses:", countError.message);
    }
    const reference = `DEP/${(/* @__PURE__ */ new Date()).getFullYear()}/${String((count || 0) + 1).padStart(5, "0")}`;
    const data = {
      categorie: req.body.categorie,
      description: req.body.description || "",
      montant_ht: Number(req.body.montantHt) || 0,
      montant_ttc: Number(req.body.montantTtc) || 0
    };
    if (req.body.fournisseurId) data.fournisseur_id = req.body.fournisseurId;
    if (req.body.dateDepense) data.date_depense = req.body.dateDepense;
    if (req.body.montantTva !== void 0) data.montant_tva = Number(req.body.montantTva) || 0;
    if (req.body.modePaiement) data.mode_paiement = req.body.modePaiement;
    if (req.body.notes) data.notes = req.body.notes;
    try {
      const { error: refError } = await supabase.from("depenses").select("reference").limit(1);
      if (!refError) {
        data.reference = reference;
      }
    } catch {
    }
    const { data: depense, error: insertError } = await supabase.from("depenses").insert([data]).select("*, fournisseur:fournisseurs(*)").single();
    if (insertError) {
      console.error("Error creating depense:", insertError);
      return res.status(400).json({ error: "Failed to create depense", details: formatError(insertError) });
    }
    await logActivity("cr\xC3\xA9ation d\xC3\xA9pense", `D\xC3\xA9pense ${data.reference || ""} cr\xC3\xA9\xC3\xA9e`);
    res.status(201).json(toCamel(depense));
  } catch (error) {
    console.error("Unexpected error in POST /depenses:", error);
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
});
router.put("/depenses/:id", async (req, res) => {
  try {
    const depenseData = req.body;
    const id = req.params.id;
    const updateData = {};
    if (depenseData.fournisseurId !== void 0) updateData.fournisseur_id = depenseData.fournisseurId;
    if (depenseData.dateDepense !== void 0) updateData.date_depense = depenseData.dateDepense;
    if (depenseData.description !== void 0) updateData.description = depenseData.description;
    if (depenseData.categorie !== void 0) updateData.categorie = depenseData.categorie;
    if (depenseData.montantHt !== void 0) updateData.montant_ht = depenseData.montantHt;
    if (depenseData.montantTva !== void 0) updateData.montant_tva = depenseData.montantTva;
    if (depenseData.montantTtc !== void 0) updateData.montant_ttc = depenseData.montantTtc;
    if (depenseData.modePaiement !== void 0) updateData.mode_paiement = depenseData.modePaiement;
    if (depenseData.notes !== void 0) updateData.notes = depenseData.notes;
    const { error: updateError } = await supabase.from("depenses").update(updateData).eq("id", id);
    if (updateError) {
      console.error("Error updating depense:", updateError);
      return res.status(400).json({ error: "Failed to update depense", details: updateError.message });
    }
    const { data: updatedDepense, error: fetchError } = await supabase.from("depenses").select("*, fournisseur:fournisseurs(*)").eq("id", id).single();
    if (fetchError) {
      return res.status(200).json({ id });
    }
    res.json(toCamel(updatedDepense));
  } catch (error) {
    console.error("Unexpected error in PUT /depenses:", error);
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
});
router.delete("/depenses/:id", async (req, res) => {
  try {
    const { error } = await supabase.from("depenses").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete depense" });
  }
});
router.get("/mouvements-stock", async (req, res) => {
  try {
    const { data: mouvements, error } = await supabase.from("mouvements_stock").select("*, produit:produits(*)").order("date_mouvement", { ascending: false }).limit(100);
    if (error) throw error;
    res.json(toCamel(mouvements));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stock movements" });
  }
});
router.post("/mouvements-stock", async (req, res) => {
  try {
    const { produitId, type, quantite, notes, referenceDocument, impactStock } = req.body;
    let finalQty = parseFloat(quantite);
    if (isNaN(finalQty) || finalQty === 0) {
      return res.status(400).json({ error: "Quantit\xC3\xA9 invalide" });
    }
    if (type === "vente") {
      finalQty = -Math.abs(finalQty);
    } else if (type === "achat") {
      finalQty = Math.abs(finalQty);
    }
    if (impactStock && finalQty < 0) {
      const { data: p } = await supabase.from("produits").select("stock_actuel").eq("id", produitId).single();
      const currentStock = Number(p?.stock_actuel || 0);
      if (currentStock + finalQty < 0) {
        return res.status(400).json({ error: `Stock insuffisant. Stock actuel: ${currentStock}` });
      }
    }
    const mData = {
      produit_id: parseInt(produitId),
      type,
      quantite: finalQty,
      notes: impactStock ? notes : `(SANS IMPACT STOCK) ${notes || ""}`,
      reference_document: referenceDocument,
      date_mouvement: /* @__PURE__ */ new Date()
    };
    const { data: m, error: mError } = await supabase.from("mouvements_stock").insert([mData]).select("*, produit:produits(*)").single();
    if (mError) throw mError;
    if (impactStock) {
      await updateProductStock(produitId, finalQty);
    }
    res.status(201).json(toCamel(m));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to create stock movement" });
  }
});
router.get("/backup/data", async (req, res) => {
  try {
    const tables = [
      "produits",
      "clients",
      "fournisseurs",
      "factures",
      "facture_lignes",
      "bons_commande",
      "bon_commande_lignes",
      "bons_livraison",
      "bon_livraison_lignes",
      "depenses",
      "avoirs",
      "avoir_lignes",
      "ventes_passagers",
      "ventes_passagers_lignes",
      "mouvements_stock",
      "parametres"
    ];
    const backupData = {};
    for (const table of tables) {
      if (table === "factures" || table === "devis" || table === "avoirs") {
        const { data, error } = await supabase.from(table).select("*, client:clients(id, nom, nom_societe)");
        if (error) {
          console.log(`Error fetching ${table}:`, error);
          backupData[table] = [];
        } else {
          console.log(`${table} sample before processing:`, JSON.stringify(data?.[0])?.slice(0, 200));
          const processedData = (data || []).map((row) => {
            if (row.client) {
              row.client_id = row.client.id;
              row.client_nom = row.client.nom || row.client.nom_societe || "";
              delete row.client;
            }
            return row;
          });
          console.log(`${table} sample after processing:`, JSON.stringify(processedData[0])?.slice(0, 200));
          backupData[table] = processedData;
        }
      } else if (table === "bons_commande" || table === "bons_livraison" || table === "depenses") {
        const { data, error } = await supabase.from(table).select("*, fournisseur:fournisseurs(id, nom, nom_societe)");
        if (error) {
          console.log(`Error fetching ${table}:`, error);
          backupData[table] = [];
        } else {
          console.log(`${table} sample before processing:`, JSON.stringify(data?.[0])?.slice(0, 200));
          const processedData = (data || []).map((row) => {
            if (row.fournisseur) {
              row.fournisseur_id = row.fournisseur.id;
              row.fournisseur_nom = row.fournisseur.nom || row.fournisseur.nom_societe || "";
              delete row.fournisseur;
            }
            return row;
          });
          console.log(`${table} sample after processing:`, JSON.stringify(processedData[0])?.slice(0, 200));
          backupData[table] = processedData;
        }
      } else {
        const { data, error } = await supabase.from(table).select("*");
        backupData[table] = error ? [] : data || [];
      }
    }
    const ligneTableMapping = {
      "facture_lignes": "factures",
      "devis_lignes": "devis",
      "bon_commande_lignes": "bons_commande",
      "bon_livraison_lignes": "bons_livraison",
      "avoir_lignes": "avoirs",
      "ventes_passagers_lignes": "ventes_passagers"
    };
    for (const [ligneTable, parentTable] of Object.entries(ligneTableMapping)) {
      const parentSelect = parentTable === "factures" ? "id, numero" : "id, numero";
      const { data, error } = await supabase.from(ligneTable).select(`*, ${parentTable}(${parentSelect})`);
      if (!error && data) {
        const processedData = (data || []).map((row) => {
          const parentRef = row[parentTable];
          if (parentRef) {
            row[`${parentTable}_id`] = parentRef.id;
            row.facture_numero = parentRef.numero || "";
          }
          return row;
        });
        backupData[ligneTable] = processedData;
        console.log(`${ligneTable}: ${processedData.length} rows, sample parent_id:`, processedData[0]?.[`${parentTable}_id`]);
      }
    }
    console.log("Exporting data keys:", Object.keys(backupData));
    console.log("Factures first row keys:", Object.keys(backupData["factures"]?.[0] || {}));
    res.json(backupData);
  } catch (error) {
    console.error("Backup error:", error);
    res.status(500).json({ error: "Failed to fetch backup data" });
  }
});
var fieldMappings = {
  produits: {
    "R\xC3\xA9f\xC3\xA9rence": "reference",
    "D\xC3\xA9signation": "designation",
    "Code \xC3\xA0 barre": "codebarre",
    "Code barre": "codebarre",
    "Cat\xC3\xA9gorie": "categorie",
    "Prix achat": "prix_achat",
    "Prix vente": "prix_vente",
    "Quantit\xC3\xA9": "quantite",
    "Seuil alerte": "seuil_alerte",
    "TVA": "taux_tva",
    "Unit\xC3\xA9": "unite"
  },
  clients: {
    "Nom": "nom",
    "Email": "email",
    "T\xC3\xA9l\xC3\xA9phone": "telephone",
    "Adresse": "adresse",
    "Ville": "ville",
    "Code postal": "code_postal",
    "ICE": "ice"
  },
  fournisseurs: {
    "Nom": "nom",
    "Email": "email",
    "T\xC3\xA9l\xC3\xA9phone": "telephone",
    "Adresse": "adresse",
    "Ville": "ville",
    "Code postal": "code_postal",
    "ICE": "ice"
  },
  factures: {
    "Num\xC3\xA9ro": "numero",
    "Date": "date",
    "Client": "client_id",
    // Map to ID directly if Excel has ID
    "Montant HT": "montant_ht",
    "Montant TVA": "montant_tva",
    "Montant TTC": "montant_ttc",
    "Statut": "statut",
    "Reste \xC3\xA0 payer": "reste_a_payer",
    "\xC3\u2030ch\xC3\xA9ance": "echeance"
  },
  facture_lignes: {
    "Facture": "facture_id",
    "factures_id": "facture_id",
    "Num\xC3\xA9ro facture": "facture_numero",
    "Facture num\xC3\xA9ro": "facture_numero",
    "Produit": "produit_id",
    "produit_id": "produit_id",
    "D\xC3\xA9signation": "designation",
    "Quantit\xC3\xA9": "quantite",
    "Prix unitaire": "prix_unitaire",
    "Total HT": "total_ht",
    "TVA": "taux_tva",
    "Total TVA": "total_tva",
    "Total TTC": "total_ttc"
  },
  bons_commande: {
    "Num\xC3\xA9ro": "numero",
    "Date": "date",
    "Fournisseur": "fournisseur_id",
    // Map to ID directly if Excel has ID
    "Montant HT": "montant_ht",
    "Montant TVA": "montant_tva",
    "Montant TTC": "montant_ttc",
    "Statut": "statut"
  },
  bon_commande_lignes: {
    "Bon de commande": "bon_commande_id",
    "bons_commande_id": "bon_commande_id",
    "Produit": "produit_id",
    "produit_id": "produit_id",
    "D\xC3\xA9signation": "designation",
    "Quantit\xC3\xA9": "quantite",
    "Prix unitaire": "prix_unitaire",
    "Total HT": "total_ht",
    "TVA": "taux_tva",
    "Total TVA": "total_tva",
    "Total TTC": "total_ttc"
  },
  bons_livraison: {
    "Num\xC3\xA9ro": "numero",
    "Date": "date",
    "Fournisseur": "fournisseur_id",
    // Map to ID directly if Excel has ID
    "Bon de commande": "bon_commande_id",
    "Statut": "statut"
  },
  bon_livraison_lignes: {
    "Bon de livraison": "bon_livraison_id",
    "bons_livraison_id": "bon_livraison_id",
    "Produit": "produit_id",
    "produit_id": "produit_id",
    "D\xC3\xA9signation": "designation",
    "Quantit\xC3\xA9": "quantite"
  },
  devis: {
    "Num\xC3\xA9ro": "numero",
    "Date": "date",
    "Client": "client_id",
    // Map to ID directly if Excel has ID
    "Montant HT": "montant_ht",
    "Montant TVA": "montant_tva",
    "Montant TTC": "montant_ttc",
    "Statut": "statut",
    "Validit\xC3\xA9": "validite"
  },
  devis_lignes: {
    "Devis": "devis_id",
    "devis_id": "devis_id",
    "Produit": "produit_id",
    "produit_id": "produit_id",
    "D\xC3\xA9signation": "designation",
    "Quantit\xC3\xA9": "quantite",
    "Prix unitaire": "prix_unitaire",
    "Total HT": "total_ht",
    "TVA": "taux_tva",
    "Total TVA": "total_tva",
    "Total TTC": "total_ttc"
  },
  avoirs: {
    "Num\xC3\xA9ro": "numero",
    "Date": "date",
    "Facture": "facture_numero",
    "Montant HT": "montant_ht",
    "Montant TVA": "montant_tva",
    "Montant TTC": "montant_ttc",
    "Motif": "motif"
  },
  avoir_lignes: {
    "Avoir": "avoir_id",
    "avoirs_id": "avoir_id",
    "Produit": "produit_id",
    "produit_id": "produit_id",
    "D\xC3\xA9signation": "designation",
    "Quantit\xC3\xA9": "quantite",
    "Prix unitaire": "prix_unitaire",
    "Total HT": "total_ht",
    "TVA": "taux_tva",
    "Total TVA": "total_tva",
    "Total TTC": "total_ttc"
  },
  ventes_passagers: {
    "Date": "date",
    "Client": "client_nom",
    "Montant HT": "montant_ht",
    "Montant TVA": "montant_tva",
    "Montant TTC": "montant_ttc"
  },
  ventes_passagers_lignes: {
    "Vente": "vente_passager_id",
    "ventes_passagers_id": "vente_passager_id",
    "vente_passager_id": "vente_passager_id",
    "Produit": "produit_id",
    "produit_id": "produit_id",
    "D\xC3\xA9signation": "designation",
    "Quantit\xC3\xA9": "quantite",
    "Prix unitaire": "prix_unitaire",
    "Total HT": "total_ht",
    "TVA": "taux_tva",
    "Total TVA": "total_tva",
    "Total TTC": "total_ttc"
  },
  depenses: {
    "R\xC3\xA9f\xC3\xA9rence": "reference",
    "Date": "date_depense",
    "Cat\xC3\xA9gorie": "categorie",
    "Description": "description",
    "Montant HT": "montant_ht",
    "Montant TVA": "montant_tva",
    "Montant TTC": "montant_ttc",
    "Fournisseur": "fournisseur_id"
    // Map to ID directly if Excel has ID
  },
  parametres: {
    "Nom": "nom_societe",
    "Adresse": "adresse",
    "Ville": "ville",
    "Code postal": "code_postal",
    "T\xC3\xA9l\xC3\xA9phone": "telephone",
    "Email": "email",
    "Site web": "site_web",
    "ICE": "ice",
    "RC": "rc",
    "IF": "if_number",
    "TP": "tp_patente",
    "CNSS": "cnss",
    "Capital": "capital_social",
    "Forme juridique": "forme_juridique",
    "Banque": "banque",
    "RIB": "rib",
    "SWIFT": "swift",
    "Couleur": "couleur_principale"
  }
};
var tableNameMapping = {
  // French names
  "Ventes": "factures",
  "Factures": "factures",
  "Devis": "devis",
  "Avoirs": "avoirs",
  "Achats": "bons_commande",
  "Bons de commande": "bons_commande",
  "Bons de livraison": "bons_livraison",
  "D\xC3\xA9penses": "depenses",
  "Produits": "produits",
  "Clients": "clients",
  "Fournisseurs": "fournisseurs",
  "Param\xC3\xA8tres": "parametres",
  "Mouvements de stock": "mouvements_stock",
  // Line tables
  "facture_lignes": "facture_lignes",
  "facture_ligne": "facture_lignes",
  "devis_lignes": "devis_lignes",
  "devis_ligne": "devis_lignes",
  "bon_commande_lignes": "bon_commande_lignes",
  "bon_commande_ligne": "bon_commande_lignes",
  "bons_livraison": "bons_livraison",
  "bon_livraison": "bons_livraison",
  "bon_livraison_lignes": "bon_livraison_lignes",
  "avoir_lignes": "avoir_lignes",
  "avoir_ligne": "avoir_lignes",
  "ventes_passagers": "ventes_passagers",
  "ventes_passagers_lignes": "ventes_passagers_lignes",
  "mouvements_stock": "mouvements_stock",
  // Lowercase variants
  "factures": "factures",
  "devis": "devis",
  "avoirs": "avoirs",
  "bons_commande": "bons_commande",
  "depenses": "depenses",
  "produits": "produits",
  "clients": "clients",
  "fournisseurs": "fournisseurs",
  "parametres": "parametres"
};
function transformRow(table, row, _lookupCache) {
  const mapping = fieldMappings[table] || {};
  const transformed = {};
  const uniqueSuffix = Math.floor(1e3 + Math.random() * 9e3).toString();
  for (const excelKey of Object.keys(row)) {
    const dbKey = mapping[excelKey] || excelKey;
    let value = row[excelKey];
    if (dbKey === "id" || value === "" || value === null || value === void 0) continue;
    if (dbKey === "user_id") continue;
    if (table === "produits" && dbKey === "reference") {
      value = value + "-" + uniqueSuffix;
    }
    if (table === "bons_commande" && dbKey === "numero") {
      value = value + "-" + uniqueSuffix;
    }
    if (table === "bons_livraison" && dbKey === "numero") {
      value = value + "-" + uniqueSuffix;
    }
    if (table === "ventes_passagers" && dbKey === "numero") {
      value = value + "-" + uniqueSuffix;
    }
    transformed[dbKey] = value;
  }
  return transformed;
}
router.post("/backup/import", async (req, res) => {
  try {
    const userId = req.body.user_id;
    console.log("Importing for user:", userId);
    const { user_id, ...excelData } = req.body;
    const data = excelData;
    const results = {};
    const mappedData = {};
    for (const sheetName of Object.keys(data)) {
      let dbTable = tableNameMapping[sheetName];
      if (!dbTable) {
        const lowerName = sheetName.toLowerCase();
        if (lowerName.includes("ligne")) {
          const parentMatch = lowerName.match(/^(\w+)\s*lignes?/);
          if (parentMatch) {
            const parent = parentMatch[1];
            if (["facture", "devis", "bon_commande", "bon_livraison", "avoir", "vente"].includes(parent)) {
              dbTable = parent + "_lignes";
            }
          }
        }
        if (!dbTable) {
          const singularMap = {
            "facture": "factures",
            "devis": "devis",
            "avoir": "avoirs",
            "bon_commande": "bons_commande",
            "bon_livraison": "bons_livraison",
            "depense": "depenses",
            "produit": "produits",
            "client": "clients",
            "fournisseur": "fournisseurs",
            "vente_passager": "ventes_passagers"
          };
          const singular = lowerName.replace(/s$/, "");
          dbTable = singularMap[singular] || sheetName.toLowerCase().replace(/ /g, "_");
        }
      }
      if (dbTable) {
        mappedData[dbTable] = data[sheetName];
      }
    }
    console.log("Mapped table names:", Object.keys(mappedData));
    console.log("Mapped table names:", Object.keys(mappedData));
    console.log("Sample data:", mappedData.produits?.[0] || mappedData.Produits?.[0]);
    const dataToImport = mappedData;
    const parentTables = ["clients", "fournisseurs", "produits"];
    const childTables = ["factures", "devis", "bons_commande", "bons_livraison", "avoirs", "ventes_passagers", "depenses"];
    const ligneTables = ["facture_lignes", "devis_lignes", "bon_commande_lignes", "bon_livraison_lignes", "avoir_lignes", "ventes_passagers_lignes"];
    const tablesWithUserId = ["clients", "fournisseurs", "produits", "factures", "devis", "bons_commande", "bons_livraison", "avoirs", "ventes_passagers", "depenses"];
    const tablesWithoutUserId = ["facture_lignes", "devis_lignes", "bon_commande_lignes", "bon_livraison_lignes", "avoir_lignes", "ventes_passagers_lignes", "mouvements_stock"];
    const tablesToProcess = [...parentTables, ...childTables].filter((t) => dataToImport[t]?.length > 0);
    const clientIdMap = /* @__PURE__ */ new Map();
    const fournisseurIdMap = /* @__PURE__ */ new Map();
    const produitIdMap = /* @__PURE__ */ new Map();
    const produitDesignationMap = /* @__PURE__ */ new Map();
    const phase1Tables = ["clients", "fournisseurs", "produits"];
    for (const table of phase1Tables) {
      if (!dataToImport[table]?.length) continue;
      const rows = dataToImport[table].map((row, idx) => {
        const transformed = transformRow(table, row, {});
        const oldId = row["id"] || row["Num\xC3\xA9ro"] || row["R\xC3\xA9f\xC3\xA9rence"] || idx + 1;
        if (table === "clients") {
          clientIdMap.set(oldId, "PLACEHOLDER");
        } else if (table === "fournisseurs") {
          fournisseurIdMap.set(oldId, "PLACEHOLDER");
        } else if (table === "produits") {
          produitIdMap.set(oldId, "PLACEHOLDER");
          const designation = transformed.designation || row["D\xC3\xA9signation"] || "";
          if (designation) {
            produitDesignationMap.set(designation.toLowerCase().trim(), "PLACEHOLDER");
          }
        }
        return transformed;
      }).filter((r) => Object.keys(r).length > 0);
      if (userId) rows.forEach((row) => {
        row.user_id = userId;
      });
      console.log(`[PHASE 1] Importing ${table}: ${rows.length} rows`);
      if (!rows.length) continue;
      const { data: inserted, error } = await supabase.from(table).insert(rows).select();
      if (error) {
        console.error(`[ERROR] Failed to import ${table}:`, error);
        results[table] = { success: false, error: error.message };
      } else {
        results[table] = { success: true, count: rows.length };
        if (inserted) {
          inserted.forEach((newRow, idx) => {
            const oldId = dataToImport[table][idx]?.id || dataToImport[table][idx]?.["Num\xC3\xA9ro"] || dataToImport[table][idx]?.["R\xC3\xA9f\xC3\xA9rence"] || idx + 1;
            if (table === "clients") {
              clientIdMap.set(oldId, newRow.id);
              console.log(`[LINKING] Client OldID: ${oldId} -> New UUID: ${newRow.id}`);
            } else if (table === "fournisseurs") {
              fournisseurIdMap.set(oldId, newRow.id);
              console.log(`[LINKING] Fournisseur OldID: ${oldId} -> New UUID: ${newRow.id}`);
            } else if (table === "produits") {
              produitIdMap.set(oldId, newRow.id);
              const designation = newRow.designation || dataToImport[table][idx]?.["D\xC3\xA9signation"] || "";
              if (designation) {
                produitDesignationMap.set(designation.toLowerCase().trim(), newRow.id);
              }
              console.log(`[LINKING] Product OldID: ${oldId} -> New UUID: ${newRow.id}`);
            }
          });
        }
      }
    }
    const factureIdMap = /* @__PURE__ */ new Map();
    const devisIdMap = /* @__PURE__ */ new Map();
    const bcIdMap = /* @__PURE__ */ new Map();
    const blIdMap = /* @__PURE__ */ new Map();
    const avoirIdMap = /* @__PURE__ */ new Map();
    const vpIdMap = /* @__PURE__ */ new Map();
    const phase2Tables = [
      { table: "factures", fkField: "client_id", idMap: factureIdMap, clientField: "Client" },
      { table: "devis", fkField: "client_id", idMap: devisIdMap, clientField: "Client" },
      { table: "bons_commande", fkField: "fournisseur_id", idMap: bcIdMap, clientField: "Fournisseur" },
      { table: "bons_livraison", fkField: "fournisseur_id", idMap: blIdMap, clientField: "Fournisseur" },
      { table: "avoirs", fkField: "client_id", idMap: avoirIdMap, clientField: "Client" },
      { table: "ventes_passagers", fkField: "", idMap: vpIdMap, clientField: "" }
    ];
    for (const { table, fkField, idMap, clientField } of phase2Tables) {
      if (!dataToImport[table]?.length) continue;
      const rows = dataToImport[table].map((row, idx) => {
        const transformed = transformRow(table, row, {});
        const oldId = row["id"] || row["Num\xC3\xA9ro"] || idx + 1;
        if (fkField) {
          const oldFkId = row[clientField] || row[fkField] || row["id"];
          if (fkField === "client_id" && oldFkId) {
            const newId = clientIdMap.get(oldFkId);
            if (newId && newId !== "PLACEHOLDER") {
              transformed.client_id = newId;
            }
          } else if (fkField === "fournisseur_id" && oldFkId) {
            const newId = fournisseurIdMap.get(oldFkId);
            if (newId && newId !== "PLACEHOLDER") {
              transformed.fournisseur_id = newId;
            }
          }
        }
        if (transformed.devis_id) delete transformed.devis_id;
        if (transformed.bon_commande_id) delete transformed.bon_commande_id;
        if (transformed.facture_id) delete transformed.facture_id;
        return { oldId, row: transformed };
      }).filter((r) => Object.keys(r.row).length > 0);
      const insertRows = rows.map((r) => r.row);
      if (userId) insertRows.forEach((row) => {
        row.user_id = userId;
      });
      console.log(`[PHASE 2] Importing ${table}: ${insertRows.length} rows`);
      if (!insertRows.length) continue;
      const { data: inserted, error } = await supabase.from(table).insert(insertRows).select();
      if (error) {
        console.error(`[ERROR] Failed to import ${table}:`, error);
        results[table] = { success: false, error: error.message };
      } else {
        results[table] = { success: true, count: insertRows.length };
        if (inserted) {
          inserted.forEach((newRow, idx) => {
            const oldId = rows[idx]?.oldId || idx + 1;
            idMap.set(oldId, newRow.id);
            console.log(`[LINKING] ${table} OldID: ${oldId} -> New UUID: ${newRow.id}`);
          });
        }
      }
    }
    const ligneConfig = [
      { table: "facture_lignes", parentField: "facture_id", parentIdMap: factureIdMap, parentExcelField: "Facture" },
      { table: "devis_lignes", parentField: "devis_id", parentIdMap: devisIdMap, parentExcelField: "Devis" },
      { table: "bon_commande_lignes", parentField: "bon_commande_id", parentIdMap: bcIdMap, parentExcelField: "Bon de commande" },
      { table: "bon_livraison_lignes", parentField: "bon_livraison_id", parentIdMap: blIdMap, parentExcelField: "Bon de livraison" },
      { table: "avoir_lignes", parentField: "avoir_id", parentIdMap: avoirIdMap, parentExcelField: "Avoir" },
      { table: "ventes_passagers_lignes", parentField: "vente_passager_id", parentIdMap: vpIdMap, parentExcelField: "Vente passager" }
    ];
    let totalSkipped = 0;
    const factureNumeroToId = /* @__PURE__ */ new Map();
    (dataToImport["factures"] || []).forEach((f, idx) => {
      const oldId = f["id"] || f["Num\xC3\xA9ro"] || idx + 1;
      const newId = factureIdMap.get(oldId);
      const numero = f["Num\xC3\xA9ro"] || f["numero"] || "";
      if (numero && newId) {
        factureNumeroToId.set(numero, newId);
      }
    });
    const vpPositionToId = /* @__PURE__ */ new Map();
    (dataToImport["ventes_passagers"] || []).forEach((vp, idx) => {
      const newId = vpIdMap.get(idx + 1);
      if (newId) {
        vpPositionToId.set(idx + 1, newId);
      }
    });
    for (const { table, parentField, parentIdMap, parentExcelField } of ligneConfig) {
      if (!dataToImport[table]?.length) continue;
      const allSourceRows = dataToImport[table];
      console.log(`[PHASE 3] ${table}: Total rows found in CSV: ${allSourceRows.length}`);
      const validRows = [];
      const skippedRows = [];
      for (const row of allSourceRows) {
        const idx = validRows.length + skippedRows.length;
        const uuidColumnName = `${table.replace("_lignes", "s")}_id`;
        const uuidFromExcel = row[uuidColumnName] || row["facture_id"] || row["devis_id"] || row["bon_commande_id"] || row["bon_livraison_id"] || row["avoir_id"] || row["vente_passager_id"];
        const isUUID = uuidFromExcel && typeof uuidFromExcel === "string" && uuidFromExcel.includes("-") && uuidFromExcel.length > 30;
        let newParentId;
        if (isUUID) {
          newParentId = uuidFromExcel;
          console.log(`[DATA_CHECK] [UUID_DIRECT] ${parentField}: Using UUID from Excel: ${newParentId}`);
        } else {
          const parentOldId = row[parentExcelField] || row[`${parentField}`] || row["id"] || idx + 1;
          newParentId = parentIdMap.get(parentOldId);
          if (!newParentId || newParentId === "PLACEHOLDER") {
            const rowNumero = row["facture_numero"] || row["Facture num\xC3\xA9ro"] || row["Num\xC3\xA9ro facture"] || row[parentExcelField + " num\xC3\xA9ro"] || "";
            if (rowNumero && factureNumeroToId.has(rowNumero)) {
              newParentId = factureNumeroToId.get(rowNumero);
              console.log(`[DATA_CHECK] [NUMERO_FALLBACK] ${parentField}: ${rowNumero} -> ${newParentId}`);
            }
          }
          if ((!newParentId || newParentId === "PLACEHOLDER") && table === "ventes_passagers_lignes") {
            const rowIdx = idx + 1;
            if (vpPositionToId.has(rowIdx)) {
              newParentId = vpPositionToId.get(rowIdx);
              console.log(`[DATA_CHECK] [VP_POSITION_FALLBACK] ${parentField}: position ${rowIdx} -> ${newParentId}`);
            }
          }
          if (!newParentId || newParentId === "PLACEHOLDER") {
            const lastParentId = parentIdMap.values().next().value;
            if (lastParentId && lastParentId !== "PLACEHOLDER") {
              newParentId = lastParentId;
              console.log(`[DATA_CHECK] [LAST_PARENT_FALLBACK] ${parentField}: using last parent ${newParentId}`);
            } else {
              console.log(`[WARNING] No parent mapping for ${parentField}=${parentOldId}, using NULL`);
            }
          }
        }
        const transformed = {
          [parentField]: newParentId || null,
          designation: row["D\xC3\xA9signation"] || row["designation"] || "",
          reference: row["R\xC3\xA9f\xC3\xA9rence"] || row["reference"] || "",
          quantite: Number(row["Quantit\xC3\xA9"] || row["quantite"] || 1),
          prix_unitaire_ht: Number(row["Prix unitaire"] || row["prix_unitaire"] || row["prix_unitaire_ht"] || 0),
          tva: Number(row["TVA"] || row["tva"] || row["taux_tva"] || 20),
          montant_ht: Number(row["Montant HT"] || row["montant_ht"] || row["Total HT"] || row["total_ht"] || 0),
          montant_ttc: Number(row["Montant TTC"] || row["montant_ttc"] || row["Total TTC"] || row["total_ttc"] || 0)
        };
        const produitOldIdRaw = row["Produit"] || row["produit_id"] || row["id"] || null;
        const produitIsUUID = produitOldIdRaw && typeof produitOldIdRaw === "string" && produitOldIdRaw.includes("-") && produitOldIdRaw.length > 30;
        if (produitIsUUID) {
          transformed.produit_id = produitOldIdRaw;
          console.log(`[DATA_CHECK] ${parentField}: FK=${newParentId} | Product UUID: ${produitOldIdRaw} (used directly)`);
        } else {
          const produitOldId = produitOldIdRaw ? Number(produitOldIdRaw) : null;
          if (produitOldId) {
            const newProduitId = produitIdMap.get(produitOldId);
            if (newProduitId && newProduitId !== "PLACEHOLDER") {
              transformed.produit_id = newProduitId;
              console.log(`[DATA_CHECK] ${parentField}: FK=${newParentId} | Product OldID: ${produitOldId} | New_FK: ${newProduitId}`);
            } else {
              console.log(`[WARNING] Missing produit_id mapping for OLD ID: ${produitOldId}`);
            }
          }
        }
        validRows.push(transformed);
      }
      console.log(`[PHASE 3] Processing ${table}: ${validRows.length} valid, ${skippedRows.length} skipped`);
      if (skippedRows.length > 0) {
        console.log(`[WARNING] Skipped orphan rows in ${table}:`);
        skippedRows.slice(0, 5).forEach((s) => {
          console.log(`  - ${s.reason}`);
        });
        totalSkipped += skippedRows.length;
      }
      if (!validRows.length) continue;
      const { error } = await supabase.from(table).insert(validRows);
      if (error) {
        console.error(`[ERROR] Failed to import ${table}:`, error);
        results[table] = { success: false, error: error.message };
      } else {
        results[table] = { success: true, count: validRows.length };
        console.log(`[SUCCESS] Inserted ${validRows.length} lines into ${table}`);
        const { count } = await supabase.from(table).select("id", { count: "exact" });
        console.log(`[VERIFY] ${table} total rows in DB: ${count}`);
      }
    }
    console.log(`[SUMMARY] Import complete. Total skipped orphan rows: ${totalSkipped}`);
    console.log(`[SUMMARY] ID Maps created:`, {
      clients: clientIdMap.size,
      produits: produitIdMap.size,
      factures: factureIdMap.size,
      ligneRows: Object.keys(results).filter((k) => k.includes("lignes")).length
    });
    const { data: allFactures } = await supabase.from("factures").select("id, numero").eq("user_id", userId);
    if (allFactures) {
      for (const facture of allFactures) {
        const { count: ligneCount } = await supabase.from("facture_lignes").select("id", { count: "exact" }).eq("facture_id", facture.id);
        if (ligneCount && ligneCount > 0) {
          console.log(`[SUCCESS] Linked ${ligneCount} lines to Facture ${facture.numero}`);
        }
      }
    }
    if (userId) {
      console.log("Step 5: Fixing NULL FKs...");
      const { data: allClients } = await supabase.from("clients").select("id, nom, nom_societe").eq("user_id", userId);
      const { data: allFournisseurs } = await supabase.from("fournisseurs").select("id, nom, nom_societe").eq("user_id", userId);
      const clientNameToId = {};
      (allClients || []).forEach((c) => {
        if (c.nom) clientNameToId[c.nom.toLowerCase().trim()] = c.id;
        if (c.nom_societe) clientNameToId[c.nom_societe.toLowerCase().trim()] = c.id;
      });
      const fournisseurNameToId = {};
      (allFournisseurs || []).forEach((f) => {
        if (f.nom) fournisseurNameToId[f.nom.toLowerCase().trim()] = f.id;
        if (f.nom_societe) fournisseurNameToId[f.nom_societe.toLowerCase().trim()] = f.id;
      });
      console.log(`Found ${Object.keys(clientNameToId).length} clients, ${Object.keys(fournisseurNameToId).length} fournisseurs`);
      const { data: nullClientFactures } = await supabase.from("factures").select("id, numero").is("client_id", null).eq("user_id", userId);
      console.log(`Found ${nullClientFactures?.length || 0} factures with NULL client_id`);
      const { data: orderedClients } = await supabase.from("clients").select("id, nom").eq("user_id", userId).order("created_at");
      const { data: orderedFactures } = await supabase.from("factures").select("id").eq("user_id", userId).order("created_at");
      if (orderedClients && orderedFactures) {
        let updated = 0;
        for (let i = 0; i < Math.min(orderedFactures.length, orderedClients.length); i++) {
          await supabase.from("factures").update({ client_id: orderedClients[i].id }).eq("id", orderedFactures[i].id);
          updated++;
        }
        console.log(`Updated ${updated} factures with client_id by position matching`);
      }
      const { data: orderedFournisseurs } = await supabase.from("fournisseurs").select("id, nom").eq("user_id", userId).order("created_at");
      const { data: orderedBC } = await supabase.from("bons_commande").select("id").eq("user_id", userId).order("created_at");
      if (orderedFournisseurs && orderedBC) {
        let updated = 0;
        for (let i = 0; i < Math.min(orderedBC.length, orderedFournisseurs.length); i++) {
          await supabase.from("bons_commande").update({ fournisseur_id: orderedFournisseurs[i].id }).eq("id", orderedBC[i].id);
          updated++;
        }
        console.log(`Updated ${updated} bons_commande with fournisseur_id by position matching`);
      }
      const { data: orderedDevis } = await supabase.from("devis").select("id").eq("user_id", userId).order("created_at");
      if (orderedClients && orderedDevis) {
        let updated = 0;
        for (let i = 0; i < Math.min(orderedDevis.length, orderedClients.length); i++) {
          await supabase.from("devis").update({ client_id: orderedClients[i].id }).eq("id", orderedDevis[i].id);
          updated++;
        }
        console.log(`Updated ${updated} devis with client_id by position matching`);
      }
      const { data: orderedAvoirs } = await supabase.from("avoirs").select("id").eq("user_id", userId).order("created_at");
      if (orderedClients && orderedAvoirs) {
        let updated = 0;
        for (let i = 0; i < Math.min(orderedAvoirs.length, orderedClients.length); i++) {
          await supabase.from("avoirs").update({ client_id: orderedClients[i].id }).eq("id", orderedAvoirs[i].id);
          updated++;
        }
        console.log(`Updated ${updated} avoirs with client_id by position matching`);
      }
      if (orderedFactures && orderedAvoirs) {
        let updated = 0;
        for (let i = 0; i < Math.min(orderedAvoirs.length, orderedFactures.length); i++) {
          await supabase.from("avoirs").update({ facture_id: orderedFactures[i].id }).eq("id", orderedAvoirs[i].id);
          updated++;
        }
        console.log(`Updated ${updated} avoirs with facture_id by position matching`);
      }
      const { data: orderedBL } = await supabase.from("bons_livraison").select("id").eq("user_id", userId).order("created_at");
      if (orderedFournisseurs && orderedBL) {
        let updated = 0;
        for (let i = 0; i < Math.min(orderedBL.length, orderedFournisseurs.length); i++) {
          await supabase.from("bons_livraison").update({ fournisseur_id: orderedFournisseurs[i].id }).eq("id", orderedBL[i].id);
          updated++;
        }
        console.log(`Updated ${updated} bons_livraison with fournisseur_id by position matching`);
      }
      const { data: orderedDepenses } = await supabase.from("depenses").select("id").eq("user_id", userId).order("created_at");
      if (orderedFournisseurs && orderedDepenses) {
        let updated = 0;
        for (let i = 0; i < Math.min(orderedDepenses.length, orderedFournisseurs.length); i++) {
          await supabase.from("depenses").update({ fournisseur_id: orderedFournisseurs[i].id }).eq("id", orderedDepenses[i].id);
          updated++;
        }
        console.log(`Updated ${updated} depenses with fournisseur_id by position matching`);
      }
      const { data: orderedVP } = await supabase.from("ventes_passagers").select("id").eq("user_id", userId).order("created_at");
      if (orderedClients && orderedVP) {
        let updated = 0;
        for (let i = 0; i < Math.min(orderedVP.length, orderedClients.length); i++) {
          await supabase.from("ventes_passagers").update({ client_id: orderedClients[i].id }).eq("id", orderedVP[i].id);
          updated++;
        }
        console.log(`Updated ${updated} ventes_passagers with client_id by position matching`);
      }
      console.log("[STEP 5] Linking NULL produit_id in ligne tables...");
      let totalProductsRecovered = 0;
      const failedDesignations = [];
      const ligneTables2 = [
        "facture_lignes",
        "bon_commande_lignes",
        "bon_livraison_lignes",
        "avoir_lignes",
        "ventes_passagers_lignes"
      ];
      for (const ligneTable of ligneTables2) {
        try {
          const { data: lignes, error: lignesError } = await supabase.from(ligneTable).select("id, designation, reference").is("produit_id", null);
          if (lignesError) {
            console.log(`[STEP 5] Error fetching ${ligneTable}:`, lignesError.message);
            continue;
          }
          if (!lignes || lignes.length === 0) {
            console.log(`[STEP 5] No NULL produit_id in ${ligneTable}`);
            continue;
          }
          let linked = 0;
          for (const ligne of lignes) {
            const desig = (ligne.designation || "").trim();
            const ref = (ligne.reference || "").trim();
            let { data: products } = await supabase.from("produits").select("id").eq("user_id", userId).or(`designation.eq.${desig},nom.eq.${desig},reference.eq.${ref}`).limit(1);
            if (!products || products.length === 0) {
              ({ data: products } = await supabase.from("produits").select("id").eq("user_id", userId).or(`designation.ilike.%${desig}%,nom.ilike.%${desig}%`).limit(1));
            }
            if (products && products.length > 0) {
              await supabase.from(ligneTable).update({ produit_id: products[0].id }).eq("id", ligne.id);
              linked++;
            } else {
              if (desig) {
                failedDesignations.push(desig);
              }
            }
          }
          totalProductsRecovered += linked;
          console.log(`[STEP 5] Linked ${linked}/${lignes.length} NULL produit_id in ${ligneTable}`);
        } catch (e) {
          console.log(`[STEP 5] Exception processing ${ligneTable}:`, e);
        }
      }
      if (failedDesignations.length > 0) {
        console.log(`[STEP 5] Failed to match designations:`, [...new Set(failedDesignations)].slice(0, 10));
      }
      console.log(`[SUMMARY] Products recovered via text-matching (Step 5): ${totalProductsRecovered}`);
      console.log("FK fix complete!");
    }
    const linkingResults = {
      facturesLinked: 0,
      bonsCommandeLinked: 0,
      depensesLinked: 0,
      devisLinked: 0,
      avoirsLinked: 0,
      bonsLivraisonLinked: 0,
      ventesPassagersLinked: 0
    };
    if (userId) {
      const { count: linkedFactures } = await supabase.from("factures").select("id", { count: "exact" }).not("client_id", "is", null).eq("user_id", userId);
      const { count: linkedBC } = await supabase.from("bons_commande").select("id", { count: "exact" }).not("fournisseur_id", "is", null).eq("user_id", userId);
      const { count: linkedDepenses } = await supabase.from("depenses").select("id", { count: "exact" }).not("fournisseur_id", "is", null).eq("user_id", userId);
      const { count: linkedDevis } = await supabase.from("devis").select("id", { count: "exact" }).not("client_id", "is", null).eq("user_id", userId);
      const { count: linkedAvoirs } = await supabase.from("avoirs").select("id", { count: "exact" }).not("client_id", "is", null).eq("user_id", userId);
      const { count: linkedBL } = await supabase.from("bons_livraison").select("id", { count: "exact" }).not("fournisseur_id", "is", null).eq("user_id", userId);
      const { count: linkedVP } = await supabase.from("ventes_passagers").select("id", { count: "exact" }).not("client_id", "is", null).eq("user_id", userId);
      linkingResults.facturesLinked = linkedFactures || 0;
      linkingResults.bonsCommandeLinked = linkedBC || 0;
      linkingResults.depensesLinked = linkedDepenses || 0;
      linkingResults.devisLinked = linkedDevis || 0;
      linkingResults.avoirsLinked = linkedAvoirs || 0;
      linkingResults.bonsLivraisonLinked = linkedBL || 0;
      linkingResults.ventesPassagersLinked = linkedVP || 0;
    }
    res.json({ success: true, results, linkingResults });
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({ error: error.message || "Failed to import backup data" });
  }
});
router.post("/reset-database", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis" });
  }
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (authError || !authData.user) {
      console.error("Auth error during reset:", authError);
      return res.status(401).json({ error: "Identifiants invalides ou acc\xC3\xA8s refus\xC3\xA9" });
    }
    const userId = authData.user.id;
    console.log("Resetting data for user:", userId);
    await supabase.from("facture_lignes").delete().not("id", "is", null);
    await supabase.from("bon_commande_lignes").delete().not("id", "is", null);
    await supabase.from("bon_livraison_lignes").delete().not("id", "is", null);
    await supabase.from("avoir_lignes").delete().not("id", "is", null);
    await supabase.from("ventes_passagers_lignes").delete().not("id", "is", null);
    await supabase.from("devis_lignes").delete().not("id", "is", null);
    console.log("Cleared all ligne tables");
    const { data: avoirs } = await supabase.from("avoirs").select("id").eq("user_id", userId);
    if (avoirs?.length) {
      await supabase.from("avoirs").delete().eq("user_id", userId);
    }
    await supabase.from("ventes_passagers").delete().eq("user_id", userId);
    await supabase.from("factures").delete().eq("user_id", userId);
    await supabase.from("devis").delete().eq("user_id", userId);
    await supabase.from("bons_livraison").delete().eq("user_id", userId);
    await supabase.from("bons_commande").delete().eq("user_id", userId);
    await supabase.from("depenses").delete().eq("user_id", userId);
    await supabase.from("mouvements_stock").delete().eq("user_id", userId);
    await supabase.from("produits").delete().eq("user_id", userId);
    await supabase.from("clients").delete().eq("user_id", userId);
    await supabase.from("fournisseurs").delete().eq("user_id", userId);
    await supabase.from("logs_activites").delete().eq("user_id", userId);
    await supabase.from("tasks").delete().eq("user_id", userId);
    await logActivity("r\xC3\xA9initialisation base de donn\xC3\xA9es", `Base de donn\xC3\xA9es r\xC3\xA9initialis\xC3\xA9e par ${email}`);
    res.json({ success: true, message: "Base de donn\xC3\xA9es r\xC3\xA9initialis\xC3\xA9e avec succ\xC3\xA8s" });
  } catch (error) {
    console.error("Reset error:", error);
    res.status(500).json({ error: "Failed to reset database" });
  }
});
router.get("/tasks", async (req, res) => {
  try {
    const { data: tasks, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (error) {
      if (error.code === "42P01" || error.message?.includes('relation "tasks" does not exist')) {
        console.warn('Table "tasks" does not exist yet. Returning empty array.');
        return res.json([]);
      }
      console.error("Supabase error fetching tasks:", error);
      return res.status(500).json({
        error: "Failed to fetch tasks",
        details: error.message,
        code: error.code
      });
    }
    res.json(toCamel(tasks));
  } catch (error) {
    console.error("Server error fetching tasks:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message || String(error)
    });
  }
});
router.get("/logs-activites", async (req, res) => {
  try {
    const { data, error } = await supabase.from("logs_activites").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) {
      console.warn("Logs-activites table may not exist:", error.message);
      res.json([]);
      return;
    }
    res.json(data || []);
  } catch (error) {
    console.warn("Error fetching logs:", error);
    res.json([]);
  }
});
router.post("/tasks", async (req, res) => {
  try {
    const data = toSnake(req.body);
    const { data: task, error } = await supabase.from("tasks").insert([data]).select().single();
    if (error) {
      if (error.code === "42P01" || error.message?.includes('relation "tasks" does not exist')) {
        return res.status(400).json({ error: "La table des t\xC3\xA2ches n'est pas encore pr\xC3\xAAte. Veuillez ex\xC3\xA9cuter le script SQL dans Supabase." });
      }
      console.error("Supabase error creating task:", error);
      return res.status(500).json({
        error: "Failed to create task",
        details: error.message,
        code: error.code
      });
    }
    res.status(201).json(toCamel(task));
  } catch (error) {
    console.error("Server error creating task:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message || String(error)
    });
  }
});
router.post("/sql", async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) {
      return res.status(400).json({ error: "Requ\xC3\xAAte SQL manquante" });
    }
    const { data, error } = await supabase.rpc("execute_sql", { sql });
    if (error) {
      console.error("SQL Execution Error:", error);
      return res.status(400).json({
        error: "Erreur lors de l'ex\xC3\xA9cution du SQL",
        details: error.message,
        code: error.code
      });
    }
    res.json({ data });
  } catch (error) {
    console.error("Server error executing SQL:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message || String(error)
    });
  }
});
router.put("/tasks/:id", async (req, res) => {
  try {
    const data = toSnake(req.body);
    if (data.id) delete data.id;
    const { data: task, error } = await supabase.from("tasks").update(data).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json(toCamel(task));
  } catch (error) {
    res.status(500).json({ error: "Failed to update task" });
  }
});
router.delete("/tasks/:id", async (req, res) => {
  try {
    const { error } = await supabase.from("tasks").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete task" });
  }
});
router.post("/check-stock-alerts", async (req, res) => {
  try {
    const userId = req.body.user_id;
    if (!userId) return res.status(400).json({ error: "user_id required" });
    const { data: produits } = await supabase.from("produits").select("*");
    const lowStockItems = (produits || []).filter(
      (p) => Number(p.stock_actuel) <= Number(p.stock_min) && Number(p.stock_min) > 0
    );
    for (const p of lowStockItems) {
      const designation = p.designation || p.nom || "Produit";
      const { data: recentNotifs } = await supabase.from("notifications").select("id").eq("user_id", userId).eq("title", "Stock Faible").ilike("message", `${designation} - %`).gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString()).limit(1);
      if (!recentNotifs || recentNotifs.length === 0) {
        await createNotification(
          userId,
          "Stock Faible",
          `${designation} - ${p.stock_actuel} unit\xC3\xA9s restantes`,
          "warning",
          "/produits"
        );
      }
    }
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const { data: factures } = await supabase.from("factures").select("*, client:clients(id, nom)").eq("statut", "reste_a_payer").lt("date_echeance", today);
    for (const f of factures || []) {
      const clientName = f.client?.nom || "Client";
      await createNotification(
        userId,
        "Paiement en Retard",
        `${clientName} - Facture ${f.numero} \xC3\xA9chue depuis le ${f.date_echeance}`,
        "error",
        `/factures?id=${f.id}`
      );
    }
    const weekFromNow = /* @__PURE__ */ new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const weekFromNowStr = weekFromNow.toISOString().split("T")[0];
    const { data: upcoming } = await supabase.from("factures").select("*, client:clients(id, nom)").eq("statut", "reste_a_payer").gte("date_echeance", today).lte("date_echeance", weekFromNowStr);
    for (const f of upcoming || []) {
      const clientName = f.client?.nom || "Client";
      await createNotification(
        userId,
        "\xC3\u2030ch\xC3\xA9ance Proche",
        `${clientName} - Facture ${f.numero} \xC3\xA0 payer avant le ${f.date_echeance}`,
        "info",
        `/factures?id=${f.id}`
      );
    }
    res.json({ checked: true, lowStock: lowStockItems.length, overdue: (factures || []).length, upcoming: (upcoming || []).length });
  } catch (error) {
    console.error("Error checking stock alerts:", error);
    res.status(500).json({ error: "Failed to check alerts" });
  }
});
var scheduleStockChecks = async () => {
  const checkAndNotify = async () => {
    try {
      const { data: users } = await supabase.from("produits").select("user_id");
      const userIds = [...new Set((users || []).map((u) => u.user_id).filter(Boolean))];
      for (const userId of userIds) {
        const { data: produits } = await supabase.from("produits").select("*").eq("user_id", userId);
        const lowStockItems = (produits || []).filter(
          (p) => Number(p.stock_actuel) <= Number(p.stock_min) && Number(p.stock_min) > 0
        );
        for (const p of lowStockItems) {
          const designation = p.designation || p.nom || "Produit";
          const { data: recentNotifs } = await supabase.from("notifications").select("id").eq("user_id", userId).eq("title", "Stock Faible").ilike("message", `${designation} - %`).gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString()).limit(1);
          if (!recentNotifs || recentNotifs.length === 0) {
            await createNotification(
              userId,
              "Stock Faible",
              `${designation} - ${p.stock_actuel} unit\xC3\xA9s restantes`,
              "warning",
              "/produits"
            );
          }
        }
      }
    } catch (err) {
      console.error("Scheduled stock check error:", err);
    }
  };
  await checkAndNotify();
  setInterval(checkAndNotify, 30 * 60 * 1e3);
};
scheduleStockChecks().catch((err) => console.error("Failed to start stock checks:", err));
var api_default = router;

// scripts/api-entry.ts
var app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/api", api_default);
app.get("/api/_health", (_req, res) => {
  res.json({ ok: true, ts: (/* @__PURE__ */ new Date()).toISOString() });
});
function handler(req, res) {
  return app(req, res);
}
export {
  handler as default
};
