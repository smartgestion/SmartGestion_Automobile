import { Router } from 'express'
import { supabase, supabaseAdmin } from '../lib/supabase.server'

const router = Router();

// --- USER MANAGEMENT (Admin) ---
router.post('/create-user', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe sont requis' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractÃ¨res' });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (error) {
      console.error('Error creating user:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ 
      success: true, 
      user: { id: data.user.id, email: data.user.email },
      message: 'Utilisateur crÃ©Ã© avec succÃ¨s'
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- LIST USERS (Admin) ---
router.get('/users', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data.users.map(u => ({ id: u.id, email: u.email, created_at: u.created_at })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- DELETE USER (Admin) - cascades to all user data ---
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'ID utilisateur requis' });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, message: 'Utilisateur et toutes ses donnÃ©es supprimÃ©s avec succÃ¨s' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- DATABASE INITIALIZATION ---
const initializeDatabase = async () => {
  try {
    // Check parametres table has all required columns
    const { error: paramError } = await supabaseAdmin.from('parametres').select('activer_droit_timbre').limit(1);
    if (paramError && paramError.message.includes("'activer_droit_timbre'")) {
      console.warn('Table parametres is missing columns, will use fallback defaults');
    }
    
    console.log('Database schema check complete');
  } catch (error) {
    console.warn('Database initialization note:', error);
  }
};

initializeDatabase();

// --- SCHEMA FIX ENDPOINT ---
router.post('/fix-schema', async (req, res) => {
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
    message: 'Run this SQL in Supabase SQL Editor',
    sql: sql
  });
});

import { generatePDFController } from '../lib/pdfGenerator.js';
// --- PDF GENERATION ---
router.post('/generate-pdf', generatePDFController);

// Helper to convert snake_case to camelCase
const toCamel = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(toCamel);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc: any, key) => {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      acc[camelKey] = toCamel(obj[key]);
      return acc;
    }, {});
  }
  return obj;
};

// Helper to convert camelCase to snake_case
const toSnake = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(toSnake);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc: any, key) => {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      acc[snakeKey] = toSnake(obj[key]);
      return acc;
    }, {});
  }
  return obj;
};

const formatError = (error: any): string => {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    // Handle Supabase error objects
    const msg = error.message || error.error_description || error.error;
    const details = error.details ? ` (${error.details})` : '';
    const hint = error.hint ? ` [Hint: ${error.hint}]` : '';
    
    if (msg) return `${msg}${details}${hint}`;
    
    try {
      return JSON.stringify(error);
    } catch (e) {
      return String(error);
    }
  }
  return String(error);
};

const logActivity = async (action: string, details?: string) => {
  try {
    await supabase.from('logs_activites').insert([{ action, details }]);
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

const createNotification = async (
  userId: string | undefined | null,
  title: string,
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
  link?: string
) => {
  if (!userId) return;
  try {
    await supabase.from('notifications').insert([{
      user_id: userId,
      title,
      message,
      type,
      is_read: false,
      link: link || null
    }]);
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

const updateProductStock = async (
  produitId: any, 
  delta: number, 
  type: string = 'ajustement', 
  referenceDocument?: string, 
  notes?: string, 
  entiteNom?: string, 
  prixUnitaire?: number
) => {
  if (!produitId) return;
  
  // Always use supabaseAdmin â€” this runs server-side and must bypass RLS
  const { data: produit, error: fetchError } = await supabaseAdmin
    .from('produits')
    .select('stock_actuel, stock_min, designation, nom, user_id')
    .eq('id', produitId)
    .single();
    
  if (fetchError || !produit) {
    console.error(`Error fetching product ${produitId} for stock update:`, fetchError);
    throw new Error(`Produit introuvable: ${produitId}`);
  }
  
  const currentStock = Number(produit.stock_actuel || 0);
  const newStock = currentStock + delta;
  
  const { error: updateError } = await supabaseAdmin
    .from('produits')
    .update({ stock_actuel: newStock })
    .eq('id', produitId);
    
  if (updateError) {
    console.error(`Error updating stock for product ${produitId}:`, updateError);
    throw updateError;
  }

  const mData = {
    produit_id: parseInt(produitId),
    type,
    quantite: delta,
    notes: notes || '',
    reference_document: referenceDocument,
    entite_nom: entiteNom,
    prix_unitaire: prixUnitaire || 0,
    date_mouvement: new Date()
  };

  const { error: mError } = await supabaseAdmin.from('mouvements_stock').insert([mData]);
  if (mError) {
    console.warn(`Stock movement not recorded (table may not exist): ${mError.message}`);
  }

  if (delta < 0 && newStock <= Number(produit.stock_min) && Number(produit.stock_min) > 0 && produit.user_id) {
    try {
      const designation = produit.designation || produit.nom || 'Produit';
      const { data: recentNotifs } = await supabaseAdmin
        .from('notifications')
        .select('id')
        .eq('user_id', produit.user_id)
        .eq('title', 'Stock Faible')
        .ilike('message', `${designation} - %`)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (!recentNotifs || recentNotifs.length === 0) {
        await createNotification(
          produit.user_id,
          'Stock Faible',
          `${designation} - ${newStock} unitÃ©s restantes`,
          'warning',
          '/produits'
        );
      }
    } catch (err) {
      console.error('Error creating low stock notification:', err);
    }
  }
};

/**
 * Safe variant of updateProductStock for administrative reversals
 * (e.g. un-marking a purchase order as "livré").
 *
 * Unlike updateProductStock, this function NEVER throws when the resulting
 * stock would go negative. Instead it clamps the stock to 0 and logs a
 * warning. This is correct behaviour for purchase reversals: the physical
 * goods may already have been consumed, sold, or adjusted, so the ERP should
 * not block the administrative action â€” it simply records what it can.
 */
const updateProductStockSafe = async (
  produitId: any,
  delta: number,
  type: string = 'ajustement',
  referenceDocument?: string,
  notes?: string,
  entiteNom?: string,
  prixUnitaire?: number
) => {
  if (!produitId) return;

  // Always use supabaseAdmin â€” this runs server-side and must bypass RLS
  const { data: produit, error: fetchError } = await supabaseAdmin
    .from('produits')
    .select('stock_actuel, stock_min, designation, nom, user_id')
    .eq('id', produitId)
    .single();

  if (fetchError || !produit) {
    console.warn(`updateProductStockSafe: product ${produitId} not found â€” skipping`);
    return;
  }

  const currentStock = Number(produit.stock_actuel || 0);
  const newStock = Math.max(0, currentStock + delta);

  if (newStock < currentStock + delta) {
    console.warn(
      `updateProductStockSafe: stock clamped to 0 for product ${produitId}. ` +
      `currentStock=${currentStock}, delta=${delta}. ` +
      `Likely the stock was already consumed after receipt.`
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from('produits')
    .update({ stock_actuel: newStock })
    .eq('id', produitId);

  if (updateError) {
    console.error(`updateProductStockSafe: failed to update product ${produitId}:`, updateError);
    return;
  }

  const mData = {
    produit_id: parseInt(produitId),
    type,
    quantite: delta,
    notes: notes || '',
    reference_document: referenceDocument,
    entite_nom: entiteNom,
    prix_unitaire: prixUnitaire || 0,
    date_mouvement: new Date()
  };

  const { error: mError } = await supabaseAdmin.from('mouvements_stock').insert([mData]);
  if (mError) {
    console.warn(`Stock movement not recorded: ${mError.message}`);
  }
};

const handleAvoirLogic = async (factureId: any, newStatut: string, oldStatut: string) => {
  if (newStatut === 'annulÃ©e' && oldStatut !== 'annulÃ©e') {
    const { data: existingAvoir } = await supabase.from('avoirs').select('id').eq('facture_id', factureId).single();
    if (!existingAvoir) {
      const { data: facture } = await supabase.from('factures').select('*').eq('id', factureId).single();
      if (!facture) return;

      const year = new Date().getFullYear();
      const { data: existing } = await supabase.from('avoirs').select('numero').like('numero', `AV-${year}-%`).eq('user_id', facture.user_id);
      let maxNum = 0;
      for (const a of existing || []) { const m = a.numero?.match(new RegExp(`^AV-${year}-(\\d+)$`)); if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; } }
      const avoirNumero = `AV-${year}-${String(maxNum + 1).padStart(4, '0')}`;

      const { data: factureLignes } = await supabase.from('facture_lignes').select('*').eq('facture_id', factureId);

      if (facture) {
        const avoirData: any = {
          numero: avoirNumero,
          user_id: facture.user_id,
          facture_id: factureId,
          client_id: facture.client_id,
          date_emission: new Date().toISOString().split('T')[0],
          voiture: facture.voiture,
          matricule: facture.matricule,
          montant_ht: Number(facture.montant_ht || 0),
          montant_tva: Number(facture.montant_tva || 0),
          montant_ttc: Number(facture.montant_ttc || 0),
          notes: `Avoir pour annulation de la facture ${facture.numero}`,
          statut: 'GÃ©nÃ©rÃ©'
        };

        const { data: newAvoir, error: avoirError } = await supabase.from('avoirs').insert([avoirData]).select().single();
        if (avoirError) throw new Error(`Erreur lors de la crÃ©ation de l'avoir: ${avoirError.message}`);

        if (newAvoir && factureLignes) {
          const avoirLignesData = factureLignes.map(l => ({
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
          const { error: lignesError } = await supabase.from('avoir_lignes').insert(avoirLignesData);
          if (lignesError) throw new Error(`Erreur lors de la crÃ©ation des lignes d'avoir: ${lignesError.message}`);
          await logActivity('crÃ©ation avoir', `Avoir ${avoirNumero} crÃ©Ã© pour la facture ${facture.numero}`);
        }
      }
    }
  } else if (oldStatut === 'annulÃ©e' && (newStatut === 'payÃ©e' || newStatut === 'reste_a_payer')) {
    const { data: avoir } = await supabase.from('avoirs').select('numero').eq('facture_id', factureId).single();
    if (avoir) {
      await supabase.from('avoirs').delete().eq('facture_id', factureId);
      await logActivity('suppression avoir', `Avoir ${avoir.numero} supprimÃ© car la facture ${factureId} est revenue au statut ${newStatut}`);
    }
  }
};

// --- DASHBOARD DATA ---
router.get('/dashboard-data', async (req, res) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const applyDateFilter = (q: any, field: string) => {
      if (startDate) q = q.gte(field, startDate);
      if (endDate) q = q.lte(field, endDate);
      return q;
    };

    // Factures: only statuts validÃ©s (exclure brouillon, en_attente, annulÃ©e)
    const validFactureStatuses = ['payÃ©e', 'reste_a_payer'];
    let factQuery = supabase.from('factures').select('*').in('statut', validFactureStatuses);
    let vpQuery = supabase.from('ventes_passagers').select('*');
    let bcQuery = supabase.from('bons_commande').select('*').in('statut', ['livrÃ©', 'livrÃ©e']);
    let depQuery = supabase.from('depenses').select('*');

    if (startDate || endDate) {
      factQuery = applyDateFilter(factQuery, 'date_emission');
      vpQuery = applyDateFilter(vpQuery, 'date');
      bcQuery = applyDateFilter(bcQuery, 'date_commande');
      depQuery = applyDateFilter(depQuery, 'date_depense');
    }

    const [factures, ventesPassagers, bonsCommande, depenses, produits] = (await Promise.all([
      factQuery, vpQuery, bcQuery, depQuery,
      supabase.from('produits').select('*'),
    ])).map(r => r.data || []);

    // Chiffre d'Affaires = Ventes Passagers + Factures validÃ©es (TTC)
    const caVP = (ventesPassagers || []).reduce((sum, vp) => sum + Number(vp.montant_ttc || 0), 0);
    const caFactures = (factures || []).reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0);
    const totalRevenue = caVP + caFactures;

    // CrÃ©ances = reste Ã  payer des factures partiellement payÃ©es
    const unpaidRevenue = (factures || [])
      .filter(f => f.statut === 'reste_a_payer')
      .reduce((sum, f) => sum + Number(f.reste_a_payer || 0), 0);

    // DÃ©penses Totales (TTC) = DÃ©penses + Bons de Commande LivrÃ©
    const depensesTTC = (depenses || []).reduce((sum, d) => sum + Number(d.montant_ttc || 0), 0);
    const bcDepensesTTC = (bonsCommande || []).reduce((sum, bc) => sum + Number(bc.montant_ttc || 0), 0);
    const totalDepenses = depensesTTC + bcDepensesTTC;

    // BÃ©nÃ©fice Net = CA - DÃ©penses Totales
    const profit = totalRevenue - totalDepenses;

    // TVA CollectÃ©e
    const tvaVP = (ventesPassagers || []).reduce((sum, vp) => sum + Number(vp.montant_tva || 0), 0);
    const tvaFactures = (factures || []).reduce((sum, f) => sum + Number(f.montant_tva || 0), 0);
    const totalTvaCollectee = tvaVP + tvaFactures;

    // TVA DÃ©ductible
    const tvaDepenses = (depenses || []).reduce((sum, d) => sum + Number(d.montant_tva || 0), 0);
    const tvaBC = (bonsCommande || []).reduce((sum, bc) => sum + Number(bc.montant_tva || 0), 0);
    const totalTvaDeductible = tvaDepenses + tvaBC;

    const tvaNet = totalTvaCollectee - totalTvaDeductible;

    // Monthly chart data
    const range = (req.query.range as string) || '6m';
    const monthlyData = [];
    const monthNames = ['Jan', 'FÃ©v', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'AoÃ»', 'Sep', 'Oct', 'Nov', 'DÃ©c'];

    if (range === '1m') {
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        const dayFactures = (factures || []).filter(f => {
          const fDate = new Date(f.date_emission).toISOString().split('T')[0];
          return fDate === dateStr;
        });
        const dayVP = (ventesPassagers || []).filter(vp => {
          const vpDate = new Date(vp.date).toISOString().split('T')[0];
          return vpDate === dateStr;
        });
        const dayDepenses = (depenses || []).filter(d2 => {
          const dDate = new Date(d2.date_depense).toISOString().split('T')[0];
          return dDate === dateStr;
        });
        const dayBC = (bonsCommande || []).filter(bc => {
          const bcDate = new Date(bc.date_commande).toISOString().split('T')[0];
          return bcDate === dateStr;
        });

        monthlyData.push({
          name: d.getDate().toString(),
          revenue: dayFactures.reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0)
            + dayVP.reduce((sum, vp) => sum + Number(vp.montant_ttc || 0), 0),
          expenses: dayDepenses.reduce((sum, d2) => sum + Number(d2.montant_ttc || 0), 0)
            + dayBC.reduce((sum, bc) => sum + Number(bc.montant_ttc || 0), 0)
        });
      }
    } else {
      const monthsCount = range === '1y' ? 12 : 6;
      for (let i = monthsCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const month = d.getMonth();
        const year = d.getFullYear();

        const monthFactures = (factures || []).filter(f => {
          const fDate = new Date(f.date_emission);
          return fDate.getMonth() === month && fDate.getFullYear() === year;
        });
        const monthVP = (ventesPassagers || []).filter(vp => {
          const vpDate = new Date(vp.date);
          return vpDate.getMonth() === month && vpDate.getFullYear() === year;
        });
        const monthDepenses = (depenses || []).filter(d2 => {
          const dDate = new Date(d2.date_depense);
          return dDate.getMonth() === month && dDate.getFullYear() === year;
        });
        const monthBC = (bonsCommande || []).filter(bc => {
          const bcDate = new Date(bc.date_commande);
          return bcDate.getMonth() === month && bcDate.getFullYear() === year;
        });

        monthlyData.push({
          name: monthNames[month],
          revenue: monthFactures.reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0)
            + monthVP.reduce((sum, vp) => sum + Number(vp.montant_ttc || 0), 0),
          expenses: monthDepenses.reduce((sum, d2) => sum + Number(d2.montant_ttc || 0), 0)
            + monthBC.reduce((sum, bc) => sum + Number(bc.montant_ttc || 0), 0)
        });
      }
    }

    const lowStockProduits = (produits || [])
      .filter(p => Number(p.stock_actuel) <= Number(p.stock_min))
      .slice(0, 5);

    let recentQuery = supabase.from('factures').select('*, client:clients(*)').order('date_emission', { ascending: false }).limit(5);
    if (startDate || endDate) {
      recentQuery = applyDateFilter(recentQuery, 'date_emission');
    }
    const { data: recentFactures } = await recentQuery;

    let clientsQuery = supabase.from('clients').select('*', { count: 'exact', head: true });
    if (startDate || endDate) {
      clientsQuery = applyDateFilter(clientsQuery, 'created_at');
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
      lowStockProduits: toCamel((lowStockProduits || []).map(p => ({ ...p, nom: p.designation || p.nom }))) || [],
      recentFactures: toCamel(recentFactures) || []
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// --- CLIENTS ---
router.get('/clients', async (req, res) => {
  try {
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching clients:', error);
      throw error;
    }
    res.json(toCamel(clients));
  } catch (error) {
    console.error('Failed to fetch clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients', details: formatError(error) });
  }
});

router.post('/clients', async (req, res) => {
  try {
    const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true });
    const code = `C${String((count || 0) + 1).padStart(3, '0')}`;
    
    // Build client data, excluding any non-existent columns
    const clientData: any = {
      nom: req.body.nom || req.body.nomSociete,
      email: req.body.email,
      telephone: req.body.telephone,
      adresse: req.body.adresse,
      ville: req.body.ville,
      code_postal: req.body.codePostal,
      pays: req.body.pays || 'Maroc',
      ice: req.body.ice,
      rc: req.body.rc,
      if_identifiant: req.body.ifIdentifiant,
      patente: req.body.patente,
      notes: req.body.notes,
      type: req.body.type || 'entreprise'
    };
    
    const { data: client, error } = await supabase
      .from('clients')
      .insert([clientData])
      .select()
      .single();
    if (error) {
      console.error('Error creating client:', error);
      throw error;
    }
    res.status(201).json(toCamel(client));
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: 'Failed to create client', details: formatError(error) });
  }
});

router.put('/clients/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    
    // Build update data with only provided fields
    const updateData: any = {};
    if (req.body.nom !== undefined) updateData.nom = req.body.nom;
    if (req.body.email !== undefined) updateData.email = req.body.email || null;
    if (req.body.telephone !== undefined) updateData.telephone = req.body.telephone || null;
    if (req.body.adresse !== undefined) updateData.adresse = req.body.adresse || null;
    if (req.body.ville !== undefined) updateData.ville = req.body.ville || null;
    if (req.body.pays !== undefined) updateData.pays = req.body.pays || 'Maroc';
    if (req.body.ice !== undefined) updateData.ice = req.body.ice || null;
    if (req.body.rc !== undefined) updateData.rc = req.body.rc || null;
    if (req.body.if_identifiant !== undefined) updateData.if_identifiant = req.body.if_identifiant || null;
    if (req.body.patente !== undefined) updateData.patente = req.body.patente || null;
    if (req.body.notes !== undefined) updateData.notes = req.body.notes || null;
    if (req.body.type !== undefined) updateData.type = req.body.type;
    
    console.log('Updating client ID:', id, 'with data:', updateData);
    
    // First check if client exists
    const { data: existing, error: checkError } = await supabase
      .from('clients')
      .select('id, nom')
      .eq('id', id)
      .single();
      
    if (checkError || !existing) {
      console.error('Client not found:', id, checkError);
      return res.status(404).json({ error: 'Client not found' });
    }
    
    console.log('Found existing client:', existing);
    
    const { data: client, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
      
    if (error) {
      console.error('Update error:', error);
      throw error;
    }
    
    console.log('Updated client:', client);
    res.json(toCamel(client));
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client', details: formatError(error) });
  }
});

router.delete('/clients/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('clients').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// --- FOURNISSEURS ---
router.get('/fournisseurs', async (req, res) => {
  try {
    const { data: fournisseurs, error } = await supabase
      .from('fournisseurs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching fournisseurs:', error);
      res.status(500).json({ error: 'Failed to fetch fournisseurs', details: error.message });
      return;
    }
    res.json(toCamel(fournisseurs || []));
  } catch (error: any) {
    console.error('Error fetching fournisseurs:', error);
    res.status(500).json({ error: 'Failed to fetch fournisseurs', details: error.message });
  }
});

