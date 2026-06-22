-- =====================================================
-- Add all missing columns to parametres table
-- Run this ONCE in Supabase SQL Editor
-- =====================================================

ALTER TABLE parametres 
ADD COLUMN IF NOT EXISTS watermark_text TEXT DEFAULT 'SmartGestion';

ALTER TABLE parametres 
ADD COLUMN IF NOT EXISTS activer_filigrane BOOLEAN DEFAULT TRUE;

ALTER TABLE parametres 
ADD COLUMN IF NOT EXISTS texte_filigrane TEXT DEFAULT 'SmartGestion';
