import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

function sendJson(res: any, statusCode: number, payload: Record<string, any>) {
  if (typeof res?.status === 'function' && typeof res?.json === 'function') {
    return res.status(statusCode).json(payload);
  }
  res.statusCode = statusCode;
  if (typeof res?.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
  }
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: any): Promise<Record<string, any>> {
  const rawBody = req?.body;
  if (rawBody !== undefined && rawBody !== null) {
    if (typeof rawBody === 'string') {
      return rawBody.trim() ? JSON.parse(rawBody) : {};
    }
    if (rawBody instanceof Uint8Array) {
      const decoded = new TextDecoder().decode(rawBody);
      return decoded.trim() ? JSON.parse(decoded) : {};
    }
    if (typeof rawBody === 'object') {
      return rawBody;
    }
    return {};
  }

  if (req && typeof req[Symbol.asyncIterator] === 'function') {
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      if (typeof chunk === 'string') {
        chunks.push(new TextEncoder().encode(chunk));
      } else if (chunk instanceof Uint8Array) {
        chunks.push(chunk);
      }
    }
    const totalLen = chunks.reduce((acc, c) => acc + c.byteLength, 0);
    if (totalLen === 0) return {};
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    const text = new TextDecoder().decode(merged).trim();
    return text ? JSON.parse(text) : {};
  }

  return {};
}

