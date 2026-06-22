-- =====================================================
-- SMARTFACTURE COMPLETE MIGRATION
-- Run this in Supabase SQL Editor (all at once)
-- =====================================================

-- ====== STEP 1: Add user_id to all main tables ======
ALTER TABLE produits ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE fournisseurs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE bons_commande ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE bons_livraison ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE depenses ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS user_id UUID;

-- ====== STEP 2: Create missing tables ======

-- Ventes Passagers
CREATE TABLE IF NOT EXISTS ventes_passagers (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID,
    numero TEXT UNIQUE NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    montant_ht DECIMAL(15, 2) DEFAULT 0,
    montant_tva DECIMAL(15, 2) DEFAULT 0,
    montant_ttc DECIMAL(15, 2) DEFAULT 0,
    cogs DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ventes Passagers Lignes
CREATE TABLE IF NOT EXISTS ventes_passagers_lignes (
    id BIGSERIAL PRIMARY KEY,
    vp_id BIGINT REFERENCES ventes_passagers(id) ON DELETE CASCADE,
    produit_id BIGINT REFERENCES produits(id),
    designation TEXT NOT NULL,
    quantite DECIMAL(15, 2) NOT NULL,
    prix_unitaire_ht DECIMAL(15, 2) NOT NULL,
    tva DECIMAL(5, 2) DEFAULT 20,
    montant_ht DECIMAL(15, 2),
    montant_ttc DECIMAL(15, 2),
    montant_tva DECIMAL(15, 2),
    ordre INTEGER DEFAULT 0
);

-- Avoirs
CREATE TABLE IF NOT EXISTS avoirs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID,
    numero TEXT UNIQUE NOT NULL,
    facture_id BIGINT REFERENCES factures(id),
    client_id BIGINT REFERENCES clients(id),
    date_emission DATE DEFAULT CURRENT_DATE,
    montant_ht DECIMAL(15, 2) DEFAULT 0,
    montant_tva DECIMAL(15, 2) DEFAULT 0,
    montant_ttc DECIMAL(15, 2) DEFAULT 0,
    statut TEXT DEFAULT 'en_attente',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Avoir Lignes
CREATE TABLE IF NOT EXISTS avoir_lignes (
    id BIGSERIAL PRIMARY KEY,
    avoir_id BIGINT REFERENCES avoirs(id) ON DELETE CASCADE,
    produit_id BIGINT REFERENCES produits(id),
    designation TEXT NOT NULL,
    quantite DECIMAL(15, 2) NOT NULL,
    prix_unitaire_ht DECIMAL(15, 2) NOT NULL,
    tva DECIMAL(5, 2) DEFAULT 20,
    montant_ht DECIMAL(15, 2),
    montant_ttc DECIMAL(15, 2),
    ordre INTEGER DEFAULT 0
);

-- ====== STEP 3: Add missing columns to produits ======
ALTER TABLE produits ADD COLUMN IF NOT EXISTS taux_tva DECIMAL(5, 2) DEFAULT 20;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS nom TEXT;

-- ====== STEP 4: Add missing columns to clients ======
ALTER TABLE clients ADD COLUMN IF NOT EXISTS nom_societe TEXT;

-- ====== STEP 5: Add missing columns to fournisseurs ======
ALTER TABLE fournisseurs ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE fournisseurs ADD COLUMN IF NOT EXISTS nom_societe TEXT;
ALTER TABLE fournisseurs ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'entreprise';

-- ====== STEP 6: Add missing columns to factures ======
ALTER TABLE factures ADD COLUMN IF NOT EXISTS cogs DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS mode_paiement TEXT;

-- ====== STEP 7: Add missing columns to facture_lignes ======
ALTER TABLE facture_lignes ADD COLUMN IF NOT EXISTS prix_unitaire DECIMAL(15, 2);

-- ====== STEP 8: Create indexes ======
CREATE INDEX IF NOT EXISTS idx_produits_user_id ON produits(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_user_id ON fournisseurs(user_id);
CREATE INDEX IF NOT EXISTS idx_devis_user_id ON devis(user_id);
CREATE INDEX IF NOT EXISTS idx_factures_user_id ON factures(user_id);
CREATE INDEX IF NOT EXISTS idx_bons_commande_user_id ON bons_commande(user_id);
CREATE INDEX IF NOT EXISTS idx_bons_livraison_user_id ON bons_livraison(user_id);
CREATE INDEX IF NOT EXISTS idx_depenses_user_id ON depenses(user_id);
CREATE INDEX IF NOT EXISTS idx_parametres_user_id ON parametres(user_id);

-- ====== STEP 9: Verify ======
SELECT 'Migration Complete! Checking tables...' as status;

-- Check user_id exists
SELECT 
    table_name,
    CASE WHEN column_name IS NOT NULL THEN 'OK' ELSE 'MISSING' END as user_id_status
FROM information_schema.columns c
RIGHT JOIN (
    VALUES ('produits'), ('clients'), ('fournisseurs'), ('devis'), 
           ('factures'), ('bons_commande'), ('bons_livraison'), 
           ('depenses'), ('parametres'), ('ventes_passagers'), ('avoirs')
) t(table_name) ON c.table_name = t.table_name AND c.column_name = 'user_id'
WHERE c.table_schema = 'public';