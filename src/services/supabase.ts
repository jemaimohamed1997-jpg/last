/**
 * Client Supabase officiel pour Huilerie Jemai (معصرة جماعي)
 * Source unique de vérité PostgreSQL — aucune clé ni URL codée en dur.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getEnv = (key: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
      return String((import.meta as any).env[key]).trim();
    }
  } catch {
    // ignore
  }
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return String(process.env[key]).trim();
    }
  } catch {
    // ignore
  }
  return '';
};

const rawUrl = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL');
export const SUPABASE_URL = rawUrl.replace(/\/rest\/v1\/?$/, '');
export const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL.startsWith('http') &&
    !SUPABASE_URL.includes('YOUR_SUPABASE')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Configuration Supabase manquante : définissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans les variables d’environnement.'
    );
  }
  return supabase;
}

export interface SupabaseHealth {
  configured: boolean;
  connected: boolean;
  canRead: boolean;
  canWrite: boolean;
  url: string;
  lastChecked: string;
  error?: string;
  rlsWarning?: string;
}

export function ensureUuid(id: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return id;
  }
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  const nowHex = Date.now().toString(16).padStart(12, '0');
  return `${hex.slice(0, 8)}-1234-4567-89ab-${nowHex.slice(-12)}`;
}

export async function checkSupabaseConnection(): Promise<SupabaseHealth> {
  if (!supabase) {
    return {
      configured: false,
      connected: false,
      canRead: false,
      canWrite: false,
      url: '',
      lastChecked: new Date().toISOString(),
      error: 'Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY non configurées.',
    };
  }

  let canRead = false;
  let readError: string | undefined;

  try {
    const { error } = await supabase.from('tanks').select('id').limit(1);
    if (!error) {
      canRead = true;
    } else {
      readError = error.message;
    }
  } catch (err: any) {
    readError = err?.message || 'Erreur réseau Supabase';
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const isAuthenticated = Boolean(sessionData?.session);

  return {
    configured: true,
    connected: canRead,
    canRead,
    canWrite: canRead && isAuthenticated,
    url: SUPABASE_URL,
    lastChecked: new Date().toISOString(),
    error: readError,
    rlsWarning: !isAuthenticated
      ? 'Connectez-vous avec votre compte Supabase Auth pour activer les écritures protégées par RLS.'
      : undefined,
  };
}

/**
 * Récupère les données du module Stock (cuves, clients, opérations, mouvements, paramètres) depuis les tables officielles Supabase.
 */
export async function fetchAllSupabaseData(): Promise<{
  cuves: any[];
  clients: any[];
  movements: any[];
  settings: any | null;
  error?: string;
}> {
  if (!supabase) {
    return { cuves: [], clients: [], movements: [], settings: null, error: 'Supabase non configuré' };
  }
  try {
    const [tRes, pRes, oRes, tmRes, setRes] = await Promise.allSettled([
      supabase.from('tanks').select('*').eq('is_deleted', false).order('code', { ascending: true }),
      supabase.from('parties').select('*').eq('is_deleted', false).order('name', { ascending: true }),
      supabase.from('operations').select('*').order('operation_date', { ascending: false }),
      supabase.from('tank_movements').select('*').order('created_at', { ascending: false }),
      supabase.from('app_settings').select('*').limit(1).maybeSingle(),
    ]);

    const cuves =
      tRes.status === 'fulfilled' && !tRes.value.error && Array.isArray(tRes.value.data)
        ? tRes.value.data.map((t) => ({
            id: t.id,
            numero: t.code,
            nom: t.name || t.code,
            capacite_max: Number(t.capacity),
            active: t.is_active ?? true,
            notes: t.notes || null,
            date_creation: t.created_at,
          }))
        : [];

    const clients =
      pRes.status === 'fulfilled' && !pRes.value.error && Array.isArray(pRes.value.data)
        ? pRes.value.data.map((p) => ({
            id: p.id,
            code_client: p.code,
            nom_complet: p.name,
            telephone: p.phone || null,
            notes: p.notes || null,
            actif: p.is_active !== false && !p.is_deleted,
            date_creation: p.created_at,
          }))
        : [];

    const ops =
      oRes.status === 'fulfilled' && !oRes.value.error && Array.isArray(oRes.value.data)
        ? oRes.value.data
        : [];
    const tms =
      tmRes.status === 'fulfilled' && !tmRes.value.error && Array.isArray(tmRes.value.data)
        ? tmRes.value.data
        : [];

    const opsMap = new Map<string, any>();
    for (const op of ops) {
      opsMap.set(op.id, op);
    }

    const movements = tms.map((tm) => {
      const op = opsMap.get(tm.operation_id) || {};
      let typeMouvement = 'ENTREE';
      if (op.type === 'TRANSFERT') {
        typeMouvement = tm.direction === 'IN' ? 'TRANSFERT_ENTREE' : 'TRANSFERT_SORTIE';
      } else {
        typeMouvement = tm.direction === 'IN' ? 'ENTREE' : 'SORTIE';
      }
      return {
        id: tm.id,
        operation_id: tm.operation_id,
        numero_bon: op.doc_number || `BON-${String(tm.id).slice(0, 8)}`,
        type_mouvement: typeMouvement,
        cuve_id: tm.tank_id,
        client_id: tm.party_id || op.party_id,
        quantite: Number(tm.quantity || 0),
        acidite: null,
        date_mouvement: op.operation_date || tm.created_at,
        motif: op.notes || tm.notes || null,
        observations: tm.notes || null,
        utilisateur: op.operator || 'Personnel Huilerie',
        est_annule: op.status === 'ANNULE',
      };
    });

    let settings: any = null;
    if (setRes.status === 'fulfilled' && !setRes.value.error && setRes.value.data) {
      const s = setRes.value.data;
      settings = {
        nomEntreprise: s.company_name || 'HUILERIE JEMAI',
        sousTitreArabe: s.arabic_subtitle || 'معصرة جماعي لإنتاج وتخزين زيت الزيتون',
        precisionDecimales: Number(s.settings_json?.precisionDecimales ?? 1),
        unite: s.unit || 'L',
        contactTelephone: s.phone || '+216 98 000 000',
        adresse: s.address || 'Route Principale des Oliviers - Tunisie',
        alertSeuilRemplissage: Number(s.threshold || 85),
        logoUrl: s.logo_url || undefined,
      };
    }

    return { cuves, clients, movements, settings };
  } catch (err: any) {
    return { cuves: [], clients: [], movements: [], settings: null, error: err?.message };
  }
}

/**
 * Canal Supabase Realtime sur les tables réelles PostgreSQL
 */
export function initSupabaseRealtime(
  onDataChange: (payload: { table: string; eventType: string; newRow: any; oldRow: any }) => void
): () => void {
  if (!supabase) return () => {};
  try {
    const channel = supabase
      .channel('huilerie_jemai_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tanks' }, (payload) => {
        onDataChange({ table: 'tanks', eventType: payload.eventType, newRow: payload.new, oldRow: payload.old });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parties' }, (payload) => {
        onDataChange({ table: 'parties', eventType: payload.eventType, newRow: payload.new, oldRow: payload.old });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operations' }, (payload) => {
        onDataChange({ table: 'operations', eventType: payload.eventType, newRow: payload.new, oldRow: payload.old });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tank_movements' }, (payload) => {
        onDataChange({ table: 'tank_movements', eventType: payload.eventType, newRow: payload.new, oldRow: payload.old });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
        onDataChange({ table: 'app_settings', eventType: payload.eventType, newRow: payload.new, oldRow: payload.old });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn('Realtime indisponible:', err);
    return () => {};
  }
}
