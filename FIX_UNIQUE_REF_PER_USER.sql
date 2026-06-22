-- Drop the global UNIQUE constraint on reference
ALTER TABLE produits DROP CONSTRAINT IF EXISTS produits_reference_key;

-- Add a per-user UNIQUE constraint (user_id, reference)
-- Each user can have their own REF-001, REF-002, etc.
-- NULL user_ids are treated as distinct from each other
ALTER TABLE produits ADD CONSTRAINT produits_user_id_reference_key UNIQUE (user_id, reference);

-- Same for bons_commande: drop global UNIQUE on numero, add per-user UNIQUE (user_id, numero)
ALTER TABLE bons_commande DROP CONSTRAINT IF EXISTS bons_commande_numero_key;
ALTER TABLE bons_commande ADD CONSTRAINT bons_commande_user_id_numero_key UNIQUE (user_id, numero);

-- Same for factures
ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_numero_key;
ALTER TABLE factures ADD CONSTRAINT factures_user_id_numero_key UNIQUE (user_id, numero);

-- Same for devis
ALTER TABLE devis DROP CONSTRAINT IF EXISTS devis_numero_key;
ALTER TABLE devis ADD CONSTRAINT devis_user_id_numero_key UNIQUE (user_id, numero);

-- Same for ventes_passagers
ALTER TABLE ventes_passagers DROP CONSTRAINT IF EXISTS ventes_passagers_numero_key;
ALTER TABLE ventes_passagers ADD CONSTRAINT ventes_passagers_user_id_numero_key UNIQUE (user_id, numero);

-- Same for avoirs
ALTER TABLE avoirs DROP CONSTRAINT IF EXISTS avoirs_numero_key;
ALTER TABLE avoirs ADD CONSTRAINT avoirs_user_id_numero_key UNIQUE (user_id, numero);

-- Same for bons_livraison
ALTER TABLE bons_livraison DROP CONSTRAINT IF EXISTS bons_livraison_numero_key;
ALTER TABLE bons_livraison ADD CONSTRAINT bons_livraison_user_id_numero_key UNIQUE (user_id, numero);

-- Same for depenses (reference field, no existing constraint to drop)
ALTER TABLE depenses ADD CONSTRAINT depenses_user_id_reference_key UNIQUE (user_id, reference);
