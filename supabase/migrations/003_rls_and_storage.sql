-- ============================================================================
-- HUILERIE JEMAI ERP — MIGRATION 003: STRICT RLS POLICIES & STORAGE BUCKET
-- Drops ALL existing permissive policies before applying granular RBAC policies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DROP ALL EXISTING PUBLIC POLICIES (PREVENTS OR-COMBINATION BYPASSES)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2. REVOKE ANON ACCESS & ENABLE RLS ON ALL ERP TABLES
-- ----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

ALTER TABLE public.tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tank_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.olive_receptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reception_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_modification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grignon_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. APP SETTINGS & PROFILES
-- ----------------------------------------------------------------------------
CREATE POLICY "settings_select_active" ON public.app_settings
    FOR SELECT TO authenticated
    USING ((public.current_user_profile()).id IS NOT NULL);

CREATE POLICY "settings_admin_insert" ON public.app_settings
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

CREATE POLICY "settings_admin_update" ON public.app_settings
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "settings_admin_delete" ON public.app_settings
    FOR DELETE TO authenticated
    USING (public.is_admin());

CREATE POLICY "profiles_select_self_or_admin" ON public.profiles
    FOR SELECT TO authenticated
    USING (auth_user_id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_admin_insert" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

CREATE POLICY "profiles_admin_update" ON public.profiles
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "profiles_admin_delete" ON public.profiles
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. DOCUMENT SEQUENCES (READ FOR ACTIVE, MUTATION VIA SECURITY DEFINER OR ADMIN)
-- ----------------------------------------------------------------------------
CREATE POLICY "sequences_select_active" ON public.document_sequences
    FOR SELECT TO authenticated
    USING ((public.current_user_profile()).id IS NOT NULL);

CREATE POLICY "sequences_admin_all" ON public.document_sequences
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. TANKS, OPERATIONS, TANK_MOVEMENTS & LEGACY MOVEMENTS (CUVES)
-- ----------------------------------------------------------------------------
CREATE POLICY "tanks_select_active" ON public.tanks
    FOR SELECT TO authenticated
    USING ((public.current_user_profile()).id IS NOT NULL);

CREATE POLICY "tanks_insert_perm" ON public.tanks
    FOR INSERT TO authenticated
    WITH CHECK (public.has_action_permission('CUVES', 'create') OR public.is_admin());

CREATE POLICY "tanks_update_perm" ON public.tanks
    FOR UPDATE TO authenticated
    USING (public.has_action_permission('CUVES', 'edit') OR public.is_admin())
    WITH CHECK (public.has_action_permission('CUVES', 'edit') OR public.is_admin());

CREATE POLICY "tanks_delete_admin" ON public.tanks
    FOR DELETE TO authenticated
    USING (public.is_admin());

CREATE POLICY "operations_select_active" ON public.operations
    FOR SELECT TO authenticated
    USING ((public.current_user_profile()).id IS NOT NULL);

CREATE POLICY "operations_insert_perm" ON public.operations
    FOR INSERT TO authenticated
    WITH CHECK (public.has_action_permission('CUVES', 'create'));

CREATE POLICY "operations_update_perm" ON public.operations
    FOR UPDATE TO authenticated
    USING (public.has_action_permission('CUVES', 'edit') OR public.has_action_permission('CUVES', 'cancel'))
    WITH CHECK (public.has_action_permission('CUVES', 'edit') OR public.has_action_permission('CUVES', 'cancel'));

CREATE POLICY "operations_delete_admin" ON public.operations
    FOR DELETE TO authenticated
    USING (public.is_admin());

CREATE POLICY "tank_movements_select_active" ON public.tank_movements
    FOR SELECT TO authenticated
    USING ((public.current_user_profile()).id IS NOT NULL);

CREATE POLICY "tank_movements_insert_perm" ON public.tank_movements
    FOR INSERT TO authenticated
    WITH CHECK (public.has_action_permission('CUVES', 'create'));

CREATE POLICY "tank_movements_update_perm" ON public.tank_movements
    FOR UPDATE TO authenticated
    USING (public.has_action_permission('CUVES', 'edit'))
    WITH CHECK (public.has_action_permission('CUVES', 'edit'));

CREATE POLICY "tank_movements_delete_admin" ON public.tank_movements
    FOR DELETE TO authenticated
    USING (public.is_admin());

CREATE POLICY "movements_select_active" ON public.movements
    FOR SELECT TO authenticated
    USING ((public.current_user_profile()).id IS NOT NULL);

CREATE POLICY "movements_insert_perm" ON public.movements
    FOR INSERT TO authenticated
    WITH CHECK (public.has_action_permission('CUVES', 'create'));

CREATE POLICY "movements_update_perm" ON public.movements
    FOR UPDATE TO authenticated
    USING (public.has_action_permission('CUVES', 'edit') OR public.has_action_permission('CUVES', 'cancel'))
    WITH CHECK (public.has_action_permission('CUVES', 'edit') OR public.has_action_permission('CUVES', 'cancel'));

CREATE POLICY "movements_delete_admin" ON public.movements
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. PARTIES (CLIENTS DIRECTORY)
-- ----------------------------------------------------------------------------
CREATE POLICY "parties_select_active" ON public.parties
    FOR SELECT TO authenticated
    USING ((public.current_user_profile()).id IS NOT NULL);

CREATE POLICY "parties_insert_perm" ON public.parties
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_action_permission('CLIENTS', 'create')
        OR public.has_action_permission('RECEPTIONS', 'create')
        OR public.has_action_permission('CUVES', 'create')
    );