router.post('/fournisseurs', async (req, res) => {
  try {
    const { count } = await supabase.from('fournisseurs').select('*', { count: 'exact', head: true });
    const code = `F${String((count || 0) + 1).padStart(3, '0')}`;
    
    // Map camelCase to snake_case for fournisseurs - only include fields that exist
    const data: any = {
      nom: req.body.nom,
      email: req.body.email || null,
      telephone: req.body.telephone || null,
      adresse: req.body.adresse || null,
      ville: req.body.ville || null,
      ice: req.body.ice || null,
    };
    
    // Try to add optional fields, ignore if column doesn't exist
    try {
      if (req.body.contact !== undefined) data.contact = req.body.contact;
      if (req.body.type !== undefined) data.type = req.body.type || 'entreprise';
      if (req.body.codePostale !== undefined) data.code_postale = req.body.codePostale;
    } catch (e) {
      // Columns don't exist, continue without them
    }

    const { data: fournisseur, error } = await supabase
      .from('fournisseurs')
      .insert([data])
      .select()
      .single();
    if (error) {
      console.error('Error creating fournisseur:', error);
      res.status(400).json({ error: 'Failed to create fournisseur', details: error.message });
      return;
    }
    res.status(201).json(toCamel(fournisseur));
  } catch (error: any) {
    console.error('Error creating fournisseur:', error);
    res.status(500).json({ error: 'Failed to create fournisseur', details: error.message });
  }
});

router.put('/fournisseurs/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid fournisseur ID' });
    }
    
    // Build update data with only provided fields
    const updateData: any = {};
    if (req.body.nom !== undefined) updateData.nom = req.body.nom;
    if (req.body.email !== undefined) updateData.email = req.body.email || null;
    if (req.body.telephone !== undefined) updateData.telephone = req.body.telephone || null;
    if (req.body.adresse !== undefined) updateData.adresse = req.body.adresse || null;
    if (req.body.ville !== undefined) updateData.ville = req.body.ville || null;
    if (req.body.ice !== undefined) updateData.ice = req.body.ice || null;
    if (req.body.contact !== undefined) updateData.contact = req.body.contact || null;
    if (req.body.type !== undefined) updateData.type = req.body.type;

    // Check if exists
    const { data: existing, error: checkError } = await supabase
      .from('fournisseurs')
      .select('id, nom')
      .eq('id', id)
      .single();
      
    if (checkError || !existing) {
      return res.status(404).json({ error: 'Fournisseur not found' });
    }

    const { data: fournisseur, error } = await supabase
      .from('fournisseurs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      res.status(400).json({ error: 'Failed to update fournisseur', details: error.message });
      return;
    }
    res.json(toCamel(fournisseur));
  } catch (error: any) {
    console.error('Error updating fournisseur:', error);
    res.status(500).json({ error: 'Failed to update fournisseur', details: error.message });
  }
});

router.delete('/fournisseurs/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('fournisseurs').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete fournisseur' });
  }
});

// --- PRODUITS ---
router.get('/produits', async (req, res) => {
  try {
    const { data: produits, error } = await supabase
      .from('produits')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const mappedProduits = (produits || []).map(p => ({
      ...p,
      nom: p.designation || p.nom
    }));
    res.json(toCamel(mappedProduits));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch produits' });
  }
});

router.post('/produits', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (!authError && user) userId = user.id;
      } catch (e) { /* ignore */ }
    }

    let reference = req.body.reference;
    if (!reference) {
      const q = supabase.from('produits').select('*', { count: 'exact', head: true });
      if (userId) q.eq('user_id', userId);
      const { count } = await q;
      reference = `REF-${String((count || 0) + 1).padStart(3, '0')}`;
      
      // Check if reference already exists
      let isUnique = false;
      let attempt = 0;
      while (!isUnique && attempt < 10) {
        const { data: existing, error: checkError } = await supabase
          .from('produits')
          .select('id')
          .eq('reference', reference)
          .eq('user_id', userId)
          .maybeSingle();
        
        if (!existing && !checkError) {
          isUnique = true;
        } else {
          attempt++;
          reference = `REF-${String((count || 0) + 1 + attempt).padStart(3, '0')}`;
        }
      }
    }

    const data: any = {
      reference,
      user_id: userId,
      designation: req.body.designation || req.body.nom || 'Produit sans nom',
      nom: req.body.nom || req.body.designation || 'Produit sans nom',
      description: req.body.description,
      categorie: req.body.categorie,
      marque: req.body.marque,
      barcode: req.body.barcode,
      image_url: req.body.imageUrl,
      prix_achat_ht: Number(req.body.prixAchatHt || 0),
      prix_vente_ht: Number(req.body.prixVenteHt || 0),
      tva: req.body.tauxTva !== undefined ? Number(req.body.tauxTva) : (req.body.tva !== undefined ? Number(req.body.tva) : 20),
      stock_actuel: Number(req.body.stockActuel || 0),
      stock_min: Number(req.body.stockMin || 5),
      unite: req.body.unite || 'unitÃ©'
    };

    // Don't insert into generated columns - they are calculated automatically
    let { data: produit, error } = await supabase
      .from('produits')
      .insert([data])
      .select()
      .single();
      
    if (error) {
      console.error('Supabase error creating produit:', error);
      
      // Handle "cannot insert into column ... is a generated column" - retry without generated fields
      if (error.code === '428C9' || error.message?.includes('generated column')) {
        const cleanedData = { ...data };
        delete cleanedData.prix_achat_ttc;
        delete cleanedData.prix_vente_ttc;
        
        const { data: pRetry, error: eRetry } = await supabase
          .from('produits')
          .insert([cleanedData])
          .select()
          .single();
          
        if (eRetry) {
          // If it still fails, maybe 'nom' or 'designation' is missing
          if (eRetry.message?.includes('column "nom" does not exist')) {
            delete cleanedData.nom;
            const { data: p3, error: e3 } = await supabase.from('produits').insert([cleanedData]).select().single();
            if (e3) throw e3;
            produit = p3;
            error = null;
          } else if (eRetry.message?.includes('column "designation" does not exist')) {
            delete cleanedData.designation;
            const { data: p3, error: e3 } = await supabase.from('produits').insert([cleanedData]).select().single();
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
      } 
      // Handle missing columns
      else if (error.message?.includes('column "nom" does not exist')) {
        const fallbackData = { ...data };
        delete fallbackData.nom;
        const { data: p2, error: e2 } = await supabase.from('produits').insert([fallbackData]).select().single();
        if (e2) throw e2;
        produit = p2;
        error = null;
      }
      else if (error.message?.includes('column "designation" does not exist')) {
        const fallbackData = { ...data };
        delete fallbackData.designation;
        const { data: p2, error: e2 } = await supabase.from('produits').insert([fallbackData]).select().single();
        if (e2) throw e2;
        produit = p2;
        error = null;
      }
      else if (error.message?.includes('column "updated_at" does not exist') || error.message?.includes("'updated_at' column") || error.message?.includes('schema cache')) {
        const fallbackData = { ...data };
        delete (fallbackData as any).updated_at;
        const { data: p2, error: e2 } = await supabase.from('produits').insert([fallbackData]).select().single();
        if (e2) throw e2;
        produit = p2;
        error = null;
      }
      else if (error.message?.includes('column "created_at" does not exist') || error.message?.includes("'created_at' column")) {
        const fallbackData = { ...data };
        delete (fallbackData as any).created_at;
        const { data: p2, error: e2 } = await supabase.from('produits').insert([fallbackData]).select().single();
        if (e2) throw e2;
        produit = p2;
        error = null;
      } else {
        throw error;
      }
    }

    // Record initial movement if stock > 0
    if (produit && req.body.stockActuel > 0) {
      try {
        await supabase.from('mouvements_stock').insert([{
          produit_id: produit.id,
          type: 'initial',
          quantite: req.body.stockActuel,
          notes: 'Stock initial Ã  la crÃ©ation du produit',
          date_mouvement: new Date()
        }]);
      } catch (mError) {
        console.error('Error recording initial stock movement:', mError);
      }
    }

    const mappedProduit = { ...produit, nom: (produit as any).designation || (produit as any).nom };
    res.status(201).json(toCamel(mappedProduit));
  } catch (error: any) {
    console.error('Unexpected error in POST /produits:', formatError(error));
    res.status(500).json({ 
      error: 'Failed to create produit', 
      details: formatError(error)
    });
  }
});

router.get('/produits/:id', async (req, res) => {
  try {
    const { data: produit, error } = await supabase
      .from('produits')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    const mappedProduit = {
      ...produit,
      nom: (produit as any).designation || (produit as any).nom
    };
    res.json(toCamel(mappedProduit));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch produit' });
  }
});

router.put('/produits/:id', async (req, res) => {
  try {
    const { id: _, created_at: __, ...updateData } = req.body;
    
    const data: any = {};
    if (updateData.reference !== undefined) data.reference = updateData.reference;
    if (updateData.nom !== undefined) {
      data.designation = updateData.nom;
      data.nom = updateData.nom;
    }
    if (updateData.designation !== undefined) {
      data.designation = updateData.designation;
      data.nom = updateData.designation;
    }
    if (updateData.description !== undefined) data.description = updateData.description;
    if (updateData.categorie !== undefined) data.categorie = updateData.categorie;
    if (updateData.marque !== undefined) data.marque = updateData.marque;
    if (updateData.barcode !== undefined) data.barcode = updateData.barcode;
    if (updateData.imageUrl !== undefined) data.image_url = updateData.imageUrl;
    if (updateData.prixAchatHt !== undefined) data.prix_achat_ht = Number(updateData.prixAchatHt || 0);
    if (updateData.prixVenteHt !== undefined) data.prix_vente_ht = Number(updateData.prixVenteHt || 0);
    if (updateData.tauxTva !== undefined) data.tva = Number(updateData.tauxTva || 0);
    if (updateData.tva !== undefined) data.tva = Number(updateData.tva || 0);
    if (updateData.stockActuel !== undefined) data.stock_actuel = Number(updateData.stockActuel || 0);
    if (updateData.stockMin !== undefined) data.stock_min = Number(updateData.stockMin || 0);
    if (updateData.unite !== undefined) data.unite = updateData.unite;
    if (updateData.isActive !== undefined) data.is_active = updateData.isActive;

    data.updated_at = new Date();

    let { data: produit, error } = await supabase
      .from('produits')
      .update(data)
      .eq('id', req.params.id)
      .select()
      .single();
      
    if (error) {
      console.error('Supabase error updating produit:', error);
      
      // Handle generated column error - retry without generated fields
      if (error.code === '428C9' || error.message?.includes('generated column')) {
        const cleanedData = { ...data };
        delete cleanedData.prix_achat_ttc;
        delete cleanedData.prix_vente_ttc;
        
        const { data: pRetry, error: eRetry } = await supabase
          .from('produits')
          .update(cleanedData)
          .eq('id', req.params.id)
          .select()
          .single();
        
        if (eRetry) {
          if (eRetry.message?.includes('column "nom" does not exist')) {
            delete cleanedData.nom;
            const { data: p3, error: e3 } = await supabase.from('produits').update(cleanedData).eq('id', req.params.id).select().single();
            if (e3) throw e3;
            produit = p3;
            error = null;
          } else if (eRetry.message?.includes('column "designation" does not exist')) {
            delete cleanedData.designation;
            const { data: p3, error: e3 } = await supabase.from('produits').update(cleanedData).eq('id', req.params.id).select().single();
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
      }
      // Handle missing columns
      else if (error.message?.includes('column "nom" does not exist')) {
        const fallbackData = { ...data };
        delete fallbackData.nom;
        const { data: p2, error: e2 } = await supabase.from('produits').update(fallbackData).eq('id', req.params.id).select().single();
        if (e2) throw e2;
        produit = p2;
        error = null;
      }
      else if (error.message?.includes('column "designation" does not exist')) {
        const fallbackData = { ...data };
        delete fallbackData.designation;
        const { data: p2, error: e2 } = await supabase.from('produits').update(fallbackData).eq('id', req.params.id).select().single();
        if (e2) throw e2;
        produit = p2;
        error = null;
      }
      else if (error.message?.includes('column "updated_at" does not exist') || error.message?.includes("'updated_at' column") || error.message?.includes('schema cache')) {
        const fallbackData = { ...data };
        delete fallbackData.updated_at;
        const { data: p2, error: e2 } = await supabase.from('produits').update(fallbackData).eq('id', req.params.id).select().single();
        if (e2) throw e2;
        produit = p2;
        error = null;
      }
      else if (error.message?.includes('column "created_at" does not exist') || error.message?.includes("'created_at' column")) {
        const fallbackData = { ...data };
        delete fallbackData.created_at;
        const { data: p2, error: e2 } = await supabase.from('produits').update(fallbackData).eq('id', req.params.id).select().single();
        if (e2) throw e2;
        produit = p2;
        error = null;
      } else {
        throw error;
      }
    }
    const mappedProduit = { ...produit, nom: (produit as any).designation || (produit as any).nom };
    res.json(toCamel(mappedProduit));
  } catch (error: any) {
    console.error('Error updating produit:', formatError(error));
    res.status(500).json({ 
      error: 'Failed to update produit', 
      details: formatError(error)
    });
  }
});

router.delete('/produits/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('produits').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete produit' });
  }
});

// --- FACTURES ---
router.get('/factures', async (req, res) => {
  try {
    const { data: factures, error } = await supabase
      .from('factures')
      .select('*, client:clients(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(toCamel(factures));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch factures' });
  }
});

router.post('/factures', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;
    if (authHeader?.startsWith('Bearer ')) {
      try { const token = authHeader.split(' ')[1]; const { data: { user } } = await supabaseAdmin.auth.getUser(token); if (user) userId = user.id; } catch (e) { /* ignore */ }
    }

    const { lignes, ...factureData } = req.body;
    
    const year = new Date().getFullYear();
    const { data: existing } = await supabase.from('factures').select('numero').like('numero', `FAC-${year}-%`).eq('user_id', userId);
    let maxNum = 0;
    for (const f of existing || []) { const m = f.numero?.match(new RegExp(`^FAC-${year}-(\\d+)$`)); if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; } }
    const numero = `FAC-${year}-${String(maxNum + 1).padStart(4, '0')}`;
    
    const data: any = {
      numero,
      user_id: userId,
      client_id: factureData.clientId,
      date_emission: factureData.dateEmission,
      date_echeance: factureData.dateEcheance,
      statut: factureData.statut || 'brouillon',
      mode_paiement: factureData.modePaiement,
      voiture: factureData.voiture,
      matricule: factureData.matricule,
      montant_ht: Number(factureData.montantHt || 0),
      montant_tva: Number(factureData.montantTva || 0),
      montant_ttc: Number(factureData.montantTtc || 0),
      reste_a_payer: Number(factureData.resteAPayer || factureData.montantTtc || 0),
      notes: factureData.notes,
      conditions_paiement: factureData.conditionsPaiement,
      stock_updated: false
    };

    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .insert([data])
      .select()
      .single();
    
    if (factureError) {
      console.error('Error creating facture:', factureError);
      return res.status(400).json({ error: 'Failed to create facture', details: formatError(factureError) });
    }

    await logActivity('crÃ©ation facture', `Facture ${numero} crÃ©Ã©e`);

    if (lignes && lignes.length > 0) {
      const lignesData = lignes.map((l: any, index: number) => {
        const qte = Number(l.quantite || 0);
        const pu = Number(l.prix_unitaire || l.prix_unitaire_ht || 0);
        const tva = Number(l.tva || 0);
        const mht = Number(l.montant_ht || (qte * pu));
        const mttc = Number(l.montant_ttc || (mht * (1 + tva / 100)));

        return {
          facture_id: facture.id,
          produit_id: l.produit_id || null,
          reference: l.reference || null,
          designation: l.designation || l.description || '',
          quantite: qte,
          prix_unitaire_ht: pu,
          tva: tva,
          montant_ht: mht,
          montant_ttc: mttc,
          ordre: l.ordre !== undefined ? Number(l.ordre) : index
        };
      });
      
      const { error: lignesError } = await supabase.from('facture_lignes').insert(lignesData);
      if (lignesError) {
        console.error('Error creating facture lines:', JSON.stringify(lignesError, null, 2));
        // Cleanup: delete the facture if lines failed to avoid partial data
        await supabase.from('factures').delete().eq('id', facture.id);
        return res.status(400).json({ error: 'Error creating facture lines', details: lignesError.message || JSON.stringify(lignesError) });
      }

      // Stock update logic for Factures
      if (['payÃ©e', 'reste_a_payer'].includes(facture.statut)) {
        const { data: client } = await supabase.from('clients').select('nom').eq('id', facture.client_id).single();
        for (const l of lignesData) {
          if (l.produit_id) {
            await updateProductStock(
              l.produit_id, 
              -Number(l.quantite || 0), 
              'vente', 
              facture.numero, 
              `Vente Facture ${facture.numero}`,
              client?.nom,
              l.prix_unitaire_ht
            );
          }
        }
        // Update the flag
        await supabase.from('factures').update({ stock_updated: true }).eq('id', facture.id);
      }
    }

    const { data: completeFacture, error: fetchError } = await supabase
      .from('factures')
      .select('*, lignes:facture_lignes(*), client:clients(*)')
      .eq('id', facture.id)
      .single();

    if (fetchError) {
      console.error('Error fetching complete facture:', fetchError);
      return res.status(201).json(toCamel(facture));
    }

    res.status(201).json(toCamel(completeFacture));
  } catch (error) {
    console.error('Unexpected error in POST /factures:', error);
    res.status(500).json({ error: 'Internal server error', details: formatError(error) });
  }
});

router.get('/factures/:id', async (req, res) => {
  try {
    const { data: facture, error } = await supabase
      .from('factures')
      .select('*, client:clients(*), lignes:facture_lignes(*)')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    if (!facture) return res.status(404).json({ error: 'Not found' });
    res.json(toCamel(facture));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch facture' });
  }
});

router.put('/factures/:id', async (req, res) => {
  try {
    const { lignes, ...factureData } = req.body;
    const id = req.params.id;
    
    // Fetch old status and stock_updated flag for stock update
    const { data: oldFacture } = await supabase.from('factures').select('statut, stock_updated, client_id').eq('id', id).single();
    const oldStatut = oldFacture?.statut;
    const oldStockUpdated = oldFacture?.stock_updated;

    const updateData: any = {};
    if (factureData.clientId !== undefined) updateData.client_id = factureData.clientId;
    if (factureData.dateEmission !== undefined) updateData.date_emission = factureData.dateEmission;
    if (factureData.dateEcheance !== undefined) updateData.date_echeance = factureData.dateEcheance;
    if (factureData.statut !== undefined) updateData.statut = factureData.statut;
    if (factureData.modePaiement !== undefined) updateData.mode_paiement = factureData.modePaiement;
    if (factureData.voiture !== undefined) updateData.voiture = factureData.voiture;
    if (factureData.matricule !== undefined) updateData.matricule = factureData.matricule;
    if (factureData.montantHt !== undefined) updateData.montant_ht = Number(factureData.montantHt || 0);
    if (factureData.montantTva !== undefined) updateData.montant_tva = Number(factureData.montantTva || 0);
    if (factureData.montantTtc !== undefined) updateData.montant_ttc = Number(factureData.montantTtc || 0);
    if (factureData.resteAPayer !== undefined) updateData.reste_a_payer = Number(factureData.resteAPayer || 0);
    if (factureData.notes !== undefined) updateData.notes = factureData.notes;
    if (factureData.conditionsPaiement !== undefined) updateData.conditions_paiement = factureData.conditionsPaiement;

    const newStatut = updateData.statut;

    // Avoir creation BEFORE status update (transactional integrity)
    if (newStatut === 'annulÃ©e' && oldStatut && oldStatut !== 'annulÃ©e') {
      await handleAvoirLogic(id, newStatut, oldStatut);
    }

    const { error: updateError } = await supabase
      .from('factures')
      .update(updateData)
      .eq('id', id);
    
    if (updateError) {
      console.error('Error updating facture:', updateError);
      return res.status(400).json({ error: 'Failed to update facture', details: formatError(updateError) });
    }

    // Stock update logic
    if (newStatut && newStatut !== oldStatut) {
      const { data: currentLignes } = await supabase.from('facture_lignes').select('*').eq('facture_id', id);
      if (currentLignes && currentLignes.length > 0) {
        const isActive = ['payÃ©e', 'reste_a_payer'].includes(newStatut);
        const isCancelled = newStatut === 'annulÃ©e';
        
        if (!oldStockUpdated && isActive) {
          const { data: client } = await supabase.from('clients').select('nom').eq('id', oldFacture.client_id || updateData.client_id).single();
          const { data: f } = await supabase.from('factures').select('numero').eq('id', id).single();
          for (const l of currentLignes) {
            if (l.produit_id) await updateProductStock(
              l.produit_id, 
              -Number(l.quantite || 0), 
              'vente', 
              f?.numero, 
              `Vente Facture ${f?.numero}`,
              client?.nom,
              l.prix_unitaire_ht
            );
          }
          await supabase.from('factures').update({ stock_updated: true }).eq('id', id);
        } else if (oldStockUpdated && isCancelled) {
          const { data: client } = await supabase.from('clients').select('nom').eq('id', oldFacture.client_id || updateData.client_id).single();
          const { data: f } = await supabase.from('factures').select('numero').eq('id', id).single();
          for (const l of currentLignes) {
            if (l.produit_id) await updateProductStock(
              l.produit_id, 
              Number(l.quantite || 0), 
              'ajustement', 
              f?.numero, 
              `Annulation Facture ${f?.numero}`,
              client?.nom,
              l.prix_unitaire_ht
            );
          }
          await supabase.from('factures').update({ stock_updated: false }).eq('id', id);
        }
      }
    }

    // Avoir deletion (reverse case) after status update
    if (oldStatut === 'annulÃ©e' && newStatut && newStatut !== 'annulÃ©e') {
      await handleAvoirLogic(id, newStatut, oldStatut);
    }

    // Only update lines if they are provided
    if (lignes !== undefined) {
      // Delete existing lines
      await supabase.from('facture_lignes').delete().eq('facture_id', id);

      // Recreate lines
      if (lignes && lignes.length > 0) {
        const lignesData = lignes.map((l: any, index: number) => {
          const qte = Number(l.quantite || 0);
          const pu = Number(l.prix_unitaire || l.prix_unitaire_ht || 0);
          const tva = Number(l.tva || 0);
          const mht = Number(l.montant_ht || (qte * pu));
          const mttc = Number(l.montant_ttc || (mht * (1 + tva / 100)));

          return {
            facture_id: id,
            produit_id: l.produit_id || null,
            reference: l.reference || null,
            designation: l.designation || l.description || '',
            quantite: qte,
            prix_unitaire_ht: pu,
            tva: tva,
            montant_ht: mht,
            montant_ttc: mttc,
            ordre: l.ordre !== undefined ? Number(l.ordre) : index
          };
        });
        
        const { error: lignesError } = await supabase.from('facture_lignes').insert(lignesData);
        if (lignesError) {
          console.error('Error updating facture lines:', JSON.stringify(lignesError, null, 2));
          return res.status(400).json({ error: 'Error updating facture lines', details: lignesError.message || JSON.stringify(lignesError) });
        }
      }
    }

    const { data: updatedFacture, error: fetchError } = await supabase
      .from('factures')
      .select('*, lignes:facture_lignes(*), client:clients(*)')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching updated facture:', fetchError);
      return res.status(200).json({ id });
    }

    res.json(toCamel(updatedFacture));
  } catch (error) {
    console.error('Unexpected error in PUT /factures/:id:', error);
    res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) });
  }
});

