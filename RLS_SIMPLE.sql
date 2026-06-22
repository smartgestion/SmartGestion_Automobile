-- =====================================================
-- SIMPLE RLS FIX - Allow all operations
-- Run in Supabase SQL Editor
-- =====================================================

-- Disable RLS temporarily (or use simpler policies)
ALTER TABLE ventes_passagers DISABLE ROW LEVEL SECURITY;
ALTER TABLE avoirs DISABLE ROW LEVEL SECURITY;

-- Or use permissive policies that check user_id in WHERE
DROP POLICY IF EXISTS "Allow all ventes_passagers" ON ventes_passagers;
CREATE POLICY "Allow all ventes_passagers" ON ventes_passagers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all avoirs" ON avoirs;
CREATE POLICY "Allow all avoirs" ON avoirs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

SELECT 'RLS made permissive for ventes_passagers and avoirs' as status;