CREATE POLICY "parties_update_perm" ON public.parties
    FOR UPDATE TO authenticated
    USING (public.has_action_permission('CLIENTS', 'edit'))
    WITH CHECK (public.has_action_permission('CLIENTS', 'edit'));

CREATE POLICY "parties_delete_admin" ON public.parties
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 7. OLIVE RECEPTIONS, PAYMENTS & MODIFICATION HISTORY
-- ----------------------------------------------------------------------------
CREATE POLICY "receptions_select_active" ON public.olive_receptions
    FOR SELECT TO authenticated
    USING ((public.current_user_profile()).id IS NOT NULL);

CREATE POLICY "receptions_insert_perm" ON public.olive_receptions
    FOR INSERT TO authenticated
    WITH CHECK (public.has_action_permission('RECEPTIONS', 'create'));

CREATE POLICY "receptions_update_perm" ON public.olive_receptions
    FOR UPDATE TO authenticated
    USING (
        public.has_action_permission('RECEPTIONS', 'edit')
        OR public.has_action_permission('RECEPTIONS', 'pay')
        OR public.has_action_permission('PRODUCTION', 'create')
        OR public.has_action_permission('PRODUCTION', 'confirm')
    )
    WITH CHECK (
        public.has_action_permission('RECEPTIONS', 'edit')
        OR public.has_action_permission('RECEPTIONS', 'pay')
        OR public.has_action_permission('PRODUCTION', 'create')
        OR public.has_action_permission('PRODUCTION', 'confirm')
    );

CREATE POLICY "receptions_delete_admin" ON public.olive_receptions
    FOR DELETE TO authenticated
    USING (public.is_admin());

CREATE POLICY "reception_payments_select_active" ON public.reception_payments
    FOR SELECT TO authenticated
    USING ((public.current_user_profile()).id IS NOT NULL);

CREATE POLICY "reception_payments_insert_perm" ON public.reception_payments
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_action_permission('RECEPTIONS', 'pay')
        OR public.has_action_permission('FINANCES', 'create')
    );

CREATE POLICY "reception_payments_delete_admin" ON public.reception_payments
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- Append-only modification history
CREATE POLICY "mod_history_select_active" ON public.receipt_modification_history
    FOR SELECT TO authenticated
    USING ((public.current_user_profile()).id IS NOT NULL);

CREATE POLICY "mod_history_insert_admin" ON public.receipt_modification_history
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 8. PRODUCTION BATCHES
-- ----------------------------------------------------------------------------
CREATE POLICY "production_select_active" ON public.production_batches
    FOR SELECT TO authenticated
    USING ((public.current_user_profile()).id IS NOT NULL);

CREATE POLICY "production_insert_perm" ON public.production_batches
    FOR INSERT TO authenticated
    WITH CHECK (public.has_action_permission('PRODUCTION', 'create'));

CREATE POLICY "production_update_perm" ON public.production_batches
    FOR UPDATE TO authenticated
    USING (
        public.has_action_permission('PRODUCTION', 'edit')
        OR public.has_action_permission('PRODUCTION', 'confirm')
    )
    WITH CHECK (
        public.has_action_permission('PRODUCTION', 'edit')
        OR public.has_action_permission('PRODUCTION', 'confirm')
    );

CREATE POLICY "production_delete_admin" ON public.production_batches
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 9. GRIGNONS, PURCHASES, EXPENSES
-- ----------------------------------------------------------------------------
CREATE POLICY "grignons_select_active" ON public.grignon_sales
    FOR SELECT TO authenticated
    USING ((public.current_user_profile()).id IS NOT NULL);

CREATE POLICY "grignons_insert_perm" ON public.grignon_sales
    FOR INSERT TO authenticated
    WITH CHECK (public.has_action_permission('GRIGNONS', 'create'));

CREATE POLICY "grignons_update_perm" ON public.grignon_sales
    FOR UPDATE TO authenticated
    USING (public.has_action_permission('GRIGNONS', 'edit') OR public.has_action_permission('GRIGNONS', 'pay'))
    WITH CHECK (public.has_action_permission('GRIGNONS', 'edit') OR public.has_action_permission('GRIGNONS', 'pay'));

