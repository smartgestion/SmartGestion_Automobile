-- =====================================================
-- MULTI-TENANT MIGRATION: Add user_id to all tables
-- Run this in Supabase SQL Editor
-- =====================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add user_id columns to existing tables
-- Run each with proper error handling

DO $$
BEGIN
    -- Produits
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'produits' AND column_name = 'user_id') THEN
        ALTER TABLE produits ADD COLUMN user_id UUID;
    END IF;
    
    -- Clients  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'user_id') THEN
        ALTER TABLE clients ADD COLUMN user_id UUID;
    END IF;
    
    -- Fournisseurs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fournisseurs' AND column_name = 'user_id') THEN
        ALTER TABLE fournisseurs ADD COLUMN user_id UUID;
    END IF;
    
    -- Devis
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devis' AND column_name = 'user_id') THEN
        ALTER TABLE devis ADD COLUMN user_id UUID;
    END IF;
    
    -- Factures
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'factures' AND column_name = 'user_id') THEN
        ALTER TABLE factures ADD COLUMN user_id UUID;
    END IF;
    
    -- Bons Commande
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bons_commande' AND column_name = 'user_id') THEN
        ALTER TABLE bons_commande ADD COLUMN user_id UUID;
    END IF;
    
    -- Bons Livraison
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bons_livraison' AND column_name = 'user_id') THEN
        ALTER TABLE bons_livraison ADD COLUMN user_id UUID;
    END IF;
    
    -- Depenses
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'depenses' AND column_name = 'user_id') THEN
        ALTER TABLE depenses ADD COLUMN user_id UUID;
    END IF;
    
    -- Parametres
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres' AND column_name = 'user_id') THEN
        ALTER TABLE parametres ADD COLUMN user_id UUID;
    END IF;
END $$;

-- Create indexes for user_id (if not exists)
CREATE INDEX IF NOT EXISTS idx_produits_user_id ON produits(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_user_id ON fournisseurs(user_id);
CREATE INDEX IF NOT EXISTS idx_devis_user_id ON devis(user_id);
CREATE INDEX IF NOT EXISTS idx_factures_user_id ON factures(user_id);
CREATE INDEX IF NOT EXISTS idx_bons_commande_user_id ON bons_commande(user_id);
CREATE INDEX IF NOT EXISTS idx_bons_livraison_user_id ON bons_livraison(user_id);
CREATE INDEX IF NOT EXISTS idx_depenses_user_id ON depenses(user_id);
CREATE INDEX IF NOT EXISTS idx_parametres_user_id ON parametres(user_id);

-- Create missing tables if not exists

-- Ventes Passagers table
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

-- Ventes Passagers Lignes table
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

-- Ajouter les colonnes user_id si elles manque pour ventes_passagers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ventes_passagers' AND column_name = 'user_id') THEN
        ALTER TABLE ventes_passagers ADD COLUMN user_id UUID;
    END IF;
END $$;

-- Ajouter les indexes pour ventes_passagers
CREATE INDEX IF NOT EXISTS idx_ventes_passagers_user_id ON ventes_passagers(user_id);

-- Ajouter les colonnes manquantes aux tables existantes

-- Ajouter colonnes manquantes à produits
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'produits' AND column_name = 'taux_tva') THEN
        ALTER TABLE produits ADD COLUMN taux_tva DECIMAL(5, 2) DEFAULT 20;
    END IF;
END $$;

-- Ajouter colonnes manquantes à clients
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'nom_societe') THEN
        ALTER TABLE clients ADD COLUMN nom_societe TEXT;
    END IF;
END $$;

-- Ajouter colonnes manquantes à fournisseurs  
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fournisseurs' AND column_name = 'code') THEN
        ALTER TABLE fournisseurs ADD COLUMN code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fournisseurs' AND column_name = 'nom_societe') THEN
        ALTER TABLE fournisseurs ADD COLUMN nom_societe TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fournisseurs' AND column_name = 'type') THEN
        ALTER TABLE fournisseurs ADD COLUMN type TEXT DEFAULT 'entreprise';
    END IF;
END $$;

-- Ajouter colonnes manquantes à factures
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'factures' AND column_name = 'cogs') THEN
        ALTER TABLE factures ADD COLUMN cogs DECIMAL(15, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'factures' AND column_name = 'mode_paiement') THEN
        ALTER TABLE factures ADD COLUMN mode_paiement TEXT;
    END IF;
END $$;

-- Ajouter colonnes manquantes à facture_lignes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facture_lignes' AND column_name = 'prix_unitaire') THEN
        ALTER TABLE facture_lignes ADD COLUMN prix_unitaire DECIMAL(15, 2);
    END IF;
END $$;

-- Result
SELECT 'Migration completed successfully!' as status;