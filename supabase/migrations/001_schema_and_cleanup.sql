-- ============================================================================
-- HUILERIE JEMAI ERP — MIGRATION 001: UNIFIED SCHEMA, CLEANUP & SEQUENCES
-- Execute manually in Supabase SQL Editor (in strict order 001 -> 002 -> 003 -> 004)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CORE STOCK & SYSTEM TABLES (PRESERVED & HARDENED)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tanks (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    capacity NUMERIC(12, 2) NOT NULL CHECK (capacity > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE parties ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS operations (
    id TEXT PRIMARY KEY,
    doc_number TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('ENTREE', 'SORTIE', 'TRANSFERT')),
    party_id TEXT NOT NULL,
    operator TEXT NOT NULL,
    total_quantity NUMERIC(12, 3) NOT NULL CHECK (total_quantity > 0),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'VALIDE' CHECK (status IN ('VALIDE', 'ANNULE')),
    operation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_tank_id TEXT,
    target_tank_id TEXT,
    allocations JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE operations ADD COLUMN IF NOT EXISTS source_tank_id TEXT;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS target_tank_id TEXT;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS allocations JSONB;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS tank_movements (
    id TEXT PRIMARY KEY,
    operation_id TEXT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
    tank_id TEXT NOT NULL REFERENCES tanks(id),
    party_id TEXT NOT NULL REFERENCES parties(id),
    direction TEXT NOT NULL CHECK (direction IN ('IN', 'OUT')),
    quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL DEFAULT 'HUILERIE JEMAI',
    arabic_subtitle TEXT NOT NULL DEFAULT 'معصرة جماعي لإنتاج وتخزين زيت الزيتون',
    phone TEXT NOT NULL DEFAULT '+216 98 000 000',
    address TEXT NOT NULL DEFAULT 'Route Principale des Oliviers - Tunisie',
    unit TEXT NOT NULL DEFAULT 'L',
    threshold NUMERIC(5, 2) NOT NULL DEFAULT 85,
    oil_density NUMERIC(8, 4) NOT NULL DEFAULT 1.1,
    default_milling_fee_per_kg NUMERIC(10, 3) NOT NULL DEFAULT 0.200,
    logo_url TEXT,
    settings_json JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS default_milling_fee_per_kg NUMERIC(10, 3) NOT NULL DEFAULT 0.200;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS settings_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

INSERT INTO app_settings (id, company_name, arabic_subtitle, phone, address, unit, threshold, oil_density, default_milling_fee_per_kg)
VALUES ('default', 'HUILERIE JEMAI', 'معصرة جماعي لإنتاج وتخزين زيت الزيتون', '+216 98 000 000', 'Route Principale des Oliviers - Tunisie', 'L', 85, 1.1, 0.200)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    auth_user_id UUID UNIQUE,
    email TEXT,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operateur',
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_auth_user_id_key'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_auth_user_id_key UNIQUE (auth_user_id);
    END IF;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

UPDATE profiles
SET role = CASE WHEN LOWER(COALESCE(role, '')) IN ('admin', 'gerant', 'administrator') THEN 'admin' ELSE 'operateur' END
WHERE role IS DISTINCT FROM CASE WHEN LOWER(COALESCE(role, '')) IN ('admin', 'gerant', 'administrator') THEN 'admin' ELSE 'operateur' END;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'operateur'));

-- Legacy /api/movement compatibility table
CREATE TABLE IF NOT EXISTS movements (
    id TEXT PRIMARY KEY,
    numero_bon TEXT,
    type_mouvement TEXT,
    cuve_id TEXT,
    client_id TEXT,
    quantite NUMERIC(12, 3),
    acidite NUMERIC(6, 3),
    date_mouvement TIMESTAMPTZ DEFAULT NOW(),
    motif TEXT,
    observations TEXT,
    utilisateur TEXT,
    est_annule BOOLEAN DEFAULT FALSE,
    motif_annulation TEXT,
    date_annulation TIMESTAMPTZ,
    type TEXT,
    quantity NUMERIC(12, 3),
    lot TEXT,
    reason TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. SAFE ARCHIVE OF TEST TANKS (NO HISTORICAL DELETION)
-- ----------------------------------------------------------------------------
UPDATE tanks
SET is_active = FALSE,
    is_deleted = TRUE,
    updated_at = NOW(),
    notes = COALESCE(notes || ' | ', '') || 'Archivé (cuve de test)'
WHERE code IN ('P-TEST-5000', 'P-DEST-3000')
  AND (is_active = TRUE OR is_deleted = FALSE);

-- ----------------------------------------------------------------------------
-- 3. DOCUMENT SEQUENCES (ATOMIC BON NUMBERING)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_sequences (
    doc_type TEXT NOT NULL,
    doc_year INT NOT NULL,
    last_value INT NOT NULL DEFAULT 0,
    PRIMARY KEY (doc_type, doc_year)
);

-- ----------------------------------------------------------------------------
-- 4. OLIVE RECEPTIONS, PAYMENTS & MODIFICATION HISTORY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS olive_receptions (
    id TEXT PRIMARY KEY,
    ticket_number TEXT UNIQUE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    party_id TEXT NOT NULL,
    party_name TEXT NOT NULL,
    party_code TEXT,
    phone TEXT,
    vehicle_plate TEXT,
    driver_name TEXT,
    gross_weight_kg NUMERIC(10, 2) NOT NULL CHECK (gross_weight_kg >= 0),
    tare_weight_kg NUMERIC(10, 2) NOT NULL CHECK (tare_weight_kg >= 0),
    net_weight_kg NUMERIC(10, 2) NOT NULL CHECK (net_weight_kg >= 0),
    milling_fee_per_kg NUMERIC(10, 3) NOT NULL DEFAULT 0.200 CHECK (milling_fee_per_kg >= 0),
    total_milling_fee_tnd NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (total_milling_fee_tnd >= 0),
    paid_amount_tnd NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (paid_amount_tnd >= 0),
    remaining_amount_tnd NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (remaining_amount_tnd >= 0),
    payment_status TEXT NOT NULL DEFAULT 'IMPAYE' CHECK (payment_status IN ('PAYE', 'PARTIEL', 'IMPAYE')),
    status TEXT NOT NULL DEFAULT 'RECU' CHECK (status IN ('RECU', 'EN_FILE', 'EN_COURS', 'TERMINE')),
    notes TEXT,
    operator TEXT NOT NULL DEFAULT 'Opérateur',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure legacy optional columns on olive_receptions never block inserts
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'olive_receptions' AND column_name = 'olive_variety') THEN
        ALTER TABLE olive_receptions ALTER COLUMN olive_variety DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'olive_receptions' AND column_name = 'boxes_count') THEN
        ALTER TABLE olive_receptions ALTER COLUMN boxes_count DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'olive_receptions' AND column_name = 'quality') THEN
        ALTER TABLE olive_receptions ALTER COLUMN quality DROP NOT NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS reception_payments (
    id TEXT PRIMARY KEY,
    reception_id TEXT NOT NULL REFERENCES olive_receptions(id) ON DELETE CASCADE,
    ticket_number TEXT NOT NULL,
    party_name TEXT NOT NULL,
    amount_tnd NUMERIC(12, 3) NOT NULL CHECK (amount_tnd > 0),
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('ESPECES', 'CHEQUE', 'VIREMENT', 'NATURE')),
    reference TEXT,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    operator TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receipt_modification_history (
    id TEXT PRIMARY KEY,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('BON-OLV', 'BON-REC')),
    record_id TEXT NOT NULL,
    doc_number TEXT NOT NULL,
    modified_by_user_id TEXT NOT NULL,
    modified_by_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    before_data JSONB NOT NULL,
    after_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. PRODUCTION BATCHES (TRITURATION: KG ONLY, 1 KG = 1.1 L, PENDING -> CONFIRMED)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS production_batches (
    id TEXT PRIMARY KEY,
    ticket_number TEXT UNIQUE NOT NULL,
    reception_id TEXT NOT NULL REFERENCES olive_receptions(id) ON DELETE RESTRICT,
    reception_ticket TEXT NOT NULL,
    party_id TEXT NOT NULL,
    party_name TEXT NOT NULL,
    party_code TEXT,
    olives_net_kg NUMERIC(10, 2) NOT NULL CHECK (olives_net_kg > 0),
    press_line TEXT DEFAULT '',
    oil_input_unit TEXT NOT NULL DEFAULT 'KG' CHECK (oil_input_unit IN ('KG', 'L')),
    oil_quantity_entered NUMERIC(12, 3) NOT NULL CHECK (oil_quantity_entered >= 0),
    oil_density NUMERIC(8, 4) NOT NULL DEFAULT 1.1,
    oil_quantity_kg NUMERIC(12, 3) NOT NULL CHECK (oil_quantity_kg >= 0),
    oil_quantity_litres NUMERIC(12, 3) NOT NULL CHECK (oil_quantity_litres >= 0),
    yield_percentage NUMERIC(8, 3) NOT NULL DEFAULT 0,
    yield_litres_per_100kg NUMERIC(8, 3) NOT NULL DEFAULT 0,
    grignons_estimated_kg NUMERIC(10, 2) NOT NULL DEFAULT 0,
    milling_fee_rate NUMERIC(10, 3) NOT NULL DEFAULT 0,
    milling_fee_mode TEXT NOT NULL DEFAULT 'ESPECES',
    milling_fee_total_tnd NUMERIC(12, 3) NOT NULL DEFAULT 0,
    milling_fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
    operator TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'EN_ATTENTE' CHECK (status IN ('EN_ATTENTE', 'EN_COURS', 'CONFIRME')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    confirmed_by TEXT,
    confirmed_at TIMESTAMPTZ,
    oil_destination TEXT NOT NULL DEFAULT 'NON_DEFINI' CHECK (oil_destination IN ('SORTIE_CLIENT', 'STOCKAGE_CUVE', 'NON_DEFINI')),
    destination_tank_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. GRIGNONS SALES, PURCHASES, EXPENSES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grignon_sales (
    id TEXT PRIMARY KEY,
    doc_number TEXT UNIQUE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    buyer_name TEXT NOT NULL,
    truck_plate TEXT NOT NULL,
    driver_name TEXT,
    gross_weight_kg NUMERIC(10, 2) NOT NULL CHECK (gross_weight_kg >= 0),
    tare_weight_kg NUMERIC(10, 2) NOT NULL CHECK (tare_weight_kg >= 0),
    net_weight_kg NUMERIC(10, 2) NOT NULL CHECK (net_weight_kg >= 0),
    net_weight_tonnes NUMERIC(10, 4) NOT NULL CHECK (net_weight_tonnes >= 0),
    price_unit TEXT NOT NULL DEFAULT 'TONNE' CHECK (price_unit IN ('TONNE', 'KG')),
    unit_price_per_tonne_tnd NUMERIC(12, 3) NOT NULL CHECK (unit_price_per_tonne_tnd >= 0),
    unit_price_tnd NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (unit_price_tnd >= 0),
    total_price_tnd NUMERIC(12, 3) NOT NULL CHECK (total_price_tnd >= 0),
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('ESPECES', 'CHEQUE', 'VIREMENT', 'A_TERME')),
    payment_status TEXT NOT NULL CHECK (payment_status IN ('PAYE', 'IMPAYE')),
    operator TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE grignon_sales ADD COLUMN IF NOT EXISTS price_unit TEXT NOT NULL DEFAULT 'TONNE';
ALTER TABLE grignon_sales ADD COLUMN IF NOT EXISTS unit_price_tnd NUMERIC(12, 3) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    doc_number TEXT UNIQUE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_name TEXT NOT NULL,
    supplier_phone TEXT,
    item_type TEXT NOT NULL CHECK (item_type IN ('OLIVES', 'HUILE_VRAC')),
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    unit_price_tnd NUMERIC(12, 3) NOT NULL CHECK (unit_price_tnd >= 0),
    total_price_tnd NUMERIC(12, 3) NOT NULL CHECK (total_price_tnd >= 0),
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('ESPECES', 'CHEQUE', 'VIREMENT', 'A_TERME')),
    payment_status TEXT NOT NULL CHECK (payment_status IN ('PAYE', 'IMPAYE')),
    operator TEXT NOT NULL,
    destination_tank_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'variety') THEN
        ALTER TABLE purchases ALTER COLUMN variety DROP NOT NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL CHECK (category IN ('ENERGIE_ELECTRICITE', 'MAIN_DOEUVRE', 'MAINTENANCE_PIECES', 'EAU_ASSAINISSEMENT', 'TRANSPORT', 'DIVERS')),
    label TEXT NOT NULL,
    amount_tnd NUMERIC(12, 3) NOT NULL CHECK (amount_tnd >= 0),
    beneficiary TEXT,
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('ESPECES', 'CHEQUE', 'VIREMENT')),
    operator TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. PERSONNEL & PAYROLL (EMPLOYEES, ADVANCES, MONTHLY SETTLEMENT)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role_title TEXT NOT NULL DEFAULT 'Ouvrier Huilerie',
    base_salary_tnd NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (base_salary_tnd >= 0),
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salary_advances (
    id TEXT PRIMARY KEY,
    doc_number TEXT UNIQUE NOT NULL,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    employee_name TEXT NOT NULL,
    amount_tnd NUMERIC(12, 3) NOT NULL CHECK (amount_tnd > 0),
    advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_month TEXT NOT NULL, -- YYYY-MM
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('ESPECES', 'CHEQUE', 'VIREMENT')),
    operator TEXT NOT NULL,
    notes TEXT,
    is_settled BOOLEAN NOT NULL DEFAULT FALSE,
    settlement_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salary_payments (
    id TEXT PRIMARY KEY,
    doc_number TEXT UNIQUE NOT NULL,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    employee_name TEXT NOT NULL,
    period_month TEXT NOT NULL, -- YYYY-MM
    base_salary_tnd NUMERIC(12, 3) NOT NULL CHECK (base_salary_tnd >= 0),
    total_advances_tnd NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (total_advances_tnd >= 0),
    previous_payments_tnd NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (previous_payments_tnd >= 0),
    net_paid_tnd NUMERIC(12, 3) NOT NULL CHECK (net_paid_tnd >= 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('ESPECES', 'CHEQUE', 'VIREMENT')),
    operator TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_salary_payment_employee_month UNIQUE (employee_id, period_month)
);

