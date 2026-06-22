-- Add activer_filigrane and texte_filigrane columns to parametres table
-- Run this in Supabase SQL Editor
ALTER TABLE parametres 
ADD COLUMN IF NOT EXISTS activer_filigrane BOOLEAN DEFAULT TRUE;

ALTER TABLE parametres 
ADD COLUMN IF NOT EXISTS texte_filigrane TEXT DEFAULT 'SmartGestion';
