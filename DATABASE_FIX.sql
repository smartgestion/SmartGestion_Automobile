-- =====================================================
-- COMPLETE DATABASE FIX FOR MULTI-TENANT
-- Run this in Supabase SQL Editor
-- =====================================================

-- Step 1: Add user_id to missing tables
-- =====================================================

-- Add user_id to ventes_passagers (missing!)
ALTER TABLE ventes_passagers ADD COLUMN IF NOT EXISTS user_id UUID;

-- Add user_id to avoirs (missing!)
ALTER TABLE avoirs ADD COLUMN IF NOT EXISTS user_id UUID;

-- Fix parametres user_id type (text -> uuid)
ALTER TABLE parametres DROP COLUMN IF EXISTS user_id;
ALTER TABLE parametres ADD COLUMN user_id UUID UNIQUE;

-- =====================================================
-- Step 2: Get your user ID and update records
-- =====================================================

-- Get your user ID (run this and copy the result)
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- =====================================================
-- Step 3: Update existing records with YOUR user_id
-- (Replace 'YOUR-USER-ID-HERE' with your actual user ID from Step 2)
-- =====================================================

-- Update ALL tables to set user_id for existing records
-- UPDATE fournisseurs SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;
-- UPDATE clients SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;
-- UPDATE produits SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;
-- UPDATE factures SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;
-- UPDATE devis SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;
-- UPDATE bons_commande SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;
-- UPDATE bons_livraison SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;
-- UPDATE depenses SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;
-- UPDATE ventes_passagers SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;
-- UPDATE avoirs SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;
-- UPDATE parametres SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;

-- =====================================================
-- Step 4: Verify user_id is set correctly
-- =====================================================

SELECT 
  'fournisseurs' as table_name,
  COUNT(*) as total,
  COUNT(user_id) as with_user_id,
  SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END) as filled
FROM fournisseurs
UNION ALL
SELECT 'clients', COUNT(*), COUNT(user_id), SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END)
FROM clients
UNION ALL
SELECT 'produits', COUNT(*), COUNT(user_id), SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END)
FROM produits
UNION ALL
SELECT 'factures', COUNT(*), COUNT(user_id), SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END)
FROM factures
UNION ALL
SELECT 'ventes_passagers', COUNT(*), COUNT(user_id), SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END)
FROM ventes_passagers;

-- =====================================================
-- Step 5: Show sample data to verify
-- =====================================================

SELECT 'fournisseurs' as t, id, nom, user_id FROM fournisseurs ORDER BY id DESC LIMIT 3;
SELECT 'clients' as t, id, nom, user_id FROM clients ORDER BY id DESC LIMIT 3;
SELECT 'produits' as t, id, designation, user_id FROM produits ORDER BY id DESC LIMIT 3;

SELECT 'Done! Check that user_id is set for all records.' as status;