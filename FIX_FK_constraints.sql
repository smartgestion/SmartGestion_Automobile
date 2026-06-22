-- Make FK columns nullable to allow import without forcing IDs
-- This script removes the NOT NULL constraint from FK columns

-- Drop existing FK constraints
ALTER TABLE public.factures DROP CONSTRAINT IF EXISTS factures_client_id_fkey;
ALTER TABLE public.factures DROP CONSTRAINT IF EXISTS factures_devis_id_fkey;
ALTER TABLE public.avoirs DROP CONSTRAINT IF EXISTS avoirs_client_id_fkey;
ALTER TABLE public.avoirs DROP CONSTRAINT IF EXISTS avoirs_facture_id_fkey;
ALTER TABLE public.bons_commande DROP CONSTRAINT IF EXISTS bons_commande_fournisseur_id_fkey;
ALTER TABLE public.bons_livraison DROP CONSTRAINT IF EXISTS bons_livraison_fournisseur_id_fkey;
ALTER TABLE public.bons_livraison DROP CONSTRAINT IF EXISTS bons_livraison_bon_commande_id_fkey;
ALTER TABLE public.depenses DROP CONSTRAINT IF EXISTS depenses_fournisseur_id_fkey;
ALTER TABLE public.devis DROP CONSTRAINT IF EXISTS devis_client_id_fkey;

-- Recreate FK constraints with ON DELETE SET NULL (allows NULL values)
ALTER TABLE public.factures ADD CONSTRAINT factures_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.factures ADD CONSTRAINT factures_devis_id_fkey FOREIGN KEY (devis_id) REFERENCES public.devis(id) ON DELETE SET NULL;
ALTER TABLE public.avoirs ADD CONSTRAINT avoirs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.avoirs ADD CONSTRAINT avoirs_facture_id_fkey FOREIGN KEY (facture_id) REFERENCES public.factures(id) ON DELETE SET NULL;
ALTER TABLE public.bons_commande ADD CONSTRAINT bons_commande_fournisseur_id_fkey FOREIGN KEY (fournisseur_id) REFERENCES public.fournisseurs(id) ON DELETE SET NULL;
ALTER TABLE public.bons_livraison ADD CONSTRAINT bons_livraison_fournisseur_id_fkey FOREIGN KEY (fournisseur_id) REFERENCES public.fournisseurs(id) ON DELETE SET NULL;
ALTER TABLE public.bons_livraison ADD CONSTRAINT bons_livraison_bon_commande_id_fkey FOREIGN KEY (bon_commande_id) REFERENCES public.bons_commande(id) ON DELETE SET NULL;
ALTER TABLE public.depenses ADD CONSTRAINT depenses_fournisseur_id_fkey FOREIGN KEY (fournisseur_id) REFERENCES public.fournisseurs(id) ON DELETE SET NULL;
ALTER TABLE public.devis ADD CONSTRAINT devis_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

SELECT 'FK constraints updated to allow NULL values' as status;