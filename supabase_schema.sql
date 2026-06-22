-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Table: Produits
CREATE TABLE IF NOT EXISTS produits (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    reference TEXT,
    UNIQUE(user_id, reference),
    designation TEXT NOT NULL,
    nom TEXT,
    description TEXT,
    categorie TEXT,
    marque TEXT,
    barcode TEXT,
    image_url TEXT,
    prix_achat_ht DECIMAL(15, 2) DEFAULT 0,
    prix_vente_ht DECIMAL(15, 2) DEFAULT 0,
    taux_tva DECIMAL(5, 2) DEFAULT 20,
    prix_achat_ttc DECIMAL(15, 2),
    prix_vente_ttc DECIMAL(15, 2),
    stock_actuel DECIMAL(15, 2) DEFAULT 0,
    stock_min DECIMAL(15, 2) DEFAULT 5,
    unite TEXT DEFAULT 'unité',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Clients
CREATE TABLE IF NOT EXISTS clients (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nom TEXT NOT NULL,
    nom_societe TEXT,
    email TEXT,
    telephone TEXT,
    adresse TEXT,
    ville TEXT,
    code_postal TEXT,
    pays TEXT DEFAULT 'Maroc',
    ice TEXT,
    rc TEXT,
    if_identifiant TEXT,
    patente TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Fournisseurs
CREATE TABLE IF NOT EXISTS fournisseurs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT,
    nom TEXT NOT NULL,
    nom_societe TEXT,
    type TEXT DEFAULT 'entreprise',
    email TEXT,
    telephone TEXT,
    adresse TEXT,
    ville TEXT,
    ice TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Devis
CREATE TABLE IF NOT EXISTS devis (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    numero TEXT NOT NULL,
    UNIQUE(user_id, numero),
    client_id BIGINT REFERENCES clients(id),
    date_emission DATE DEFAULT CURRENT_DATE,
    date_validite DATE,
    statut TEXT DEFAULT 'brouillon',
    voiture TEXT,
    matricule TEXT,
    montant_ht DECIMAL(15, 2) DEFAULT 0,
    montant_tva DECIMAL(15, 2) DEFAULT 0,
    montant_ttc DECIMAL(15, 2) DEFAULT 0,
    notes TEXT,
    conditions_paiement TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Devis Lignes
CREATE TABLE IF NOT EXISTS devis_lignes (
    id BIGSERIAL PRIMARY KEY,
    devis_id BIGINT REFERENCES devis(id) ON DELETE CASCADE,
    produit_id BIGINT REFERENCES produits(id),
    reference TEXT,
    designation TEXT NOT NULL,
    quantite DECIMAL(15, 2) NOT NULL,
    prix_unitaire_ht DECIMAL(15, 2) NOT NULL,
    tva DECIMAL(5, 2) DEFAULT 20,
    montant_ht DECIMAL(15, 2),
    montant_ttc DECIMAL(15, 2),
    ordre INTEGER DEFAULT 0
);

-- Table: Factures
CREATE TABLE IF NOT EXISTS factures (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    numero TEXT NOT NULL,
    UNIQUE(user_id, numero),
    client_id BIGINT REFERENCES clients(id),
    devis_id BIGINT REFERENCES devis(id),
    date_emission DATE DEFAULT CURRENT_DATE,
    date_echeance DATE,
    statut TEXT DEFAULT 'brouillon',
    mode_paiement TEXT,
    voiture TEXT,
    matricule TEXT,
    montant_ht DECIMAL(15, 2) DEFAULT 0,
    montant_tva DECIMAL(15, 2) DEFAULT 0,
    montant_ttc DECIMAL(15, 2) DEFAULT 0,
    reste_a_payer DECIMAL(15, 2) DEFAULT 0,
    cogs DECIMAL(15, 2) DEFAULT 0,
    notes TEXT,
    conditions_paiement TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Facture Lignes
CREATE TABLE IF NOT EXISTS facture_lignes (
    id BIGSERIAL PRIMARY KEY,
    facture_id BIGINT REFERENCES factures(id) ON DELETE CASCADE,
    produit_id BIGINT REFERENCES produits(id),
    reference TEXT,
    designation TEXT NOT NULL,
    quantite DECIMAL(15, 2) NOT NULL,
    prix_unitaire_ht DECIMAL(15, 2) NOT NULL,
    tva DECIMAL(5, 2) DEFAULT 20,
    montant_ht DECIMAL(15, 2),
    montant_ttc DECIMAL(15, 2),
    ordre INTEGER DEFAULT 0
);

-- Table: Bons de Commande
CREATE TABLE IF NOT EXISTS bons_commande (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    numero TEXT NOT NULL,
    UNIQUE(user_id, numero),
    fournisseur_id BIGINT REFERENCES fournisseurs(id),
    date_commande DATE DEFAULT CURRENT_DATE,
    date_livraison_prevue DATE,
    statut TEXT DEFAULT 'brouillon',
    montant_ht DECIMAL(15, 2) DEFAULT 0,
    montant_tva DECIMAL(15, 2) DEFAULT 0,
    montant_ttc DECIMAL(15, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Bon Commande Lignes
CREATE TABLE IF NOT EXISTS bon_commande_lignes (
    id BIGSERIAL PRIMARY KEY,
    bon_commande_id BIGINT REFERENCES bons_commande(id) ON DELETE CASCADE,
    produit_id BIGINT REFERENCES produits(id),
    reference TEXT,
    designation TEXT NOT NULL,
    quantite DECIMAL(15, 2) NOT NULL,
    prix_unitaire_ht DECIMAL(15, 2) NOT NULL,
    tva DECIMAL(5, 2) DEFAULT 20,
    montant_ht DECIMAL(15, 2),
    montant_ttc DECIMAL(15, 2),
    ordre INTEGER DEFAULT 0
);

-- Table: Bons de Livraison
CREATE TABLE IF NOT EXISTS bons_livraison (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    numero TEXT NOT NULL,
    UNIQUE(user_id, numero),
    fournisseur_id BIGINT REFERENCES fournisseurs(id),
    bon_commande_id BIGINT REFERENCES bons_commande(id),
    date_livraison DATE DEFAULT CURRENT_DATE,
    statut TEXT DEFAULT 'reçu',
    montant_ht DECIMAL(15, 2) DEFAULT 0,
    montant_tva DECIMAL(15, 2) DEFAULT 0,
    montant_ttc DECIMAL(15, 2) DEFAULT 0,
    stock_updated BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Bon Livraison Lignes
CREATE TABLE IF NOT EXISTS bon_livraison_lignes (
    id BIGSERIAL PRIMARY KEY,
    bon_livraison_id BIGINT REFERENCES bons_livraison(id) ON DELETE CASCADE,
    produit_id BIGINT REFERENCES produits(id),
    reference TEXT,
    designation TEXT NOT NULL,
    quantite DECIMAL(15, 2) NOT NULL,
    prix_unitaire_ht DECIMAL(15, 2) NOT NULL,
    tva DECIMAL(5, 2) DEFAULT 20,
    montant_ht DECIMAL(15, 2),
    montant_ttc DECIMAL(15, 2),
    ordre INTEGER DEFAULT 0
);

-- Table: Bons de Livraison (Client / sales-side) — never impacts stock
CREATE TABLE IF NOT EXISTS bons_livraison_client (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    numero TEXT NOT NULL,
    UNIQUE(user_id, numero),
    client_id BIGINT REFERENCES clients(id),
    facture_id BIGINT REFERENCES factures(id),
    date_livraison DATE DEFAULT CURRENT_DATE,
    statut TEXT DEFAULT 'en_attente',
    voiture TEXT,
    matricule TEXT,
    montant_ht DECIMAL(15, 2) DEFAULT 0,
    montant_tva DECIMAL(15, 2) DEFAULT 0,
    montant_ttc DECIMAL(15, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Bon Livraison Client Lignes
CREATE TABLE IF NOT EXISTS bon_livraison_client_lignes (
    id BIGSERIAL PRIMARY KEY,
    bon_livraison_client_id BIGINT REFERENCES bons_livraison_client(id) ON DELETE CASCADE,
    produit_id BIGINT REFERENCES produits(id),
    reference TEXT,
    designation TEXT NOT NULL,
    quantite DECIMAL(15, 2) NOT NULL,
    prix_unitaire_ht DECIMAL(15, 2) NOT NULL,
    tva DECIMAL(5, 2) DEFAULT 20,
    montant_ht DECIMAL(15, 2),
    montant_ttc DECIMAL(15, 2),
    ordre INTEGER DEFAULT 0
);

-- Table: Ventes Passagers
CREATE TABLE IF NOT EXISTS ventes_passagers (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    numero TEXT NOT NULL,
    UNIQUE(user_id, numero),
    date DATE DEFAULT CURRENT_DATE,
    montant_ht DECIMAL(15, 2) DEFAULT 0,
    montant_tva DECIMAL(15, 2) DEFAULT 0,
    montant_ttc DECIMAL(15, 2) DEFAULT 0,
    cogs DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Ventes Passagers Lignes
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

-- Table: Depenses
CREATE TABLE IF NOT EXISTS depenses (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    reference TEXT,
    UNIQUE(user_id, reference),
    categorie TEXT DEFAULT 'autre',
    description TEXT,
    montant_ht DECIMAL(15, 2) DEFAULT 0,
    montant_tva DECIMAL(15, 2) DEFAULT 0,
    montant_ttc DECIMAL(15, 2) DEFAULT 0,
    date_depense DATE DEFAULT CURRENT_DATE,
    mode_paiement TEXT DEFAULT 'virement',
    fournisseur_id BIGINT REFERENCES fournisseurs(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Avoirs
CREATE TABLE IF NOT EXISTS avoirs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    numero TEXT NOT NULL,
    UNIQUE(user_id, numero),
    facture_id BIGINT REFERENCES factures(id),
    client_id BIGINT REFERENCES clients(id),
    date_emission DATE DEFAULT CURRENT_DATE,
    montant_ht DECIMAL(15, 2) DEFAULT 0,
    montant_tva DECIMAL(15, 2) DEFAULT 0,
    montant_ttc DECIMAL(15, 2) DEFAULT 0,
    statut TEXT DEFAULT 'en_attente',
    voiture TEXT,
    matricule TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Avoir Lignes
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

-- Table: Avoirs Fournisseur (supplier credit notes — the purchase-side mirror
-- of avoirs). A manual one (bon_commande_id IS NULL) reduces expenses & stock;
-- one auto-created from a cancelled Bon de Commande is just a traceability
-- record (statut 'annulé') that does NOT impact stock or dashboard totals.
CREATE TABLE IF NOT EXISTS avoirs_fournisseur (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    numero TEXT NOT NULL,
    UNIQUE(user_id, numero),
    bon_commande_id BIGINT REFERENCES bons_commande(id),
    fournisseur_id BIGINT REFERENCES fournisseurs(id),
    date_emission DATE DEFAULT CURRENT_DATE,
    montant_ht DECIMAL(15, 2) DEFAULT 0,
    montant_tva DECIMAL(15, 2) DEFAULT 0,
    montant_ttc DECIMAL(15, 2) DEFAULT 0,
    statut TEXT DEFAULT 'émis',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Avoir Fournisseur Lignes
CREATE TABLE IF NOT EXISTS avoir_fournisseur_lignes (
    id BIGSERIAL PRIMARY KEY,
    avoir_fournisseur_id BIGINT REFERENCES avoirs_fournisseur(id) ON DELETE CASCADE,
    produit_id BIGINT REFERENCES produits(id),
    designation TEXT NOT NULL,
    quantite DECIMAL(15, 2) NOT NULL,
    prix_unitaire_ht DECIMAL(15, 2) NOT NULL,
    tva DECIMAL(5, 2) DEFAULT 20,
    montant_ht DECIMAL(15, 2),
    montant_ttc DECIMAL(15, 2),
    ordre INTEGER DEFAULT 0
);

-- Table: Mouvements de Stock
CREATE TABLE IF NOT EXISTS mouvements_stock (
    id BIGSERIAL PRIMARY KEY,
    produit_id BIGINT REFERENCES produits(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    quantite DECIMAL(15, 2) NOT NULL,
    date_mouvement TIMESTAMPTZ DEFAULT NOW(),
    reference_document TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Logs Activités
CREATE TABLE IF NOT EXISTS logs_activites (
    id BIGSERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Paramètres
CREATE TABLE IF NOT EXISTS parametres (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    nom_societe TEXT,
    nom TEXT,
    adresse TEXT,
    ville TEXT,
    code_postal TEXT,
    telephone TEXT,
    email TEXT,
    site_web TEXT,
    ice TEXT,
    rc TEXT,
    if_number TEXT,
    tp_patente TEXT,
    cnss TEXT,
    capital_social TEXT,
    forme_juridique TEXT,
    logo_url TEXT,
    couleur_principale TEXT DEFAULT '#267E54',
    banque TEXT,
    rib TEXT,
    swift TEXT,
    devise TEXT DEFAULT 'DH',
    conditions_paiement_defaut TEXT,
    pied_page_defaut TEXT,
    activer_droit_timbre BOOLEAN DEFAULT TRUE,
    watermark_text TEXT DEFAULT 'SmartGestion',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for user_id on all tables
DO $$
DECLARE
    t TEXT;
    col TEXT;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('produits', 'clients', 'fournisseurs', 'devis', 'factures', 'bons_commande', 'bons_livraison', 'bons_livraison_client', 'ventes_passagers', 'depenses', 'avoirs', 'avoirs_fournisseur', 'parametres')
    LOOP
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I_user_id_idx ON %I (user_id)', t, t);
    END LOOP;
END $$;

-- Triggers for updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('produits', 'clients', 'fournisseurs', 'devis', 'factures', 'bons_commande', 'bons_livraison', 'bons_livraison_client', 'ventes_passagers', 'depenses', 'avoirs', 'avoirs_fournisseur', 'parametres')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', t, t);
        EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END $$;

-- RPC Function to execute SQL (for development)
DROP FUNCTION IF EXISTS execute_sql(text);
CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE sql;
    RETURN json_build_object('status', 'success');
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('status', 'error', 'message', SQLERRM);
END;
$$;

-- Migrations: ensure vehicle columns exist on factures for existing databases
ALTER TABLE factures ADD COLUMN IF NOT EXISTS voiture TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS matricule TEXT;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS voiture TEXT;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS matricule TEXT;
ALTER TABLE avoirs ADD COLUMN IF NOT EXISTS voiture TEXT;
ALTER TABLE avoirs ADD COLUMN IF NOT EXISTS matricule TEXT;
ALTER TABLE bons_livraison_client ADD COLUMN IF NOT EXISTS voiture TEXT;
ALTER TABLE bons_livraison_client ADD COLUMN IF NOT EXISTS matricule TEXT;