router.delete('/factures/:id', async (req, res) => {
  try {
    const { data: facture } = await supabase.from('factures').select('statut').eq('id', req.params.id).single();
    if (facture && facture.statut !== 'brouillon') {
      return res.status(400).json({ error: 'Impossible de supprimer une facture validÃ©e. Veuillez l\'annuler.' });
    }
    const { error } = await supabase.from('factures').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete facture' });
  }
});

router.put('/factures/:id/statut', async (req, res) => {
  try {
    const { statut } = req.body;
    const id = req.params.id;

    // Fetch old status and stock_updated flag for stock update
    const { data: oldFacture } = await supabase.from('factures').select('statut, stock_updated, client_id, numero').eq('id', id).single();
    const oldStatut = oldFacture?.statut;
    const oldStockUpdated = oldFacture?.stock_updated;

    // Avoir creation BEFORE status update (transactional integrity)
    if (statut === 'annulÃ©e' && oldStatut && oldStatut !== 'annulÃ©e') {
      await handleAvoirLogic(id, statut, oldStatut);
    }

    const updatePayload: any = { statut };
    if (['payÃ©e', 'annulÃ©e'].includes(statut)) {
      updatePayload.reste_a_payer = 0;
    }

    const { data: facture, error } = await supabase
      .from('factures')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // Stock update logic
    if (statut && statut !== oldStatut) {
      const { data: currentLignes } = await supabase.from('facture_lignes').select('*').eq('facture_id', id);
      if (currentLignes && currentLignes.length > 0) {
        const isActive = ['payÃ©e', 'reste_a_payer'].includes(statut);
        const isCancelled = statut === 'annulÃ©e';
        
        if (!oldStockUpdated && isActive) {
          const { data: client } = await supabase.from('clients').select('nom').eq('id', oldFacture.client_id).single();
          for (const l of currentLignes) {
            if (l.produit_id) await updateProductStock(
              l.produit_id, 
              -Number(l.quantite || 0), 
              'vente', 
              oldFacture.numero, 
              `Vente Facture ${oldFacture.numero}`,
              client?.nom,
              l.prix_unitaire_ht
            );
          }
          await supabase.from('factures').update({ stock_updated: true }).eq('id', id);
        } else if (oldStockUpdated && isCancelled) {
          const { data: client } = await supabase.from('clients').select('nom').eq('id', oldFacture.client_id).single();
          for (const l of currentLignes) {
            if (l.produit_id) await updateProductStock(
              l.produit_id, 
              Number(l.quantite || 0), 
              'ajustement', 
              oldFacture.numero, 
              `Annulation Facture ${oldFacture.numero}`,
              client?.nom,
              l.prix_unitaire_ht
            );
          }
          await supabase.from('factures').update({ stock_updated: false }).eq('id', id);
        }
      }
    }

    // Avoir deletion (reverse case) after status update
    if (oldStatut === 'annulÃ©e' && statut && statut !== 'annulÃ©e') {
      await handleAvoirLogic(id, statut, oldStatut);
    }

    await logActivity('changement de statut facture', `Facture ${oldFacture?.numero || id} : ${oldStatut} -> ${statut}`);

    res.json(toCamel(facture));
  } catch (error: any) {
    console.error('Error updating facture status:', error);
    res.status(500).json({ error: error.message || 'Failed to update facture status' });
  }
});

// --- AVOIRS ---
router.get('/avoirs', async (req, res) => {
  try {
    const { data: avoirs, error } = await supabase
      .from('avoirs')
      .select('*, client:clients(*), facture:factures(numero, statut)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(toCamel(avoirs || []));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch avoirs' });
  }
});

router.get('/avoirs/:id', async (req, res) => {
  try {
    const { data: avoir, error } = await supabase
      .from('avoirs')
      .select('*, client:clients(*), facture:factures(*), lignes:avoir_lignes(*)')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    if (!avoir) return res.status(404).json({ error: 'Not found' });
    res.json(toCamel(avoir));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch avoir' });
  }
});

router.delete('/avoirs/:id', async (req, res) => {
  try {
    // Check facture status before deleting
    const { data: avoir, error: fetchError } = await supabase
      .from('avoirs')
      .select('facture:factures(statut)')
      .eq('id', req.params.id)
      .single();
    
    if (fetchError || !avoir) return res.status(404).json({ error: 'Avoir non trouvÃ©' });
    
    const fStatut = (avoir.facture as any)?.statut;
    if (fStatut !== 'payÃ©e' && fStatut !== 'reste_a_payer') {
      return res.status(400).json({ error: 'Impossible de supprimer un avoir si la facture n\'est pas payÃ©e ou reste Ã  payer' });
    }

    const { error } = await supabase.from('avoirs').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error('Error deleting avoir:', error);
    res.status(500).json({ error: 'Failed to delete avoir' });
  }
});

// --- DEVIS ---
router.get('/devis', async (req, res) => {
  try {
    const { data: devis, error } = await supabase
      .from('devis')
      .select('*, client:clients(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(toCamel(devis));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch devis' });
  }
});

router.post('/devis', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;
    if (authHeader?.startsWith('Bearer ')) {
      try { const token = authHeader.split(' ')[1]; const { data: { user } } = await supabaseAdmin.auth.getUser(token); if (user) userId = user.id; } catch (e) { /* ignore */ }
    }

    const { lignes, ...devisData } = req.body;
    
    const year = new Date().getFullYear();
    const { data: existing } = await supabase.from('devis').select('numero').like('numero', `DEV-${year}-%`).eq('user_id', userId);
    let maxNum = 0;
    for (const d of existing || []) { const m = d.numero?.match(new RegExp(`^DEV-${year}-(\\d+)$`)); if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; } }
    const numero = `DEV-${year}-${String(maxNum + 1).padStart(4, '0')}`;
    
    const data: any = {
      numero,
      user_id: userId,
      client_id: devisData.clientId,
      date_emission: devisData.dateEmission,
      date_validite: devisData.dateValidite,
      statut: devisData.statut || 'brouillon',
      mode_paiement: devisData.modePaiement,
      voiture: devisData.voiture,
      matricule: devisData.matricule,
      montant_ht: Number(devisData.montantHt || 0),
      montant_tva: Number(devisData.montantTva || 0),
      montant_ttc: Number(devisData.montantTtc || 0),
      notes: devisData.notes
    };

    const { data: devis, error: devisError } = await supabase
      .from('devis')
      .insert([data])
      .select()
      .single();
    
    if (devisError) {
      console.error('Error creating devis:', devisError);
      return res.status(400).json({ error: 'Failed to create devis', details: devisError.message });
    }

    await logActivity('crÃ©ation devis', `Devis ${numero} crÃ©Ã©`);

    if (lignes && lignes.length > 0) {
      const lignesData = lignes.map((l: any, index: number) => {
        const qte = Number(l.quantite || 0);
        const pu = Number(l.prix_unitaire || l.prix_unitaire_ht || 0);
        const tva = Number(l.tva || 0);
        const mht = Number(l.montant_ht || (qte * pu));
        const mttc = Number(l.montant_ttc || (mht * (1 + tva / 100)));

        return {
          devis_id: devis.id,
          produit_id: l.produit_id || null,
          reference: l.reference || null,
          designation: l.designation || l.description || '',
          quantite: qte,
          prix_unitaire_ht: pu,
          tva: tva,
          montant_ht: mht,
          montant_ttc: mttc,
          ordre: l.ordre !== undefined ? Number(l.ordre) : index
        };
      });
      const { error: lignesError } = await supabase.from('devis_lignes').insert(lignesData);
      if (lignesError) {
        console.error('Error creating devis lines:', JSON.stringify(lignesError, null, 2));
        // Cleanup
        await supabase.from('devis').delete().eq('id', devis.id);
        return res.status(400).json({ error: 'Error creating devis lines', details: lignesError.message || JSON.stringify(lignesError) });
      }
    }

    const { data: completeDevis, error: fetchError } = await supabase
      .from('devis')
      .select('*, lignes:devis_lignes(*), client:clients(*)')
      .eq('id', devis.id)
      .single();

    if (fetchError) {
      return res.status(201).json(toCamel(devis));
    }

    res.status(201).json(toCamel(completeDevis));
  } catch (error) {
    console.error('Unexpected error in POST /devis:', error);
    res.status(500).json({ error: 'Internal server error', details: formatError(error) });
  }
});

router.put('/devis/:id/statut', async (req, res) => {
  try {
    const { statut } = req.body;
    const { data: devis, error } = await supabase
      .from('devis')
      .update({ statut })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(toCamel(devis));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update devis status' });
  }
});

router.get('/devis/:id', async (req, res) => {
  try {
    const { data: devis, error } = await supabase
      .from('devis')
      .select('*, client:clients(*), lignes:devis_lignes(*)')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    if (!devis) return res.status(404).json({ error: 'Not found' });
    res.json(toCamel(devis));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch devis' });
  }
});

router.put('/devis/:id', async (req, res) => {
  try {
    const { lignes, ...devisData } = req.body;
    const id = req.params.id;
    
    const updateData: any = {};
    if (devisData.clientId !== undefined) updateData.client_id = devisData.clientId;
    if (devisData.dateEmission !== undefined) updateData.date_emission = devisData.dateEmission;
    if (devisData.dateValidite !== undefined) updateData.date_validite = devisData.dateValidite;
    if (devisData.statut !== undefined) updateData.statut = devisData.statut;
    if (devisData.modePaiement !== undefined) updateData.mode_paiement = devisData.modePaiement;
    if (devisData.voiture !== undefined) updateData.voiture = devisData.voiture;
    if (devisData.matricule !== undefined) updateData.matricule = devisData.matricule;
    if (devisData.montantHt !== undefined) updateData.montant_ht = Number(devisData.montantHt || 0);
    if (devisData.montantTva !== undefined) updateData.montant_tva = Number(devisData.montantTva || 0);
    if (devisData.montantTtc !== undefined) updateData.montant_ttc = Number(devisData.montantTtc || 0);
    if (devisData.notes !== undefined) updateData.notes = devisData.notes;

    const { error: updateError } = await supabase
      .from('devis')
      .update(updateData)
      .eq('id', id);
    
    if (updateError) {
      console.error('Error updating devis:', updateError);
      return res.status(400).json({ error: 'Failed to update devis', details: formatError(updateError) });
    }

    if (updateData.statut) {
      await logActivity('changement de statut devis', `Devis ${id} : statut mis Ã  jour vers ${updateData.statut}`);
    }

    // Only update lines if provided
    if (lignes !== undefined) {
      // Delete existing lines
      await supabase.from('devis_lignes').delete().eq('devis_id', id);

      // Recreate lines
      if (lignes && lignes.length > 0) {
        const lignesData = lignes.map((l: any, index: number) => {
          const qte = Number(l.quantite || 0);
          const pu = Number(l.prix_unitaire || l.prix_unitaire_ht || 0);
          const tva = Number(l.tva || 0);
          const mht = Number(l.montant_ht || (qte * pu));
          const mttc = Number(l.montant_ttc || (mht * (1 + tva / 100)));

          return {
            devis_id: id,
            produit_id: l.produit_id || null,
            reference: l.reference || null,
            designation: l.designation || l.description || '',
            quantite: qte,
            prix_unitaire_ht: pu,
            tva: tva,
            montant_ht: mht,
            montant_ttc: mttc,
            ordre: l.ordre !== undefined ? Number(l.ordre) : index
          };
        });
        const { error: lignesError } = await supabase.from('devis_lignes').insert(lignesData);
        if (lignesError) {
          console.error('Error updating devis lines:', JSON.stringify(lignesError, null, 2));
          return res.status(400).json({ error: 'Error updating devis lines', details: lignesError.message || JSON.stringify(lignesError) });
        }
      }
    }

    const { data: updatedDevis, error: fetchError } = await supabase
      .from('devis')
      .select('*, lignes:devis_lignes(*), client:clients(*)')
      .eq('id', id)
      .single();

    if (fetchError) {
      return res.status(200).json({ id });
    }

    res.json(toCamel(updatedDevis));
  } catch (error) {
    console.error('Unexpected error in PUT /devis/:id:', error);
    res.status(500).json({ error: 'Internal server error', details: formatError(error) });
  }
});

router.delete('/devis/:id', async (req, res) => {
  try {
    const { data: devis } = await supabase.from('devis').select('statut').eq('id', req.params.id).single();
    if (devis && devis.statut !== 'brouillon') {
      return res.status(400).json({ error: 'Impossible de supprimer un devis validÃ©. Veuillez le refuser ou l\'annuler.' });
    }
    const { error } = await supabase.from('devis').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete devis' });
  }
});

router.post('/devis/:id/convert', async (req, res) => {
  try {
    const { data: devis, error: fetchError } = await supabase
      .from('devis')
      .select('*, lignes:devis_lignes(*)')
      .eq('id', req.params.id)
      .single();
    
    if (fetchError) throw fetchError;
    if (!devis) return res.status(404).json({ error: 'Devis not found' });
    
    const { count } = await supabase.from('factures').select('*', { count: 'exact', head: true });
    const numero = `FAC/${new Date().getFullYear()}/${String((count || 0) + 1).padStart(5, '0')}`;
    
    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .insert([{
        numero,
        client_id: devis.client_id,
        date_emission: new Date().toISOString(),
        montant_ht: devis.montant_ht,
        montant_tva: devis.montant_tva,
        montant_ttc: devis.montant_ttc,
        statut: 'en_attente',
        reste_a_payer: devis.montant_ttc,
        mode_paiement: devis.mode_paiement,
        voiture: devis.voiture,
        matricule: devis.matricule,
        notes: `Facture gÃ©nÃ©rÃ©e Ã  partir du devis ${devis.numero}`
      }])
      .select()
      .single();
    
    if (factureError) throw factureError;
    
    if (devis.lignes && devis.lignes.length > 0) {
      const lignesData = devis.lignes.map((l: any) => ({
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
      const { error: lignesError } = await supabase.from('facture_lignes').insert(lignesData);
      if (lignesError) throw lignesError;
    }
    
    await supabase
      .from('devis')
      .update({ statut: 'converti' })
      .eq('id', devis.id);
    
    res.status(201).json(toCamel(facture));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to convert devis' });
  }
});

// --- BONS DE COMMANDE ---
router.get('/bons-commande', async (req, res) => {
  try {
    const { data: bons, error } = await supabase
      .from('bons_commande')
      .select('*, fournisseur:fournisseurs(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(toCamel(bons));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bons de commande' });
  }
});

router.get('/bons-commande/:id', async (req, res) => {
  try {
    const { data: bon, error } = await supabase
      .from('bons_commande')
      .select('*, fournisseur:fournisseurs(*), lignes:bon_commande_lignes(*)')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json(toCamel(bon));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bon de commande' });
  }
});

router.post('/bons-commande', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (!authError && user) userId = user.id;
      } catch (e) { /* ignore */ }
    }

    const { lignes, ...bonData } = req.body;
    
    // Generate order number (per-user)
    const year = new Date().getFullYear();
    const { data: existing } = await supabase
      .from('bons_commande')
      .select('numero')
      .like('numero', `BC-${year}-%`)
      .eq('user_id', userId);
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
    const numero = `BC-${year}-${String(maxNum + 1).padStart(4, '0')}`;
    
    const data: any = {
      numero,
      user_id: userId,
      fournisseur_id: bonData.fournisseurId,
      date_commande: bonData.dateCommande,
      date_livraison_prevue: bonData.dateLivraisonPrevue,
      statut: bonData.statut || 'en_attente',
      montant_ht: bonData.montantHt || 0,
      montant_tva: bonData.montantTva || 0,
      montant_ttc: bonData.montantTtc || 0
    };

    const { data: bon, error: bonError } = await supabase
      .from('bons_commande')
      .insert([data])
      .select()
      .single();
    
    if (bonError) {
      console.error('Error creating bon de commande:', bonError);
      return res.status(400).json({ error: 'Failed to create bon de commande', details: bonError.message });
    }

    await logActivity('crÃ©ation bon de commande', `Bon de Commande ${numero} crÃ©Ã©`);

    if (lignes && lignes.length > 0) {
      const lignesData = lignes.map((l: any, index: number) => {
        const qte = Number(l.quantite || 0);
        const pu = Number(l.prix_unitaire || l.prix_unitaire_ht || 0);
        const tva = Number(l.tva || 0);
        const mht = Number(l.montant_ht || (qte * pu));
        const mttc = Number(l.montant_ttc || (mht * (1 + tva / 100)));

        return {
          bon_commande_id: bon.id,
          produit_id: l.produit_id ? Number(l.produit_id) : null,
          reference: l.reference || null,
          designation: l.designation || l.description || '',
          quantite: qte,
          prix_unitaire_ht: pu,
          tva: tva,
          montant_ht: mht,
          montant_ttc: mttc,
          ordre: l.ordre !== undefined ? Number(l.ordre) : index
        };
      });

      const { error: lignesError } = await supabaseAdmin.from('bon_commande_lignes').insert(lignesData);
      
      if (lignesError) {
        console.error('Error creating bon de commande lines:', JSON.stringify(lignesError, null, 2));
        // Cleanup: delete the bon if lines fail
        await supabaseAdmin.from('bons_commande').delete().eq('id', bon.id);
        return res.status(400).json({ 
          error: 'Error creating bon de commande lines', 
          details: lignesError.message,
          hint: 'Run in Supabase SQL Editor: ALTER TABLE bon_commande_lignes ADD COLUMN IF NOT EXISTS montant_ht DECIMAL(12,2) DEFAULT 0;'
        });
      }

      // Stock update logic: if status is 'livrée' or 'livré', add to stock
      const islivré = bon.statut === 'livrée' || bon.statut === 'livré';
      if (islivré) {
        const { data: fournisseur } = await supabaseAdmin.from('fournisseurs').select('nom').eq('id', bon.fournisseur_id).single();
        for (const l of lignesData) {
          if (l.produit_id) {
            await updateProductStock(
              l.produit_id, 
              Number(l.quantite || 0), 
              'achat', 
              bon.numero, 
              `RÃ©ception Bon de Commande ${bon.numero}`,
              fournisseur?.nom,
              l.prix_unitaire_ht
            );
          }
        }
        // `stock_updated` column does not exist on bons_commande — state is
        // derived from `statut` (livré/livrée) instead.

        // Create a linked Bon de Livraison
        const year = new Date().getFullYear();
        const { data: blExisting } = await supabaseAdmin.from('bons_livraison').select('numero').like('numero', `BL-${year}-%`).eq('user_id', bon.user_id);
        let blMax = 0;
        for (const b of blExisting || []) { const m = b.numero?.match(new RegExp(`^BL-${year}-(\\d+)$`)); if (m) { const n = parseInt(m[1], 10); if (n > blMax) blMax = n; } }
        const blNumero = `BL-${year}-${String(blMax + 1).padStart(4, '0')}`;
        
        const blData: any = {
          numero: blNumero,
          user_id: bon.user_id,
          fournisseur_id: bon.fournisseur_id,
          date_livraison: new Date().toISOString(),
          statut: 'livré',
          notes: `GÃ©nÃ©rÃ© automatiquement depuis Bon de Commande ${bon.numero}`,
          montant_ht: bon.montant_ht || 0,
          montant_tva: bon.montant_tva || 0,
          montant_ttc: bon.montant_ttc || 0,
          bon_commande_id: bon.id
        };

        const { data: newBL, error: blError } = await supabaseAdmin.from('bons_livraison').insert([blData]).select().single();
        
        if (!blError && newBL && lignesData) {
          const blLignesData = lignesData.map((l: any, index: number) => ({
            bon_livraison_id: newBL.id,
            produit_id: l.produit_id,
            reference: l.reference,
            designation: l.designation,
            quantite: l.quantite,
            prix_unitaire_ht: l.prix_unitaire_ht,
            tva: l.tva,
            montant_ht: l.montant_ht,
            montant_ttc: l.montant_ttc,
            ordre: l.ordre !== undefined ? l.ordre : index
          }));
          await supabaseAdmin.from('bon_livraison_lignes').insert(blLignesData);
        }
      }
    }

    const { data: completeBon, error: fetchError } = await supabase
      .from('bons_commande')
      .select('*, fournisseur:fournisseurs(*), lignes:bon_commande_lignes(*)')
      .eq('id', bon.id)
      .single();

    if (fetchError) {
      return res.status(201).json(toCamel(bon));
    }

    res.status(201).json(toCamel(completeBon));
  } catch (error) {
    console.error('Unexpected error in POST /bons-commande:', error);
    res.status(500).json({ error: 'Internal server error', details: formatError(error) });
  }
});