CREATE POLICY "grignons_delete_admin" ON public.grignon_sales
    FOR DELETE TO authenticated
    USING (public.is_admin());

CREATE POLICY "purchases_select_active" ON public.purchases
    FOR SELECT TO authenticated
    USING ((public.current_user_profile()).id IS NOT NULL);

CREATE POLICY "purchases_insert_perm" ON public.purchases
    FOR INSERT TO authenticated
    WITH CHECK (public.has_action_permission('PURCHASES', 'create'));

CREATE POLICY "purchases_update_perm" ON public.purchases
    FOR UPDATE TO authenticated
    USING (public.has_action_permission('PURCHASES', 'edit') OR public.has_action_permission('PURCHASES', 'pay'))
    WITH CHECK (public.has_action_permission('PURCHASES', 'edit') OR public.has_action_permission('PURCHASES', 'pay'));

CREATE POLICY "purchases_delete_admin" ON public.purchases
    FOR DELETE TO authenticated
    USING (public.is_admin());

CREATE POLICY "expenses_select_active" ON public.expenses
    FOR SELECT TO authenticated
    USING ((public.current_user_profile()).id IS NOT NULL);

CREATE POLICY "expenses_insert_perm" ON public.expenses
    FOR INSERT TO authenticated
    WITH CHECK (public.has_action_permission('FINANCES', 'create'));

CREATE POLICY "expenses_update_perm" ON public.expenses
    FOR UPDATE TO authenticated
    USING (public.has_action_permission('FINANCES', 'edit'))
    WITH CHECK (public.has_action_permission('FINANCES', 'edit'));

CREATE POLICY "expenses_delete_admin" ON public.expenses
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 10. PERSONNEL & PAYROLL
-- ----------------------------------------------------------------------------
CREATE POLICY "employees_select_active" ON public.employees
    FOR SELECT TO authenticated
    USING ((public.current_user_profile()).id IS NOT NULL);

CREATE POLICY "employees_insert_perm" ON public.employees
    FOR INSERT TO authenticated
    WITH CHECK (public.has_action_permission('PERSONNEL', 'create'));

CREATE POLICY "employees_update_perm" ON public.employees
    FOR UPDATE TO authenticated
    USING (public.has_action_permission('PERSONNEL', 'edit'))
    WITH CHECK (public.has_action_permission('PERSONNEL', 'edit'));

CREATE POLICY "employees_delete_admin" ON public.employees
    FOR DELETE TO authenticated
    USING (public.is_admin());

CREATE POLICY "salary_advances_select_active" ON public.salary_advances
    FOR SELECT TO authenticated
    USING ((public.current_user_profile()).id IS NOT NULL);

CREATE POLICY "salary_advances_insert_perm" ON public.salary_advances
    FOR INSERT TO authenticated
    WITH CHECK (public.has_action_permission('PERSONNEL', 'create') OR public.has_action_permission('PERSONNEL', 'pay'));

CREATE POLICY "salary_advances_delete_admin" ON public.salary_advances
    FOR DELETE TO authenticated
    USING (public.is_admin());

CREATE POLICY "salary_payments_select_active" ON public.salary_payments
    FOR SELECT TO authenticated
    USING ((public.current_user_profile()).id IS NOT NULL);

CREATE POLICY "salary_payments_insert_perm" ON public.salary_payments
    FOR INSERT TO authenticated
    WITH CHECK (public.has_action_permission('PERSONNEL', 'pay'));

CREATE POLICY "salary_payments_delete_admin" ON public.salary_payments
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 11. AUDIT LOGS (APPEND-ONLY FOR ACTIVE AUTHENTICATED USERS)
-- ----------------------------------------------------------------------------
CREATE POLICY "audit_logs_select_active" ON public.audit_logs
    FOR SELECT TO authenticated
    USING ((public.current_user_profile()).id IS NOT NULL);

CREATE POLICY "audit_logs_insert_active" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK ((public.current_user_profile()).id IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 12. SUPABASE STORAGE BUCKET FOR COMPANY LOGO (huilerie-assets)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('huilerie-assets', 'huilerie-assets', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

DROP POLICY IF EXISTS "huilerie_assets_public_read" ON storage.objects;
CREATE POLICY "huilerie_assets_public_read" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'huilerie-assets');

DROP POLICY IF EXISTS "huilerie_assets_admin_insert" ON storage.objects;
CREATE POLICY "huilerie_assets_admin_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'huilerie-assets' AND public.is_admin());

DROP POLICY IF EXISTS "huilerie_assets_admin_update" ON storage.objects;
CREATE POLICY "huilerie_assets_admin_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'huilerie-assets' AND public.is_admin())
    WITH CHECK (bucket_id = 'huilerie-assets' AND public.is_admin());

DROP POLICY IF EXISTS "huilerie_assets_admin_delete" ON storage.objects;
CREATE POLICY "huilerie_assets_admin_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'huilerie-assets' AND public.is_admin());
