/**
 * Unified Supabase client, Auth, Storage, RPC and CRUD engine for Huilerie Jemai ERP.
 * Single source of truth: Supabase PostgreSQL (no localStorage business persistence, no hardcoded keys).
 */
import { supabase, isSupabaseConfigured, requireSupabase } from '../services/supabase';
import { Tank, Party, Operation, TankMovement, UserProfile, AppSettings } from '../types/stock';
import {
  OliveReception,
  ReceptionPayment,
  ReceiptModificationHistory,
  ProductionBatch,
  GrignonSale,
  PurchaseBatch,
  ExpenseItem,
  Employee,
  SalaryAdvance,
  SalaryPayment,
  AuditLog,
} from '../types/production';
import { DEFAULT_OPERATOR_PERMISSIONS, ADMIN_FULL_PERMISSIONS, PermissionMatrix } from './permissions';

export { supabase, isSupabaseConfigured };

export const OIL_KG_TO_LITRES_FACTOR = 1.1;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'default',
  company_name: 'HUILERIE JEMAI',
  arabic_subtitle: 'معصرة جماعي لإنتاج وتخزين زيت الزيتون',
  phone: '+216 98 000 000',
  address: 'Route Principale des Oliviers - Tunisie',
  unit: 'L',
  threshold: 85,
  oil_density: OIL_KG_TO_LITRES_FACTOR,
  default_milling_fee_per_kg: 0.200,
  logo_url: null,
  settings_json: {
    unite: 'L',
    precisionDecimales: 1,
    alertSeuilRemplissage: 85,
  },
};

// ----------------------------------------------------------------------------
// AUTHENTICATION & PROFILE RESOLUTION
// ----------------------------------------------------------------------------
export async function getCurrentAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signInWithEmailPassword(email: string, password: string): Promise<UserProfile> {
  const client = requireSupabase();
  const cleanEmail = email.trim().toLowerCase();
  const { data, error } = await client.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });
  if (error || !data.user) {
    throw new Error(error?.message || 'Identifiants invalides.');
  }

  let profile: UserProfile | null = null;
  try {
    profile = await fetchProfileByAuthUserId(data.user.id);
    if (!profile) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      profile = await fetchProfileByAuthUserId(data.user.id);
    }
  } catch (err: any) {
    await client.auth.signOut().catch(() => {});
    throw new Error(err?.message || 'Impossible de charger votre profil utilisateur.');
  }

  if (!profile) {
    await client.auth.signOut().catch(() => {});
    throw new Error(
      'Profil utilisateur inactif ou introuvable. Contactez un administrateur.'
    );
  }
  if (!profile.is_active) {
    await client.auth.signOut().catch(() => {});
    throw new Error('Profil utilisateur inactif ou introuvable. Votre compte est désactivé.');
  }
  return profile;
}