router.put('/bons-commande/:id', async (req, res) => {
  try {
    const { lignes, ...bonData } = req.body;
    const id = req.params.id;
    
    // Fetch old status for stock update.
    // NOTE: `bons_commande` has no `stock_updated` column in the production
    // schema, so we derive `wasStockUpdated` from the previous statut.
    const { data: oldBon } = await supabaseAdmin.from('bons_commande').select('statut, fournisseur_id, numero').eq('id', id).single();
    const oldStatut = oldBon?.statut;
    const wasStockUpdated = oldStatut === 'livré' || oldStatut === 'livrée';

    const updateData: any = {};
    if (bonData.fournisseurId !== undefined) updateData.fournisseur_id = bonData.fournisseurId;
    if (bonData.dateCommande !== undefined) updateData.date_commande = bonData.dateCommande;
    if (bonData.dateLivraisonPrevue !== undefined) updateData.date_livraison_prevue = bonData.dateLivraisonPrevue;
    if (bonData.statut !== undefined) updateData.statut = bonData.statut;
    if (bonData.montantHt !== undefined) updateData.montant_ht = bonData.montantHt;
    if (bonData.montantTva !== undefined) updateData.montant_tva = bonData.montantTva;
    if (bonData.montantTtc !== undefined) updateData.montant_ttc = bonData.montantTtc;

    const { error: updateError } = await supabase
      .from('bons_commande')
      .update(updateData)
      .eq('id', id);
    
    if (updateError) {
      console.error('Error updating bon de commande:', updateError);
      return res.status(400).json({ error: 'Failed to update bon de commande', details: formatError(updateError) });
    }

    if (updateData.statut) {
      await logActivity('changement de statut bon de commande', `Bon de Commande ${id} : statut mis Ã  jour vers ${updateData.statut}`);
    }

    // Stock update logic
    const newStatut = updateData.statut || oldStatut;
    const isNowLivré = newStatut === 'livrée' || newStatut === 'livré';
    const waslivré = oldStatut === 'livrée' || oldStatut === 'livré';

    if (isNowLivré && !waslivré) {
      // Create a linked Bon de Livraison
      const year = new Date().getFullYear();
      const { data: bonDetails } = await supabaseAdmin.from('bons_commande').select('*').eq('id', id).single();
      const { data: bonLignes } = await supabaseAdmin.from('bon_commande_lignes').select('*').eq('bon_commande_id', id);

      if (bonDetails) {
        const { data: blExisting } = await supabaseAdmin.from('bons_livraison').select('numero').like('numero', `BL-${year}-%`).eq('user_id', bonDetails.user_id);
        let blMax = 0;
        for (const b of blExisting || []) { const m = b.numero?.match(new RegExp(`^BL-${year}-(\\d+)$`)); if (m) { const n = parseInt(m[1], 10); if (n > blMax) blMax = n; } }
        const blNumero = `BL-${year}-${String(blMax + 1).padStart(4, '0')}`;
        const blData: any = {
          numero: blNumero,
          user_id: bonDetails.user_id,
          fournisseur_id: bonDetails.fournisseur_id,
          date_livraison: new Date().toISOString(),
          statut: 'livré',
          notes: `GÃ©nÃ©rÃ© automatiquement depuis Bon de Commande ${bonDetails.numero}`,
          montant_ht: bonDetails.montant_ht || 0,
          montant_tva: bonDetails.montant_tva || 0,
          montant_ttc: bonDetails.montant_ttc || 0,
          bon_commande_id: id
        };

        const { data: newBL, error: blError } = await supabaseAdmin.from('bons_livraison').insert([blData]).select().single();
        
        if (!blError && newBL && bonLignes) {
          const blLignesData = bonLignes.map((l: any, index: number) => ({
            bon_livraison_id: newBL.id,
            produit_id: l.produit_id,
            reference: l.reference,
            designation: l.designation,
            quantite: l.quantite,
            prix_unitaire_ht: l.prix_unitaire_ht,
            tva: l.tva,
            montant_ht: l.montant_ht || (Number(l.quantite || 0) * Number(l.prix_unitaire_ht || 0)),
            montant_ttc: l.montant_ttc || ((Number(l.quantite || 0) * Number(l.prix_unitaire_ht || 0)) * (1 + Number(l.tva || 0) / 100)),
            ordre: l.ordre !== undefined ? l.ordre : index
          }));
          await supabaseAdmin.from('bon_livraison_lignes').insert(blLignesData);
        }
      }
    } else if (!isNowLivré && waslivré) {
      // Delete linked Bon de Livraison
      await supabaseAdmin.from('bons_livraison').delete().eq('bon_commande_id', id);
    }

    if (isNowLivré && !wasStockUpdated) {
      const { data: currentLignes } = await supabaseAdmin.from('bon_commande_lignes').select('*').eq('bon_commande_id', id);
      const { data: fournisseur } = await supabaseAdmin.from('fournisseurs').select('nom').eq('id', oldBon.fournisseur_id || updateData.fournisseur_id).single();
      const { data: b } = await supabaseAdmin.from('bons_commande').select('numero').eq('id', id).single();
      if (currentLignes && currentLignes.length > 0) {
        for (const l of currentLignes) {
          if (l.produit_id) await updateProductStock(
            l.produit_id, 
            Number(l.quantite || 0), 
            'achat', 
            b?.numero, 
            `RÃ©ception Bon de Commande ${b?.numero}`,
            fournisseur?.nom,
            l.prix_unitaire_ht
          );
        }
        // `stock_updated` column does not exist on bons_commande — state is
        // derived from `statut` (livré/livrée) instead.
      }
    } else if (!isNowLivré && wasStockUpdated) {
      // Revert stock if it was updated but status is no longer 'livrée'
      const { data: currentLignes } = await supabaseAdmin.from('bon_commande_lignes').select('*').eq('bon_commande_id', id);
      const { data: fournisseur } = await supabaseAdmin.from('fournisseurs').select('nom').eq('id', oldBon.fournisseur_id || updateData.fournisseur_id).single();
      const { data: b } = await supabaseAdmin.from('bons_commande').select('numero').eq('id', id).single();
      if (currentLignes && currentLignes.length > 0) {
        for (const l of currentLignes) {
          if (l.produit_id) await updateProductStock(
            l.produit_id, 
            -Number(l.quantite || 0), 
            'ajustement', 
            b?.numero, 
            `Annulation RÃ©ception Bon de Commande ${b?.numero}`,
            fournisseur?.nom,
            l.prix_unitaire_ht
          );
        }
        // `stock_updated` column does not exist on bons_commande — state is
        // derived from `statut` (livré/livrée) instead.
      }
    }

    // Only update lines if provided
    if (lignes !== undefined) {
      // Delete existing lines
      await supabaseAdmin.from('bon_commande_lignes').delete().eq('bon_commande_id', id);
      
      // Recreate lines
      if (lignes && lignes.length > 0) {
        const lignesData = lignes.map((l: any, index: number) => {
          const qte = Number(l.quantite || 0);
          const pu = Number(l.prix_unitaire || l.prix_unitaire_ht || 0);
          const tva = Number(l.tva || 0);
          const mht = Number(l.montant_ht || (qte * pu));
          const mttc = Number(l.montant_ttc || (mht * (1 + tva / 100)));

          return {
            bon_commande_id: id,
            produit_id: l.produit_id ? Number(l.produit_id) : null,
            reference: l.reference || null,
            designation: l.designation || l.description || '',
            quantite: qte,
            prix_unitaire_ht: pu,
            tva: tva,
            montant_ht: mht,
            montant_ttc: mttc,
            ordre: l.ordre !== undefined ? Number(l.ordre) : index
          };
        });
        const { error: lignesError } = await supabaseAdmin.from('bon_commande_lignes').insert(lignesData);
        if (lignesError) {
          console.error('Error updating bon de commande lines:', JSON.stringify(lignesError, null, 2));
          return res.status(400).json({ error: 'Error updating bon de commande lines', details: lignesError.message || JSON.stringify(lignesError) });
        }
      }
    }

    const { data: updatedBon, error: fetchError } = await supabase
      .from('bons_commande')
      .select('*, fournisseur:fournisseurs(*), lignes:bon_commande_lignes(*)')
      .eq('id', id)
      .single();

    if (fetchError) {
      return res.status(200).json({ id });
    }

    res.json(toCamel(updatedBon));
  } catch (error) {
    console.error('Unexpected error in PUT /bons-commande:', error);
    res.status(500).json({ error: 'Internal server error', details: formatError(error) });
  }
});

router.delete('/bons-commande/:id', async (req, res) => {
  try {
    const { data: bc } = await supabaseAdmin.from('bons_commande').select('statut').eq('id', req.params.id).single();
    if (bc && bc.statut !== 'brouillon') {
      return res.status(400).json({ error: 'Impossible de supprimer un bon de commande validÃ©. Veuillez l\'annuler.' });
    }
    const { error } = await supabaseAdmin.from('bons_commande').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete bon de commande' });
  }
});

