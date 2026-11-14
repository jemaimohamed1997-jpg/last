-- ============================================================================
-- HUILERIE JEMAI ERP — MIGRATION 002: SECURITY DEFINER FUNCTIONS, RPCs & TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AUTHENTICATED PROFILE & RBAC HELPERS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_profile()
RETURNS public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID;
    v_prof public.profiles;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT * INTO v_prof
    FROM public.profiles
    WHERE auth_user_id = v_uid
      AND is_active = TRUE
    LIMIT 1;

    RETURN v_prof;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prof public.profiles;
BEGIN
    v_prof := public.current_user_profile();
    RETURN v_prof.id IS NOT NULL AND v_prof.role = 'admin';
END;
$$;

CREATE OR REPLACE FUNCTION public.has_action_permission(p_module TEXT, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prof public.profiles;
    v_val TEXT;
BEGIN
    v_prof := public.current_user_profile();
    IF v_prof.id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_prof.role = 'admin' THEN
        RETURN TRUE;
    END IF;

    v_val := v_prof.permissions -> p_module ->> p_action;
    IF v_val IS NOT NULL THEN
        RETURN LOWER(v_val) = 'true';
    END IF;

    RETURN FALSE;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. SECURITY TRIGGERS (AUDIT ACTOR INTEGRITY, PROFILE PROTECTION, BATCH LOCK)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_audit_logs_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prof public.profiles;
BEGIN
    IF auth.uid() IS NOT NULL THEN
        v_prof := public.current_user_profile();
        IF v_prof.id IS NULL THEN
            RAISE EXCEPTION 'Utilisateur non autorisé ou profil inactif.';
        END IF;
        NEW.user_id := v_prof.id;
        NEW.user_name := v_prof.display_name;
    END IF;
    IF NEW.timestamp IS NULL THEN
        NEW.timestamp := NOW();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_enforce_actor ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_enforce_actor
    BEFORE INSERT ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_audit_logs_actor();

CREATE OR REPLACE FUNCTION public.trg_profiles_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Allow service_role / SQL Editor (when auth.uid() IS NULL)
    IF auth.uid() IS NULL THEN
        NEW.updated_at := NOW();
        RETURN NEW;
    END IF;

    IF NOT public.is_admin() THEN
        IF NEW.role IS DISTINCT FROM OLD.role
           OR NEW.permissions IS DISTINCT FROM OLD.permissions
           OR NEW.is_active IS DISTINCT FROM OLD.is_active
           OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
            RAISE EXCEPTION 'Modification des privilèges interdite.';
        END IF;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_sensitive ON public.profiles;
CREATE TRIGGER trg_profiles_guard_sensitive
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_profiles_guard();

CREATE OR REPLACE FUNCTION public.trg_production_batch_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.is_confirmed = TRUE THEN
            RAISE EXCEPTION 'Un lot de trituration confirmé ne peut pas être supprimé.';
        END IF;
        RETURN OLD;
    END IF;

    IF OLD.is_confirmed = TRUE THEN
        IF COALESCE(current_setting('huilerie.allow_deposit_update', TRUE), '') = 'on' THEN
            NEW.updated_at := NOW();
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Lot de trituration confirmé (%) : modification définitivement verrouillée.', OLD.ticket_number;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_confirmed_batch_mutation ON public.production_batches;
CREATE TRIGGER trg_prevent_confirmed_batch_mutation
    BEFORE UPDATE OR DELETE ON public.production_batches
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_production_batch_lock();

-- ----------------------------------------------------------------------------
-- 3. ATOMIC BON NUMBERING RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_next_bon_number(
    p_type TEXT,
    p_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prof public.profiles;
    v_type TEXT;
    v_year INT;
    v_next INT;
BEGIN
    -- Allow service role (auth.uid() IS NULL) or active authenticated user
    IF auth.uid() IS NOT NULL THEN
        v_prof := public.current_user_profile();
        IF v_prof.id IS NULL THEN
            RAISE EXCEPTION 'Accès refusé : profil utilisateur inactif ou introuvable.';
        END IF;
    END IF;

    v_type := UPPER(TRIM(COALESCE(p_type, '')));
    IF v_type NOT IN ('OLV', 'PRD', 'GRI', 'ACH', 'REC', 'SOR', 'TRF', 'ADV', 'PAY', 'CLI') THEN
        RAISE EXCEPTION 'Type de document invalide : %', p_type;
    END IF;

    v_year := CASE WHEN v_type = 'CLI' THEN 0 ELSE COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::INT) END;

    INSERT INTO public.document_sequences (doc_type, doc_year, last_value)
    VALUES (v_type, v_year, 1)
    ON CONFLICT (doc_type, doc_year)
    DO UPDATE SET last_value = public.document_sequences.last_value + 1
    RETURNING last_value INTO v_next;

    IF v_type = 'CLI' THEN
        RETURN 'CLI-' || LPAD(v_next::TEXT, 3, '0');
    END IF;

    RETURN 'BON-' || v_type || '-' || v_year::TEXT || '-' || LPAD(v_next::TEXT, 4, '0');
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. OLIVE RECEPTION PAYMENT & EDIT RPCs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_reception_payment(
    p_reception_id TEXT,
    p_amount_tnd NUMERIC,
    p_payment_mode TEXT,
    p_reference TEXT DEFAULT NULL,
    p_payment_date DATE DEFAULT CURRENT_DATE,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prof public.profiles;
    v_rec public.olive_receptions;
    v_new_paid NUMERIC(12, 3);
    v_new_rem NUMERIC(12, 3);
    v_pay_status TEXT;
    v_pay_id TEXT;
BEGIN
    v_prof := public.current_user_profile();
    IF v_prof.id IS NULL OR (NOT public.has_action_permission('RECEPTIONS', 'pay') AND NOT public.has_action_permission('FINANCES', 'create')) THEN
        RAISE EXCEPTION 'Permission refusée pour enregistrer un règlement.';
    END IF;

    IF p_amount_tnd IS NULL OR p_amount_tnd <= 0 THEN
        RAISE EXCEPTION 'Le montant du règlement doit être strictement positif.';
    END IF;

    IF p_payment_mode NOT IN ('ESPECES', 'CHEQUE', 'VIREMENT', 'NATURE') THEN
        RAISE EXCEPTION 'Mode de paiement invalide : %', p_payment_mode;
    END IF;

    SELECT * INTO v_rec
    FROM public.olive_receptions
    WHERE id = p_reception_id
    FOR UPDATE;

    IF v_rec.id IS NULL THEN
        RAISE EXCEPTION 'Bon de réception introuvable : %', p_reception_id;
    END IF;

    IF p_amount_tnd > v_rec.remaining_amount_tnd + 0.001 THEN
        RAISE EXCEPTION 'Surpaiement interdit : reste à payer = % TND, montant saisi = % TND.',
            v_rec.remaining_amount_tnd, p_amount_tnd;
    END IF;

    v_pay_id := 'pay-' || REPLACE(gen_random_uuid()::TEXT, '-', '');

    INSERT INTO public.reception_payments (
        id, reception_id, ticket_number, party_name, amount_tnd,
        payment_mode, reference, payment_date, operator, notes
    ) VALUES (
        v_pay_id, v_rec.id, v_rec.ticket_number, v_rec.party_name, ROUND(p_amount_tnd, 3),
        p_payment_mode, NULLIF(TRIM(COALESCE(p_reference, '')), ''),
        COALESCE(p_payment_date, CURRENT_DATE), v_prof.display_name,
        NULLIF(TRIM(COALESCE(p_notes, '')), '')
    );

    SELECT COALESCE(SUM(amount_tnd), 0) INTO v_new_paid
    FROM public.reception_payments
    WHERE reception_id = v_rec.id;

    v_new_paid := ROUND(v_new_paid, 3);
    v_new_rem := GREATEST(0, ROUND(v_rec.total_milling_fee_tnd - v_new_paid, 3));
    v_pay_status := CASE
        WHEN v_new_rem <= 0.001 THEN 'PAYE'
        WHEN v_new_paid > 0 THEN 'PARTIEL'
        ELSE 'IMPAYE'
    END;

    UPDATE public.olive_receptions
    SET paid_amount_tnd = v_new_paid,
        remaining_amount_tnd = v_new_rem,
        payment_status = v_pay_status,
        updated_at = NOW()
    WHERE id = v_rec.id
    RETURNING * INTO v_rec;

    INSERT INTO public.audit_logs (id, user_id, user_name, action, module, record_id, details)
    VALUES (
        'log-' || REPLACE(gen_random_uuid()::TEXT, '-', ''),
        v_prof.id, v_prof.display_name,
        'REGLEMENT_RECEPTION', 'RECEPTIONS', v_rec.id,
        'Encaissement ' || ROUND(p_amount_tnd, 3) || ' TND (' || p_payment_mode || ') sur ' || v_rec.ticket_number
    );

    RETURN jsonb_build_object(
        'payment_id', v_pay_id,
        'reception', to_jsonb(v_rec)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.edit_olive_reception(
    p_reception_id TEXT,
    p_date DATE,
    p_party_id TEXT,
    p_party_name TEXT,
    p_party_code TEXT,
    p_phone TEXT,
    p_vehicle_plate TEXT,
    p_driver_name TEXT,
    p_gross_weight_kg NUMERIC,
    p_tare_weight_kg NUMERIC,
    p_milling_fee_per_kg NUMERIC,
    p_notes TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prof public.profiles;
    v_old public.olive_receptions;
    v_new public.olive_receptions;
    v_net NUMERIC(10, 2);
    v_total_fee NUMERIC(12, 3);
    v_rem NUMERIC(12, 3);
    v_pay_status TEXT;
    v_hist_id TEXT;
BEGIN
    v_prof := public.current_user_profile();
    IF v_prof.id IS NULL OR NOT public.has_action_permission('RECEPTIONS', 'edit') THEN
        RAISE EXCEPTION 'Permission refusée pour modifier un bon de réception.';
    END IF;

    IF TRIM(COALESCE(p_reason, '')) = '' THEN
        RAISE EXCEPTION 'Un motif de modification est obligatoire.';
    END IF;

    IF p_gross_weight_kg IS NULL OR p_tare_weight_kg IS NULL OR p_gross_weight_kg <= p_tare_weight_kg OR p_tare_weight_kg < 0 THEN
        RAISE EXCEPTION 'Poids invalides : le poids brut doit être strictement supérieur à la tare.';
    END IF;

    IF p_milling_fee_per_kg IS NULL OR p_milling_fee_per_kg < 0 THEN
        RAISE EXCEPTION 'Le tarif de trituration doit être positif ou nul.';
    END IF;

    SELECT * INTO v_old
    FROM public.olive_receptions
    WHERE id = p_reception_id
    FOR UPDATE;

    IF v_old.id IS NULL THEN
        RAISE EXCEPTION 'Bon de réception introuvable : %', p_reception_id;
    END IF;

    v_net := ROUND(p_gross_weight_kg - p_tare_weight_kg, 2);
    v_total_fee := ROUND(v_net * p_milling_fee_per_kg, 3);

    IF v_total_fee + 0.001 < v_old.paid_amount_tnd THEN
        RAISE EXCEPTION 'Le nouveau montant total (% TND) ne peut pas être inférieur au montant déjà encaissé (% TND).',
            v_total_fee, v_old.paid_amount_tnd;
    END IF;

    v_rem := GREATEST(0, ROUND(v_total_fee - v_old.paid_amount_tnd, 3));
    v_pay_status := CASE
        WHEN v_rem <= 0.001 AND v_total_fee > 0 THEN 'PAYE'
        WHEN v_total_fee = 0 THEN 'PAYE'
        WHEN v_old.paid_amount_tnd > 0 THEN 'PARTIEL'
        ELSE 'IMPAYE'
    END;

    UPDATE public.olive_receptions
    SET date = COALESCE(p_date, v_old.date),
        party_id = COALESCE(NULLIF(TRIM(p_party_id), ''), v_old.party_id),
        party_name = COALESCE(NULLIF(TRIM(p_party_name), ''), v_old.party_name),
        party_code = COALESCE(NULLIF(TRIM(p_party_code), ''), v_old.party_code),
        phone = NULLIF(TRIM(COALESCE(p_phone, '')), ''),
        vehicle_plate = NULLIF(TRIM(COALESCE(p_vehicle_plate, '')), ''),
        driver_name = NULLIF(TRIM(COALESCE(p_driver_name, '')), ''),
        gross_weight_kg = ROUND(p_gross_weight_kg, 2),
        tare_weight_kg = ROUND(p_tare_weight_kg, 2),
        net_weight_kg = v_net,
        milling_fee_per_kg = ROUND(p_milling_fee_per_kg, 3),
        total_milling_fee_tnd = v_total_fee,
        remaining_amount_tnd = v_rem,
        payment_status = v_pay_status,
        notes = NULLIF(TRIM(COALESCE(p_notes, '')), ''),
        updated_at = NOW()
    WHERE id = v_old.id
    RETURNING * INTO v_new;

    v_hist_id := 'mod-' || REPLACE(gen_random_uuid()::TEXT, '-', '');
    INSERT INTO public.receipt_modification_history (
        id, doc_type, record_id, doc_number, modified_by_user_id, modified_by_name,
        reason, before_data, after_data
    ) VALUES (
        v_hist_id, 'BON-OLV', v_old.id, v_old.ticket_number, v_prof.id, v_prof.display_name,
        TRIM(p_reason), to_jsonb(v_old), to_jsonb(v_new)
    );

    INSERT INTO public.audit_logs (id, user_id, user_name, action, module, record_id, details)
    VALUES (
        'log-' || REPLACE(gen_random_uuid()::TEXT, '-', ''),
        v_prof.id, v_prof.display_name,
        'MODIFICATION_RECEPTION', 'RECEPTIONS', v_old.id,
        'Modification ' || v_old.ticket_number || ' : ' || TRIM(p_reason)
    );

    RETURN to_jsonb(v_new);
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. PRODUCTION CONFIRMATION & EXPLICIT TANK DEPOSIT RPCs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_production_batch(p_batch_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prof public.profiles;
    v_batch public.production_batches;
BEGIN
    v_prof := public.current_user_profile();
    IF v_prof.id IS NULL OR NOT public.has_action_permission('PRODUCTION', 'confirm') THEN
        RAISE EXCEPTION 'Permission refusée : vous n''êtes pas autorisé à confirmer un lot de trituration.';
    END IF;

    SELECT * INTO v_batch
    FROM public.production_batches
    WHERE id = p_batch_id
    FOR UPDATE;

    IF v_batch.id IS NULL THEN
        RAISE EXCEPTION 'Lot de trituration introuvable : %', p_batch_id;
    END IF;

    IF v_batch.is_confirmed = TRUE THEN
        RAISE EXCEPTION 'Ce lot (%) est déjà confirmé et verrouillé.', v_batch.ticket_number;
    END IF;

    UPDATE public.production_batches
    SET status = 'CONFIRME',
        is_confirmed = TRUE,
        confirmed_by = v_prof.display_name,
        confirmed_at = NOW(),
        completed_at = COALESCE(completed_at, NOW()),
        updated_at = NOW()
    WHERE id = v_batch.id
    RETURNING * INTO v_batch;

    UPDATE public.olive_receptions
    SET status = 'TERMINE',
        updated_at = NOW()
    WHERE id = v_batch.reception_id;

    INSERT INTO public.audit_logs (id, user_id, user_name, action, module, record_id, details)
    VALUES (
        'log-' || REPLACE(gen_random_uuid()::TEXT, '-', ''),
        v_prof.id, v_prof.display_name,
        'CONFIRMATION_PRODUCTION', 'PRODUCTION', v_batch.id,
        'Confirmation définitive lot ' || v_batch.ticket_number || ' (' || v_batch.oil_quantity_kg || ' kg / ' || v_batch.oil_quantity_litres || ' L)'
    );

    RETURN to_jsonb(v_batch);
END;
$$;

CREATE OR REPLACE FUNCTION public.deposit_production_to_tank(
    p_batch_id TEXT,
    p_tank_id TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prof public.profiles;
    v_batch public.production_batches;
    v_tank public.tanks;
    v_current_stock NUMERIC(12, 3);
    v_remaining_cap NUMERIC(12, 3);
    v_doc_number TEXT;
    v_op_id TEXT;
    v_tm_id TEXT;
BEGIN
    v_prof := public.current_user_profile();
    IF v_prof.id IS NULL OR (
        NOT public.has_action_permission('CUSTOMER_HISTORY', 'edit')
        AND NOT public.has_action_permission('CUVES', 'create')
    ) THEN
        RAISE EXCEPTION 'Permission refusée pour transférer une production en cuve.';
    END IF;

    SELECT * INTO v_batch
    FROM public.production_batches
    WHERE id = p_batch_id
    FOR UPDATE;

    IF v_batch.id IS NULL THEN
        RAISE EXCEPTION 'Lot de trituration introuvable : %', p_batch_id;
    END IF;

    IF v_batch.is_confirmed = FALSE THEN
        RAISE EXCEPTION 'Le lot (%) doit être confirmé avant le transfert en cuve.', v_batch.ticket_number;
    END IF;

    IF v_batch.oil_destination = 'STOCKAGE_CUVE' THEN
        RAISE EXCEPTION 'Ce lot (%) a déjà été déposé en cuve de stockage.', v_batch.ticket_number;
    END IF;

    IF v_batch.oil_quantity_litres <= 0 THEN
        RAISE EXCEPTION 'La quantité d''huile doit être supérieure à 0 L.';
    END IF;

    SELECT * INTO v_tank
    FROM public.tanks
    WHERE id = p_tank_id
    FOR UPDATE;

    IF v_tank.id IS NULL OR v_tank.is_active = FALSE OR v_tank.is_deleted = TRUE THEN
        RAISE EXCEPTION 'Cuve cible introuvable ou inactive.';
    END IF;

    SELECT COALESCE(SUM(
        CASE WHEN tm.direction = 'IN' THEN tm.quantity ELSE -tm.quantity END
    ), 0) INTO v_current_stock
    FROM public.tank_movements tm
    JOIN public.operations op ON op.id = tm.operation_id
    WHERE tm.tank_id = v_tank.id
      AND op.status = 'VALIDE';

    v_remaining_cap := GREATEST(0, v_tank.capacity - v_current_stock);
    IF v_batch.oil_quantity_litres > v_remaining_cap + 0.001 THEN
        RAISE EXCEPTION 'Capacité insuffisante dans la cuve % (%) : % L libres pour % L requis.',
            v_tank.code, v_tank.name, ROUND(v_remaining_cap, 2), v_batch.oil_quantity_litres;
    END IF;

    v_doc_number := public.get_next_bon_number('REC', EXTRACT(YEAR FROM CURRENT_DATE)::INT);
    v_op_id := 'op-' || REPLACE(gen_random_uuid()::TEXT, '-', '');
    v_tm_id := 'tm-' || REPLACE(gen_random_uuid()::TEXT, '-', '');

    INSERT INTO public.operations (
        id, doc_number, type, party_id, operator, total_quantity,
        notes, status, operation_date, allocations
    ) VALUES (
        v_op_id, v_doc_number, 'ENTREE', v_batch.party_id, v_prof.display_name, v_batch.oil_quantity_litres,
        COALESCE(NULLIF(TRIM(COALESCE(p_notes, '')), ''), 'Dépôt depuis trituration ' || v_batch.ticket_number),
        'VALIDE', NOW(),
        jsonb_build_array(jsonb_build_object('tank_id', v_tank.id, 'quantity', v_batch.oil_quantity_litres))
    );

    INSERT INTO public.tank_movements (
        id, operation_id, tank_id, party_id, direction, quantity, notes
    ) VALUES (
        v_tm_id, v_op_id, v_tank.id, v_batch.party_id, 'IN', v_batch.oil_quantity_litres,
        'Transfert production ' || v_batch.ticket_number
    );

    PERFORM set_config('huilerie.allow_deposit_update', 'on', TRUE);
    UPDATE public.production_batches
    SET oil_destination = 'STOCKAGE_CUVE',
        destination_tank_id = v_tank.id,
        updated_at = NOW()
    WHERE id = v_batch.id;
    PERFORM set_config('huilerie.allow_deposit_update', '', TRUE);

    INSERT INTO public.audit_logs (id, user_id, user_name, action, module, record_id, details)
    VALUES (
        'log-' || REPLACE(gen_random_uuid()::TEXT, '-', ''),
        v_prof.id, v_prof.display_name,
        'DEPOT_CUVE_PRODUCTION', 'CUSTOMER_HISTORY', v_op_id,
        'Dépôt ' || v_batch.oil_quantity_litres || ' L (' || v_batch.ticket_number || ') dans cuve ' || v_tank.code || ' -> ' || v_doc_number
    );

    RETURN jsonb_build_object(
        'operation_id', v_op_id,
        'doc_number', v_doc_number,
        'tank_id', v_tank.id,
        'quantity_litres', v_batch.oil_quantity_litres
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. STOCK RECEPTION (BON-REC) EDIT WITH HISTORY RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.edit_stock_reception(
    p_operation_id TEXT,
    p_tank_id TEXT,
    p_party_id TEXT,
    p_quantity NUMERIC,
    p_operation_date TIMESTAMPTZ,
    p_notes TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prof public.profiles;
    v_op public.operations;
    v_old_tm public.tank_movements;
    v_tank public.tanks;
    v_party public.parties;
    v_current_stock NUMERIC(12, 3);
    v_old_party_stock NUMERIC(12, 3);
    v_hist_id TEXT;
    v_before JSONB;
    v_after JSONB;
BEGIN
    v_prof := public.current_user_profile();
    IF v_prof.id IS NULL OR NOT public.has_action_permission('CUVES', 'edit') THEN
        RAISE EXCEPTION 'Permission refusée pour modifier un bon de réception stock (BON-REC).';
    END IF;

    IF TRIM(COALESCE(p_reason, '')) = '' THEN
        RAISE EXCEPTION 'Un motif de modification est obligatoire.';
    END IF;

    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'La quantité doit être strictement supérieure à 0 L.';
    END IF;

    SELECT * INTO v_op
    FROM public.operations
    WHERE id = p_operation_id
    FOR UPDATE;

    IF v_op.id IS NULL THEN
        RAISE EXCEPTION 'Opération introuvable : %', p_operation_id;
    END IF;

    IF v_op.type <> 'ENTREE' OR v_op.status <> 'VALIDE' THEN
        RAISE EXCEPTION 'Seuls les bons d''entrée valides (BON-REC) peuvent être modifiés.';
    END IF;

    SELECT * INTO v_old_tm
    FROM public.tank_movements
    WHERE operation_id = v_op.id
    LIMIT 1
    FOR UPDATE;

    IF v_old_tm.id IS NULL THEN
        RAISE EXCEPTION 'Mouvement de cuve associé introuvable.';
    END IF;

    SELECT * INTO v_tank
    FROM public.tanks
    WHERE id = p_tank_id
    FOR UPDATE;

    IF v_tank.id IS NULL OR v_tank.is_active = FALSE OR v_tank.is_deleted = TRUE THEN
        RAISE EXCEPTION 'Cuve cible introuvable ou inactive.';
    END IF;

    SELECT * INTO v_party
    FROM public.parties
    WHERE id = p_party_id;

    IF v_party.id IS NULL THEN
        RAISE EXCEPTION 'Client introuvable : %', p_party_id;
    END IF;

    -- Verify capacity of target tank (excluding the old movement from this operation)
    SELECT COALESCE(SUM(
        CASE WHEN tm.direction = 'IN' THEN tm.quantity ELSE -tm.quantity END
    ), 0) INTO v_current_stock
    FROM public.tank_movements tm
    JOIN public.operations op ON op.id = tm.operation_id
    WHERE tm.tank_id = v_tank.id
      AND op.status = 'VALIDE'
      AND tm.operation_id <> v_op.id;

    IF v_current_stock + p_quantity > v_tank.capacity + 0.001 THEN
        RAISE EXCEPTION 'Capacité cuve dépassée (% L max, % L déjà occupés hors ce bon).',
            v_tank.capacity, ROUND(v_current_stock, 2);
    END IF;

    -- Verify old tank + old party does not become negative after removing/reducing old movement
    SELECT COALESCE(SUM(
        CASE WHEN tm.direction = 'IN' THEN tm.quantity ELSE -tm.quantity END
    ), 0) INTO v_old_party_stock
    FROM public.tank_movements tm
    JOIN public.operations op ON op.id = tm.operation_id
    WHERE tm.tank_id = v_old_tm.tank_id
      AND tm.party_id = v_old_tm.party_id
      AND op.status = 'VALIDE'
      AND tm.operation_id <> v_op.id;

    IF v_old_tm.tank_id = v_tank.id AND v_old_tm.party_id = v_party.id THEN
        IF v_old_party_stock + p_quantity < -0.001 THEN
            RAISE EXCEPTION 'Impossible de réduire la quantité : des sorties ultérieures dépendent de ce stock.';
        END IF;
    ELSE
        IF v_old_party_stock < -0.001 THEN
            RAISE EXCEPTION 'Impossible de déplacer ce bon : le client a déjà retiré une partie de ce stock de la cuve d''origine.';
        END IF;
    END IF;

    v_before := jsonb_build_object(
        'operation', to_jsonb(v_op),
        'tank_movement', to_jsonb(v_old_tm)
    );

    UPDATE public.operations
    SET party_id = v_party.id,
        total_quantity = ROUND(p_quantity, 3),
        operation_date = COALESCE(p_operation_date, v_op.operation_date),
        notes = NULLIF(TRIM(COALESCE(p_notes, '')), ''),
        allocations = jsonb_build_array(jsonb_build_object('tank_id', v_tank.id, 'quantity', ROUND(p_quantity, 3))),
        updated_at = NOW()
    WHERE id = v_op.id
    RETURNING * INTO v_op;

    UPDATE public.tank_movements
    SET tank_id = v_tank.id,
        party_id = v_party.id,
        quantity = ROUND(p_quantity, 3),
        notes = NULLIF(TRIM(COALESCE(p_notes, '')), '')
    WHERE id = v_old_tm.id
    RETURNING * INTO v_old_tm;

    v_after := jsonb_build_object(
        'operation', to_jsonb(v_op),
        'tank_movement', to_jsonb(v_old_tm)
    );

    v_hist_id := 'mod-' || REPLACE(gen_random_uuid()::TEXT, '-', '');
    INSERT INTO public.receipt_modification_history (
        id, doc_type, record_id, doc_number, modified_by_user_id, modified_by_name,
        reason, before_data, after_data
    ) VALUES (
        v_hist_id, 'BON-REC', v_op.id, v_op.doc_number, v_prof.id, v_prof.display_name,
        TRIM(p_reason), v_before, v_after
    );

    INSERT INTO public.audit_logs (id, user_id, user_name, action, module, record_id, details)
    VALUES (
        'log-' || REPLACE(gen_random_uuid()::TEXT, '-', ''),
        v_prof.id, v_prof.display_name,
        'MODIFICATION_BON_REC', 'CUVES', v_op.id,
        'Modification ' || v_op.doc_number || ' : ' || TRIM(p_reason)
    );

    RETURN v_after;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. PERSONNEL ADVANCES & MONTHLY PAYROLL SETTLEMENT RPCs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_salary_advance(
    p_employee_id TEXT,
    p_amount_tnd NUMERIC,
    p_advance_date DATE DEFAULT CURRENT_DATE,
    p_payment_mode TEXT DEFAULT 'ESPECES',
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prof public.profiles;
    v_emp public.employees;
    v_period TEXT;
    v_existing_settlement TEXT;
    v_adv_sum NUMERIC(12, 3);
    v_doc_number TEXT;
    v_adv public.salary_advances;
BEGIN
    v_prof := public.current_user_profile();
    IF v_prof.id IS NULL OR (NOT public.has_action_permission('PERSONNEL', 'create') AND NOT public.has_action_permission('PERSONNEL', 'pay')) THEN
        RAISE EXCEPTION 'Permission refusée pour enregistrer une avance sur salaire.';
    END IF;

    IF p_amount_tnd IS NULL OR p_amount_tnd <= 0 THEN
        RAISE EXCEPTION 'Le montant de l''avance doit être strictement positif.';
    END IF;

    IF p_payment_mode NOT IN ('ESPECES', 'CHEQUE', 'VIREMENT') THEN
        RAISE EXCEPTION 'Mode de paiement invalide : %', p_payment_mode;
    END IF;

    SELECT * INTO v_emp
    FROM public.employees
    WHERE id = p_employee_id
    FOR UPDATE;

    IF v_emp.id IS NULL OR v_emp.is_active = FALSE THEN
        RAISE EXCEPTION 'Employé introuvable ou inactif.';
    END IF;

    v_period := TO_CHAR(COALESCE(p_advance_date, CURRENT_DATE), 'YYYY-MM');

    SELECT id INTO v_existing_settlement
    FROM public.salary_payments
    WHERE employee_id = v_emp.id AND period_month = v_period
    LIMIT 1;

    IF v_existing_settlement IS NOT NULL THEN
        RAISE EXCEPTION 'Le salaire du mois % est déjà clôturé pour %.', v_period, v_emp.full_name;
    END IF;

    SELECT COALESCE(SUM(amount_tnd), 0) INTO v_adv_sum
    FROM public.salary_advances
    WHERE employee_id = v_emp.id AND period_month = v_period;

    IF v_adv_sum + p_amount_tnd > v_emp.base_salary_tnd + 0.001 THEN
        RAISE EXCEPTION 'Le total des avances (% TND) dépasserait le salaire de base (% TND) pour %.',
            ROUND(v_adv_sum + p_amount_tnd, 3), v_emp.base_salary_tnd, v_period;
    END IF;

    v_doc_number := public.get_next_bon_number('ADV', EXTRACT(YEAR FROM COALESCE(p_advance_date, CURRENT_DATE))::INT);

    INSERT INTO public.salary_advances (
        id, doc_number, employee_id, employee_name, amount_tnd,
        advance_date, period_month, payment_mode, operator, notes
    ) VALUES (
        'adv-' || REPLACE(gen_random_uuid()::TEXT, '-', ''),
        v_doc_number, v_emp.id, v_emp.full_name, ROUND(p_amount_tnd, 3),
        COALESCE(p_advance_date, CURRENT_DATE), v_period, p_payment_mode,
        v_prof.display_name, NULLIF(TRIM(COALESCE(p_notes, '')), '')
    )
    RETURNING * INTO v_adv;

    INSERT INTO public.audit_logs (id, user_id, user_name, action, module, record_id, details)
    VALUES (
        'log-' || REPLACE(gen_random_uuid()::TEXT, '-', ''),
        v_prof.id, v_prof.display_name,
        'AVANCE_SALAIRE', 'PERSONNEL', v_adv.id,
        'Avance ' || v_adv.doc_number || ' de ' || v_adv.amount_tnd || ' TND à ' || v_emp.full_name || ' (' || v_period || ')'
    );

    RETURN to_jsonb(v_adv);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_salary_payment(
    p_employee_id TEXT,
    p_period_month TEXT,
    p_payment_date DATE DEFAULT CURRENT_DATE,
    p_payment_mode TEXT DEFAULT 'ESPECES',
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prof public.profiles;
    v_emp public.employees;
    v_existing_id TEXT;
    v_total_adv NUMERIC(12, 3);
    v_net_paid NUMERIC(12, 3);
    v_doc_number TEXT;
    v_pay public.salary_payments;
BEGIN
    v_prof := public.current_user_profile();
    IF v_prof.id IS NULL OR NOT public.has_action_permission('PERSONNEL', 'pay') THEN
        RAISE EXCEPTION 'Permission refusée pour régler un salaire mensuel.';
    END IF;

    IF p_period_month IS NULL OR p_period_month !~ '^\d{4}-\d{2}$' THEN
        RAISE EXCEPTION 'Format du mois invalide (attendu YYYY-MM) : %', p_period_month;
    END IF;

    IF p_payment_mode NOT IN ('ESPECES', 'CHEQUE', 'VIREMENT') THEN
        RAISE EXCEPTION 'Mode de paiement invalide : %', p_payment_mode;
    END IF;

    SELECT * INTO v_emp
    FROM public.employees
    WHERE id = p_employee_id
    FOR UPDATE;

    IF v_emp.id IS NULL THEN
        RAISE EXCEPTION 'Employé introuvable : %', p_employee_id;
    END IF;

    SELECT id INTO v_existing_id
    FROM public.salary_payments
    WHERE employee_id = v_emp.id AND period_month = p_period_month
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        RAISE EXCEPTION 'Le salaire du mois % a déjà été soldé pour % (règlement unique).',
            p_period_month, v_emp.full_name;
    END IF;

    SELECT COALESCE(SUM(amount_tnd), 0) INTO v_total_adv
    FROM public.salary_advances
    WHERE employee_id = v_emp.id AND period_month = p_period_month;

    v_net_paid := GREATEST(0, ROUND(v_emp.base_salary_tnd - v_total_adv, 3));
    v_doc_number := public.get_next_bon_number('PAY', EXTRACT(YEAR FROM COALESCE(p_payment_date, CURRENT_DATE))::INT);

    INSERT INTO public.salary_payments (
        id, doc_number, employee_id, employee_name, period_month,
        base_salary_tnd, total_advances_tnd, previous_payments_tnd,
        net_paid_tnd, payment_date, payment_mode, operator, notes
    ) VALUES (
        'sal-' || REPLACE(gen_random_uuid()::TEXT, '-', ''),
        v_doc_number, v_emp.id, v_emp.full_name, p_period_month,
        v_emp.base_salary_tnd, v_total_adv, 0,
        v_net_paid, COALESCE(p_payment_date, CURRENT_DATE), p_payment_mode,
        v_prof.display_name, NULLIF(TRIM(COALESCE(p_notes, '')), '')
    )
    RETURNING * INTO v_pay;

    UPDATE public.salary_advances
    SET is_settled = TRUE,
        settlement_id = v_pay.id
    WHERE employee_id = v_emp.id AND period_month = p_period_month;

    INSERT INTO public.audit_logs (id, user_id, user_name, action, module, record_id, details)
    VALUES (
        'log-' || REPLACE(gen_random_uuid()::TEXT, '-', ''),
        v_prof.id, v_prof.display_name,
        'CLOTURE_PAIE', 'PERSONNEL', v_pay.id,
        'Clôture paie ' || v_pay.doc_number || ' (' || p_period_month || ') pour ' || v_emp.full_name || ' : net = ' || v_net_paid || ' TND'
    );

    RETURN to_jsonb(v_pay);
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. STRICT EXECUTE PRIVILEGES (REVOKE FROM PUBLIC & ANON)
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.current_user_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_action_permission(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_next_bon_number(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_reception_payment(TEXT, NUMERIC, TEXT, TEXT, DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.edit_olive_reception(TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_production_batch(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deposit_production_to_tank(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.edit_stock_reception(TEXT, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_salary_advance(TEXT, NUMERIC, DATE, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_salary_payment(TEXT, TEXT, DATE, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_action_permission(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_bon_number(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_reception_payment(TEXT, NUMERIC, TEXT, TEXT, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edit_olive_reception(TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_production_batch(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deposit_production_to_tank(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edit_stock_reception(TEXT, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_salary_advance(TEXT, NUMERIC, DATE, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_salary_payment(TEXT, TEXT, DATE, TEXT, TEXT) TO authenticated;