export async function signOutSession(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function fetchProfileByAuthUserId(authUserId: string): Promise<UserProfile | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erreur chargement profil : ${error.message}`);
  }
  if (!data) return null;

  const normalizedRole: 'admin' | 'operateur' =
    String(data.role || '').toLowerCase() === 'admin' ? 'admin' : 'operateur';
  const hasExplicitPermissions =
    data.permissions &&
    typeof data.permissions === 'object' &&
    !Array.isArray(data.permissions) &&
    Object.keys(data.permissions).length > 0;
  const permissions: PermissionMatrix =
    normalizedRole === 'admin'
      ? ADMIN_FULL_PERMISSIONS
      : hasExplicitPermissions
        ? data.permissions
        : DEFAULT_OPERATOR_PERMISSIONS;

  return {
    id: data.id,
    auth_user_id: data.auth_user_id,
    email: data.email || null,
    username: data.username,
    display_name: data.display_name,
    role: normalizedRole,
    phone: data.phone || null,
    is_active: data.is_active !== false,
    permissions,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function fetchCurrentUserAndProfile(): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data: sessData } = await supabase.auth.getSession();
  const user = sessData?.session?.user;
  if (!user) return null;
  try {
    const profile = await fetchProfileByAuthUserId(user.id);
    if (!profile || !profile.is_active) return null;
    return profile;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// STORAGE: COMPANY LOGO UPLOAD (huilerie-assets)
// ----------------------------------------------------------------------------
export async function uploadCompanyLogo(file: File): Promise<string> {
  const client = requireSupabase();
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const allowedExts = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
  if (!allowedExts.includes(ext)) {
    throw new Error('Format de logo invalide. Formats acceptés : PNG, JPG, WEBP, SVG.');
  }
  if (file.size > 3 * 1024 * 1024) {
    throw new Error('Le fichier logo dépasse la taille maximale de 3 Mo.');
  }

  const filePath = `company/logo-${Date.now()}.${ext}`;
  const { error: upErr } = await client.storage
    .from('huilerie-assets')
    .upload(filePath, file, { upsert: true, contentType: file.type });

  if (upErr) {
    throw new Error(`Échec upload logo : ${upErr.message}`);
  }

  const { data: pubData } = client.storage.from('huilerie-assets').getPublicUrl(filePath);
  const publicUrl = pubData.publicUrl;

  const { error: setErr } = await client
    .from('app_settings')
    .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', 'default');

  if (setErr) {
    throw new Error(`Logo téléversé mais erreur sauvegarde paramètres : ${setErr.message}`);
  }

  return publicUrl;
}

// ----------------------------------------------------------------------------
// ATOMIC DOCUMENT NUMBERING & CORE RPCs
// ----------------------------------------------------------------------------
export type DocumentCodeType =
  | 'OLV'
  | 'PRD'
  | 'GRI'
  | 'ACH'
  | 'REC'
  | 'SOR'
  | 'TRF'
  | 'ADV'
  | 'PAY'
  | 'CLI';

export async function getNextBonNumber(type: DocumentCodeType, year?: number): Promise<string> {
  const client = requireSupabase();
  const targetYear = type === 'CLI' ? 0 : year ?? new Date().getFullYear();
  const { data, error } = await client.rpc('get_next_bon_number', {
    p_type: type,
    p_year: targetYear,
  });
  if (error || !data) {
    throw new Error(error?.message || `Impossible de générer le numéro ${type}.`);
  }
  return String(data);
}

// ----------------------------------------------------------------------------
// STOCK FETCHERS & MUTATIONS (TANKS, PARTIES, OPERATIONS, TANK MOVEMENTS)
// ----------------------------------------------------------------------------
export async function fetchLiveTanks(): Promise<Tank[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('tanks')
    .select('*')
    .eq('is_deleted', false)
    .order('code', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((t: any) => ({
    ...t,
    capacity: Number(t.capacity),
  })) as Tank[];
}

export async function fetchLiveParties(): Promise<Party[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('parties')
    .select('*')
    .eq('is_deleted', false)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as Party[];
}

export async function createPartyRecord(input: {
  name: string;
  phone?: string;
  notes?: string;
}): Promise<Party> {
  const client = requireSupabase();
  const code = await getNextBonNumber('CLI');
  const id = `cli-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const row = {
    id,
    code,
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    notes: input.notes?.trim() || null,
    is_active: true,
    is_deleted: false,
  };
  const { data, error } = await client.from('parties').insert([row]).select().single();
  if (error || !data) {
    throw new Error(error?.message || 'Erreur création client.');
  }
  return data as Party;
}

export async function updatePartyRecord(
  id: string,
  updates: { name: string; phone?: string; notes?: string }
): Promise<Party> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('parties')
    .update({
      name: updates.name.trim(),
      phone: updates.phone?.trim() || null,
      notes: updates.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error || !data) {
    throw new Error(error?.message || 'Erreur modification client.');
  }
  return data as Party;
}

export async function togglePartyActiveRecord(id: string, isActive: boolean): Promise<Party> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('parties')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error || !data) {
    throw new Error(error?.message || 'Erreur changement statut client.');
  }
  return data as Party;
}

export async function fetchLiveOperations(): Promise<Operation[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('operations')
    .select('*')
    .order('operation_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((op: any) => ({
    ...op,
    total_quantity: Number(op.total_quantity),
  })) as Operation[];
}

export async function fetchLiveTankMovements(): Promise<TankMovement[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('tank_movements')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((tm: any) => ({
    ...tm,
    quantity: Number(tm.quantity),
  })) as TankMovement[];
}