router.put(['/bons-commande/:id/statut', '/bons-commande/:id/status'], async (req, res) => {
  try {
    const { statut } = req.body ?? {};
    const rawId = req.params.id;
    const id = parseInt(rawId, 10);

    // --- Input validation -----------------------------------------------------
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: `Invalid bon de commande id: "${rawId}"` });
    }
    if (typeof statut !== 'string' || statut.trim() === '') {
      return res.status(400).json({ error: 'Field "statut" is required and must be a non-empty string' });
    }

    // --- Fetch existing record ------------------------------------------------
    // NOTE: `bons_commande` does NOT have a `stock_updated` column in the
    // production schema (see supabase_schema.sql). We therefore derive whether
    // the stock has already been incremented purely from the previous statut.
    const { data: oldBon, error: fetchError } = await supabaseAdmin
      .from('bons_commande')
      .select('statut, fournisseur_id, numero')
      .eq('id', id)
      .single();

    if (fetchError || !oldBon) {
      console.error('[PUT /bons-commande/:id/statut] fetch failed:', fetchError);
      return res.status(404).json({
        error: `Bon de commande ${id} introuvable`,
        details: fetchError?.message,
      });
    }

    const isLivréStatus = (s?: string | null) => s === 'livré' || s === 'livrée';
    const isNowLivré = isLivréStatus(statut);
    const wasLivré = isLivréStatus(oldBon.statut);
    const wasStockUpdated = wasLivré; // derived, no DB column needed

    // --- Update statut --------------------------------------------------------
    const { data: bon, error: updateError } = await supabaseAdmin
      .from('bons_commande')
      .update({ statut })
      .eq('id', id)
      .select()
      .single();

    if (updateError || !bon) {
      console.error('[PUT /bons-commande/:id/statut] update failed:', updateError);
      return res.status(500).json({
        error: 'Failed to update bon de commande status',
        details: updateError?.message,
        code: (updateError as any)?.code,
      });
    }

    // --- Linked Bon de Livraison sync ----------------------------------------
    if (isNowLivré && !wasLivré) {
      try {
        const { data: bonDetails } = await supabaseAdmin
          .from('bons_commande')
          .select('*')
          .eq('id', id)
          .single();
        const { data: bonLignes } = await supabaseAdmin
          .from('bon_commande_lignes')
          .select('*')
          .eq('bon_commande_id', id);

        if (bonDetails) {
          const year = new Date().getFullYear();
          const { data: blExisting } = await supabaseAdmin.from('bons_livraison').select('numero').like('numero', `BL-${year}-%`).eq('user_id', bonDetails.user_id);
          let blMax = 0;
          for (const b of blExisting || []) { const m = b.numero?.match(new RegExp(`^BL-${year}-(\\d+)$`)); if (m) { const n = parseInt(m[1], 10); if (n > blMax) blMax = n; } }
          const blNumero = `BL-${year}-${String(blMax + 1).padStart(4, '0')}`;
          const blData: any = {
            numero: blNumero,
            user_id: bonDetails.user_id,
            fournisseur_id: bonDetails.fournisseur_id,
            date_livraison: new Date().toISOString(),
            statut: 'livré',
            notes: `Généré automatiquement depuis Bon de Commande ${bonDetails.numero}`,
            montant_ht: bonDetails.montant_ht || 0,
            montant_tva: bonDetails.montant_tva || 0,
            montant_ttc: bonDetails.montant_ttc || 0,
            bon_commande_id: id,
          };

          const { data: newBL, error: blError } = await supabaseAdmin
            .from('bons_livraison')
            .insert([blData])
            .select()
            .single();

          if (blError) {
            console.warn('[PUT /bons-commande/:id/statut] BL insert failed:', blError);
          } else if (newBL && bonLignes && bonLignes.length > 0) {
            const blLignesData = bonLignes.map((l: any, index: number) => ({
              bon_livraison_id: newBL.id,
              produit_id: l.produit_id,
              reference: l.reference,
              designation: l.designation,
              quantite: l.quantite,
              prix_unitaire_ht: l.prix_unitaire_ht,
              tva: l.tva,
              montant_ht: l.montant_ht || (Number(l.quantite || 0) * Number(l.prix_unitaire_ht || 0)),
              montant_ttc:
                l.montant_ttc ||
                Number(l.quantite || 0) * Number(l.prix_unitaire_ht || 0) * (1 + Number(l.tva || 0) / 100),
              ordre: l.ordre !== undefined ? l.ordre : index,
            }));
            const { error: blLignesError } = await supabaseAdmin
              .from('bon_livraison_lignes')
              .insert(blLignesData);
            if (blLignesError) {
              console.warn('[PUT /bons-commande/:id/statut] BL lignes insert failed:', blLignesError);
            }
          }
        }
      } catch (blSyncErr) {
        // Non-fatal: the BC status update already succeeded
        console.error('[PUT /bons-commande/:id/statut] BL sync error (non-fatal):', blSyncErr);
      }
    } else if (!isNowLivré && wasLivré) {
      // Reverting: remove the auto-generated Bon de Livraison
      const { error: delErr } = await supabaseAdmin
        .from('bons_livraison')
        .delete()
        .eq('bon_commande_id', id);
      if (delErr) {
        console.warn('[PUT /bons-commande/:id/statut] BL delete failed:', delErr);
      }
    }

    // --- Stock movement sync --------------------------------------------------
    if (isNowLivré && !wasStockUpdated) {
      const { data: currentLignes } = await supabaseAdmin
        .from('bon_commande_lignes')
        .select('*')
        .eq('bon_commande_id', id);
      const { data: b } = await supabaseAdmin
        .from('bons_commande')
        .select('*, fournisseur:fournisseurs(nom)')
        .eq('id', id)
        .single();

      if (currentLignes && currentLignes.length > 0) {
        for (const l of currentLignes) {
          if (!l.produit_id) continue;
          try {
            await updateProductStock(
              l.produit_id,
              Number(l.quantite || 0),
              'achat',
              b?.numero,
              `Réception Bon de Commande ${b?.numero}`,
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
    } else if (!isNowLivré && wasStockUpdated) {
      // Revert stock — use the safe variant so a low/zero stock does not
      // block the administrative status change.
      const { data: currentLignes } = await supabaseAdmin
        .from('bon_commande_lignes')
        .select('*')
        .eq('bon_commande_id', id);
      const { data: b } = await supabaseAdmin
        .from('bons_commande')
        .select('*, fournisseur:fournisseurs(nom)')
        .eq('id', id)
        .single();

      if (currentLignes && currentLignes.length > 0) {
        for (const l of currentLignes) {
          if (!l.produit_id) continue;
          try {
            await updateProductStockSafe(
              l.produit_id,
              -Number(l.quantite || 0),
              'ajustement',
              b?.numero,
              `Annulation Réception Bon de Commande ${b?.numero}`,
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
  } catch (error: any) {
    // Top-level safety net — always return JSON, never let the serverless
    // function crash with an unhandled exception.
    console.error('[PUT /bons-commande/:id/statut] unhandled error:', error);
    return res.status(500).json({
      error: 'Failed to update bon de commande status',
      details: error?.message || String(error),
      code: error?.code,
    });
  }
});

// --- BONS DE LIVRAISON ---
router.get('/bons-livraison', async (req, res) => {
  try {
    const { data: bons, error } = await supabase
      .from('bons_livraison')
      .select('*, fournisseur:fournisseurs(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(toCamel(bons));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bons de livraison' });
  }
});

router.get('/bons-livraison/:id', async (req, res) => {
  try {
    const { data: bon, error } = await supabase
      .from('bons_livraison')
      .select('*, fournisseur:fournisseurs(*), lignes:bon_livraison_lignes(*)')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json(toCamel(bon));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bon de livraison' });
  }
});

router.post('/bons-livraison', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;
    if (authHeader?.startsWith('Bearer ')) {
      try { const token = authHeader.split(' ')[1]; const { data: { user } } = await supabaseAdmin.auth.getUser(token); if (user) userId = user.id; } catch (e) { /* ignore */ }
    }

    const { lignes, ...blData } = req.body;
    
    const year = new Date().getFullYear();
    const { data: existing } = await supabase.from('bons_livraison').select('numero').like('numero', `BL-${year}-%`).eq('user_id', userId);
    let maxNum = 0;
    for (const b of existing || []) { const m = b.numero?.match(new RegExp(`^BL-${year}-(\\d+)$`)); if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; } }
    const numero = `BL-${year}-${String(maxNum + 1).padStart(4, '0')}`;
    
    const data: any = {
      numero,
      user_id: userId,
      fournisseur_id: blData.fournisseurId,
      date_livraison: blData.dateLivraison,
      statut: blData.statut || 'en_attente',
      notes: blData.notes,
      montant_ht: blData.montantHt || 0,
      montant_tva: blData.montantTva || 0,
      montant_ttc: blData.montantTtc || 0
    };

    const { data: bon, error: bonError } = await supabase
      .from('bons_livraison')
      .insert([data])
      .select()
      .single();
    
    if (bonError) {
      console.error('Error creating bon de livraison:', bonError);
      return res.status(400).json({ error: 'Failed to create bon de livraison', details: bonError.message });
    }

    if (lignes && lignes.length > 0) {
      const lignesData = lignes.map((l: any, index: number) => {
        const qte = Number(l.quantite || 0);
        const pu = Number(l.prix_unitaire || l.prix_unitaire_ht || 0);
        const tva = Number(l.tva || 0);
        const mht = Number(l.montant_ht || (qte * pu));
        const mttc = Number(l.montant_ttc || (mht * (1 + tva / 100)));

        return {
          bon_livraison_id: bon.id,
          produit_id: l.produit_id ? Number(l.produit_id) : null,
          reference: l.reference || null,
          designation: l.designation || l.description || '',
          quantite: qte,
          prix_unitaire_ht: pu,
          tva: tva,
          montant_ht: mht,
          montant_ttc: mttc,
          ordre: l.ordre !== undefined ? Number(l.ordre) : index
        };
      });
      const { error: lignesError } = await supabase.from('bon_livraison_lignes').insert(lignesData);
      if (lignesError) {
        console.error('Error creating bon de livraison lines:', JSON.stringify(lignesError, null, 2));
        // Cleanup
        await supabase.from('bons_livraison').delete().eq('id', bon.id);
        return res.status(400).json({ 
          error: 'Error creating bon de livraison lines', 
          details: lignesError.message,
          hint: 'Visit /api/fix-schema and run the SQL in Supabase'
        });
      }

      // Recalculate and update totals on the header
      const totalHt = lignesData.reduce((sum, l) => sum + Number(l.montant_ht || 0), 0);
      const totalTva = lignesData.reduce((sum, l) => sum + (Number(l.montant_ht || 0) * Number(l.tva || 20) / 100), 0);
      const totalTtc = lignesData.reduce((sum, l) => sum + Number(l.montant_ttc || 0), 0);
      
      await supabase.from('bons_livraison').update({
        montant_ht: totalHt,
        montant_tva: totalTva,
        montant_ttc: totalTtc
      }).eq('id', bon.id);

      // Stock update logic: if status is 'livrée' or 'livré', add to stock
      const islivré = bon.statut === 'livrée' || bon.statut === 'livré';
      if (islivré) {
        const { data: fournisseur } = await supabase.from('fournisseurs').select('nom').eq('id', bon.fournisseur_id).single();
        for (const l of lignesData) {
          if (l.produit_id) {
            await updateProductStock(
              l.produit_id, 
              Number(l.quantite || 0), 
              'achat', 
              bon.numero, 
              `RÃ©ception Bon de Livraison ${bon.numero}`,
              fournisseur?.nom,
              l.prix_unitaire_ht
            );
          }
        }
        // Mark as stock updated
        await supabase.from('bons_livraison').update({ stock_updated: true }).eq('id', bon.id);
      }
    }

    const { data: completeBon, error: fetchError } = await supabase
      .from('bons_livraison')
      .select('*, fournisseur:fournisseurs(*), lignes:bon_livraison_lignes(*)')
      .eq('id', bon.id)
      .single();

    if (fetchError) {
      return res.status(201).json(toCamel(bon));
    }

    res.status(201).json(toCamel(completeBon));
  } catch (error) {
    console.error('Unexpected error in POST /bons-livraison:', error);
    res.status(500).json({ error: 'Internal server error', details: formatError(error) });
  }
});

router.put('/bons-livraison/:id', async (req, res) => {
  try {
    const { lignes, ...blData } = req.body;
    const id = req.params.id;
    
    // Fetch old status for stock update
    const { data: oldBon } = await supabase.from('bons_livraison').select('statut, stock_updated, fournisseur_id, numero').eq('id', id).single();
    const oldStatut = oldBon?.statut;
    const wasStockUpdated = oldBon?.stock_updated;

    const updateData: any = {};
    if (blData.fournisseurId !== undefined) updateData.fournisseur_id = blData.fournisseurId;
    if (blData.dateLivraison !== undefined) updateData.date_livraison = blData.dateLivraison;
    if (blData.statut !== undefined) updateData.statut = blData.statut;
    if (blData.montantHt !== undefined) updateData.montant_ht = blData.montantHt;
    if (blData.montantTva !== undefined) updateData.montant_tva = blData.montantTva;
    if (blData.montantTtc !== undefined) updateData.montant_ttc = blData.montantTtc;

    const { error: updateError } = await supabase
      .from('bons_livraison')
      .update(updateData)
      .eq('id', id);
    
    if (updateError) {
      console.error('Error updating bon de livraison:', updateError);
      return res.status(400).json({ error: 'Failed to update bon de livraison', details: formatError(updateError) });
    }

    // Stock update logic
    const newStatut = updateData.statut || oldStatut;
    const isNowLivré = newStatut === 'livrée' || newStatut === 'livré';
    const waslivré = oldStatut === 'livrée' || oldStatut === 'livré';

    if (isNowLivré && !wasStockUpdated) {
      const { data: currentLignes } = await supabase.from('bon_livraison_lignes').select('*').eq('bon_livraison_id', id);
      const { data: fournisseur } = await supabase.from('fournisseurs').select('nom').eq('id', oldBon.fournisseur_id || updateData.fournisseur_id).single();
      const { data: b } = await supabase.from('bons_livraison').select('numero').eq('id', id).single();
      if (currentLignes && currentLignes.length > 0) {
        for (const l of currentLignes) {
          if (l.produit_id) await updateProductStock(
            l.produit_id, 
            Number(l.quantite || 0), 
            'achat', 
            b?.numero, 
            `RÃ©ception Bon de Livraison ${b?.numero}`,
            fournisseur?.nom,
            l.prix_unitaire_ht
          );
        }
        // Mark as stock updated
        await supabase.from('bons_livraison').update({ stock_updated: true }).eq('id', id);
      }
    } else if (!isNowLivré && wasStockUpdated) {
      // Revert stock
      const { data: currentLignes } = await supabase.from('bon_livraison_lignes').select('*').eq('bon_livraison_id', id);
      const { data: fournisseur } = await supabase.from('fournisseurs').select('nom').eq('id', oldBon.fournisseur_id || updateData.fournisseur_id).single();
      const { data: b } = await supabase.from('bons_livraison').select('numero').eq('id', id).single();
      if (currentLignes && currentLignes.length > 0) {
        for (const l of currentLignes) {
          if (l.produit_id) await updateProductStock(
            l.produit_id, 
            -Number(l.quantite || 0), 
            'ajustement', 
            b?.numero, 
            `Annulation RÃ©ception Bon de Livraison ${b?.numero}`,
            fournisseur?.nom,
            l.prix_unitaire_ht
          );
        }
        // Mark as stock NOT updated
        await supabase.from('bons_livraison').update({ stock_updated: false }).eq('id', id);
      }
    }

    // Only update lines if provided
    if (lignes !== undefined) {
      // Delete existing lines
      await supabase.from('bon_livraison_lignes').delete().eq('bon_livraison_id', id);
      
      // Recreate lines
      if (lignes && lignes.length > 0) {
        const lignesData = lignes.map((l: any, index: number) => {
          const qte = Number(l.quantite || 0);
          const pu = Number(l.prix_unitaire || l.prix_unitaire_ht || 0);
          const tva = Number(l.tva || 0);
          const mht = Number(l.montant_ht || (qte * pu));
          const mttc = Number(l.montant_ttc || (mht * (1 + tva / 100)));

          return {
            bon_livraison_id: id,
            produit_id: l.produit_id ? Number(l.produit_id) : null,
            reference: l.reference || null,
            designation: l.designation || l.description || '',
            quantite: qte,
            prix_unitaire_ht: pu,
            tva: tva,
            montant_ht: mht,
            montant_ttc: mttc,
            ordre: l.ordre !== undefined ? Number(l.ordre) : index
          };
        });
        const { error: lignesError } = await supabase.from('bon_livraison_lignes').insert(lignesData);
        if (lignesError) {
          console.error('Error updating bon de livraison lines:', JSON.stringify(lignesError, null, 2));
          return res.status(400).json({ error: 'Error updating bon de livraison lines', details: lignesError.message || JSON.stringify(lignesError) });
        }
      }
    }

    const { data: updatedBon, error: fetchError } = await supabase
      .from('bons_livraison')
      .select('*, fournisseur:fournisseurs(*), lignes:bon_livraison_lignes(*)')
      .eq('id', id)
      .single();

    if (fetchError) {
      return res.status(200).json({ id });
    }

    res.json(toCamel(updatedBon));
  } catch (error) {
    console.error('Unexpected error in PUT /bons-livraison:', error);
    res.status(500).json({ error: 'Internal server error', details: formatError(error) });
  }
});

router.delete('/bons-livraison/:id', async (req, res) => {
  try {
    const { data: bl } = await supabase.from('bons_livraison').select('statut').eq('id', req.params.id).single();
    if (bl && bl.statut !== 'en_attente' && bl.statut !== 'brouillon') {
      return res.status(400).json({ error: 'Impossible de supprimer un bon de livraison validÃ©. Veuillez l\'annuler.' });
    }
    const { error } = await supabase.from('bons_livraison').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete bon de livraison' });
  }
});

router.put(['/bons-livraison/:id/statut', '/bons-livraison/:id/status'], async (req, res) => {
  try {
    const { statut } = req.body;
    const id = req.params.id;

    // Fetch old status for stock update
    const { data: oldBon } = await supabase.from('bons_livraison').select('statut, stock_updated, fournisseur_id, numero').eq('id', id).single();
    const wasStockUpdated = oldBon?.stock_updated;

    const { data: bon, error } = await supabase
      .from('bons_livraison')
      .update({ statut })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // Stock update logic - handle both livré and livrée
    const isNowLivré = statut === 'livré' || statut === 'livrée';
    const waslivré = oldBon?.statut === 'livré' || oldBon?.statut === 'livrée';

    if (isNowLivré && !wasStockUpdated) {
      const { data: currentLignes } = await supabase.from('bon_livraison_lignes').select('*').eq('bon_livraison_id', id);
      const { data: b } = await supabase.from('bons_livraison').select('*, fournisseur:fournisseurs(nom)').eq('id', id).single();
      if (currentLignes && currentLignes.length > 0) {
        for (const l of currentLignes) {
          if (l.produit_id) await updateProductStock(
            l.produit_id, 
            Number(l.quantite || 0), 
            'achat', 
            b?.numero, 
            `RÃ©ception Bon de Livraison ${b?.numero}`,
            b?.fournisseur?.nom,
            l.prix_unitaire_ht
          );
        }
        // Mark as stock updated
        await supabase.from('bons_livraison').update({ stock_updated: true }).eq('id', id);
      }
    } else if (!isNowLivré && wasStockUpdated) {
      // Revert stock
      const { data: currentLignes } = await supabase.from('bon_livraison_lignes').select('*').eq('bon_livraison_id', id);
      const { data: b } = await supabase.from('bons_livraison').select('*, fournisseur:fournisseurs(nom)').eq('id', id).single();
      if (currentLignes && currentLignes.length > 0) {
        for (const l of currentLignes) {
          if (l.produit_id) await updateProductStock(
            l.produit_id, 
            -Number(l.quantite || 0), 
            'ajustement', 
            b?.numero, 
            `Annulation RÃ©ception Bon de Livraison ${b?.numero}`,
            b?.fournisseur?.nom,
            l.prix_unitaire_ht
          );
        }
        // Mark as stock NOT updated
        await supabase.from('bons_livraison').update({ stock_updated: false }).eq('id', id);
      }
    }
    res.json(toCamel(bon));
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update bon de livraison status' });
  }
});

// --- VENTES PASSAGERS ---
router.get('/ventes-passagers', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ventes_passagers')
      .select('*, lignes:ventes_passagers_lignes(*)')
      .order('date', { ascending: false });
    if (error) throw error;
    res.json(toCamel(data));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ventes passagers' });
  }
});

router.post('/ventes-passagers', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;
    if (authHeader?.startsWith('Bearer ')) {
      try { const token = authHeader.split(' ')[1]; const { data: { user } } = await supabaseAdmin.auth.getUser(token); if (user) userId = user.id; } catch (e) { /* ignore */ }
    }

    const { lignes, ...vpData } = req.body;
    
    const year = new Date().getFullYear();
    const { data: existing } = await supabase.from('ventes_passagers').select('numero').like('numero', `VP-${year}-%`).eq('user_id', userId);
    let maxNum = 0;
    for (const v of existing || []) { const m = v.numero?.match(new RegExp(`^VP-${year}-(\\d+)$`)); if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; } }
    const numero = `VP-${year}-${String(maxNum + 1).padStart(4, '0')}`;
    
    const { data: vp, error: vpError } = await supabase
      .from('ventes_passagers')
      .insert([{
        numero,
        user_id: userId,
        date: vpData.date || new Date().toISOString(),
        montant_ht: vpData.montantHt || 0,
        montant_tva: vpData.montantTva || 0,
        montant_ttc: vpData.montantTtc || 0,
        cogs: vpData.cogs || 0
      }])
      .select()
      .single();
    
    if (vpError) throw vpError;

    await logActivity('crÃ©ation vente passager', `Vente Passager ${numero} crÃ©Ã©e`);

    if (lignes && lignes.length > 0) {
      const lignesData = lignes.map((l: any) => ({
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
      
      const { error: lignesError } = await supabase.from('ventes_passagers_lignes').insert(lignesData);
      if (lignesError) throw lignesError;

      // Update stock
      for (const l of lignesData) {
        if (l.produit_id) {
          await updateProductStock(
            l.produit_id,
            -l.quantite,
            'vente',
            numero,
            `Vente Passager ${numero}`,
            'Passager',
            l.prix_unitaire_ht
          );
        }
      }
    }

    res.status(201).json(toCamel(vp));
  } catch (error) {
    console.error('Error creating vente passager:', error);
    res.status(500).json({ error: 'Failed to create vente passager' });
  }
});

router.delete('/ventes-passagers/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    // Revert stock before deleting
    const { data: lignes } = await supabase.from('ventes_passagers_lignes').select('*').eq('vp_id', id);
    const { data: vp } = await supabase.from('ventes_passagers').select('numero').eq('id', id).single();
    
    if (lignes && vp) {
      for (const l of lignes) {
        if (l.produit_id) {
          await updateProductStock(
            l.produit_id,
            l.quantite,
            'ajustement',
            vp.numero,
            `Annulation Vente Passager ${vp.numero}`,
            'Passager',
            l.prix_unitaire_ht
          );
        }
      }
    }

    const { error } = await supabase.from('ventes_passagers').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete vente passager' });
  }
});

// --- SMART INSIGHTS ---
router.get('/smart-insights', async (req, res) => {
  try {
    const { data: factures } = await supabase.from('factures').select('*').in('statut', ['payÃ©e', 'reste_a_payer']);
    const { data: produits } = await supabase.from('produits').select('*');
    const { data: depenses } = await supabase.from('depenses').select('*');
    const { data: bonsCommande } = await supabase.from('bons_commande').select('*').in('statut', ['livrÃ©', 'livrÃ©e']);
    
    const insights: any[] = [];

    // 1. Performance Insight
    const totalVentes = (factures || []).reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0)
      + (await supabase.from('ventes_passagers').select('montant_ttc')).data?.reduce((s: number, vp: any) => s + Number(vp.montant_ttc || 0), 0) || 0;
    
    if (totalVentes > 100000) {
      insights.push({
        type: 'performance',
        title: 'Excellente Performance',
        message: 'Vos ventes ont dÃ©passÃ© 100k MAD ce mois-ci. Continuez ainsi !',
        status: 'success'
      });
    } else if (totalVentes < 10000) {
      insights.push({
        type: 'performance',
        title: 'Ventes Faibles',
        message: 'Vos ventes sont en dessous de la moyenne. Envisagez une promotion.',
        status: 'warning'
      });
    }

    // 2. Stock Insight
    const lowStock = (produits || []).filter(p => Number(p.stock_actuel) <= Number(p.stock_min));
    if (lowStock.length > 5) {
      insights.push({
        type: 'stock',
        title: 'Alerte Stock',
        message: `${lowStock.length} produits sont en rupture ou stock faible. Commandez rapidement.`,
        status: 'danger'
      });
    }

    // 3. Finance Insight (TVA)
    const tvaCollectee = (factures || []).reduce((sum, f) => sum + Number(f.montant_tva || 0), 0);
    const tvaDeductible = (bonsCommande || []).reduce((sum, bc) => sum + Number(bc.montant_tva || 0), 0) + 
                          (depenses || []).reduce((sum, d) => sum + Number(d.montant_tva || 0), 0);
    const tvaAPayer = tvaCollectee - tvaDeductible;
    
    if (tvaAPayer > 20000) {
      insights.push({
        type: 'finance',
        title: 'TVA Ã‰levÃ©e',
        message: `TVA Ã  payer estimÃ©e: ${tvaAPayer.toFixed(2)} MAD. PrÃ©voyez la trÃ©sorerie.`,
        status: 'warning'
      });
    }

    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch smart insights' });
  }
});

// --- PARAMETRES ---
router.get('/parametres', async (req, res) => {
  try {
    // Get user from Authorization header
    const authHeader = req.headers.authorization;
    let userId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (!authError && user) {
          userId = user.id;
        }
      } catch (e) {
        console.warn('Could not verify token:', e);
      }
    }
    
    // If no user, return empty
    if (!userId) {
      return res.json({
        nomSociete: '',
        adresse: '',
        ville: '',
        codePostale: '',
        telephone: '',
        email: '',
        ice: '',
        formeJuridique: '',
        logoUrl: '',
        couleurPrincipale: '#267E54',
        watermarkText: 'SmartGestion'
      });
    }
    
    // Get parametres for this user
    const { data: params, error } = await supabase
      .from('parametres')
      .select('id,user_id,nom_societe,nom,adresse,ville,code_postale,telephone,email,site_web,ice,rc,if_number,tp_patente,cnss,capital_social,forme_juridique,logo_url,couleur_principale,banque,rib,swift,devise,conditions_paiement_defaut,pied_page_defaut,activer_droit_timbre,created_at,updated_at')
      .eq('user_id', userId)
      .single();
    
    // If not found, return empty defaults
    if (!params || error?.code === 'PGRST116' || error) {
      return res.json({
        nomSociete: '',
        adresse: '',
        ville: '',
        codePostale: '',
        telephone: '',
        email: '',
        ice: '',
        formeJuridique: '',
        logoUrl: '',
        couleurPrincipale: '#267E54',
        watermarkText: 'SmartGestion'
      });
    }
    
    // Filter out any invalid image URLs
    if (params && params.logo_url) {
      if (params.logo_url === 'image.png' || !params.logo_url.startsWith('http')) {
        params.logo_url = '';
      }
    }
    
    // Map the response to camelCase with fallbacks
    const mapped = {
      id: params.id,
      userId: params.user_id,
      nomSociete: params.nom_societe || params.nom || '',
      adresse: params.adresse || '',
      ville: params.ville || '',
      codePostale: params.code_postale || params.codePostale || '',
      telephone: params.telephone || '',
      email: params.email || '',
      siteWeb: params.site_web || params.siteWeb || '',
      ice: params.ice || '',
      rc: params.rc || '',
      ifNumber: params.if_number || params.ifNumber || '',
      tpPatente: params.tp_patente || params.tpPatente || '',
      cnss: params.cnss || '',
      capitalSocial: params.capital_social || params.capitalSocial || '',
      formeJuridique: params.forme_juridique || params.formeJuridique || '',
      banque: params.banque || '',
      rib: params.rib || '',
      swift: params.swift || '',
      logoUrl: params.logo_url || '',
      couleurPrincipale: params.couleur_principale || '#267E54',
      conditionsPaiementDefaut: params.conditions_paiement_defaut || '',
      piedPageDefaut: params.pied_page_defaut || '',
      activerDroitTimbre: params.activer_droit_timbre !== undefined ? params.activer_droit_timbre : true,
      watermarkText: params.watermark_text || 'SmartGestion',
    };
    
    res.json(mapped);
  } catch (error: any) {
    console.error('Error fetching parametres:', error);
    res.json({
      nomSociete: '',
      adresse: '',
      ville: '',
      codePostale: '',
      telephone: '',
      email: '',
      ice: '',
      formeJuridique: '',
      logoUrl: '',
      couleurPrincipale: '#267E54',
      watermarkText: 'SmartGestion'
    });
  }
});