-- ----------------------------------------------------------------------------
-- 8. AUDIT LOGS (APPEND-ONLY)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id TEXT,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    record_id TEXT,
    details TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 9. INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_receptions_date ON olive_receptions(date);
CREATE INDEX IF NOT EXISTS idx_receptions_status ON olive_receptions(status);
CREATE INDEX IF NOT EXISTS idx_receptions_payment_status ON olive_receptions(payment_status);
CREATE INDEX IF NOT EXISTS idx_receptions_party_id ON olive_receptions(party_id);
CREATE INDEX IF NOT EXISTS idx_payments_reception_id ON reception_payments(reception_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON reception_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_mod_history_record ON receipt_modification_history(doc_type, record_id);
CREATE INDEX IF NOT EXISTS idx_prod_batches_party ON production_batches(party_id);
CREATE INDEX IF NOT EXISTS idx_prod_batches_status ON production_batches(status);
CREATE INDEX IF NOT EXISTS idx_tank_movements_op ON tank_movements(operation_id);
CREATE INDEX IF NOT EXISTS idx_tank_movements_tank ON tank_movements(tank_id);
CREATE INDEX IF NOT EXISTS idx_tank_movements_party ON tank_movements(party_id);
CREATE INDEX IF NOT EXISTS idx_salary_adv_emp_month ON salary_advances(employee_id, period_month);
CREATE INDEX IF NOT EXISTS idx_salary_pay_emp_month ON salary_payments(employee_id, period_month);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ts ON audit_logs(timestamp DESC);

-- ----------------------------------------------------------------------------
-- 10. BACKFILL DOCUMENT SEQUENCES FROM EXISTING RECORDS
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_year INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
BEGIN
    INSERT INTO document_sequences (doc_type, doc_year, last_value)
    SELECT 'OLV', v_year, COALESCE(MAX((regexp_match(ticket_number, '(\d+)$'))[1]::INT), 0)
    FROM olive_receptions WHERE ticket_number LIKE 'BON-OLV-' || v_year || '-%'
    ON CONFLICT (doc_type, doc_year) DO UPDATE SET last_value = GREATEST(document_sequences.last_value, EXCLUDED.last_value);

    INSERT INTO document_sequences (doc_type, doc_year, last_value)
    SELECT 'PRD', v_year, COALESCE(MAX((regexp_match(ticket_number, '(\d+)$'))[1]::INT), 0)
    FROM production_batches WHERE ticket_number LIKE 'BON-PRD-' || v_year || '-%'
    ON CONFLICT (doc_type, doc_year) DO UPDATE SET last_value = GREATEST(document_sequences.last_value, EXCLUDED.last_value);

    INSERT INTO document_sequences (doc_type, doc_year, last_value)
    SELECT 'GRI', v_year, COALESCE(MAX((regexp_match(doc_number, '(\d+)$'))[1]::INT), 0)
    FROM grignon_sales WHERE doc_number LIKE 'BON-GRI-' || v_year || '-%'
    ON CONFLICT (doc_type, doc_year) DO UPDATE SET last_value = GREATEST(document_sequences.last_value, EXCLUDED.last_value);

    INSERT INTO document_sequences (doc_type, doc_year, last_value)
    SELECT 'ACH', v_year, COALESCE(MAX((regexp_match(doc_number, '(\d+)$'))[1]::INT), 0)
    FROM purchases WHERE doc_number LIKE 'BON-ACH-' || v_year || '-%'
    ON CONFLICT (doc_type, doc_year) DO UPDATE SET last_value = GREATEST(document_sequences.last_value, EXCLUDED.last_value);

    INSERT INTO document_sequences (doc_type, doc_year, last_value)
    SELECT 'REC', v_year, COALESCE(MAX((regexp_match(doc_number, '(\d+)$'))[1]::INT), 0)
    FROM operations WHERE doc_number LIKE 'BON-REC-' || v_year || '-%'
    ON CONFLICT (doc_type, doc_year) DO UPDATE SET last_value = GREATEST(document_sequences.last_value, EXCLUDED.last_value);

    INSERT INTO document_sequences (doc_type, doc_year, last_value)
    SELECT 'SOR', v_year, COALESCE(MAX((regexp_match(doc_number, '(\d+)$'))[1]::INT), 0)
    FROM operations WHERE doc_number LIKE 'BON-SOR-' || v_year || '-%'
    ON CONFLICT (doc_type, doc_year) DO UPDATE SET last_value = GREATEST(document_sequences.last_value, EXCLUDED.last_value);

    INSERT INTO document_sequences (doc_type, doc_year, last_value)
    SELECT 'TRF', v_year, COALESCE(MAX((regexp_match(doc_number, '(\d+)$'))[1]::INT), 0)
    FROM operations WHERE doc_number LIKE 'BON-TRF-' || v_year || '-%'
    ON CONFLICT (doc_type, doc_year) DO UPDATE SET last_value = GREATEST(document_sequences.last_value, EXCLUDED.last_value);

    INSERT INTO document_sequences (doc_type, doc_year, last_value)
    SELECT 'CLI', 0, COALESCE(MAX((regexp_match(code, '(\d+)$'))[1]::INT), 0)
    FROM parties WHERE code LIKE 'CLI-%'
    ON CONFLICT (doc_type, doc_year) DO UPDATE SET last_value = GREATEST(document_sequences.last_value, EXCLUDED.last_value);
END $$;
