-- Configuration de Supabase Storage pour les images de produits
-- À exécuter dans l'éditeur SQL de Supabase (SQL Editor)

-- 1. Créer le bucket de stockage pour les images de produits
-- Note: Créez d'abord le bucket via l'interface Supabase Dashboard si ce script ne fonctionne pas
-- dans le menu "Storage" → "New bucket" → nom: "product-images"

-- Activer Row Level Security sur le bucket
-- ALTER TABLE "storage".objects ENABLE ROW LEVEL SECURITY;

-- 2. Politiques de sécurité pour le bucket "product-images"
-- Ces politiques permettent aux utilisateurs authentifiés de:
-- - Lire leurs propres images
-- - Uploader leurs propres images
-- - Supprimer leurs propres images

-- Politique: Les utilisateurs peuvent lire les fichiers dans le bucket
CREATE POLICY "Users can view their own product images" 
ON "storage".objects 
FOR SELECT 
USING (
  bucket_id = 'product-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Politique: Les utilisateurs peuvent uploader des fichiers dans leur propre dossier
CREATE POLICY "Users can upload their own product images" 
ON "storage".objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND (ARRAY_LENGTH(storage.foldername(name), 1) >= 2)
  AND (
    LOWER(RIGHT(name, 4)) IN ('.jpg', 'jpeg', '.png', '.gif', 'webp')
    OR LOWER(RIGHT(name, 5)) IN ('.jpeg', '.webp')
  )
);

-- Politique: Les utilisateurs peuvent supprimer leurs propres fichiers
CREATE POLICY "Users can delete their own product images" 
ON "storage".objects 
FOR DELETE 
USING (
  bucket_id = 'product-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Politique: Les utilisateurs peuvent mettre à jour leurs propres fichiers
CREATE POLICY "Users can update their own product images" 
ON "storage".objects 
FOR UPDATE 
USING (
  bucket_id = 'product-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
