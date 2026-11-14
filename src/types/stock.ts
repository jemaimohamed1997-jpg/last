/**
 * Types for the original Gestion de Stock Huilerie Jemai module
 * STRICTLY PRESERVED AND PROTECTED: Cuves, Parties, Operations, TankMovements
 */
import type { PermissionMatrix } from '../lib/permissions';

export type TankDirection = 'IN' | 'OUT';

export interface Tank {
  id: string;
  code: string;
  name: string;
  capacity: number;
  is_active: boolean;
  notes?: string | null;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Party {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  notes?: string | null;
  is_active?: boolean;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TankAllocation {
  tank_id: string;
  quantity: number; // in Litres
}

export interface Operation {
  id: string;
  doc_number: string; // e.g. BON-REC-2026-0001, BON-SOR-2026-0001, BON-TRF-2026-0001
  type: 'ENTREE' | 'SORTIE' | 'TRANSFERT';
  party_id: string;
  operator: string;
  total_quantity: number;
  notes?: string | null;
  status: 'VALIDE' | 'ANNULE';
  operation_date: string;
  created_at?: string;
  updated_at?: string;
  source_tank_id?: string;
  target_tank_id?: string;
  allocations?: TankAllocation[];
}

export interface TankMovement {
  id: string;
  operation_id: string;
  tank_id: string;
  party_id: string;
  direction: TankDirection;
  quantity: number;
  notes?: string | null;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  auth_user_id?: string | null;
  email?: string | null;
  username: string;
  display_name: string;
  role: 'admin' | 'operateur';
  phone?: string | null;
  is_active: boolean;
  permissions?: PermissionMatrix;
  created_at?: string;
  updated_at?: string;
}

export interface AppSettings {
  id: string;
  company_name: string;
  arabic_subtitle: string;
  phone: string;
  address: string;
  unit: string;
  threshold: number; // Filling threshold alert %
  oil_density: number; // Fixed 1.1 L/kg conversion reference
  default_milling_fee_per_kg: number; // e.g. 0.200 TND/kg
  logo_url?: string | null;
  settings_json?: Record<string, unknown>;
  updated_at?: string;
}

export interface TankStockDetail {
  tank: Tank;
  current_quantity: number;
  fill_percentage: number;
  remaining_capacity: number;
  is_alert: boolean;
  clients_breakdown: {
    party_id: string;
    party_name: string;
    party_code: string;
    quantity: number;
    percentage_of_tank: number;
  }[];
}

export interface ClientStockSummary {
  party: Party;
  total_quantity: number;
  tanks_distribution: {
    tank_id: string;
    tank_name: string;
    tank_code: string;
    quantity: number;
  }[];
  total_operations: number;
  last_operation_date?: string;
}