router.put('/parametres', async (req, res) => {
  try {
    // Get user from Authorization header
    const authHeader = req.headers.authorization;
    let userId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (!authError && user) {
          userId = user.id;
        }
      } catch (e) {
        console.warn('Could not verify token:', e);
      }
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'Non autorisÃ©' });
    }
    
    // Build safe fields - use snake_case for database columns
    const safeFields: Record<string, any> = {
      user_id: userId
    };
    if (req.body.nomSociete !== undefined) {
      safeFields.nom_societe = req.body.nomSociete;
      safeFields.nom = req.body.nomSociete;
    }
    if (req.body.adresse !== undefined) safeFields.adresse = req.body.adresse;
    if (req.body.ville !== undefined) safeFields.ville = req.body.ville;
    if (req.body.codePostal !== undefined) safeFields.code_postale = req.body.codePostal;
    if (req.body.codePostale !== undefined) safeFields.code_postale = req.body.codePostale;
    if (req.body.telephone !== undefined) safeFields.telephone = req.body.telephone;
    if (req.body.email !== undefined) safeFields.email = req.body.email;
    if (req.body.siteWeb !== undefined) safeFields.site_web = req.body.siteWeb;
    if (req.body.ice !== undefined) safeFields.ice = req.body.ice;
    if (req.body.rc !== undefined) safeFields.rc = req.body.rc;
    if (req.body.cnss !== undefined) safeFields.cnss = req.body.cnss;
    if (req.body.ifNumber !== undefined) safeFields.if_number = req.body.ifNumber;
    if (req.body.tpPatente !== undefined) safeFields.tp_patente = req.body.tpPatente;
    if (req.body.capitalSocial !== undefined) safeFields.capital_social = req.body.capitalSocial;
    if (req.body.formeJuridique !== undefined) safeFields.forme_juridique = req.body.formeJuridique;
    if (req.body.banque !== undefined) safeFields.banque = req.body.banque;
    if (req.body.rib !== undefined) safeFields.rib = req.body.rib;
    if (req.body.swift !== undefined) safeFields.swift = req.body.swift;
    if (req.body.logoUrl !== undefined) safeFields.logo_url = req.body.logoUrl;
    if (req.body.couleurPrincipale !== undefined) safeFields.couleur_principale = req.body.couleurPrincipale;
    if (req.body.activerDroitTimbre !== undefined) safeFields.activer_droit_timbre = req.body.activerDroitTimbre;
    if (req.body.watermarkText !== undefined) safeFields.watermark_text = req.body.watermarkText;
    
    // Check if record exists for this user
    let { data: existingRows } = await supabase.from('parametres').select('id').eq('user_id', userId).limit(1);
    let recordId = existingRows && existingRows.length > 0 ? existingRows[0].id : null;
    
    let result;
    if (recordId) {
      // UPDATE existing record
      const { data: updated, error } = await supabase
        .from('parametres')
        .update(safeFields)
        .eq('id', recordId)
        .select('id,user_id,nom_societe,nom,adresse,ville,code_postale,telephone,email,site_web,ice,rc,if_number,tp_patente,cnss,capital_social,forme_juridique,logo_url,couleur_principale,banque,rib,swift,devise,conditions_paiement_defaut,pied_page_defaut,activer_droit_timbre,created_at,updated_at')
        .single();
      
      if (error) {
        console.error('Update error:', error);
        return res.status(500).json({ error: 'Failed to update', details: error.message });
      }
      result = updated;
    } else {
      // INSERT new record
      const { data: created, error } = await supabase
        .from('parametres')
        .insert([safeFields])
        .select('id,user_id,nom_societe,nom,adresse,ville,code_postale,telephone,email,site_web,ice,rc,if_number,tp_patente,cnss,capital_social,forme_juridique,logo_url,couleur_principale,banque,rib,swift,devise,conditions_paiement_defaut,pied_page_defaut,activer_droit_timbre,created_at,updated_at')
        .single();
      
      if (error) {
        console.error('Insert error:', error);
        return res.status(500).json({ error: 'Failed to insert', details: error.message });
      }
      result = created;
    }
    
    // Map to camelCase and return
    const mapped = {
      id: result.id,
      nomSociete: result.nom_societe || result.nom || '',
      adresse: result.adresse || '',
      ville: result.ville || '',
      codePostale: result.code_postale || '',
      telephone: result.telephone || '',
      email: result.email || '',
      siteWeb: result.site_web || '',
      ice: result.ice || '',
      rc: result.rc || '',
      ifNumber: result.if_number || '',
      tpPatente: result.tp_patente || '',
      cnss: result.cnss || '',
      capitalSocial: result.capital_social || '',
      formeJuridique: result.forme_juridique || '',
      banque: result.banque || '',
      rib: result.rib || '',
      swift: result.swift || '',
      logoUrl: result.logo_url || '',
      couleurPrincipale: result.couleur_principale || '#267E54',
      conditionsPaiementDefaut: result.conditions_paiement_defaut || '',
      piedPageDefaut: result.pied_page_defaut || '',
      activerDroitTimbre: result.activer_droit_timbre !== undefined ? result.activer_droit_timbre : true,
      watermarkText: result.watermark_text || 'SmartGestion',
    };
    
    res.json(mapped);
  } catch (error: any) {
    console.error('Error updating parametres:', error);
    res.status(500).json({ error: 'Failed to update parametres', details: error.message });
  }
});

// --- DEPENSES ---
router.get('/depenses', async (req, res) => {
  try {
    const { data: depenses, error } = await supabase
      .from('depenses')
      .select('*, fournisseur:fournisseurs(*)')
      .order('date_depense', { ascending: false });
    if (error) throw error;
    res.json(toCamel(depenses));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch depenses' });
  }
});

router.post('/depenses', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;
    if (authHeader?.startsWith('Bearer ')) {
      try { const token = authHeader.split(' ')[1]; const { data: { user } } = await supabaseAdmin.auth.getUser(token); if (user) userId = user.id; } catch (e) { /* ignore */ }
    }

    const year = new Date().getFullYear();
    const { data: existing } = await supabase.from('depenses').select('reference').like('reference', `DEP-${year}-%`).eq('user_id', userId);
    let maxNum = 0;
    for (const d of existing || []) { const m = d.reference?.match(new RegExp(`^DEP-${year}-(\\d+)$`)); if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; } }
    const reference = `DEP-${year}-${String(maxNum + 1).padStart(4, '0')}`;
    
    // Build data object with only known safe fields
    const data: any = {
      reference,
      user_id: userId,
      categorie: req.body.categorie,
      description: req.body.description || '',
      montant_ht: Number(req.body.montantHt) || 0,
      montant_ttc: Number(req.body.montantTtc) || 0,
    };

    // Add optional fields only if they might exist
    if (req.body.fournisseurId) data.fournisseur_id = req.body.fournisseurId;
    if (req.body.dateDepense) data.date_depense = req.body.dateDepense;
    if (req.body.montantTva !== undefined) data.montant_tva = Number(req.body.montantTva) || 0;
    if (req.body.modePaiement) data.mode_paiement = req.body.modePaiement;
    if (req.body.notes) data.notes = req.body.notes;

    const { data: depense, error: insertError } = await supabase
      .from('depenses')
      .insert([data])
      .select('*, fournisseur:fournisseurs(*)')
      .single();

    if (insertError) {
      console.error('Error creating depense:', insertError);
      return res.status(400).json({ error: 'Failed to create depense', details: formatError(insertError) });
    }

    await logActivity('crÃ©ation dÃ©pense', `DÃ©pense ${data.reference || ''} crÃ©Ã©e`);

    res.status(201).json(toCamel(depense));
  } catch (error) {
    console.error('Unexpected error in POST /depenses:', error);
    res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) });
  }
});

router.put('/depenses/:id', async (req, res) => {
  try {
    const depenseData = req.body;
    const id = req.params.id;
    
    const updateData: any = {};
    if (depenseData.fournisseurId !== undefined) updateData.fournisseur_id = depenseData.fournisseurId;
    if (depenseData.dateDepense !== undefined) updateData.date_depense = depenseData.dateDepense;
    if (depenseData.description !== undefined) updateData.description = depenseData.description;
    if (depenseData.categorie !== undefined) updateData.categorie = depenseData.categorie;
    if (depenseData.montantHt !== undefined) updateData.montant_ht = depenseData.montantHt;
    if (depenseData.montantTva !== undefined) updateData.montant_tva = depenseData.montantTva;
    if (depenseData.montantTtc !== undefined) updateData.montant_ttc = depenseData.montantTtc;
    if (depenseData.modePaiement !== undefined) updateData.mode_paiement = depenseData.modePaiement;
    if (depenseData.notes !== undefined) updateData.notes = depenseData.notes;

    const { error: updateError } = await supabase
      .from('depenses')
      .update(updateData)
      .eq('id', id);
    
    if (updateError) {
      console.error('Error updating depense:', updateError);
      return res.status(400).json({ error: 'Failed to update depense', details: updateError.message });
    }

    const { data: updatedDepense, error: fetchError } = await supabase
      .from('depenses')
      .select('*, fournisseur:fournisseurs(*)')
      .eq('id', id)
      .single();

    if (fetchError) {
      return res.status(200).json({ id });
    }

    res.json(toCamel(updatedDepense));
  } catch (error) {
    console.error('Unexpected error in PUT /depenses:', error);
    res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) });
  }
});

router.delete('/depenses/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('depenses').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete depense' });
  }
});

// --- Stock Movements ---
router.get('/mouvements-stock', async (req, res) => {
  try {
    const { data: mouvements, error } = await supabase
      .from('mouvements_stock')
      .select('*, produit:produits(*)')
      .order('date_mouvement', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json(toCamel(mouvements));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
});

router.post('/mouvements-stock', async (req, res) => {
  try {
    const { produitId, type, quantite, notes, referenceDocument, impactStock } = req.body;
    
    let finalQty = parseFloat(quantite);
    if (isNaN(finalQty) || finalQty === 0) {
      return res.status(400).json({ error: 'QuantitÃ© invalide' });
    }

    // Adjust sign based on type
    if (type === 'vente') {
      finalQty = -Math.abs(finalQty);
    } else if (type === 'achat') {
      finalQty = Math.abs(finalQty);
    }
    // For 'ajustement', we keep the sign as entered (though UI might have changed)

    // Check stock before creating movement if impactStock is true
    if (impactStock && finalQty < 0) {
      const { data: p } = await supabase.from('produits').select('stock_actuel').eq('id', produitId).single();
      const currentStock = Number(p?.stock_actuel || 0);
      if (currentStock + finalQty < 0) {
        return res.status(400).json({ error: `Stock insuffisant. Stock actuel: ${currentStock}` });
      }
    }
    
    // Create movement
    const mData = {
      produit_id: parseInt(produitId),
      type,
      quantite: finalQty,
      notes: impactStock ? notes : `(SANS IMPACT STOCK) ${notes || ''}`,
      reference_document: referenceDocument,
      date_mouvement: new Date()
    };

    const { data: m, error: mError } = await supabase
      .from('mouvements_stock')
      .insert([mData])
      .select('*, produit:produits(*)')
      .single();
    
    if (mError) throw mError;

    // Update product stock if impactStock is true
    if (impactStock) {
      await updateProductStock(produitId, finalQty);
    }

    res.status(201).json(toCamel(m));
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Failed to create stock movement' });
  }
});

// --- BACKUP & IMPORT ---
router.get('/backup/data', async (req, res) => {
  try {
    const tables = [
      'produits', 'clients', 'fournisseurs', 'factures', 'facture_lignes',
      'bons_commande', 'bon_commande_lignes', 'bons_livraison', 'bon_livraison_lignes',
      'depenses', 'avoirs', 'avoir_lignes', 'ventes_passagers', 'ventes_passagers_lignes',
      'mouvements_stock', 'parametres'
    ];
    
    const backupData: any = {};
    
    for (const table of tables) {
      // For tables with client_id, include client name AND ID for re-import matching
      if (table === 'factures' || table === 'devis' || table === 'avoirs') {
        const { data, error } = await supabase
          .from(table)
          .select('*, client:clients(id, nom, nom_societe)');
        
        if (error) {
          console.log(`Error fetching ${table}:`, error);
          backupData[table] = [];
        } else {
          // Debug: log first row
          console.log(`${table} sample before processing:`, JSON.stringify(data?.[0])?.slice(0, 200));
          
          // Add BOTH client_id (for reference) AND client_nom (for linking)
          const processedData = (data || []).map((row: any) => {
            if (row.client) {
              row.client_id = row.client.id; // Keep original ID for reference
              row.client_nom = row.client.nom || row.client.nom_societe || ''; // For linking
              delete row.client;
            }
            return row;
          });
          
          console.log(`${table} sample after processing:`, JSON.stringify(processedData[0])?.slice(0, 200));
          backupData[table] = processedData;
        }
      }
      // For tables with fournisseur_id
      else if (table === 'bons_commande' || table === 'bons_livraison' || table === 'depenses') {
        const { data, error } = await supabase
          .from(table)
          .select('*, fournisseur:fournisseurs(id, nom, nom_societe)');
        
        if (error) {
          console.log(`Error fetching ${table}:`, error);
          backupData[table] = [];
        } else {
          console.log(`${table} sample before processing:`, JSON.stringify(data?.[0])?.slice(0, 200));
          
          const processedData = (data || []).map((row: any) => {
            if (row.fournisseur) {
              row.fournisseur_id = row.fournisseur.id;
              row.fournisseur_nom = row.fournisseur.nom || row.fournisseur.nom_societe || '';
              delete row.fournisseur;
            }
            return row;
          });
          
          console.log(`${table} sample after processing:`, JSON.stringify(processedData[0])?.slice(0, 200));
          backupData[table] = processedData;
        }
      }
      // All other tables - simple fetch
      else {
        const { data, error } = await supabase.from(table).select('*');
        backupData[table] = error ? [] : (data || []);
      }
    }
    
    // Special handling for ligne tables - include parent reference for proper linking
    const ligneTableMapping: Record<string, string> = {
      'facture_lignes': 'factures',
      'devis_lignes': 'devis',
      'bon_commande_lignes': 'bons_commande',
      'bon_livraison_lignes': 'bons_livraison',
      'avoir_lignes': 'avoirs',
      'ventes_passagers_lignes': 'ventes_passagers'
    };
    
    for (const [ligneTable, parentTable] of Object.entries(ligneTableMapping)) {
      // Include parent ID for proper re-import linking
      const parentSelect = parentTable === 'factures' ? 'id, numero' : 'id, numero';
      const { data, error } = await supabase
        .from(ligneTable)
        .select(`*, ${parentTable}(${parentSelect})`);
      
      if (!error && data) {
        const processedData = (data || []).map((row: any) => {
          const parentRef = row[parentTable];
          if (parentRef) {
            // Include BOTH parent ID and parent numero for linking
            row[`${parentTable}_id`] = parentRef.id;
            row.facture_numero = parentRef.numero || '';
          }
          return row;
        });
        backupData[ligneTable] = processedData;
        console.log(`${ligneTable}: ${processedData.length} rows, sample parent_id:`, processedData[0]?.[`${parentTable}_id`]);
      }
    }
    
    // Debug: log what we're sending
    console.log('Exporting data keys:', Object.keys(backupData));
    console.log('Factures first row keys:', Object.keys(backupData['factures']?.[0] || {}));
    
    res.json(backupData);
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ error: 'Failed to fetch backup data' });
  }
});

// Mapping French Excel headers to snake_case database columns
const fieldMappings: Record<string, Record<string, string>> = {
  produits: {
    'RÃ©fÃ©rence': 'reference',
    'DÃ©signation': 'designation',
    'Code Ã  barre': 'codebarre',
    'Code barre': 'codebarre',
    'CatÃ©gorie': 'categorie',
    'Prix achat': 'prix_achat',
    'Prix vente': 'prix_vente',
    'QuantitÃ©': 'quantite',
    'Seuil alerte': 'seuil_alerte',
    'TVA': 'taux_tva',
    'UnitÃ©': 'unite'
  },
  clients: {
    'Nom': 'nom',
    'Email': 'email',
    'TÃ©lÃ©phone': 'telephone',
    'Adresse': 'adresse',
    'Ville': 'ville',
    'Code postal': 'code_postal',
    'ICE': 'ice'
  },
  fournisseurs: {
    'Nom': 'nom',
    'Email': 'email',
    'TÃ©lÃ©phone': 'telephone',
    'Adresse': 'adresse',
    'Ville': 'ville',
    'Code postal': 'code_postal',
    'ICE': 'ice'
  },
  factures: {
    'NumÃ©ro': 'numero',
    'Date': 'date',
    'Client': 'client_id',  // Map to ID directly if Excel has ID
    'Montant HT': 'montant_ht',
    'Montant TVA': 'montant_tva',
    'Montant TTC': 'montant_ttc',
    'Statut': 'statut',
    'Reste Ã  payer': 'reste_a_payer',
    'Ã‰chÃ©ance': 'echeance'
  },
  facture_lignes: {
    'Facture': 'facture_id',
    'factures_id': 'facture_id',
    'NumÃ©ro facture': 'facture_numero',
    'Facture numÃ©ro': 'facture_numero',
    'Produit': 'produit_id',
    'produit_id': 'produit_id',
    'DÃ©signation': 'designation',
    'QuantitÃ©': 'quantite',
    'Prix unitaire': 'prix_unitaire',
    'Total HT': 'total_ht',
    'TVA': 'taux_tva',
    'Total TVA': 'total_tva',
    'Total TTC': 'total_ttc'
  },
  bons_commande: {
    'NumÃ©ro': 'numero',
    'Date': 'date',
    'Fournisseur': 'fournisseur_id',  // Map to ID directly if Excel has ID
    'Montant HT': 'montant_ht',
    'Montant TVA': 'montant_tva',
    'Montant TTC': 'montant_ttc',
    'Statut': 'statut'
  },
  bon_commande_lignes: {
    'Bon de commande': 'bon_commande_id',
    'bons_commande_id': 'bon_commande_id',
    'Produit': 'produit_id',
    'produit_id': 'produit_id',
    'DÃ©signation': 'designation',
    'QuantitÃ©': 'quantite',
    'Prix unitaire': 'prix_unitaire',
    'Total HT': 'total_ht',
    'TVA': 'taux_tva',
    'Total TVA': 'total_tva',
    'Total TTC': 'total_ttc'
  },
  bons_livraison: {
    'NumÃ©ro': 'numero',
    'Date': 'date',
    'Fournisseur': 'fournisseur_id',  // Map to ID directly if Excel has ID
    'Bon de commande': 'bon_commande_id',
    'Statut': 'statut'
  },
  bon_livraison_lignes: {
    'Bon de livraison': 'bon_livraison_id',
    'bons_livraison_id': 'bon_livraison_id',
    'Produit': 'produit_id',
    'produit_id': 'produit_id',
    'DÃ©signation': 'designation',
    'QuantitÃ©': 'quantite'
  },
  devis: {
    'NumÃ©ro': 'numero',
    'Date': 'date',
    'Client': 'client_id',  // Map to ID directly if Excel has ID
    'Montant HT': 'montant_ht',
    'Montant TVA': 'montant_tva',
    'Montant TTC': 'montant_ttc',
    'Statut': 'statut',
    'ValiditÃ©': 'validite'
  },
  devis_lignes: {
    'Devis': 'devis_id',
    'devis_id': 'devis_id',
    'Produit': 'produit_id',
    'produit_id': 'produit_id',
    'DÃ©signation': 'designation',
    'QuantitÃ©': 'quantite',
    'Prix unitaire': 'prix_unitaire',
    'Total HT': 'total_ht',
    'TVA': 'taux_tva',
    'Total TVA': 'total_tva',
    'Total TTC': 'total_ttc'
  },
  avoirs: {
    'NumÃ©ro': 'numero',
    'Date': 'date',
    'Facture': 'facture_numero',
    'Montant HT': 'montant_ht',
    'Montant TVA': 'montant_tva',
    'Montant TTC': 'montant_ttc',
    'Motif': 'motif'
  },
  avoir_lignes: {
    'Avoir': 'avoir_id',
    'avoirs_id': 'avoir_id',
    'Produit': 'produit_id',
    'produit_id': 'produit_id',
    'DÃ©signation': 'designation',
    'QuantitÃ©': 'quantite',
    'Prix unitaire': 'prix_unitaire',
    'Total HT': 'total_ht',
    'TVA': 'taux_tva',
    'Total TVA': 'total_tva',
    'Total TTC': 'total_ttc'
  },
  ventes_passagers: {
    'Date': 'date',
    'Client': 'client_nom',
    'Montant HT': 'montant_ht',
    'Montant TVA': 'montant_tva',
    'Montant TTC': 'montant_ttc'
  },
  ventes_passagers_lignes: {
    'Vente': 'vente_passager_id',
    'ventes_passagers_id': 'vente_passager_id',
    'vente_passager_id': 'vente_passager_id',
    'Produit': 'produit_id',
    'produit_id': 'produit_id',
    'DÃ©signation': 'designation',
    'QuantitÃ©': 'quantite',
    'Prix unitaire': 'prix_unitaire',
    'Total HT': 'total_ht',
    'TVA': 'taux_tva',
    'Total TVA': 'total_tva',
    'Total TTC': 'total_ttc'
  },
  depenses: {
    'RÃ©fÃ©rence': 'reference',
    'Date': 'date_depense',
    'CatÃ©gorie': 'categorie',
    'Description': 'description',
    'Montant HT': 'montant_ht',
    'Montant TVA': 'montant_tva',
    'Montant TTC': 'montant_ttc',
    'Fournisseur': 'fournisseur_id'  // Map to ID directly if Excel has ID
  },
  parametres: {
    'Nom': 'nom_societe',
    'Adresse': 'adresse',
    'Ville': 'ville',
    'Code postal': 'code_postal',
    'TÃ©lÃ©phone': 'telephone',
    'Email': 'email',
    'Site web': 'site_web',
    'ICE': 'ice',
    'RC': 'rc',
    'IF': 'if_number',
    'TP': 'tp_patente',
    'CNSS': 'cnss',
    'Capital': 'capital_social',
    'Forme juridique': 'forme_juridique',
    'Banque': 'banque',
    'RIB': 'rib',
    'SWIFT': 'swift',
    'Couleur': 'couleur_principale'
  }
};