export async function fetchLiveAppSettings(): Promise<AppSettings> {
  const client = requireSupabase();
  const { data, error } = await client.from('app_settings').select('*').limit(1).maybeSingle();
  if (error || !data) {
    return DEFAULT_APP_SETTINGS;
  }
  return {
    ...DEFAULT_APP_SETTINGS,
    ...data,
    threshold: Number(data.threshold ?? DEFAULT_APP_SETTINGS.threshold),
    oil_density: OIL_KG_TO_LITRES_FACTOR,
    default_milling_fee_per_kg: Number(
      data.default_milling_fee_per_kg ?? DEFAULT_APP_SETTINGS.default_milling_fee_per_kg
    ),
    logo_url: data.logo_url || null,
  };
}

export async function saveLiveAppSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  const client = requireSupabase();
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.company_name !== undefined) payload.company_name = updates.company_name;
  if (updates.arabic_subtitle !== undefined) payload.arabic_subtitle = updates.arabic_subtitle;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.address !== undefined) payload.address = updates.address;
  if (updates.unit !== undefined) payload.unit = updates.unit;
  if (updates.threshold !== undefined) payload.threshold = Number(updates.threshold);
  if (updates.default_milling_fee_per_kg !== undefined) {
    payload.default_milling_fee_per_kg = Number(updates.default_milling_fee_per_kg);
  }
  if (updates.logo_url !== undefined) payload.logo_url = updates.logo_url;
  if (updates.settings_json !== undefined) payload.settings_json = updates.settings_json;

  const { data, error } = await client
    .from('app_settings')
    .update(payload)
    .eq('id', 'default')
    .select()
    .single();
  if (error || !data) {
    throw new Error(error?.message || 'Erreur sauvegarde paramètres.');
  }
  return { ...DEFAULT_APP_SETTINGS, ...data, oil_density: OIL_KG_TO_LITRES_FACTOR };
}

export async function saveLiveOperation(
  operation: Operation,
  tankMovements: TankMovement[]
): Promise<boolean> {
  const client = requireSupabase();
  const { error: opErr } = await client.from('operations').upsert({
    id: operation.id,
    doc_number: operation.doc_number,
    type: operation.type,
    party_id: operation.party_id,
    operator: operation.operator,
    total_quantity: operation.total_quantity,
    notes: operation.notes ?? null,
    status: operation.status,
    operation_date: operation.operation_date,
    source_tank_id: operation.source_tank_id ?? null,
    target_tank_id: operation.target_tank_id ?? null,
    allocations: operation.allocations ?? null,
  });
  if (opErr) throw new Error(opErr.message);

  if (tankMovements && tankMovements.length > 0) {
    const { error: tmErr } = await client.from('tank_movements').upsert(
      tankMovements.map((tm) => ({
        id: tm.id,
        operation_id: tm.operation_id,
        tank_id: tm.tank_id,
        party_id: tm.party_id,
        direction: tm.direction,
        quantity: tm.quantity,
        notes: tm.notes ?? null,
        created_at: tm.created_at || new Date().toISOString(),
      }))
    );
    if (tmErr) throw new Error(tmErr.message);
  }
  return true;
}

export async function editStockReceptionRpc(params: {
  operationId: string;
  tankId: string;
  partyId: string;
  quantity: number;
  operationDate: string;
  notes?: string;
  reason: string;
}): Promise<any> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('edit_stock_reception', {
    p_operation_id: params.operationId,
    p_tank_id: params.tankId,
    p_party_id: params.partyId,
    p_quantity: params.quantity,
    p_operation_date: params.operationDate,
    p_notes: params.notes || null,
    p_reason: params.reason,
  });
  if (error) throw new Error(error.message);
  return data;
}

// ----------------------------------------------------------------------------
// OLIVE RECEPTIONS, PAYMENTS & MODIFICATION HISTORY
// ----------------------------------------------------------------------------
export async function fetchOliveReceptions(): Promise<OliveReception[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('olive_receptions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    ...r,
    gross_weight_kg: Number(r.gross_weight_kg),
    tare_weight_kg: Number(r.tare_weight_kg),
    net_weight_kg: Number(r.net_weight_kg),
    milling_fee_per_kg: Number(r.milling_fee_per_kg),
    total_milling_fee_tnd: Number(r.total_milling_fee_tnd),
    paid_amount_tnd: Number(r.paid_amount_tnd),
    remaining_amount_tnd: Number(r.remaining_amount_tnd),
  })) as OliveReception[];
}

