-- ============================================================================
-- HUILERIE JEMAI ERP — MIGRATION 004: INITIAL ADMIN LINK & VERIFICATION CHECKS
-- Replace 'admin@huilerie-jemai.tn' with the actual email created in Supabase Auth
-- before executing the link block in Supabase SQL Editor.
-- ============================================================================

-- 1. LINK INITIAL ADMIN ACCOUNT FROM SUPABASE AUTH -> PROFILES
-- (First create the user in Supabase Dashboard -> Authentication -> Users)
DO $$
DECLARE
    v_admin_email TEXT := 'admin@huilerie-jemai.tn'; -- <-- REMPLACER PAR VOTRE EMAIL ADMIN SUPABASE
    v_auth_id UUID;
BEGIN
    SELECT id INTO v_auth_id
    FROM auth.users
    WHERE LOWER(email) = LOWER(v_admin_email)
    LIMIT 1;

    IF v_auth_id IS NOT NULL THEN
        INSERT INTO public.profiles (
            id, auth_user_id, email, username, display_name, role, is_active, permissions
        ) VALUES (
            'user-admin-' || REPLACE(v_auth_id::TEXT, '-', ''),
            v_auth_id,
            v_admin_email,
            SPLIT_PART(v_admin_email, '@', 1),
            'Mohamed Jemai (Gérant)',
            'admin',
            TRUE,
            '{}'::jsonb
        )
        ON CONFLICT (auth_user_id) DO UPDATE
        SET email = EXCLUDED.email,
            role = 'admin',
            is_active = TRUE,
            updated_at = NOW();
    ELSE
        RAISE NOTICE 'Aucun utilisateur Auth trouvé pour % — créez d''abord ce compte dans Authentication -> Users.', v_admin_email;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. READ-ONLY VERIFICATION QUERIES
-- ----------------------------------------------------------------------------

-- A. Vérifier que les cuves de test sont bien archivées sans suppression de mouvements
SELECT id, code, name, is_active, is_deleted
FROM public.tanks
WHERE code IN ('P-TEST-5000', 'P-DEST-3000');

-- B. Vérifier qu'aucune politique RLS permissive USING (true) ne subsiste
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- C. Vérifier que RLS est activée sur toutes les tables ERP
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- D. Vérifier les séquences initialisées
SELECT doc_type, doc_year, last_value
FROM public.document_sequences
ORDER BY doc_type, doc_year;
