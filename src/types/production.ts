/**
 * Types for Huilerie Jemai ERP modules:
 * 1. Olive Reception & Modification Audit
 * 2. Production Queue & Milling (Trituration: kg only, 1 kg = 1.1 L)
 * 3. Customer Production History
 * 4. Grignons (Olive Pomace) Sales
 * 5. Purchases & Expenses
 * 6. Personnel & Payroll
 */

export type OliveQuality = 'Superieure' | 'Standard' | 'Feuilles_Tiges' | 'Piquee';
export type ReceptionStatus = 'RECU' | 'EN_FILE' | 'EN_COURS' | 'TERMINE';
export type ProductionStatus = 'EN_ATTENTE' | 'EN_COURS' | 'CONFIRME';
export type OilDestination = 'SORTIE_CLIENT' | 'STOCKAGE_CUVE' | 'NON_DEFINI';
export type MillingPaymentMode = 'ESPECES' | 'NATURE' | 'CHEQUE' | 'A_TERME';
export type GrignonPaymentMode = 'ESPECES' | 'CHEQUE' | 'VIREMENT' | 'A_TERME';
export type GrignonPriceUnit = 'TONNE' | 'KG';
export type PaymentStatus = 'PAYE' | 'PARTIEL' | 'IMPAYE';

export interface ReceptionPayment {
  id: string;
  reception_id: string;
  ticket_number: string;
  party_name: string;
  amount_tnd: number;
  payment_mode: 'ESPECES' | 'CHEQUE' | 'VIREMENT' | 'NATURE';
  reference?: string;
  payment_date: string;
  operator: string;
  notes?: string;
  created_at: string;
}

export interface ReceiptModificationHistory {
  id: string;
  doc_type: 'BON-OLV' | 'BON-REC';
  record_id: string;
  doc_number: string;
  modified_by_user_id: string;
  modified_by_name: string;
  reason: string;
  before_data: Record<string, any>;
  after_data: Record<string, any>;
  created_at: string;
}

export interface OliveReception {
  id: string;
  ticket_number: string; // e.g. BON-OLV-2026-0001
  date: string;
  party_id: string;
  party_name: string;
  party_code?: string;
  phone?: string;
  vehicle_plate?: string;
  driver_name?: string;
  gross_weight_kg: number;
  tare_weight_kg: number;
  net_weight_kg: number;
  milling_fee_per_kg: number;
  total_milling_fee_tnd: number;
  paid_amount_tnd: number;
  remaining_amount_tnd: number;
  payment_status: PaymentStatus;
  payments?: ReceptionPayment[];
  status: ReceptionStatus;
  notes?: string | null;
  operator: string;
  created_at: string;
  updated_at?: string;
}

export interface ProductionBatch {
  id: string;
  ticket_number: string; // e.g. BON-PRD-2026-0001
  reception_id: string;
  reception_ticket: string;
  party_id: string;
  party_name: string;
  party_code?: string;
  olives_net_kg: number;
  press_line?: string;
  oil_input_unit: 'KG' | 'L';
  oil_quantity_entered: number;
  oil_density: number; // Fixed conversion factor 1.1 L/kg
  oil_quantity_kg: number;
  oil_quantity_litres: number; // oil_quantity_kg * 1.1
  yield_percentage: number; // (oil_quantity_kg / olives_net_kg) * 100
  yield_litres_per_100kg: number; // (oil_quantity_litres / olives_net_kg) * 100
  grignons_estimated_kg: number;
  milling_fee_rate: number;
  milling_fee_mode: MillingPaymentMode;
  milling_fee_total_tnd: number;
  milling_fee_paid: boolean;
  operator: string;
  status: ProductionStatus;
  started_at: string;
  completed_at?: string;
  is_confirmed: boolean;
  confirmed_by?: string;
  confirmed_at?: string;
  oil_destination: OilDestination;
  destination_tank_id?: string;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface GrignonSale {
  id: string;
  doc_number: string; // e.g. BON-GRI-2026-0001
  date: string;
  buyer_name: string;
  truck_plate: string;
  driver_name?: string | null;
  gross_weight_kg: number;
  tare_weight_kg: number;
  net_weight_kg: number;
  net_weight_tonnes: number;
  price_unit: GrignonPriceUnit;
  unit_price_per_tonne_tnd: number;
  unit_price_tnd: number;
  total_price_tnd: number;
  payment_mode: GrignonPaymentMode;
  payment_status: 'PAYE' | 'IMPAYE';
  operator: string;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CustomerProductionSummary {
  party_id: string;
  party_name: string;
  party_code: string;
  phone?: string;
  total_receptions_count: number;
  total_olives_kg: number;
  total_oil_kg: number;
  total_oil_litres: number;
  average_yield_percent: number;
  average_yield_l_per_100kg: number;
  total_milling_fees_tnd: number;
  milling_fees_paid_tnd: number;
  milling_fees_due_tnd: number;
  oil_taken_home_litres: number;
  oil_transferred_to_tanks_litres: number;
  batches: ProductionBatch[];
}

export interface PurchaseBatch {
  id: string;
  doc_number: string; // e.g. BON-ACH-2026-0001
  date: string;
  supplier_name: string;
  supplier_phone?: string | null;
  item_type: 'OLIVES' | 'HUILE_VRAC';
  quantity: number; // KG for olives, L for oil
  unit_price_tnd: number;
  total_price_tnd: number;
  payment_mode: 'ESPECES' | 'CHEQUE' | 'VIREMENT' | 'A_TERME';
  payment_status: 'PAYE' | 'IMPAYE';
  operator: string;
  destination_tank_id?: string;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ExpenseItem {
  id: string;
  date: string;
  category:
    | 'ENERGIE_ELECTRICITE'
    | 'MAIN_DOEUVRE'
    | 'MAINTENANCE_PIECES'
    | 'EAU_ASSAINISSEMENT'
    | 'TRANSPORT'
    | 'DIVERS';
  label: string;
  amount_tnd: number;
  beneficiary?: string;
  payment_mode: 'ESPECES' | 'CHEQUE' | 'VIREMENT';
  operator: string;
  notes?: string;
  created_at: string;
}

export interface Employee {
  id: string;
  code: string; // EMP-001
  full_name: string;
  phone?: string | null;
  role_title: string;
  base_salary_tnd: number;
  hire_date: string;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface SalaryAdvance {
  id: string;
  doc_number: string; // BON-ADV-2026-0001
  employee_id: string;
  employee_name: string;
  amount_tnd: number;
  advance_date: string;
  period_month: string; // YYYY-MM
  payment_mode: 'ESPECES' | 'CHEQUE' | 'VIREMENT';
  operator: string;
  notes?: string | null;
  is_settled: boolean;
  settlement_id?: string | null;
  created_at: string;
}

export interface SalaryPayment {
  id: string;
  doc_number: string; // BON-PAY-2026-0001
  employee_id: string;
  employee_name: string;
  period_month: string; // YYYY-MM
  base_salary_tnd: number;
  total_advances_tnd: number;
  previous_payments_tnd: number;
  net_paid_tnd: number;
  payment_date: string;
  payment_mode: 'ESPECES' | 'CHEQUE' | 'VIREMENT';
  operator: string;
  notes?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  user_id?: string;
  action: string;
  module: string;
  record_id?: string;
  details: string;
}