function getMovementSupabaseClient() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/rest\/v1\/?$/, '');
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY ||
    ''
  ).trim();
  if (!url || !key) {
    return null;
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function authorizeMovementRequest(req: any): boolean {
  const configuredApiKey = (process.env.MOVEMENT_API_KEY || '').trim();
  if (!configuredApiKey) {
    return true;
  }
  const headerKey = String(
    req.headers?.['x-api-key'] ||
      (String(req.headers?.authorization || '').startsWith('Bearer ')
        ? String(req.headers.authorization).slice(7)
        : '')
  ).trim();
  return headerKey === configuredApiKey;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Méthode POST requise.' });
  }

  if (!authorizeMovementRequest(req)) {
    return sendJson(res, 401, { success: false, error: 'Clé API mouvement invalide.' });
  }

  const supabase = getMovementSupabaseClient();
  if (!supabase) {
    return sendJson(res, 503, {
      success: false,
      error: 'Configuration Supabase serveur manquante (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).',
    });
  }

  try {
    const body = await readJsonBody(req);
    const rawMouv = body.mouvement || body;

    const rawLot = rawMouv.cuve_id || rawMouv.cuveId || rawMouv.lot;
    if (!rawLot) {
      return sendJson(res, 400, {
        success: false,
        error: "Le paramètre 'cuve_id' ou 'lot' est obligatoire.",
      });
    }

    const rawQty = rawMouv.quantite !== undefined ? rawMouv.quantite : rawMouv.quantity;
    const numQty = Number(rawQty);
    if (isNaN(numQty) || numQty <= 0) {
      return sendJson(res, 400, {
        success: false,
        error: "La quantité ('quantite') doit être strictement supérieure à 0.",
      });
    }

    const { data: tanks, error: tErr } = await supabase
      .from('tanks')
      .select('*')
      .eq('is_deleted', false);
    if (tErr) {
      return sendJson(res, 500, { success: false, error: tErr.message });
    }

    const targetCuve = (tanks || []).find(
      (c: any) =>
        c.id === rawLot ||
        (c.code && String(c.code).trim().toUpperCase() === String(rawLot).trim().toUpperCase())
    );
    if (!targetCuve) {
      return sendJson(res, 400, {
        success: false,
        error: `Cuve introuvable : le lot ou identifiant '${rawLot}' ne correspond à aucune cuve existante.`,
      });
    }
    if (!targetCuve.is_active) {
      return sendJson(res, 400, {
        success: false,
        error: `La cuve '${targetCuve.name}' est désactivée. Aucun mouvement n'est autorisé.`,
      });
    }

    const rawType = String(
      rawMouv.type_mouvement || rawMouv.typeMouvement || rawMouv.type || 'ENTREE'
    ).toUpperCase();
    const isOut = rawType.includes('SORT') || rawType === 'OUT' || rawType.includes('LIVR');
    const opType = isOut ? 'SORTIE' : 'ENTREE';
    const direction = isOut ? 'OUT' : 'IN';

    const { data: tankMoves, error: tmFetchErr } = await supabase
      .from('tank_movements')
      .select('direction, quantity, party_id, operations!inner(status)')
      .eq('tank_id', targetCuve.id)
      .eq('operations.status', 'VALIDE');

    if (tmFetchErr) {
      return sendJson(res, 500, { success: false, error: tmFetchErr.message });
    }

    let currentStock = 0;
    for (const tm of tankMoves || []) {
      currentStock += tm.direction === 'IN' ? Number(tm.quantity) : -Number(tm.quantity);
    }

    if (direction === 'IN') {
      const remainingCap = Math.max(0, Number(targetCuve.capacity) - currentStock);
      if (numQty > remainingCap + 0.001) {
        return sendJson(res, 400, {
          success: false,
          error: `Capacité dépassée : la cuve '${targetCuve.name}' n'a que ${remainingCap.toFixed(1)} L de libre.`,
        });
      }
    } else if (numQty > currentStock + 0.001) {
      return sendJson(res, 400, {
        success: false,
        error: `Stock insuffisant dans '${targetCuve.name}' (${currentStock.toFixed(1)} L disponibles).`,
      });
    }

    const rawClientId = rawMouv.client_id || rawMouv.clientId;
    const { data: parties } = await supabase
      .from('parties')
      .select('id, code, name')
      .eq('is_deleted', false);
    const matchedParty = (parties || []).find(
      (p: any) => p.id === rawClientId || p.code === rawClientId
    );
    const partyId = matchedParty?.id || parties?.[0]?.id;
    if (!partyId) {
      return sendJson(res, 400, {
        success: false,
        error: 'Aucun client valide trouvé pour ce mouvement.',
      });
    }

    if (direction === 'OUT') {
      let partyStock = 0;
      for (const tm of tankMoves || []) {
        if (tm.party_id === partyId) {
          partyStock += tm.direction === 'IN' ? Number(tm.quantity) : -Number(tm.quantity);
        }
      }
      if (numQty > partyStock + 0.001) {
        return sendJson(res, 400, {
          success: false,
          error: `Solde client insuffisant dans '${targetCuve.name}' (${partyStock.toFixed(1)} L).`,
        });
      }
    }

    const docType = direction === 'IN' ? 'REC' : 'SOR';
    const dateMouvement =
      rawMouv.date_mouvement || rawMouv.dateMouvement || rawMouv.created_at || new Date().toISOString();
    const year = new Date(dateMouvement).getFullYear() || new Date().getFullYear();

    let numeroBon = rawMouv.numero_bon || rawMouv.numeroBon;
    if (!numeroBon) {
      const { data: seqBon, error: rpcErr } = await supabase.rpc('get_next_bon_number', {
        p_type: docType,
        p_year: year,
      });
      if (rpcErr || !seqBon) {
        return sendJson(res, 500, {
          success: false,
          error: rpcErr?.message || 'Erreur numérotation bon.',
        });
      }
      numeroBon = String(seqBon);
    }

    const roundedQty = Math.round(numQty * 100) / 100;
    const opId = `op-api-${randomUUID()}`;
    const tmId = `tm-api-${randomUUID()}`;
    const utilisateur = rawMouv.utilisateur || rawMouv.user || 'API Externe';
    const motif =
      rawMouv.motif ||
      rawMouv.reason ||
      (direction === 'IN' ? "Bon de Réception d'huile" : "Sortie d'huile");
    const observations = rawMouv.observations || rawMouv.note || null;

    const { error: opErr } = await supabase.from('operations').insert([
      {
        id: opId,
        doc_number: numeroBon,
        type: opType,
        party_id: partyId,
        operator: utilisateur,
        total_quantity: roundedQty,
        notes: observations || motif,
        status: 'VALIDE',
        operation_date: dateMouvement,
        allocations: [{ tank_id: targetCuve.id, quantity: roundedQty }],
      },
    ]);
    if (opErr) {
      return sendJson(res, 500, { success: false, error: opErr.message });
    }

    const { error: tmErr } = await supabase.from('tank_movements').insert([
      {
        id: tmId,
        operation_id: opId,
        tank_id: targetCuve.id,
        party_id: partyId,
        direction,
        quantity: roundedQty,
        notes: observations,
        created_at: dateMouvement,
      },
    ]);
    if (tmErr) {
      return sendJson(res, 500, { success: false, error: tmErr.message });
    }

    await supabase.from('movements').insert([
      {
        id: opId,
        numero_bon: numeroBon,
        type_mouvement: opType,
        cuve_id: targetCuve.id,
        client_id: partyId,
        quantite: roundedQty,
        date_mouvement: dateMouvement,
        motif,
        observations,
        utilisateur,
        est_annule: false,
      },
    ]);

    await supabase.from('audit_logs').insert([
      {
        id: `log-${randomUUID()}`,
        user_name: utilisateur,
        action: direction === 'IN' ? 'ENTREE_HUILE_API' : 'SORTIE_HUILE_API',
        module: 'CUVES',
        record_id: opId,
        details: `${opType} API de ${roundedQty} L dans ${targetCuve.name} (${numeroBon})`,
      },
    ]);

    const nouveauStock =
      direction === 'IN' ? currentStock + roundedQty : Math.max(0, currentStock - roundedQty);
    return sendJson(res, 200, {
      success: true,
      mouvement: {
        id: opId,
        numeroBon,
        typeMouvement: opType,
        cuveId: targetCuve.id,
        clientId: partyId,
        quantite: roundedQty,
        dateMouvement,
        motif,
        observations,
        utilisateur,
        estAnnule: false,
      },
      stockActuel: nouveauStock,
      cuve: {
        id: targetCuve.id,
        numero: targetCuve.code,
        nom: targetCuve.name,
        stockActuel: nouveauStock,
      },
    });
  } catch (err: any) {
    return sendJson(res, 500, {
      success: false,
      error: err?.message || 'Erreur serveur mouvement.',
    });
  }
}