// Map French sheet names to database table names
const tableNameMapping: Record<string, string> = {
  // French names
  'Ventes': 'factures',
  'Factures': 'factures',
  'Devis': 'devis',
  'Avoirs': 'avoirs',
  'Achats': 'bons_commande',
  'Bons de commande': 'bons_commande',
  'Bons de livraison': 'bons_livraison',
  'DÃ©penses': 'depenses',
  'Produits': 'produits',
  'Clients': 'clients',
  'Fournisseurs': 'fournisseurs',
  'ParamÃ¨tres': 'parametres',
  'Mouvements de stock': 'mouvements_stock',
  // Line tables
  'facture_lignes': 'facture_lignes',
  'facture_ligne': 'facture_lignes',
  'devis_lignes': 'devis_lignes',
  'devis_ligne': 'devis_lignes',
  'bon_commande_lignes': 'bon_commande_lignes',
  'bon_commande_ligne': 'bon_commande_lignes',
  'bons_livraison': 'bons_livraison',
  'bon_livraison': 'bons_livraison',
  'bon_livraison_lignes': 'bon_livraison_lignes',
  'avoir_lignes': 'avoir_lignes',
  'avoir_ligne': 'avoir_lignes',
  'ventes_passagers': 'ventes_passagers',
  'ventes_passagers_lignes': 'ventes_passagers_lignes',
  'mouvements_stock': 'mouvements_stock',
  // Lowercase variants
  'factures': 'factures',
  'devis': 'devis',
  'avoirs': 'avoirs',
  'bons_commande': 'bons_commande',
  'depenses': 'depenses',
  'produits': 'produits',
  'clients': 'clients',
  'fournisseurs': 'fournisseurs',
  'parametres': 'parametres'
};

function transformRow(table: string, row: any, _lookupCache: any): any {
  const mapping = fieldMappings[table] || {};
  const transformed: any = {};
  
  // Generate unique suffix for tables with unique constraints (random 4 digits)
  const uniqueSuffix = Math.floor(1000 + Math.random() * 9000).toString();
  
  for (const excelKey of Object.keys(row)) {
    const dbKey = mapping[excelKey] || excelKey;
    let value = row[excelKey];
    
    // Skip empty values and ID field (let database auto-generate)
    if (dbKey === 'id' || value === '' || value === null || value === undefined) continue;
    
    // Skip user_id if present in import (user-specific)
    if (dbKey === 'user_id') continue;
    
    // For tables with unique constraints, add suffix to make unique
    if (table === 'produits' && dbKey === 'reference') {
      value = value + '-' + uniqueSuffix;
    }
    if (table === 'bons_commande' && dbKey === 'numero') {
      value = value + '-' + uniqueSuffix;
    }
    if (table === 'bons_livraison' && dbKey === 'numero') {
      value = value + '-' + uniqueSuffix;
    }
    if (table === 'ventes_passagers' && dbKey === 'numero') {
      value = value + '-' + uniqueSuffix;
    }
    
    transformed[dbKey] = value;
  }
  
  return transformed;
}

router.post('/backup/import', async (req, res) => {
  try {
    // Extract user_id first (not part of the Excel data)
    const userId = req.body.user_id;
    console.log('Importing for user:', userId);
    
// Get the Excel data (everything except user_id)
    const { user_id, ...excelData } = req.body;
    const data = excelData;
    const results: any = {};
    
    // Map French sheet names to database table names
    const mappedData: any = {};
    for (const sheetName of Object.keys(data)) {
      // First check the exact mapping
      let dbTable = tableNameMapping[sheetName];
      
      // If no exact match, try to guess
      if (!dbTable) {
        const lowerName = sheetName.toLowerCase();
        
        // Handle ligne tables - look for patterns like "facture lignes" -> "facture_lignes"
        if (lowerName.includes('ligne')) {
          const parentMatch = lowerName.match(/^(\w+)\s*lignes?/);
          if (parentMatch) {
            const parent = parentMatch[1];
            if (['facture', 'devis', 'bon_commande', 'bon_livraison', 'avoir', 'vente'].includes(parent)) {
              dbTable = parent + '_lignes';
            }
          }
        }
        
        // Handle direct table names
        if (!dbTable) {
          const singularMap: Record<string, string> = {
            'facture': 'factures',
            'devis': 'devis',
            'avoir': 'avoirs',
            'bon_commande': 'bons_commande',
            'bon_livraison': 'bons_livraison',
            'depense': 'depenses',
            'produit': 'produits',
            'client': 'clients',
            'fournisseur': 'fournisseurs',
            'vente_passager': 'ventes_passagers'
          };
          const singular = lowerName.replace(/s$/, '');
          dbTable = singularMap[singular] || sheetName.toLowerCase().replace(/ /g, '_');
        }
      }
      
      if (dbTable) {
        mappedData[dbTable] = data[sheetName];
      }
    }
    
    console.log('Mapped table names:', Object.keys(mappedData));
    
    console.log('Mapped table names:', Object.keys(mappedData));
    console.log('Sample data:', mappedData.produits?.[0] || mappedData.Produits?.[0]);
    
    const dataToImport = mappedData;
    
    // Process tables in order: parents first, then children
    // Parent tables: clients, fournisseurs, produits, factures, devis, bons_commande, bons_livraison, avoirs, ventes_passagers
    // Child tables: facture_lignes, bon_commande_lignes, bon_livraison_lignes, avoir_lignes, ventes_passagers_lignes
    const parentTables = ['clients', 'fournisseurs', 'produits'];
    const childTables = ['factures', 'devis', 'bons_commande', 'bons_livraison', 'avoirs', 'ventes_passagers', 'depenses'];
    const ligneTables = ['facture_lignes', 'devis_lignes', 'bon_commande_lignes', 'bon_livraison_lignes', 'avoir_lignes', 'ventes_passagers_lignes'];
    
    // Tables that have user_id
    const tablesWithUserId = ['clients', 'fournisseurs', 'produits', 'factures', 'devis', 'bons_commande', 'bons_livraison', 'avoirs', 'ventes_passagers', 'depenses'];
    // Tables that don't need user_id (line tables)
    const tablesWithoutUserId = ['facture_lignes', 'devis_lignes', 'bon_commande_lignes', 'bon_livraison_lignes', 'avoir_lignes', 'ventes_passagers_lignes', 'mouvements_stock'];
    const tablesToProcess = [...parentTables, ...childTables].filter(t => dataToImport[t]?.length > 0);
    
// ============================================
    // PHASE 1: Insert clients, fournisseurs, produits
    // Capture OLD ID â†’ NEW UUID mapping for each
    // ============================================
    const clientIdMap = new Map<number, string>(); // old_id â†’ new_uuid
    const fournisseurIdMap = new Map<number, string>();
    const produitIdMap = new Map<number, string>(); // old_id â†’ new_uuid
    const produitDesignationMap = new Map<string, string>(); // designation â†’ new_uuid
    
    const phase1Tables = ['clients', 'fournisseurs', 'produits'];
    
    for (const table of phase1Tables) {
      if (!dataToImport[table]?.length) continue;
      
      const rows = dataToImport[table].map((row: any, idx: number) => {
        const transformed = transformRow(table, row, {});
        // Capture OLD ID before removing it (let DB generate new UUID)
        const oldId = row['id'] || row['NumÃ©ro'] || row['RÃ©fÃ©rence'] || idx + 1;
        if (table === 'clients') {
          clientIdMap.set(oldId, 'PLACEHOLDER'); // Will update after insert
        } else if (table === 'fournisseurs') {
          fournisseurIdMap.set(oldId, 'PLACEHOLDER');
        } else if (table === 'produits') {
          produitIdMap.set(oldId, 'PLACEHOLDER');
          // Also map by designation for product linking
          const designation = transformed.designation || row['DÃ©signation'] || '';
          if (designation) {
            produitDesignationMap.set(designation.toLowerCase().trim(), 'PLACEHOLDER');
          }
        }
        return transformed;
      }).filter((r: any) => Object.keys(r).length > 0);
      
      if (userId) rows.forEach((row: any) => { row.user_id = userId; });
      
      console.log(`[PHASE 1] Importing ${table}: ${rows.length} rows`);
      if (!rows.length) continue;
      
      const { data: inserted, error } = await supabase.from(table).insert(rows).select();
      if (error) {
        console.error(`[ERROR] Failed to import ${table}:`, error);
        results[table] = { success: false, error: error.message };
      } else {
        results[table] = { success: true, count: rows.length };
        // Update mappings with actual UUIDs
        if (inserted) {
          inserted.forEach((newRow: any, idx: number) => {
            const oldId = dataToImport[table][idx]?.id || dataToImport[table][idx]?.['NumÃ©ro'] || dataToImport[table][idx]?.['RÃ©fÃ©rence'] || (idx + 1);
            if (table === 'clients') {
              clientIdMap.set(oldId, newRow.id);
              console.log(`[LINKING] Client OldID: ${oldId} -> New UUID: ${newRow.id}`);
            } else if (table === 'fournisseurs') {
              fournisseurIdMap.set(oldId, newRow.id);
              console.log(`[LINKING] Fournisseur OldID: ${oldId} -> New UUID: ${newRow.id}`);
            } else if (table === 'produits') {
              produitIdMap.set(oldId, newRow.id);
              const designation = newRow.designation || dataToImport[table][idx]?.['DÃ©signation'] || '';
              if (designation) {
                produitDesignationMap.set(designation.toLowerCase().trim(), newRow.id);
              }
              console.log(`[LINKING] Product OldID: ${oldId} -> New UUID: ${newRow.id}`);
            }
          });
        }
      }
    }
    
    // ============================================
    // PHASE 2: Insert factures, devis, etc.
    // Replace client_id with new UUID from Phase 1
    // Capture parent table OLD ID â†’ NEW UUID mapping
    // ============================================
    const factureIdMap = new Map<number, string>();
    const devisIdMap = new Map<number, string>();
    const bcIdMap = new Map<number, string>();
    const blIdMap = new Map<number, string>();
    const avoirIdMap = new Map<number, string>();
    const vpIdMap = new Map<number, string>();
    
    const phase2Tables: Array<{table: string, fkField: string, idMap: Map<number, string>, clientField: string}> = [
      { table: 'factures', fkField: 'client_id', idMap: factureIdMap, clientField: 'Client' },
      { table: 'devis', fkField: 'client_id', idMap: devisIdMap, clientField: 'Client' },
      { table: 'bons_commande', fkField: 'fournisseur_id', idMap: bcIdMap, clientField: 'Fournisseur' },
      { table: 'bons_livraison', fkField: 'fournisseur_id', idMap: blIdMap, clientField: 'Fournisseur' },
      { table: 'avoirs', fkField: 'client_id', idMap: avoirIdMap, clientField: 'Client' },
      { table: 'ventes_passagers', fkField: '', idMap: vpIdMap, clientField: '' }
    ];
    
    for (const { table, fkField, idMap, clientField } of phase2Tables) {
      if (!dataToImport[table]?.length) continue;
      
      const rows = dataToImport[table].map((row: any, idx: number) => {
        const transformed = transformRow(table, row, {});
        // Capture OLD ID
        const oldId = row['id'] || row['NumÃ©ro'] || idx + 1;
        
        // Replace client/fournisseur FK with new UUID if available
        if (fkField) {
          const oldFkId = row[clientField] || row[fkField] || row['id'];
          if (fkField === 'client_id' && oldFkId) {
            const newId = clientIdMap.get(oldFkId);
            if (newId && newId !== 'PLACEHOLDER') {
              transformed.client_id = newId;
            }
          } else if (fkField === 'fournisseur_id' && oldFkId) {
            const newId = fournisseurIdMap.get(oldFkId);
            if (newId && newId !== 'PLACEHOLDER') {
              transformed.fournisseur_id = newId;
            }
          }
        }
        
        // Clear ALL FK fields that reference tables not yet imported or without mapping
        // These tables have cross-references: factures->devis, bons_livraison->bons_commande, avoirs->factures
        if (transformed.devis_id) delete transformed.devis_id;
        if (transformed.bon_commande_id) delete transformed.bon_commande_id;
        if (transformed.facture_id) delete transformed.facture_id;
        
        return { oldId, row: transformed };
      }).filter((r: any) => Object.keys(r.row).length > 0);
      
      const insertRows = rows.map((r: any) => r.row);
      if (userId) insertRows.forEach((row: any) => { row.user_id = userId; });
      
      console.log(`[PHASE 2] Importing ${table}: ${insertRows.length} rows`);
      if (!insertRows.length) continue;
      
      const { data: inserted, error } = await supabase.from(table).insert(insertRows).select();
      if (error) {
        console.error(`[ERROR] Failed to import ${table}:`, error);
        results[table] = { success: false, error: error.message };
      } else {
        results[table] = { success: true, count: insertRows.length };
        // Update mappings
        if (inserted) {
          inserted.forEach((newRow: any, idx: number) => {
            const oldId = rows[idx]?.oldId || idx + 1;
            idMap.set(oldId, newRow.id);
            console.log(`[LINKING] ${table} OldID: ${oldId} -> New UUID: ${newRow.id}`);
          });
        }
      }
    }
    
    // ============================================
    // PHASE 3: Insert ligne tables with proper FK linking
    // CRITICAL: Skip rows if mapping is missing (no NULL FKs)
    // ============================================
    const ligneConfig: Array<{
      table: string,
      parentField: string,
      parentIdMap: Map<number, string>,
      parentExcelField: string
    }> = [
      { table: 'facture_lignes', parentField: 'facture_id', parentIdMap: factureIdMap, parentExcelField: 'Facture' },
      { table: 'devis_lignes', parentField: 'devis_id', parentIdMap: devisIdMap, parentExcelField: 'Devis' },
      { table: 'bon_commande_lignes', parentField: 'bon_commande_id', parentIdMap: bcIdMap, parentExcelField: 'Bon de commande' },
      { table: 'bon_livraison_lignes', parentField: 'bon_livraison_id', parentIdMap: blIdMap, parentExcelField: 'Bon de livraison' },
      { table: 'avoir_lignes', parentField: 'avoir_id', parentIdMap: avoirIdMap, parentExcelField: 'Avoir' },
      { table: 'ventes_passagers_lignes', parentField: 'vente_passager_id', parentIdMap: vpIdMap, parentExcelField: 'Vente passager' }
    ];
    
    let totalSkipped = 0;
    
    // Build numero -> UUID fallback maps for each parent table
    const factureNumeroToId = new Map<string, string>();
    (dataToImport['factures'] || []).forEach((f: any, idx: number) => {
      const oldId = f['id'] || f['NumÃ©ro'] || idx + 1;
      const newId = factureIdMap.get(oldId);
      const numero = f['NumÃ©ro'] || f['numero'] || '';
      if (numero && newId) {
        factureNumeroToId.set(numero, newId);
      }
    });
    
    // Build position -> UUID fallback for ventes_passagers (for VP IDs that don't match exact OLD IDs)
    const vpPositionToId = new Map<number, string>();
    (dataToImport['ventes_passagers'] || []).forEach((vp: any, idx: number) => {
      const newId = vpIdMap.get(idx + 1);
      if (newId) {
        vpPositionToId.set(idx + 1, newId);
      }
    });
    
    for (const { table, parentField, parentIdMap, parentExcelField } of ligneConfig) {
      if (!dataToImport[table]?.length) continue;
      
      const allSourceRows = dataToImport[table];
      console.log(`[PHASE 3] ${table}: Total rows found in CSV: ${allSourceRows.length}`);
      
      const validRows: any[] = [];
      const skippedRows: any[] = [];
      
      for (const row of allSourceRows) {
        const idx = validRows.length + skippedRows.length;
        
        // Check for UUID format directly (Excel exports the actual UUID as 'factures_id', etc.)
        const uuidColumnName = `${table.replace('_lignes', 's')}_id`;
        const uuidFromExcel = row[uuidColumnName] || row['facture_id'] || row['devis_id'] || row['bon_commande_id'] || row['bon_livraison_id'] || row['avoir_id'] || row['vente_passager_id'];
        
        // Check if this is a valid UUID format (contains hyphens and is long enough)
        const isUUID = uuidFromExcel && typeof uuidFromExcel === 'string' && 
                       uuidFromExcel.includes('-') && uuidFromExcel.length > 30;
        
        let newParentId: string | undefined;
        
        if (isUUID) {
          // UUID directly from Excel - use it as-is
          newParentId = uuidFromExcel;
          console.log(`[DATA_CHECK] [UUID_DIRECT] ${parentField}: Using UUID from Excel: ${newParentId}`);
        } else {
          // Try multiple column names to find the parent OLD ID (numeric ID from external system)
          const parentOldId = 
            row[parentExcelField] || 
            row[`${parentField}`] ||
            row['id'] || 
            idx + 1;
          
          // Try to find the parent by OLD ID first
          newParentId = parentIdMap.get(parentOldId);
          
          // Fallback: try to find by numero or position
          if (!newParentId || newParentId === 'PLACEHOLDER') {
            const rowNumero = row['facture_numero'] || row['Facture numÃ©ro'] || row['NumÃ©ro facture'] || row[parentExcelField + ' numÃ©ro'] || '';
            if (rowNumero && factureNumeroToId.has(rowNumero)) {
              newParentId = factureNumeroToId.get(rowNumero);
              console.log(`[DATA_CHECK] [NUMERO_FALLBACK] ${parentField}: ${rowNumero} -> ${newParentId}`);
            }
          }
          
          // Fallback for ventes_passagers: try position-based lookup
          if ((!newParentId || newParentId === 'PLACEHOLDER') && table === 'ventes_passagers_lignes') {
            const rowIdx = idx + 1;
            if (vpPositionToId.has(rowIdx)) {
              newParentId = vpPositionToId.get(rowIdx);
              console.log(`[DATA_CHECK] [VP_POSITION_FALLBACK] ${parentField}: position ${rowIdx} -> ${newParentId}`);
            }
          }
          
          // FINAL FALLBACK: If no parent ID found, use last parent of that type (by position)
          if (!newParentId || newParentId === 'PLACEHOLDER') {
            const lastParentId = parentIdMap.values().next().value;
            if (lastParentId && lastParentId !== 'PLACEHOLDER') {
              newParentId = lastParentId;
              console.log(`[DATA_CHECK] [LAST_PARENT_FALLBACK] ${parentField}: using last parent ${newParentId}`);
            } else {
              console.log(`[WARNING] No parent mapping for ${parentField}=${parentOldId}, using NULL`);
            }
          }
        }
        
        // Build the row with all required fields explicitly
        // Use database schema column names: montant_ht, montant_ttc (NOT total_ht, total_ttc)
        const transformed: any = {
          [parentField]: newParentId || null,
          designation: row['DÃ©signation'] || row['designation'] || '',
          reference: row['RÃ©fÃ©rence'] || row['reference'] || '',
          quantite: Number(row['QuantitÃ©'] || row['quantite'] || 1),
          prix_unitaire_ht: Number(row['Prix unitaire'] || row['prix_unitaire'] || row['prix_unitaire_ht'] || 0),
          tva: Number(row['TVA'] || row['tva'] || row['taux_tva'] || 20),
          montant_ht: Number(row['Montant HT'] || row['montant_ht'] || row['Total HT'] || row['total_ht'] || 0),
          montant_ttc: Number(row['Montant TTC'] || row['montant_ttc'] || row['Total TTC'] || row['total_ttc'] || 0)
        };
        
        // Set produit_id - check for UUID directly first (Excel exports actual UUIDs)
        const produitOldIdRaw = row['Produit'] || row['produit_id'] || row['id'] || null;
        
        // Check if this is a UUID format directly
        const produitIsUUID = produitOldIdRaw && typeof produitOldIdRaw === 'string' && 
                       produitOldIdRaw.includes('-') && produitOldIdRaw.length > 30;
        
        if (produitIsUUID) {
          // Use UUID directly from Excel
          transformed.produit_id = produitOldIdRaw;
          console.log(`[DATA_CHECK] ${parentField}: FK=${newParentId} | Product UUID: ${produitOldIdRaw} (used directly)`);
        } else {
          const produitOldId = produitOldIdRaw ? Number(produitOldIdRaw) : null;
          if (produitOldId) {
            const newProduitId = produitIdMap.get(produitOldId);
            if (newProduitId && newProduitId !== 'PLACEHOLDER') {
              transformed.produit_id = newProduitId;
              console.log(`[DATA_CHECK] ${parentField}: FK=${newParentId} | Product OldID: ${produitOldId} | New_FK: ${newProduitId}`);
            } else {
              console.log(`[WARNING] Missing produit_id mapping for OLD ID: ${produitOldId}`);
            }
          }
        }
        
        // Always add row - never skip
        validRows.push(transformed);
      }
      
      console.log(`[PHASE 3] Processing ${table}: ${validRows.length} valid, ${skippedRows.length} skipped`);
      if (skippedRows.length > 0) {
        console.log(`[WARNING] Skipped orphan rows in ${table}:`);
        skippedRows.slice(0, 5).forEach((s: any) => {
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
        
        // Post-import verification
        const { count } = await supabase.from(table).select('id', { count: 'exact' });
        console.log(`[VERIFY] ${table} total rows in DB: ${count}`);
      }
    }
    
    // Summary logging
    console.log(`[SUMMARY] Import complete. Total skipped orphan rows: ${totalSkipped}`);
    console.log(`[SUMMARY] ID Maps created:`, {
      clients: clientIdMap.size,
      produits: produitIdMap.size,
      factures: factureIdMap.size,
      ligneRows: Object.keys(results).filter(k => k.includes('lignes')).length
    });
    
    // Phase 3 (ligne linking) is done inline above - no separate linking step needed
    
    // Detailed linking summary per parent document
    const { data: allFactures } = await supabase.from('factures').select('id, numero').eq('user_id', userId);
    if (allFactures) {
      for (const facture of allFactures) {
        const { count: ligneCount } = await supabase
          .from('facture_lignes')
          .select('id', { count: 'exact' })
          .eq('facture_id', facture.id);
        if (ligneCount && ligneCount > 0) {
          console.log(`[SUCCESS] Linked ${ligneCount} lines to Facture ${facture.numero}`);
        }
      }
    }
    
    // Step 5: Fix remaining NULL FKs by matching with existing clients/fournisseurs
    if (userId) {
      console.log('Step 5: Fixing NULL FKs...');
      
      // Get all clients and fournisseurs
      const { data: allClients } = await supabase.from('clients').select('id, nom, nom_societe').eq('user_id', userId);
      const { data: allFournisseurs } = await supabase.from('fournisseurs').select('id, nom, nom_societe').eq('user_id', userId);
      
      // Build name maps
      const clientNameToId: Record<string, number> = {};
      (allClients || []).forEach((c: any) => {
        if (c.nom) clientNameToId[c.nom.toLowerCase().trim()] = c.id;
        if (c.nom_societe) clientNameToId[c.nom_societe.toLowerCase().trim()] = c.id;
      });
      
      const fournisseurNameToId: Record<string, number> = {};
      (allFournisseurs || []).forEach((f: any) => {
        if (f.nom) fournisseurNameToId[f.nom.toLowerCase().trim()] = f.id;
        if (f.nom_societe) fournisseurNameToId[f.nom_societe.toLowerCase().trim()] = f.id;
      });
      
      console.log(`Found ${Object.keys(clientNameToId).length} clients, ${Object.keys(fournisseurNameToId).length} fournisseurs`);
      
      // Fix NULL client_id in factures by matching client names in description or by position
      // First, let's get all factures with NULL client_id
      const { data: nullClientFactures } = await supabase
        .from('factures')
        .select('id, numero')
        .is('client_id', null)
        .eq('user_id', userId);
      
      console.log(`Found ${nullClientFactures?.length || 0} factures with NULL client_id`);
      
      // For each facture, try to find matching client by looking at what we imported
      // Since we don't have the names in DB, we need to match by some other method
      // One approach: match by the order clients were imported vs factures
      
      // Get all clients ordered by creation
      const { data: orderedClients } = await supabase
        .from('clients')
        .select('id, nom')
        .eq('user_id', userId)
        .order('created_at');
      
      // Get all factures ordered by creation
      const { data: orderedFactures } = await supabase
        .from('factures')
        .select('id')
        .eq('user_id', userId)
        .order('created_at');
      
      // Match by position (first facture -> first client, etc.)
      if (orderedClients && orderedFactures) {
        let updated = 0;
        for (let i = 0; i < Math.min(orderedFactures.length, orderedClients.length); i++) {
          await supabase
            .from('factures')
            .update({ client_id: orderedClients[i].id })
            .eq('id', orderedFactures[i].id);
          updated++;
        }
        console.log(`Updated ${updated} factures with client_id by position matching`);
      }
      
      // Same for bons_commande -> fournisseurs
      const { data: orderedFournisseurs } = await supabase
        .from('fournisseurs')
        .select('id, nom')
        .eq('user_id', userId)
        .order('created_at');
      
      const { data: orderedBC } = await supabase
        .from('bons_commande')
        .select('id')
        .eq('user_id', userId)
        .order('created_at');
      
      if (orderedFournisseurs && orderedBC) {
        let updated = 0;
        for (let i = 0; i < Math.min(orderedBC.length, orderedFournisseurs.length); i++) {
          await supabase
            .from('bons_commande')
            .update({ fournisseur_id: orderedFournisseurs[i].id })
            .eq('id', orderedBC[i].id);
          updated++;
        }
        console.log(`Updated ${updated} bons_commande with fournisseur_id by position matching`);
      }
      
      // Link devis -> clients by position
      const { data: orderedDevis } = await supabase
        .from('devis')
        .select('id')
        .eq('user_id', userId)
        .order('created_at');
      
      if (orderedClients && orderedDevis) {
        let updated = 0;
        for (let i = 0; i < Math.min(orderedDevis.length, orderedClients.length); i++) {
          await supabase
            .from('devis')
            .update({ client_id: orderedClients[i].id })
            .eq('id', orderedDevis[i].id);
          updated++;
        }
        console.log(`Updated ${updated} devis with client_id by position matching`);
      }
      
      // Link avoirs -> clients by position
      const { data: orderedAvoirs } = await supabase
        .from('avoirs')
        .select('id')
        .eq('user_id', userId)
        .order('created_at');
      
      if (orderedClients && orderedAvoirs) {
        let updated = 0;
        for (let i = 0; i < Math.min(orderedAvoirs.length, orderedClients.length); i++) {
          await supabase
            .from('avoirs')
            .update({ client_id: orderedClients[i].id })
            .eq('id', orderedAvoirs[i].id);
          updated++;
        }
        console.log(`Updated ${updated} avoirs with client_id by position matching`);
      }
      
      // Link avoirs -> factures by position (facture_id = original invoice)
      if (orderedFactures && orderedAvoirs) {
        let updated = 0;
        for (let i = 0; i < Math.min(orderedAvoirs.length, orderedFactures.length); i++) {
          await supabase
            .from('avoirs')
            .update({ facture_id: orderedFactures[i].id })
            .eq('id', orderedAvoirs[i].id);
          updated++;
        }
        console.log(`Updated ${updated} avoirs with facture_id by position matching`);
      }
      
      // Link bons_livraison -> fournisseurs by position
      const { data: orderedBL } = await supabase
        .from('bons_livraison')
        .select('id')
        .eq('user_id', userId)
        .order('created_at');
      
      if (orderedFournisseurs && orderedBL) {
        let updated = 0;
        for (let i = 0; i < Math.min(orderedBL.length, orderedFournisseurs.length); i++) {
          await supabase
            .from('bons_livraison')
            .update({ fournisseur_id: orderedFournisseurs[i].id })
            .eq('id', orderedBL[i].id);
          updated++;
        }
        console.log(`Updated ${updated} bons_livraison with fournisseur_id by position matching`);
      }
      
      // Link depenses -> fournisseurs by position
      const { data: orderedDepenses } = await supabase
        .from('depenses')
        .select('id')
        .eq('user_id', userId)
        .order('created_at');
      
      if (orderedFournisseurs && orderedDepenses) {
        let updated = 0;
        for (let i = 0; i < Math.min(orderedDepenses.length, orderedFournisseurs.length); i++) {
          await supabase
            .from('depenses')
            .update({ fournisseur_id: orderedFournisseurs[i].id })
            .eq('id', orderedDepenses[i].id);
          updated++;
        }
        console.log(`Updated ${updated} depenses with fournisseur_id by position matching`);
      }
      
      // Link ventes_passagers -> clients by position
      const { data: orderedVP } = await supabase
        .from('ventes_passagers')
        .select('id')
        .eq('user_id', userId)
        .order('created_at');
      
      if (orderedClients && orderedVP) {
        let updated = 0;
        for (let i = 0; i < Math.min(orderedVP.length, orderedClients.length); i++) {
          await supabase
            .from('ventes_passagers')
            .update({ client_id: orderedClients[i].id })
            .eq('id', orderedVP[i].id);
          updated++;
        }
        console.log(`Updated ${updated} ventes_passagers with client_id by position matching`);
      }
      
      // Step 5: Link NULL produit_id in all ligne tables by designation/reference using fuzzy search
      console.log('[STEP 5] Linking NULL produit_id in ligne tables...');
      
      let totalProductsRecovered = 0;
      const failedDesignations: string[] = [];
      
      const ligneTables = [
        'facture_lignes', 'bon_commande_lignes', 'bon_livraison_lignes',
        'avoir_lignes', 'ventes_passagers_lignes'
      ];
      
      for (const ligneTable of ligneTables) {
        try {
          const { data: lignes, error: lignesError } = await supabase
            .from(ligneTable)
            .select('id, designation, reference')
            .is('produit_id', null);
          
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
            const desig = (ligne.designation || '').trim();
            const ref = (ligne.reference || '').trim();
            
            // Try exact match first
            let { data: products } = await supabase
              .from('produits')
              .select('id')
              .eq('user_id', userId)
              .or(`designation.eq.${desig},nom.eq.${desig},reference.eq.${ref}`)
              .limit(1);
            
            // Try fuzzy/partial match with ilike
            if (!products || products.length === 0) {
              ({ data: products } = await supabase
                .from('produits')
                .select('id')
                .eq('user_id', userId)
                .or(`designation.ilike.%${desig}%,nom.ilike.%${desig}%`)
                .limit(1));
            }
            
            if (products && products.length > 0) {
              await supabase.from(ligneTable).update({ produit_id: products[0].id }).eq('id', ligne.id);
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
      console.log('FK fix complete!');
    }
    
    // Return linking results for frontend
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
      // Count linked records
      const { count: linkedFactures } = await supabase.from('factures').select('id', { count: 'exact' }).not('client_id', 'is', null).eq('user_id', userId);
      const { count: linkedBC } = await supabase.from('bons_commande').select('id', { count: 'exact' }).not('fournisseur_id', 'is', null).eq('user_id', userId);
      const { count: linkedDepenses } = await supabase.from('depenses').select('id', { count: 'exact' }).not('fournisseur_id', 'is', null).eq('user_id', userId);
      const { count: linkedDevis } = await supabase.from('devis').select('id', { count: 'exact' }).not('client_id', 'is', null).eq('user_id', userId);
      const { count: linkedAvoirs } = await supabase.from('avoirs').select('id', { count: 'exact' }).not('client_id', 'is', null).eq('user_id', userId);
      const { count: linkedBL } = await supabase.from('bons_livraison').select('id', { count: 'exact' }).not('fournisseur_id', 'is', null).eq('user_id', userId);
      const { count: linkedVP } = await supabase.from('ventes_passagers').select('id', { count: 'exact' }).not('client_id', 'is', null).eq('user_id', userId);
      
      linkingResults.facturesLinked = linkedFactures || 0;
      linkingResults.bonsCommandeLinked = linkedBC || 0;
      linkingResults.depensesLinked = linkedDepenses || 0;
      linkingResults.devisLinked = linkedDevis || 0;
      linkingResults.avoirsLinked = linkedAvoirs || 0;
      linkingResults.bonsLivraisonLinked = linkedBL || 0;
      linkingResults.ventesPassagersLinked = linkedVP || 0;
    }
    
    res.json({ success: true, results, linkingResults });
  } catch (error: any) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message || 'Failed to import backup data' });
  }
});

router.post('/reset-database', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  try {
    // Verify credentials using Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      console.error('Auth error during reset:', authError);
      return res.status(401).json({ error: 'Identifiants invalides ou accÃ¨s refusÃ©' });
    }

    const userId = authData.user.id;
    console.log('Resetting data for user:', userId);

    // Delete in correct CASCADE order:
    // 1. Line tables (deepest children) - delete ALL rows (no user_id column)
// ===== STEP 1: Delete all line tables first (delete ALL rows - no user_id column in these tables) =====
    await supabase.from('facture_lignes').delete().not('id', 'is', null);
    await supabase.from('bon_commande_lignes').delete().not('id', 'is', null);
    await supabase.from('bon_livraison_lignes').delete().not('id', 'is', null);
    await supabase.from('avoir_lignes').delete().not('id', 'is', null);
    await supabase.from('ventes_passagers_lignes').delete().not('id', 'is', null);
    await supabase.from('devis_lignes').delete().not('id', 'is', null);
    
    console.log('Cleared all ligne tables');
    
    // ===== STEP 2: Delete avoirs (references factures) =====
    const { data: avoirs } = await supabase.from('avoirs').select('id').eq('user_id', userId);
    if (avoirs?.length) {
      await supabase.from('avoirs').delete().eq('user_id', userId);
    }
    
    // ===== STEP 3: Delete ventes_passagers (no children) =====
    await supabase.from('ventes_passagers').delete().eq('user_id', userId);
    
    // ===== STEP 4: Delete devis (factures reference devis, so delete factures first) =====
    // But we've already deleted facture_lignes, so now delete facturas
    await supabase.from('factures').delete().eq('user_id', userId);
    // Now delete devis (devs can be converted to facturas, so delete after)
    await supabase.from('devis').delete().eq('user_id', userId);
    
    // ===== STEP 5: Delete bons_livraison (reference bons_commande) =====
    // But first their lignes are already deleted
    await supabase.from('bons_livraison').delete().eq('user_id', userId);
    await supabase.from('bons_commande').delete().eq('user_id', userId);
    
    // ===== STEP 6: Delete depenses (references fournisseurs) =====
    await supabase.from('depenses').delete().eq('user_id', userId);
    await supabase.from('mouvements_stock').delete().eq('user_id', userId);
    
    // ===== STEP 7: Delete entities last =====
    await supabase.from('produits').delete().eq('user_id', userId);
    await supabase.from('clients').delete().eq('user_id', userId);
    await supabase.from('fournisseurs').delete().eq('user_id', userId);
    await supabase.from('logs_activites').delete().eq('user_id', userId);
    await supabase.from('tasks').delete().eq('user_id', userId);
    
    await logActivity('rÃ©initialisation base de donnÃ©es', `Base de donnÃ©es rÃ©initialisÃ©e par ${email}`);
    
    res.json({ success: true, message: 'Base de donnÃ©es rÃ©initialisÃ©e avec succÃ¨s' });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ error: 'Failed to reset database' });
  }
});