export async function createOliveReceptionRecord(
  input: Omit<OliveReception, 'id' | 'ticket_number' | 'created_at' | 'updated_at'>
): Promise<OliveReception> {
  const client = requireSupabase();
  const ticketNumber = await getNextBonNumber('OLV', new Date(input.date).getFullYear());
  const id = `olv-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const row = {
    id,
    ticket_number: ticketNumber,
    date: input.date,
    party_id: input.party_id,
    party_name: input.party_name,
    party_code: input.party_code || null,
    phone: input.phone || null,
    vehicle_plate: input.vehicle_plate || null,
    driver_name: input.driver_name || null,
    gross_weight_kg: input.gross_weight_kg,
    tare_weight_kg: input.tare_weight_kg,
    net_weight_kg: input.net_weight_kg,
    milling_fee_per_kg: input.milling_fee_per_kg,
    total_milling_fee_tnd: input.total_milling_fee_tnd,
    paid_amount_tnd: input.paid_amount_tnd,
    remaining_amount_tnd: input.remaining_amount_tnd,
    payment_status: input.payment_status,
    status: input.status,
    notes: input.notes || null,
    operator: input.operator,
  };
  const { data, error } = await client.from('olive_receptions').insert([row]).select().single();
  if (error || !data) throw new Error(error?.message || 'Erreur création réception olives.');
  return {
    ...data,
    gross_weight_kg: Number(data.gross_weight_kg),
    tare_weight_kg: Number(data.tare_weight_kg),
    net_weight_kg: Number(data.net_weight_kg),
    milling_fee_per_kg: Number(data.milling_fee_per_kg),
    total_milling_fee_tnd: Number(data.total_milling_fee_tnd),
    paid_amount_tnd: Number(data.paid_amount_tnd),
    remaining_amount_tnd: Number(data.remaining_amount_tnd),
  } as OliveReception;
}

export async function editOliveReceptionRpc(params: {
  receptionId: string;
  date: string;
  partyId: string;
  partyName: string;
  partyCode?: string;
  phone?: string;
  vehiclePlate?: string;
  driverName?: string;
  grossWeightKg: number;
  tareWeightKg: number;
  millingFeePerKg: number;
  notes?: string;
  reason: string;
}): Promise<OliveReception> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('edit_olive_reception', {
    p_reception_id: params.receptionId,
    p_date: params.date,
    p_party_id: params.partyId,
    p_party_name: params.partyName,
    p_party_code: params.partyCode || null,
    p_phone: params.phone || null,
    p_vehicle_plate: params.vehiclePlate || null,
    p_driver_name: params.driverName || null,
    p_gross_weight_kg: params.grossWeightKg,
    p_tare_weight_kg: params.tareWeightKg,
    p_milling_fee_per_kg: params.millingFeePerKg,
    p_notes: params.notes || null,
    p_reason: params.reason,
  });
  if (error) throw new Error(error.message);
  return data as OliveReception;
}

export async function fetchReceptionPayments(): Promise<ReceptionPayment[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('reception_payments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((p: any) => ({
    ...p,
    amount_tnd: Number(p.amount_tnd),
  })) as ReceptionPayment[];
}

export async function recordReceptionPaymentRpc(params: {
  receptionId: string;
  amountTnd: number;
  paymentMode: 'ESPECES' | 'CHEQUE' | 'VIREMENT' | 'NATURE';
  reference?: string;
  paymentDate?: string;
  notes?: string;
}): Promise<{ payment_id: string; reception: OliveReception }> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('record_reception_payment', {
    p_reception_id: params.receptionId,
    p_amount_tnd: params.amountTnd,
    p_payment_mode: params.paymentMode,
    p_reference: params.reference || null,
    p_payment_date: params.paymentDate || new Date().toISOString().split('T')[0],
    p_notes: params.notes || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchModificationHistory(
  docType?: 'BON-OLV' | 'BON-REC',
  recordId?: string
): Promise<ReceiptModificationHistory[]> {
  const client = requireSupabase();
  let query = client
    .from('receipt_modification_history')
    .select('*')
    .order('created_at', { ascending: false });
  if (docType) query = query.eq('doc_type', docType);
  if (recordId) query = query.eq('record_id', recordId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as ReceiptModificationHistory[];
}

// ----------------------------------------------------------------------------
// PRODUCTION BATCHES (TRITURATION: KG ONLY, 1 KG = 1.1 L)
// ----------------------------------------------------------------------------
export async function fetchProductionBatches(): Promise<ProductionBatch[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('production_batches')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((b: any) => ({
    ...b,
    olives_net_kg: Number(b.olives_net_kg),
    oil_quantity_entered: Number(b.oil_quantity_entered),
    oil_density: Number(b.oil_density || OIL_KG_TO_LITRES_FACTOR),
    oil_quantity_kg: Number(b.oil_quantity_kg),
    oil_quantity_litres: Number(b.oil_quantity_litres),
    yield_percentage: Number(b.yield_percentage),
    yield_litres_per_100kg: Number(b.yield_litres_per_100kg),
    grignons_estimated_kg: Number(b.grignons_estimated_kg || 0),
    milling_fee_rate: Number(b.milling_fee_rate || 0),
    milling_fee_total_tnd: Number(b.milling_fee_total_tnd || 0),
  })) as ProductionBatch[];
}

export async function createProductionBatchRecord(
  input: Omit<ProductionBatch, 'id' | 'ticket_number' | 'created_at' | 'updated_at'>
): Promise<ProductionBatch> {
  const client = requireSupabase();
  const ticketNumber = await getNextBonNumber('PRD');
  const id = `prd-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const row = {
    id,
    ticket_number: ticketNumber,
    reception_id: input.reception_id,
    reception_ticket: input.reception_ticket,
    party_id: input.party_id,
    party_name: input.party_name,
    party_code: input.party_code || null,
    olives_net_kg: input.olives_net_kg,
    press_line: input.press_line || '',
    oil_input_unit: 'KG',
    oil_quantity_entered: input.oil_quantity_kg,
    oil_density: OIL_KG_TO_LITRES_FACTOR,
    oil_quantity_kg: input.oil_quantity_kg,
    oil_quantity_litres: input.oil_quantity_litres,
    yield_percentage: input.yield_percentage,
    yield_litres_per_100kg: input.yield_litres_per_100kg,
    grignons_estimated_kg: input.grignons_estimated_kg || 0,
    milling_fee_rate: input.milling_fee_rate || 0,
    milling_fee_mode: input.milling_fee_mode || 'ESPECES',
    milling_fee_total_tnd: input.milling_fee_total_tnd || 0,
    milling_fee_paid: Boolean(input.milling_fee_paid),
    operator: input.operator,
    status: 'EN_ATTENTE',
    started_at: input.started_at || new Date().toISOString(),
    completed_at: null,
    is_confirmed: false,
    confirmed_by: null,
    confirmed_at: null,
    oil_destination: 'NON_DEFINI',
    destination_tank_id: null,
    notes: input.notes || null,
  };
  const { data, error } = await client.from('production_batches').insert([row]).select().single();
  if (error || !data) throw new Error(error?.message || 'Erreur création lot trituration.');

  // Update reception status to EN_COURS while pending confirmation
  await client
    .from('olive_receptions')
    .update({ status: 'EN_COURS', updated_at: new Date().toISOString() })
    .eq('id', input.reception_id);

  return {
    ...data,
    olives_net_kg: Number(data.olives_net_kg),
    oil_quantity_entered: Number(data.oil_quantity_entered),
    oil_density: Number(data.oil_density),
    oil_quantity_kg: Number(data.oil_quantity_kg),
    oil_quantity_litres: Number(data.oil_quantity_litres),
    yield_percentage: Number(data.yield_percentage),
    yield_litres_per_100kg: Number(data.yield_litres_per_100kg),
  } as ProductionBatch;
}

