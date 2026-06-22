-- =====================================================
-- Add watermark_text column to parametres table
-- Run this in Supabase SQL Editor
-- =====================================================

ALTER TABLE parametres 
ADD COLUMN IF NOT EXISTS watermark_text TEXT DEFAULT 'SmartGestion';