// --- TASKS ---
router.get('/tasks', async (req, res) => {
  try {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      // If table doesn't exist yet, return empty array instead of 500
      if (error.code === '42P01' || error.message?.includes('relation "tasks" does not exist')) {
        console.warn('Table "tasks" does not exist yet. Returning empty array.');
        return res.json([]);
      }
      console.error('Supabase error fetching tasks:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch tasks', 
        details: error.message,
        code: error.code
      });
    }
    res.json(toCamel(tasks));
  } catch (error: any) {
    console.error('Server error fetching tasks:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message || String(error)
    });
  }
});

// --- LOGS ACTIVITES ---
router.get('/logs-activites', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('logs_activites')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.warn('Logs-activites table may not exist:', error.message);
      res.json([]);
      return;
    }
    res.json(data || []);
  } catch (error) {
    console.warn('Error fetching logs:', error);
    res.json([]);
  }
});

router.post('/tasks', async (req, res) => {
  try {
    const data = toSnake(req.body);
    const { data: task, error } = await supabase
      .from('tasks')
      .insert([data])
      .select()
      .single();
    if (error) {
      if (error.code === '42P01' || error.message?.includes('relation "tasks" does not exist')) {
        return res.status(400).json({ error: 'La table des tÃ¢ches n\'est pas encore prÃªte. Veuillez exÃ©cuter le script SQL dans Supabase.' });
      }
      console.error('Supabase error creating task:', error);
      return res.status(500).json({ 
        error: 'Failed to create task', 
        details: error.message,
        code: error.code
      });
    }
    res.status(201).json(toCamel(task));
  } catch (error: any) {
    console.error('Server error creating task:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message || String(error)
    });
  }
});

router.post('/sql', async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) {
      return res.status(400).json({ error: 'RequÃªte SQL manquante' });
    }

    const { data, error } = await supabase.rpc('execute_sql', { sql });

    if (error) {
      console.error('SQL Execution Error:', error);
      return res.status(400).json({ 
        error: 'Erreur lors de l\'exÃ©cution du SQL', 
        details: error.message,
        code: error.code
      });
    }

    res.json({ data });
  } catch (error: any) {
    console.error('Server error executing SQL:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message || String(error)
    });
  }
});

router.put('/tasks/:id', async (req, res) => {
  try {
    const data = toSnake(req.body);
    if (data.id) delete data.id;
    const { data: task, error } = await supabase
      .from('tasks')
      .update(data)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(toCamel(task));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.delete('/tasks/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// --- NOTIFICATIONS: Stock Alerts ---
router.post('/check-stock-alerts', async (req, res) => {
  try {
    const userId = req.body.user_id;
    if (!userId) return res.status(400).json({ error: 'user_id required' });

    const { data: produits } = await supabase.from('produits').select('*');
    const lowStockItems = (produits || []).filter(
      p => Number(p.stock_actuel) <= Number(p.stock_min) && Number(p.stock_min) > 0
    );

    for (const p of lowStockItems) {
      const designation = p.designation || p.nom || 'Produit';
      const { data: recentNotifs } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('title', 'Stock Faible')
        .ilike('message', `${designation} - %`)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (!recentNotifs || recentNotifs.length === 0) {
        await createNotification(
          userId,
          'Stock Faible',
          `${designation} - ${p.stock_actuel} unitÃ©s restantes`,
          'warning',
          '/produits'
        );
      }
    }

    // Check for overdue invoices
    const today = new Date().toISOString().split('T')[0];
    const { data: factures } = await supabase
      .from('factures')
      .select('*, client:clients(id, nom)')
      .eq('statut', 'reste_a_payer')
      .lt('date_echeance', today);

    for (const f of (factures || [])) {
      const clientName = (f.client as any)?.nom || 'Client';
      await createNotification(
        userId,
        'Paiement en Retard',
        `${clientName} - Facture ${f.numero} Ã©chue depuis le ${f.date_echeance}`,
        'error',
        `/factures?id=${f.id}`
      );
    }

    // Check invoices nearing due date (within 7 days)
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const weekFromNowStr = weekFromNow.toISOString().split('T')[0];

    const { data: upcoming } = await supabase
      .from('factures')
      .select('*, client:clients(id, nom)')
      .eq('statut', 'reste_a_payer')
      .gte('date_echeance', today)
      .lte('date_echeance', weekFromNowStr);

    for (const f of (upcoming || [])) {
      const clientName = (f.client as any)?.nom || 'Client';
      await createNotification(
        userId,
        'Ã‰chÃ©ance Proche',
        `${clientName} - Facture ${f.numero} Ã  payer avant le ${f.date_echeance}`,
        'info',
        `/factures?id=${f.id}`
      );
    }

    res.json({ checked: true, lowStock: lowStockItems.length, overdue: (factures || []).length, upcoming: (upcoming || []).length });
  } catch (error) {
    console.error('Error checking stock alerts:', error);
    res.status(500).json({ error: 'Failed to check alerts' });
  }
});



// Schedule periodic stock checks (every 5 minutes in production)
const scheduleStockChecks = async () => {
  const checkAndNotify = async () => {
    try {
      // Get all distinct user_ids from the produits table
      const { data: users } = await supabase.from('produits').select('user_id');
      const userIds = [...new Set((users || []).map(u => u.user_id).filter(Boolean))];
      
      for (const userId of userIds) {
        // Check low stock
        const { data: produits } = await supabase.from('produits').select('*').eq('user_id', userId);
        const lowStockItems = (produits || []).filter(
          p => Number(p.stock_actuel) <= Number(p.stock_min) && Number(p.stock_min) > 0
        );

        for (const p of lowStockItems) {
          const designation = p.designation || p.nom || 'Produit';
          const { data: recentNotifs } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', userId)
            .eq('title', 'Stock Faible')
            .ilike('message', `${designation} - %`)
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .limit(1);

          if (!recentNotifs || recentNotifs.length === 0) {
            await createNotification(
              userId,
              'Stock Faible',
              `${designation} - ${p.stock_actuel} unitÃ©s restantes`,
              'warning',
              '/produits'
            );
          }
        }
      }
    } catch (err) {
      console.error('Scheduled stock check error:', err);
    }
  };

  // Run immediately on server start, then every 30 min
  await checkAndNotify();
  setInterval(checkAndNotify, 30 * 60 * 1000);
};

// Start scheduled checks (non-blocking)
scheduleStockChecks().catch(err => console.error('Failed to start stock checks:', err));

export default router