export async function confirmProductionBatchRpc(batchId: string): Promise<ProductionBatch> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('confirm_production_batch', {
    p_batch_id: batchId,
  });
  if (error) throw new Error(error.message);
  return data as ProductionBatch;
}

export async function depositProductionToTankRpc(params: {
  batchId: string;
  tankId: string;
  notes?: string;
}): Promise<{ operation_id: string; doc_number: string; tank_id: string; quantity_litres: number }> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('deposit_production_to_tank', {
    p_batch_id: params.batchId,
    p_tank_id: params.tankId,
    p_notes: params.notes || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

// ----------------------------------------------------------------------------
// GRIGNONS SALES, PURCHASES, EXPENSES
// ----------------------------------------------------------------------------
export async function fetchGrignonSales(): Promise<GrignonSale[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('grignon_sales')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((g: any) => ({
    ...g,
    gross_weight_kg: Number(g.gross_weight_kg),
    tare_weight_kg: Number(g.tare_weight_kg),
    net_weight_kg: Number(g.net_weight_kg),
    net_weight_tonnes: Number(g.net_weight_tonnes),
    price_unit: (g.price_unit === 'KG' ? 'KG' : 'TONNE') as 'TONNE' | 'KG',
    unit_price_per_tonne_tnd: Number(g.unit_price_per_tonne_tnd),
    unit_price_tnd: Number(g.unit_price_tnd || g.unit_price_per_tonne_tnd),
    total_price_tnd: Number(g.total_price_tnd),
  })) as GrignonSale[];
}

export async function createGrignonSaleRecord(
  input: Omit<GrignonSale, 'id' | 'doc_number' | 'created_at' | 'updated_at'>
): Promise<GrignonSale> {
  const client = requireSupabase();
  const docNumber = await getNextBonNumber('GRI', new Date(input.date).getFullYear());
  const id = `gri-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const row = {
    id,
    doc_number: docNumber,
    date: input.date,
    buyer_name: input.buyer_name,
    truck_plate: input.truck_plate,
    driver_name: input.driver_name || null,
    gross_weight_kg: input.gross_weight_kg,
    tare_weight_kg: input.tare_weight_kg,
    net_weight_kg: input.net_weight_kg,
    net_weight_tonnes: input.net_weight_tonnes,
    price_unit: input.price_unit,
    unit_price_per_tonne_tnd: input.unit_price_per_tonne_tnd,
    unit_price_tnd: input.unit_price_tnd,
    total_price_tnd: input.total_price_tnd,
    payment_mode: input.payment_mode,
    payment_status: input.payment_status,
    operator: input.operator,
    notes: input.notes || null,
  };
  const { data, error } = await client.from('grignon_sales').insert([row]).select().single();
  if (error || !data) throw new Error(error?.message || 'Erreur création vente grignons.');
  return data as GrignonSale;
}

export async function updateGrignonSalePayment(id: string, status: 'PAYE' | 'IMPAYE'): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('grignon_sales')
    .update({ payment_status: status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchPurchases(): Promise<PurchaseBatch[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('purchases')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((p: any) => ({
    ...p,
    quantity: Number(p.quantity),
    unit_price_tnd: Number(p.unit_price_tnd),
    total_price_tnd: Number(p.total_price_tnd),
  })) as PurchaseBatch[];
}

export async function createPurchaseRecord(
  input: Omit<PurchaseBatch, 'id' | 'doc_number' | 'created_at' | 'updated_at'>
): Promise<PurchaseBatch> {
  const client = requireSupabase();
  const docNumber = await getNextBonNumber('ACH', new Date(input.date).getFullYear());
  const id = `ach-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const row = {
    id,
    doc_number: docNumber,
    date: input.date,
    supplier_name: input.supplier_name,
    supplier_phone: input.supplier_phone || null,
    item_type: input.item_type,
    quantity: input.quantity,
    unit_price_tnd: input.unit_price_tnd,
    total_price_tnd: input.total_price_tnd,
    payment_mode: input.payment_mode,
    payment_status: input.payment_status,
    operator: input.operator,
    destination_tank_id: input.destination_tank_id || null,
    notes: input.notes || null,
  };
  const { data, error } = await client.from('purchases').insert([row]).select().single();
  if (error || !data) throw new Error(error?.message || 'Erreur enregistrement achat.');
  return data as PurchaseBatch;
}

export async function updatePurchasePayment(id: string, status: 'PAYE' | 'IMPAYE'): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('purchases')
    .update({ payment_status: status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchExpenses(): Promise<ExpenseItem[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('expenses')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((e: any) => ({
    ...e,
    amount_tnd: Number(e.amount_tnd),
  })) as ExpenseItem[];
}

export async function createExpenseRecord(
  input: Omit<ExpenseItem, 'id' | 'created_at'>
): Promise<ExpenseItem> {
  const client = requireSupabase();
  const id = `exp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const { data, error } = await client
    .from('expenses')
    .insert([{ ...input, id }])
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || 'Erreur création dépense.');
  return { ...data, amount_tnd: Number(data.amount_tnd) } as ExpenseItem;
}

// ----------------------------------------------------------------------------
// PERSONNEL & PAYROLL
// ----------------------------------------------------------------------------
export async function fetchEmployees(): Promise<Employee[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('employees')
    .select('*')
    .order('full_name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((e: any) => ({
    ...e,
    base_salary_tnd: Number(e.base_salary_tnd),
  })) as Employee[];
}

export async function createEmployeeRecord(
  input: Omit<Employee, 'id' | 'code' | 'created_at' | 'updated_at'>
): Promise<Employee> {
  const client = requireSupabase();
  const existing = await fetchEmployees();
  let maxSeq = 0;
  for (const e of existing) {
    const m = (e.code || '').match(/(\d+)$/);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  }
  const code = `EMP-${String(maxSeq + 1).padStart(3, '0')}`;
  const id = `emp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const { data, error } = await client
    .from('employees')
    .insert([{ ...input, id, code }])
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || 'Erreur création employé.');
  return { ...data, base_salary_tnd: Number(data.base_salary_tnd) } as Employee;
}

export async function updateEmployeeRecord(
  id: string,
  updates: Partial<Omit<Employee, 'id' | 'code' | 'created_at'>>
): Promise<Employee> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('employees')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || 'Erreur modification employé.');
  return { ...data, base_salary_tnd: Number(data.base_salary_tnd) } as Employee;
}

export async function fetchSalaryAdvances(): Promise<SalaryAdvance[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('salary_advances')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((a: any) => ({
    ...a,
    amount_tnd: Number(a.amount_tnd),
  })) as SalaryAdvance[];
}

export async function recordSalaryAdvanceRpc(params: {
  employeeId: string;
  amountTnd: number;
  advanceDate: string;
  paymentMode: 'ESPECES' | 'CHEQUE' | 'VIREMENT';
  notes?: string;
}): Promise<SalaryAdvance> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('record_salary_advance', {
    p_employee_id: params.employeeId,
    p_amount_tnd: params.amountTnd,
    p_advance_date: params.advanceDate,
    p_payment_mode: params.paymentMode,
    p_notes: params.notes || null,
  });
  if (error) throw new Error(error.message);
  return data as SalaryAdvance;
}

export async function fetchSalaryPayments(): Promise<SalaryPayment[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('salary_payments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((p: any) => ({
    ...p,
    base_salary_tnd: Number(p.base_salary_tnd),
    total_advances_tnd: Number(p.total_advances_tnd),
    previous_payments_tnd: Number(p.previous_payments_tnd),
    net_paid_tnd: Number(p.net_paid_tnd),
  })) as SalaryPayment[];
}

export async function recordSalaryPaymentRpc(params: {
  employeeId: string;
  periodMonth: string;
  paymentDate: string;
  paymentMode: 'ESPECES' | 'CHEQUE' | 'VIREMENT';
  notes?: string;
}): Promise<SalaryPayment> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('record_salary_payment', {
    p_employee_id: params.employeeId,
    p_period_month: params.periodMonth,
    p_payment_date: params.paymentDate,
    p_payment_mode: params.paymentMode,
    p_notes: params.notes || null,
  });
  if (error) throw new Error(error.message);
  return data as SalaryPayment;
}

// ----------------------------------------------------------------------------
// AUDIT LOGS
// ----------------------------------------------------------------------------
export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('audit_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data || []).map((l: any) => ({
    id: l.id,
    timestamp: l.timestamp,
    user: l.user_name || l.user || 'Système',
    user_id: l.user_id,
    action: l.action,
    module: l.module,
    record_id: l.record_id,
    details: l.details,
  }));
}

export async function appendAuditLog(params: {
  action: string;
  module: string;
  record_id?: string;
  details: string;
  userName?: string;
}): Promise<void> {
  if (!supabase) return;
  const id = `log-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  await supabase.from('audit_logs').insert([
    {
      id,
      user_name: params.userName || 'Utilisateur',
      action: params.action,
      module: params.module,
      record_id: params.record_id || null,
      details: params.details,
    },
  ]);
}
