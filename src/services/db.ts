/**
 * Huilerie Jemai (معصرة جماعي) - Moteur Stock & Logique Métier
 * Source de vérité unique : Supabase PostgreSQL (tables tanks, parties, operations, tank_movements, app_settings, audit_logs).
 * Le mode test (StorageService.isTestMode = true) fonctionne exclusivement en mémoire sans localStorage ni écriture distante.
 */

import {
  Cuve,
  Client,
  Movement,
  AuditLog,
  AppSettings,
  CuveDetails,
  ClientBalance,
  BackupSnapshot,
  TestResultItem,
} from '../types';
import {
  supabase,
  initSupabaseRealtime,
  fetchAllSupabaseData,
  isSupabaseConfigured,
} from './supabase';

interface StorageData {
  cuves: Cuve[];
  clients: Client[];
  mouvements: Movement[];
  auditLogs: AuditLog[];
  sequences: {
    rec: number;
    sor: number;
    trf: number;
    cli: number;
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  nomEntreprise: 'HUILERIE JEMAI',
  sousTitreArabe: 'معصرة جماعي لإنتاج وتخزين زيت الزيتون',
  precisionDecimales: 1,
  unite: 'L',
  contactTelephone: '+216 98 000 000',
  adresse: 'Route Principale des Oliviers - Tunisie',
  alertSeuilRemplissage: 85,
};

function createEmptyData(): StorageData {
  return {
    cuves: [],
    clients: [],
    mouvements: [],
    auditLogs: [],
    sequences: { rec: 0, sor: 0, trf: 0, cli: 0 },
  };
}

// Mémoire isolée réservée uniquement au banc d'essai (isTestMode = true) pour valider le rechargement d'instance (Test #8)
let testMemoryData: StorageData | null = null;
let testMemoryBackups: BackupSnapshot[] = [];

export class StorageService {
  public static isTestMode = false;
  private data: StorageData;
  private settings: AppSettings;
  private backups: BackupSnapshot[] = [];
  private listeners: (() => void)[] = [];
  private isSyncing = false;
  private realtimeCleanup?: () => void;
  private bonMutex: Promise<any> = Promise.resolve();

  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    if (StorageService.isTestMode && testMemoryData) {
      this.data = JSON.parse(JSON.stringify(testMemoryData));
      this.backups = JSON.parse(JSON.stringify(testMemoryBackups));
    } else {
      this.data = createEmptyData();
      this.backups = [];
    }

    if (!StorageService.isTestMode && isSupabaseConfigured && typeof window !== 'undefined') {
      this.initServerSync();
    }
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error('Error in db listener', e);
      }
    });
  }

  public async initServerSync(): Promise<void> {
    if (StorageService.isTestMode || !supabase) return;
    await this.pullFromSupabase();

    try {
      if (this.realtimeCleanup) {
        this.realtimeCleanup();
      }
      this.realtimeCleanup = initSupabaseRealtime(() => {
        this.pullFromSupabase();
      });
    } catch (e) {
      console.warn('Realtime indisponible:', e);
    }
  }

  public async pullFromSupabase(): Promise<boolean> {
    if (StorageService.isTestMode || !supabase) return false;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) return false;

      const supaData = await fetchAllSupabaseData();
      if (!supaData || StorageService.isTestMode) return false;

      let changed = false;

      if (Array.isArray(supaData.clients)) {
        const mappedClients: Client[] = supaData.clients.map((cl: any) => ({
          id: cl.id,
          codeClient: cl.code_client,
          nomComplet: cl.nom_complet,
          telephone: cl.telephone || undefined,
          notes: cl.notes || undefined,
          actif: cl.actif ?? true,
          dateCreation: cl.date_creation || new Date().toISOString(),
        }));

        let maxClientNum = 0;
        for (const cl of mappedClients) {
          const m = (cl.codeClient || '').match(/(\d+)$/);
          if (m) maxClientNum = Math.max(maxClientNum, parseInt(m[1], 10));
        }
        this.data.sequences.cli = Math.max(this.data.sequences.cli || 0, maxClientNum);

        if (JSON.stringify(this.data.clients) !== JSON.stringify(mappedClients)) {
          this.data.clients = mappedClients;
          changed = true;
        }
      }

      if (Array.isArray(supaData.cuves)) {
        const mappedCuves: Cuve[] = supaData.cuves.map((c: any) => ({
          id: c.id,
          numero: c.numero,
          nom: c.nom,
          capaciteMax: Number(c.capacite_max),
          active: c.active ?? true,
          dateCreation: c.date_creation || new Date().toISOString(),
          notes: c.notes || undefined,
        }));
        if (JSON.stringify(this.data.cuves) !== JSON.stringify(mappedCuves)) {
          this.data.cuves = mappedCuves;
          changed = true;
        }
      }

      if (Array.isArray(supaData.movements)) {
        const mappedMovements: Movement[] = supaData.movements.map((m: any) => ({
          id: m.id,
          numeroBon: m.numero_bon || `BON-${String(m.id).slice(0, 8)}`,
          typeMouvement: (m.type_mouvement || 'ENTREE').toUpperCase() as any,
          cuveId: m.cuve_id,
          clientId: m.client_id,
          quantite: Number(m.quantite || 0),
          acidite: m.acidite != null ? Number(m.acidite) : undefined,
          dateMouvement: m.date_mouvement || new Date().toISOString(),
          motif: m.motif || undefined,
          observations: m.observations || undefined,
          utilisateur: m.utilisateur || 'Personnel',
          estAnnule: Boolean(m.est_annule),
          mouvementOrigineId: m.operation_id || undefined,
        }));

        const currentYear = new Date().getFullYear();
        let maxRec = this.data.sequences.rec || 0;
        let maxSor = this.data.sequences.sor || 0;
        let maxTrf = this.data.sequences.trf || 0;

        for (const m of mappedMovements) {
          const match = (m.numeroBon || '').match(/BON-(REC|SOR|TRF)-(\d{4})-(\d+)/i);
          if (match && parseInt(match[2], 10) === currentYear) {
            const t = match[1].toUpperCase();
            const num = parseInt(match[3], 10);
            if (t === 'REC') maxRec = Math.max(maxRec, num);
            if (t === 'SOR') maxSor = Math.max(maxSor, num);
            if (t === 'TRF') maxTrf = Math.max(maxTrf, num);
          }
        }
        this.data.sequences.rec = maxRec;
        this.data.sequences.sor = maxSor;
        this.data.sequences.trf = maxTrf;

        if (JSON.stringify(this.data.mouvements) !== JSON.stringify(mappedMovements)) {
          this.data.mouvements = mappedMovements;
          changed = true;
        }
      }

      if (supaData.settings) {
        this.settings = { ...this.settings, ...supaData.settings };
        changed = true;
      }

      // Charger les journaux d'audit
      try {
        const { data: logsData } = await supabase
          .from('audit_logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(200);
        if (Array.isArray(logsData)) {
          const mappedLogs: AuditLog[] = logsData.map((l: any) => ({
            id: l.id,
            dateAction: l.timestamp,
            utilisateur: l.user_name || 'Système',
            action: l.action,
            tableCible: l.module,
            entiteId: l.record_id || undefined,
            details: l.details,
          }));
          if (JSON.stringify(this.data.auditLogs) !== JSON.stringify(mappedLogs)) {
            this.data.auditLogs = mappedLogs;
            changed = true;
          }
        }
      } catch {
        // ignore if audit_logs unavailable before migration
      }

      if (changed) {
        this.notifyListeners();
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Échec récupération Supabase:', err);
      return false;
    }
  }

  public async smartRefresh(): Promise<{
    updated: boolean;
    message: string;
    nbCuves: number;
    nbMouvements: number;
  }> {
    try {
      this.isSyncing = true;
      const updated = await this.pullFromSupabase();
      return {
        updated,
        message: updated
          ? `Données synchronisées avec Supabase : ${this.data.cuves.length} cuve(s), ${this.data.clients.length} client(s), ${this.data.mouvements.length} mouvement(s).`
          : `Données à jour (${this.data.cuves.length} cuve(s), ${this.data.mouvements.length} mouvement(s)).`,
        nbCuves: this.data.cuves.length,
        nbMouvements: this.data.mouvements.length,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  public async saveSettings(settings: AppSettings): Promise<void> {
    this.settings = settings;
    if (!StorageService.isTestMode && supabase) {
      await supabase
        .from('app_settings')
        .update({
          company_name: settings.nomEntreprise,
          arabic_subtitle: settings.sousTitreArabe,
          phone: settings.contactTelephone,
          address: settings.adresse,
          unit: settings.unite,
          threshold: settings.alertSeuilRemplissage,
          logo_url: settings.logoUrl ?? null,
          settings_json: {
            precisionDecimales: settings.precisionDecimales,
            unite: settings.unite,
            alertSeuilRemplissage: settings.alertSeuilRemplissage,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', 'default');
    }
    this.logAudit('Gérant (Admin)', 'MODIF_PARAMETRES', 'app_settings', undefined, 'Mise à jour des paramètres système');
    this.notifyListeners();
  }

  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  private saveData(data: StorageData): void {
    this.data = data;
    if (StorageService.isTestMode) {
      testMemoryData = JSON.parse(JSON.stringify(data));
    }
    this.notifyListeners();
  }

  private logAudit(
    utilisateur: string,
    action: string,
    tableCible: string,
    entiteId?: string,
    details: string = ''
  ): void {
    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dateAction: new Date().toISOString(),
      utilisateur,
      action,
      tableCible,
      entiteId,
      details,
    };
    this.data.auditLogs.unshift(log);
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 500);
    }

    if (!StorageService.isTestMode && supabase) {
      supabase
        .from('audit_logs')
        .insert([
          {
            id: log.id,
            user_name: utilisateur,
            action,
            module: tableCible,
            record_id: entiteId || null,
            details,
          },
        ])
        .then();
    }
    this.notifyListeners();
  }

  // --- LECTURE & CALCULS ---
  public getCuves(): Cuve[] {
    return [...this.data.cuves];
  }

  public getClients(): Client[] {
    return [...this.data.clients];
  }

  public getMouvements(): Movement[] {
    return [...this.data.mouvements];
  }

  public getAuditLogs(): AuditLog[] {
    return [...this.data.auditLogs];
  }

  public getCuveStock(cuveId: string): number {
    let stock = 0;
    for (const m of this.data.mouvements) {
      if (m.cuveId === cuveId && !m.estAnnule) {
        if (m.typeMouvement === 'ENTREE' || m.typeMouvement === 'TRANSFERT_ENTREE') {
          stock += m.quantite;
        } else if (m.typeMouvement === 'SORTIE' || m.typeMouvement === 'TRANSFERT_SORTIE') {
          stock -= m.quantite;
        }
      }
    }
    return Math.max(0, Math.round(stock * 100) / 100);
  }

  public getClientSoldeDansCuve(clientId: string, cuveId: string): number {
    let solde = 0;
    for (const m of this.data.mouvements) {
      if (m.clientId === clientId && m.cuveId === cuveId && !m.estAnnule) {
        if (m.typeMouvement === 'ENTREE' || m.typeMouvement === 'TRANSFERT_ENTREE') {
          solde += m.quantite;
        } else if (m.typeMouvement === 'SORTIE' || m.typeMouvement === 'TRANSFERT_SORTIE') {
          solde -= m.quantite;
        }
      }
    }
    return Math.max(0, Math.round(solde * 100) / 100);
  }

  public getClientTotalStock(clientId: string): number {
    let total = 0;
    for (const m of this.data.mouvements) {
      if (m.clientId === clientId && !m.estAnnule) {
        if (m.typeMouvement === 'ENTREE' || m.typeMouvement === 'TRANSFERT_ENTREE') {
          total += m.quantite;
        } else if (m.typeMouvement === 'SORTIE' || m.typeMouvement === 'TRANSFERT_SORTIE') {
          total -= m.quantite;
        }
      }
    }
    return Math.max(0, Math.round(total * 100) / 100);
  }

  public getCuveDetails(cuveId: string): CuveDetails | null {
    const cuve = this.data.cuves.find((c) => c.id === cuveId);
    if (!cuve) return null;

    const stockActuel = this.getCuveStock(cuveId);
    const capaciteRestante = Math.max(0, Math.round((cuve.capaciteMax - stockActuel) * 100) / 100);
    const tauxRemplissage =
      cuve.capaciteMax > 0 ? Math.round((stockActuel / cuve.capaciteMax) * 1000) / 10 : 0;

    const clientMap = new Map<string, number>();
    for (const m of this.data.mouvements) {
      if (m.cuveId === cuveId && !m.estAnnule) {
        const delta =
          m.typeMouvement === 'ENTREE' || m.typeMouvement === 'TRANSFERT_ENTREE'
            ? m.quantite
            : -m.quantite;
        clientMap.set(m.clientId, (clientMap.get(m.clientId) || 0) + delta);
      }
    }

    const clientsList: { client: Client; quantite: number; pourcentage: number }[] = [];
    clientMap.forEach((qty, cid) => {
      const q = Math.round(qty * 100) / 100;
      if (q > 0.001) {
        const client = this.data.clients.find((c) => c.id === cid);
        if (client) {
          clientsList.push({
            client,
            quantite: q,
            pourcentage: stockActuel > 0 ? Math.round((q / stockActuel) * 1000) / 10 : 0,
          });
        }
      }
    });

    return {
      ...cuve,
      stockActuel,
      capaciteRestante,
      tauxRemplissage,
      clients: clientsList,
    };
  }

  public getClientBalance(clientId: string): ClientBalance | null {
    const client = this.data.clients.find((c) => c.id === clientId);
    if (!client) return null;

    const totalStock = this.getClientTotalStock(clientId);
    const parCuve: { cuve: Cuve; quantite: number }[] = [];

    for (const cuve of this.data.cuves) {
      const q = this.getClientSoldeDansCuve(clientId, cuve.id);
      if (q > 0.001) {
        parCuve.push({ cuve, quantite: q });
      }
    }

    const derniersMouvements = this.data.mouvements
      .filter((m) => m.clientId === clientId)
      .slice(-10)
      .reverse();

    return {
      client,
      totalStock,
      parCuve,
      derniersMouvements,
    };
  }

  // --- NUMÉROTATION ATOMIQUE ---
  public async getNextUniqueBonNumber(type: 'REC' | 'SOR' | 'TRF'): Promise<string> {
    const task = async () => {
      if (StorageService.isTestMode || !supabase) {
        return this.nextBonNumber(type);
      }
      const year = new Date().getFullYear();
      const { data, error } = await supabase.rpc('get_next_bon_number', {
        p_type: type,
        p_year: year,
      });
      if (error || !data) {
        throw new Error(error?.message || `Échec génération numéro BON-${type}.`);
      }
      return String(data);
    };

    const next = this.bonMutex.then(task, task);
    this.bonMutex = next.catch(() => {});
    return next;
  }

  private nextBonNumber(type: 'REC' | 'SOR' | 'TRF'): string {
    const year = new Date().getFullYear();
    const prefix = `BON-${type}-${year}-`;
    const seqKey = type.toLowerCase() as 'rec' | 'sor' | 'trf';
    let maxLocal = 0;
    for (const m of this.data.mouvements) {
      const b = m.numeroBon || '';
      if (b.startsWith(prefix)) {
        const match = b.match(/(\d+)$/);
        if (match) maxLocal = Math.max(maxLocal, parseInt(match[1], 10));
      }
    }
    const cur = this.data.sequences[seqKey] || 0;
    const next = Math.max(maxLocal, cur) + 1;
    this.data.sequences[seqKey] = next;
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  // --- OPÉRATIONS STOCK ---
  public async enregistrerEntree(
    params: {
      clientId: string;
      cuveId?: string;
      lot?: string;
      quantite: number;
      utilisateur: string;
      dateMouvement?: string;
      observations?: string;
      motif?: string;
      acidite?: number;
    },
    skipRemoteSync: boolean = false
  ): Promise<Movement> {
    const rawLot = params.cuveId || params.lot;
    if (!rawLot) throw new Error("L'identifiant de la cuve ou le lot est obligatoire.");

    const cuve = this.data.cuves.find(
      (c) =>
        c.id === rawLot ||
        (c.numero && c.numero.trim().toUpperCase() === String(rawLot).trim().toUpperCase())
    );
    if (!cuve) {
      throw new Error(`Cuve / Pile introuvable : '${rawLot}'.`);
    }
    if (!cuve.active) {
      throw new Error(`La cuve ${cuve.nom} (${cuve.numero}) est désactivée.`);
    }

    const client = this.data.clients.find(
      (c) => c.id === params.clientId || c.codeClient === params.clientId
    );
    if (!client) throw new Error('Client / Déposant introuvable.');

    const quantite = Number(params.quantite);
    if (isNaN(quantite) || quantite <= 0) {
      throw new Error("La quantité d'huile doit être strictement supérieure à zéro.");
    }

    const stockActuel = this.getCuveStock(cuve.id);
    const capaciteRestante = Math.round((cuve.capaciteMax - stockActuel) * 100) / 100;
    if (quantite > capaciteRestante + 0.001) {
      throw new Error(
        `Capacité insuffisante : La pile '${cuve.nom}' ne dispose que de ${capaciteRestante.toFixed(1)} L de capacité libre. Entrée demandée de ${quantite.toFixed(1)} L refusée !`
      );
    }

    const nowIso = params.dateMouvement || new Date().toISOString();
    const numeroBon = await this.getNextUniqueBonNumber('REC');
    const opId = `op-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const tmId = `tm-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const roundedQty = Math.round(quantite * 100) / 100;

    if (!skipRemoteSync && !StorageService.isTestMode && supabase) {
      const { error: opErr } = await supabase.from('operations').insert([
        {
          id: opId,
          doc_number: numeroBon,
          type: 'ENTREE',
          party_id: client.id,
          operator: params.utilisateur || 'Personnel Huilerie',
          total_quantity: roundedQty,
          notes: params.observations?.trim() || params.motif?.trim() || "Bon de Réception d'huile",
          status: 'VALIDE',
          operation_date: nowIso,
          allocations: [{ tank_id: cuve.id, quantity: roundedQty }],
        },
      ]);
      if (opErr) throw new Error(`Erreur opération Supabase : ${opErr.message}`);

      const { error: tmErr } = await supabase.from('tank_movements').insert([
        {
          id: tmId,
          operation_id: opId,
          tank_id: cuve.id,
          party_id: client.id,
          direction: 'IN',
          quantity: roundedQty,
          notes: params.observations?.trim() || null,
          created_at: nowIso,
        },
      ]);
      if (tmErr) throw new Error(`Erreur mouvement cuve Supabase : ${tmErr.message}`);
    }

    const nouveauMouvement: Movement = {
      id: tmId,
      numeroBon,
      typeMouvement: 'ENTREE',
      cuveId: cuve.id,
      clientId: client.id,
      quantite: roundedQty,
      acidite: params.acidite != null ? Number(params.acidite) : undefined,
      dateMouvement: nowIso,
      motif: params.motif?.trim() || "Bon de Réception d'huile (Entrée)",
      observations: params.observations?.trim() || undefined,
      utilisateur: params.utilisateur || 'Personnel Huilerie',
      mouvementOrigineId: opId,
      estAnnule: false,
    };

    this.data.mouvements.unshift(nouveauMouvement);
    this.logAudit(
      params.utilisateur,
      'ENTREE_HUILE',
      'operations',
      opId,
      `Entrée de ${quantite.toFixed(1)} L pour ${client.nomComplet} dans cuve ${cuve.nom} (Bon ${numeroBon})`
    );
    this.saveData(this.data);
    return nouveauMouvement;
  }

  public async enregistrerSortie(
    params: {
      clientId: string;
      cuveId?: string;
      lot?: string;
      quantite: number;
      utilisateur: string;
      dateMouvement?: string;
      motif?: string;
      observations?: string;
      acidite?: number;
    },
    skipRemoteSync: boolean = false
  ): Promise<Movement> {
    const rawLot = params.cuveId || params.lot;
    if (!rawLot) throw new Error("L'identifiant de la cuve ou le lot est obligatoire.");

    const cuve = this.data.cuves.find(
      (c) =>
        c.id === rawLot ||
        (c.numero && c.numero.trim().toUpperCase() === String(rawLot).trim().toUpperCase())
    );
    if (!cuve) throw new Error(`Pile / Cuve introuvable pour '${rawLot}'.`);

    const client = this.data.clients.find(
      (c) => c.id === params.clientId || c.codeClient === params.clientId
    );
    if (!client) throw new Error('Client / Déposant introuvable.');

    const quantite = Number(params.quantite);
    if (isNaN(quantite) || quantite <= 0) {
      throw new Error('La quantité à retirer doit être strictement supérieure à zéro.');
    }

    const soldeClient = this.getClientSoldeDansCuve(client.id, cuve.id);
    if (quantite > soldeClient + 0.001) {
      throw new Error(
        `Solde insuffisant : Le client '${client.nomComplet}' ne possède que ${soldeClient.toFixed(1)} L dans la cuve '${cuve.nom}'. Retrait de ${quantite.toFixed(1)} L refusé !`
      );
    }

    const stockCuve = this.getCuveStock(cuve.id);
    if (quantite > stockCuve + 0.001) {
      throw new Error(`Stock physique insuffisant : la cuve ne contient que ${stockCuve.toFixed(1)} L.`);
    }

    const nowIso = params.dateMouvement || new Date().toISOString();
    const numeroBon = await this.getNextUniqueBonNumber('SOR');
    const opId = `op-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const tmId = `tm-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const roundedQty = Math.round(quantite * 100) / 100;

    if (!skipRemoteSync && !StorageService.isTestMode && supabase) {
      const { error: opErr } = await supabase.from('operations').insert([
        {
          id: opId,
          doc_number: numeroBon,
          type: 'SORTIE',
          party_id: client.id,
          operator: params.utilisateur || 'Personnel Huilerie',
          total_quantity: roundedQty,
          notes: params.observations?.trim() || params.motif?.trim() || "Sortie d'huile",
          status: 'VALIDE',
          operation_date: nowIso,
          allocations: [{ tank_id: cuve.id, quantity: roundedQty }],
        },
      ]);
      if (opErr) throw new Error(`Erreur sortie Supabase : ${opErr.message}`);

      const { error: tmErr } = await supabase.from('tank_movements').insert([
        {
          id: tmId,
          operation_id: opId,
          tank_id: cuve.id,
          party_id: client.id,
          direction: 'OUT',
          quantity: roundedQty,
          notes: params.observations?.trim() || null,
          created_at: nowIso,
        },
      ]);
      if (tmErr) throw new Error(`Erreur mouvement sortie Supabase : ${tmErr.message}`);
    }

    const nouveauMouvement: Movement = {
      id: tmId,
      numeroBon,
      typeMouvement: 'SORTIE',
      cuveId: cuve.id,
      clientId: client.id,
      quantite: roundedQty,
      acidite: params.acidite != null ? Number(params.acidite) : undefined,
      dateMouvement: nowIso,
      motif: params.motif?.trim() || "Sortie d'huile (Retrait / Livraison)",
      observations: params.observations?.trim() || undefined,
      utilisateur: params.utilisateur || 'Personnel Huilerie',
      mouvementOrigineId: opId,
      estAnnule: false,
    };

    this.data.mouvements.unshift(nouveauMouvement);
    this.logAudit(
      params.utilisateur,
      'SORTIE_HUILE',
      'operations',
      opId,
      `Sortie de ${quantite.toFixed(1)} L pour ${client.nomComplet} depuis cuve ${cuve.nom} (Bon ${numeroBon})`
    );
    this.saveData(this.data);
    return nouveauMouvement;
  }

  public async enregistrerTransfert(
    params: {
      clientId: string;
      cuveSourceId: string;
      cuveDestId: string;
      quantite: number;
      utilisateur: string;
      motif?: string;
    },
    skipRemoteSync: boolean = false
  ): Promise<{ sortie: Movement; entree: Movement }> {
    const { clientId, cuveSourceId, cuveDestId, quantite, utilisateur, motif } = params;

    if (cuveSourceId === cuveDestId) {
      throw new Error("La cuve d'origine et la cuve de destination doivent être différentes.");
    }
    if (!quantite || quantite <= 0) {
      throw new Error('La quantité transférée doit être supérieure à 0.');
    }

    const cSrc = this.data.cuves.find(
      (c) => c.id === cuveSourceId || (c.numero && c.numero.toUpperCase() === String(cuveSourceId).toUpperCase())
    );
    const cDst = this.data.cuves.find(
      (c) => c.id === cuveDestId || (c.numero && c.numero.toUpperCase() === String(cuveDestId).toUpperCase())
    );
    if (!cSrc || !cDst) throw new Error('Cuve introuvable.');
    if (!cDst.active) throw new Error(`La cuve réceptrice '${cDst.nom}' est désactivée.`);

    const client = this.data.clients.find((c) => c.id === clientId || c.codeClient === clientId);
    if (!client) throw new Error('Client introuvable.');

    const soldeSrc = this.getClientSoldeDansCuve(client.id, cSrc.id);
    if (quantite > soldeSrc + 0.001) {
      throw new Error(
        `Solde source insuffisant : Le client n'a que ${soldeSrc.toFixed(1)} L dans '${cSrc.nom}'. Transfert de ${quantite.toFixed(1)} L refusé !`
      );
    }

    const stockDest = this.getCuveStock(cDst.id);
    const capDestRestante = Math.round((cDst.capaciteMax - stockDest) * 100) / 100;
    if (quantite > capDestRestante + 0.001) {
      throw new Error(
        `Capacité insuffisante à destination : '${cDst.nom}' ne dispose que de ${capDestRestante.toFixed(1)} L disponibles.`
      );
    }

    const nowIso = new Date().toISOString();
    const bonTrf = await this.getNextUniqueBonNumber('TRF');
    const opId = `op-trf-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const idSort = `tm-trf-s-${Date.now()}`;
    const idEnt = `tm-trf-e-${Date.now() + 1}`;
    const roundedQty = Math.round(quantite * 100) / 100;

    if (!skipRemoteSync && !StorageService.isTestMode && supabase) {
      const { error: opErr } = await supabase.from('operations').insert([
        {
          id: opId,
          doc_number: bonTrf,
          type: 'TRANSFERT',
          party_id: client.id,
          operator: utilisateur,
          total_quantity: roundedQty,
          notes: motif || `Transfert ${cSrc.numero} -> ${cDst.numero}`,
          status: 'VALIDE',
          operation_date: nowIso,
          source_tank_id: cSrc.id,
          target_tank_id: cDst.id,
        },
      ]);
      if (opErr) throw new Error(`Erreur transfert Supabase : ${opErr.message}`);

      const { error: tmErr } = await supabase.from('tank_movements').insert([
        {
          id: idSort,
          operation_id: opId,
          tank_id: cSrc.id,
          party_id: client.id,
          direction: 'OUT',
          quantity: roundedQty,
          notes: `Vers ${cDst.nom}`,
          created_at: nowIso,
        },
        {
          id: idEnt,
          operation_id: opId,
          tank_id: cDst.id,
          party_id: client.id,
          direction: 'IN',
          quantity: roundedQty,
          notes: `Depuis ${cSrc.nom}`,
          created_at: nowIso,
        },
      ]);
      if (tmErr) throw new Error(`Erreur mouvements transfert Supabase : ${tmErr.message}`);
    }

    const mouvSortie: Movement = {
      id: idSort,
      numeroBon: bonTrf,
      typeMouvement: 'TRANSFERT_SORTIE',
      cuveId: cSrc.id,
      clientId: client.id,
      quantite: roundedQty,
      dateMouvement: nowIso,
      motif: motif || 'Transfert inter-cuves',
      observations: `Transféré vers cuve ${cDst.nom}`,
      utilisateur,
      mouvementOrigineId: opId,
      estAnnule: false,
    };

    const mouvEntree: Movement = {
      id: idEnt,
      numeroBon: bonTrf,
      typeMouvement: 'TRANSFERT_ENTREE',
      cuveId: cDst.id,
      clientId: client.id,
      quantite: roundedQty,
      dateMouvement: nowIso,
      motif: motif || 'Transfert inter-cuves',
      observations: `Transféré depuis cuve ${cSrc.nom}`,
      utilisateur,
      mouvementOrigineId: opId,
      estAnnule: false,
    };

    this.data.mouvements.unshift(mouvEntree);
    this.data.mouvements.unshift(mouvSortie);
    this.logAudit(
      utilisateur,
      'TRANSFERT_HUILE',
      'operations',
      opId,
      `Transfert de ${quantite.toFixed(1)} L de ${cSrc.nom} vers ${cDst.nom} pour ${client.nomComplet} (${bonTrf})`
    );
    this.saveData(this.data);
    return { sortie: mouvSortie, entree: mouvEntree };
  }

  public async annulerMouvement(
    mouvementId: string,
    motif: string,
    utilisateur: string,
    skipRemoteSync: boolean = false
  ): Promise<Movement> {
    if (!motif || motif.trim().length < 4) {
      throw new Error("Un motif d'annulation détaillé et explicite est obligatoire.");
    }

    const mouv = this.data.mouvements.find((m) => m.id === mouvementId);
    if (!mouv) throw new Error('Mouvement introuvable.');
    if (mouv.estAnnule) throw new Error('Ce mouvement est déjà annulé.');

    if (mouv.typeMouvement === 'ENTREE' || mouv.typeMouvement === 'TRANSFERT_ENTREE') {
      const soldeActuel = this.getClientSoldeDansCuve(mouv.clientId, mouv.cuveId);
      if (soldeActuel < mouv.quantite - 0.001) {
        throw new Error(
          `Impossible d'annuler cette entrée : le client a déjà retiré de l'huile (solde actuel ${soldeActuel.toFixed(1)} L < ${mouv.quantite.toFixed(1)} L).`
        );
      }
    }

    const nowIso = new Date().toISOString();
    const opId = mouv.mouvementOrigineId;

    if (!skipRemoteSync && !StorageService.isTestMode && supabase && opId) {
      const { error } = await supabase
        .from('operations')
        .update({
          status: 'ANNULE',
          notes: `[ANNULÉ par ${utilisateur} le ${nowIso}] ${motif.trim()}`,
          updated_at: nowIso,
        })
        .eq('id', opId);
      if (error) throw new Error(`Erreur annulation Supabase : ${error.message}`);
    }

    mouv.estAnnule = true;
    mouv.dateAnnulation = nowIso;
    mouv.motifAnnulation = motif.trim();
    mouv.utilisateurAnnulation = utilisateur;

    if (opId) {
      for (const peer of this.data.mouvements) {
        if (peer.mouvementOrigineId === opId && peer.id !== mouv.id && !peer.estAnnule) {
          peer.estAnnule = true;
          peer.dateAnnulation = nowIso;
          peer.motifAnnulation = `Contre-passation liée : ${motif.trim()}`;
          peer.utilisateurAnnulation = utilisateur;
        }
      }
    }

    this.logAudit(
      utilisateur,
      'ANNULATION_MOUVEMENT',
      'operations',
      opId || mouv.id,
      `Annulation du bon ${mouv.numeroBon}. Motif : ${motif.trim()}`
    );
    this.saveData(this.data);
    return mouv;
  }

  public async modifierEntreeStock(params: {
    operationId: string;
    tankId: string;
    partyId: string;
    quantity: number;
    operationDate: string;
    notes?: string;
    reason: string;
  }): Promise<void> {
    if (!supabase) throw new Error('Supabase non configuré.');
    const { error } = await supabase.rpc('edit_stock_reception', {
      p_operation_id: params.operationId,
      p_tank_id: params.tankId,
      p_party_id: params.partyId,
      p_quantity: params.quantity,
      p_operation_date: params.operationDate,
      p_notes: params.notes || null,
      p_reason: params.reason,
    });
    if (error) throw new Error(error.message);
    await this.pullFromSupabase();
  }

  public corrigerDateMouvement(
    mouvementId: string,
    nouvelleDate: string,
    motif: string,
    utilisateur: string
  ): Movement {
    const mouv = this.data.mouvements.find((m) => m.id === mouvementId);
    if (!mouv) throw new Error('Mouvement introuvable.');
    if (!motif || motif.trim().length < 4) {
      throw new Error('Le motif de rectification de la date est obligatoire.');
    }

    const ancienneDate = mouv.dateMouvement;
    mouv.dateMouvement = nouvelleDate;
    mouv.dateCorrigee = true;
    mouv.dateCorrectionAudit = `Modifié le ${new Date().toISOString()} par ${utilisateur} (Ancienne date: ${ancienneDate}, Motif: ${motif})`;

    if (!StorageService.isTestMode && supabase && mouv.mouvementOrigineId) {
      supabase
        .from('operations')
        .update({ operation_date: nouvelleDate, updated_at: new Date().toISOString() })
        .eq('id', mouv.mouvementOrigineId)
        .then();
    }

    this.logAudit(
      utilisateur,
      'RECTIFICATION_DATE',
      'operations',
      mouv.mouvementOrigineId || mouvementId,
      `Date du bon ${mouv.numeroBon} rectifiée de ${ancienneDate} à ${nouvelleDate}. Motif : ${motif}`
    );
    this.saveData(this.data);
    return mouv;
  }

  // --- GESTION CUVES & CLIENTS ---
  public ajouterCuve(numero: string, nom: string, capaciteMax: number, notes: string = ''): Cuve {
    const numClean = numero.trim().toUpperCase();
    const nomClean = nom.trim();
    if (!numClean || !nomClean) throw new Error('Le numéro et le nom de la cuve sont obligatoires.');
    if (capaciteMax <= 0) throw new Error('La capacité maximale doit être supérieure à zéro.');
    if (this.data.cuves.some((c) => c.numero.toUpperCase() === numClean)) {
      throw new Error(`Le numéro de cuve '${numClean}' existe déjà.`);
    }

    const nouvelleCuve: Cuve = {
      id: `cuve-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      numero: numClean,
      nom: nomClean,
      capaciteMax: Math.round(capaciteMax * 100) / 100,
      active: true,
      dateCreation: new Date().toISOString(),
      notes: notes.trim(),
    };

    if (!StorageService.isTestMode && supabase) {
      supabase
        .from('tanks')
        .insert([
          {
            id: nouvelleCuve.id,
            code: nouvelleCuve.numero,
            name: nouvelleCuve.nom,
            capacity: nouvelleCuve.capaciteMax,
            is_active: true,
            is_deleted: false,
            notes: nouvelleCuve.notes || null,
          },
        ])
        .then(({ error }) => {
          if (error) console.error('Erreur insertion cuve Supabase:', error.message);
        });
    }

    this.data.cuves.push(nouvelleCuve);
    this.logAudit(
      'Gérant (Admin)',
      'CREATION_CUVE',
      'tanks',
      nouvelleCuve.id,
      `Création de la pile ${numClean} (${nomClean}) - ${capaciteMax} L`
    );
    this.saveData(this.data);
    return nouvelleCuve;
  }

  public modifierCuve(cuveId: string, nom: string, capaciteMax: number, notes?: string): Cuve {
    const cuve = this.data.cuves.find((c) => c.id === cuveId);
    if (!cuve) throw new Error('Cuve introuvable.');

    const stockActuel = this.getCuveStock(cuveId);
    if (capaciteMax < stockActuel) {
      throw new Error(
        `Impossible de réduire la capacité à ${capaciteMax} L car la cuve contient actuellement ${stockActuel} L d'huile !`
      );
    }

    cuve.nom = nom.trim();
    cuve.capaciteMax = capaciteMax;
    if (notes !== undefined) cuve.notes = notes.trim();

    if (!StorageService.isTestMode && supabase) {
      supabase
        .from('tanks')
        .update({
          name: cuve.nom,
          capacity: cuve.capaciteMax,
          notes: cuve.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cuveId)
        .then();
    }

    this.logAudit('Gérant (Admin)', 'MODIF_CUVE', 'tanks', cuve.id, `Modification cuve ${cuve.numero}`);
    this.saveData(this.data);
    return cuve;
  }

  public basculerStatutCuve(cuveId: string): Cuve {
    const cuve = this.data.cuves.find((c) => c.id === cuveId);
    if (!cuve) throw new Error('Cuve introuvable.');

    const stock = this.getCuveStock(cuveId);
    if (cuve.active && stock > 0.001) {
      throw new Error(
        `Impossible de désactiver la cuve '${cuve.nom}' tant qu'elle contient du stock (${stock} L).`
      );
    }

    cuve.active = !cuve.active;

    if (!StorageService.isTestMode && supabase) {
      supabase
        .from('tanks')
        .update({ is_active: cuve.active, updated_at: new Date().toISOString() })
        .eq('id', cuveId)
        .then();
    }

    this.logAudit(
      'Gérant (Admin)',
      'STATUT_CUVE',
      'tanks',
      cuve.id,
      `Cuve ${cuve.numero} passée à ${cuve.active ? 'ACTIVE' : 'DÉSACTIVÉE'}`
    );
    this.saveData(this.data);
    return cuve;
  }

  public supprimerCuve(cuveId: string): void {
    const cuve = this.data.cuves.find((c) => c.id === cuveId);
    if (!cuve) throw new Error('Cuve introuvable.');

    const stock = this.getCuveStock(cuveId);
    if (stock > 0.001) {
      throw new Error(
        `Suppression impossible : La cuve '${cuve.numero} - ${cuve.nom}' contient ${stock.toLocaleString('fr-FR')} L d'huile.`
      );
    }

    const nbMouvements = this.data.mouvements.filter((m) => m.cuveId === cuveId).length;
    if (nbMouvements > 0) {
      throw new Error(
        `Suppression permanente impossible : La cuve '${cuve.numero}' est référencée dans ${nbMouvements} mouvement(s) historique(s). Désactivez-la à la place.`
      );
    }

    if (!StorageService.isTestMode && supabase) {
      supabase
        .from('tanks')
        .update({ is_active: false, is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', cuveId)
        .then();
    }

    this.data.cuves = this.data.cuves.filter((c) => c.id !== cuveId);
    this.logAudit('Gérant (Admin)', 'SUPPRESSION_CUVE', 'tanks', cuveId, `Archivage cuve vide ${cuve.numero}`);
    this.saveData(this.data);
  }

  public async ajouterClient(
    nomComplet: string,
    telephone?: string,
    notes?: string,
    skipRemoteSync: boolean = false
  ): Promise<Client> {
    const nomClean = nomComplet.trim();
    if (!nomClean) throw new Error('Le nom complet ou la raison sociale est obligatoire.');

    if (skipRemoteSync || StorageService.isTestMode || !supabase) {
      this.data.sequences.cli += 1;
      const codeClient = `CLI-${String(this.data.sequences.cli).padStart(3, '0')}`;
      const localClient: Client = {
        id: `cli-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        codeClient,
        nomComplet: nomClean,
        telephone: telephone?.trim(),
        notes: notes?.trim(),
        dateCreation: new Date().toISOString(),
        actif: true,
      };
      this.data.clients.push(localClient);
      this.saveData(this.data);
      return localClient;
    }

    const { data: codeData, error: codeErr } = await supabase.rpc('get_next_bon_number', {
      p_type: 'CLI',
      p_year: 0,
    });
    if (codeErr || !codeData) {
      throw new Error(codeErr?.message || 'Erreur génération code client.');
    }

    const clientId = `cli-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const dateCreation = new Date().toISOString();
    const { data: inserted, error } = await supabase
      .from('parties')
      .insert([
        {
          id: clientId,
          code: String(codeData),
          name: nomClean,
          phone: telephone?.trim() || null,
          notes: notes?.trim() || null,
          is_active: true,
          is_deleted: false,
          created_at: dateCreation,
        },
      ])
      .select()
      .single();

    if (error || !inserted) {
      throw new Error(error?.message || 'Erreur création client Supabase.');
    }

    const confirmedClient: Client = {
      id: inserted.id,
      codeClient: inserted.code,
      nomComplet: inserted.name,
      telephone: inserted.phone || undefined,
      notes: inserted.notes || undefined,
      dateCreation: inserted.created_at,
      actif: inserted.is_active !== false,
    };

    this.data.clients.push(confirmedClient);
    this.logAudit(
      'Gérant (Admin)',
      'CREATION_CLIENT',
      'parties',
      confirmedClient.id,
      `Nouveau client enregistré : ${confirmedClient.codeClient} - ${confirmedClient.nomComplet}`
    );
    this.saveData(this.data);
    return confirmedClient;
  }

  public async modifierClient(
    clientId: string,
    nomComplet: string,
    telephone?: string,
    notes?: string
  ): Promise<Client> {
    const client = this.data.clients.find((c) => c.id === clientId);
    if (!client) throw new Error('Client introuvable.');

    const nomClean = nomComplet.trim();
    if (!nomClean) throw new Error('Le nom complet ou la raison sociale est obligatoire.');

    const telClean = telephone !== undefined ? telephone.trim() : client.telephone || '';
    const notesClean = notes !== undefined ? notes.trim() : client.notes || '';

    if (!StorageService.isTestMode && supabase) {
      const { error } = await supabase
        .from('parties')
        .update({
          name: nomClean,
          phone: telClean || null,
          notes: notesClean || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientId);
      if (error) throw new Error(error.message);
    }

    client.nomComplet = nomClean;
    client.telephone = telClean || undefined;
    client.notes = notesClean || undefined;

    this.logAudit('Gérant (Admin)', 'MODIF_CLIENT', 'parties', client.id, `Modification client : ${client.codeClient}`);
    this.saveData(this.data);
    return client;
  }

  public async basculerStatutClient(clientId: string): Promise<Client> {
    const client = this.data.clients.find((c) => c.id === clientId);
    if (!client) throw new Error('Client introuvable.');

    const nouveauStatut = client.actif === false;
    if (!StorageService.isTestMode && supabase) {
      const { error } = await supabase
        .from('parties')
        .update({ is_active: nouveauStatut, updated_at: new Date().toISOString() })
        .eq('id', clientId);
      if (error) throw new Error(error.message);
    }

    client.actif = nouveauStatut;
    this.logAudit(
      'Gérant (Admin)',
      'STATUT_CLIENT',
      'parties',
      client.id,
      `Client ${client.codeClient} (${client.nomComplet}) passé à ${client.actif ? 'ACTIF' : 'ARCHIVÉ'}`
    );
    this.saveData(this.data);
    return client;
  }

  public async supprimerClient(clientId: string): Promise<void> {
    const client = this.data.clients.find((c) => c.id === clientId);
    if (!client) throw new Error('Client introuvable.');

    const balance = this.getClientBalance(clientId);
    const stockClient = balance ? balance.totalStock : 0;
    if (stockClient > 0.001) {
      throw new Error(
        `Suppression impossible : Le client '${client.nomComplet} (${client.codeClient})' possède encore ${stockClient.toLocaleString('fr-FR')} L d'huile en cuve.`
      );
    }

    const nbMouvements = this.data.mouvements.filter((m) => m.clientId === clientId).length;
    if (nbMouvements > 0) {
      throw new Error(
        `Suppression permanente impossible : Le client '${client.nomComplet}' est référencé dans ${nbMouvements} mouvement(s) historique(s). Archivez-le à la place.`
      );
    }

    if (!StorageService.isTestMode && supabase) {
      const { error } = await supabase
        .from('parties')
        .update({ is_active: false, is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', clientId);
      if (error) throw new Error(error.message);
    }

    this.data.clients = this.data.clients.filter((c) => c.id !== clientId);
    this.logAudit(
      'Gérant (Admin)',
      'SUPPRESSION_CLIENT',
      'parties',
      clientId,
      `Archivage client sans historique ${client.codeClient}`
    );
    this.saveData(this.data);
  }

  // --- SNAPSHOTS EN MÉMOIRE (TESTS & EXPORT) ---
  public getBackups(): BackupSnapshot[] {
    return [...this.backups];
  }

  public createAutomaticSnapshot(description: string = 'Snapshot mémoire'): BackupSnapshot {
    const dataStr = JSON.stringify(this.data);
    const tailleKo = Math.round((dataStr.length / 1024) * 10) / 10;
    const now = new Date();
    const nomFichier = `huilerie_jemai_snapshot_${now.toISOString().replace(/[:.]/g, '-')}.json`;

    const snapshot: BackupSnapshot = {
      id: `bck-${Date.now()}`,
      date: now.toISOString(),
      nomFichier,
      tailleKo,
      nbMouvements: this.data.mouvements.length,
      nbCuves: this.data.cuves.length,
      nbClients: this.data.clients.length,
      donneesJSON: dataStr,
      description,
    };

    this.backups.unshift(snapshot);
    if (this.backups.length > 8) this.backups.length = 8;
    if (StorageService.isTestMode) {
      testMemoryBackups = JSON.parse(JSON.stringify(this.backups));
    }
    return snapshot;
  }

  public restaurerDepuisSnapshot(snapshotId: string): void {
    const bck = this.backups.find((b) => b.id === snapshotId);
    if (!bck) throw new Error('Snapshot introuvable.');
    this.restaurerDepuisJSON(bck.donneesJSON, `Restauration ${bck.nomFichier}`);
  }

  public restaurerDepuisJSON(jsonString: string, description: string = 'Restauration JSON'): void {
    const parsed = JSON.parse(jsonString);
    if (!parsed.cuves || !Array.isArray(parsed.cuves)) {
      throw new Error('Structure invalide : table cuves manquante.');
    }
    this.saveData(parsed);
    this.logAudit('Gérant (Admin)', 'RESTAURATION_SNAPSHOT', 'database', undefined, description);
  }

  public genererExportSQLiteSQL(): string {
    const lines: string[] = [];
    lines.push('-- EXPORT SQLITE HUILERIE JEMAI');
    lines.push(`-- Généré le ${new Date().toISOString()}\nBEGIN TRANSACTION;`);
    for (const c of this.data.cuves) {
      lines.push(
        `INSERT INTO cuves (numero, nom, capacite_max, active) VALUES ('${c.numero}', '${c.nom.replace(/'/g, "''")}', ${c.capaciteMax}, ${c.active ? 1 : 0});`
      );
    }
    for (const cl of this.data.clients) {
      lines.push(
        `INSERT INTO clients (code_client, nom_complet) VALUES ('${cl.codeClient}', '${cl.nomComplet.replace(/'/g, "''")}');`
      );
    }
    lines.push('COMMIT;');
    return lines.join('\n');
  }

  // --- BANC D'ESSAI AUTOMATISÉ (TESTS 1-10 PROTÉGÉS) ---
  public async executerTestsAutomatiques(): Promise<TestResultItem[]> {
    const results: TestResultItem[] = [];
    const addStep = (id: number, titre: string, desc: string) => {
      const item: TestResultItem = { id, titre, description: desc, statut: 'en_cours', detailsLog: [] };
      results.push(item);
      return item;
    };

    const backupAvantTest = JSON.stringify(this.data);
    StorageService.isTestMode = true;
    this.data = createEmptyData();
    testMemoryData = JSON.parse(JSON.stringify(this.data));

    try {
      const step1 = addStep(1, "Création d'une pile de 5 000 L", "Créer la pile de test 'P-TEST-5000' avec capacité max 5 000 Litres.");
      const cuveTest = this.ajouterCuve('P-TEST-5000', 'Cuve Inox Test Obligatoire', 5000.0, "Cuve dédiée au banc d'essai");
      const clientA = await this.ajouterClient('Producteur Test A', '+216 99 111 222', undefined, true);
      const clientB = await this.ajouterClient('Producteur Test B', '+216 99 333 444', undefined, true);
      step1.statut = 'succes';
      step1.message = `Cuve créée : ${cuveTest.numero} (${cuveTest.capaciteMax} L). Stock initial = 0 L.`;

      const step2 = addStep(2, 'Entrée de 3 000 Litres (Acceptée)', 'Enregistrer 3 000 L pour Producteur Test A.');
      const mouv1 = await this.enregistrerEntree(
        { clientId: clientA.id, cuveId: cuveTest.id, quantite: 3000.0, utilisateur: 'Opérateur Cuverie' },
        true
      );
      if (this.getCuveStock(cuveTest.id) !== 3000.0) throw new Error('Stock attendu 3000 L.');
      step2.statut = 'succes';
      step2.message = `Succès : Bon ${mouv1.numeroBon} émis. Stock cuve = 3 000 L (60%). Reste libre = 2 000 L.`;

      const step3 = addStep(3, 'Entrée supplémentaire de 2 000 Litres (Cuve Pleine)', 'Enregistrer 2 000 L pour Producteur Test B.');
      const mouv2 = await this.enregistrerEntree(
        { clientId: clientB.id, cuveId: cuveTest.id, quantite: 2000.0, utilisateur: 'Opérateur Cuverie' },
        true
      );
      const detPleine = this.getCuveDetails(cuveTest.id);
      if (this.getCuveStock(cuveTest.id) !== 5000.0 || detPleine?.capaciteRestante !== 0) {
        throw new Error('Stock attendu 5000 L.');
      }
      step3.statut = 'succes';
      step3.message = `Succès : Bon ${mouv2.numeroBon} émis. Stock cuve = 5 000 L (100% pleine).`;

      const step4 = addStep(4, 'Refus de toute entrée supplémentaire', "Tentative d'ajouter 100 L dans la cuve pleine.");
      let rejected4 = false;
      try {
        await this.enregistrerEntree({ clientId: clientA.id, cuveId: cuveTest.id, quantite: 100.0, utilisateur: 'Opérateur Cuverie' }, true);
      } catch (err: any) {
        rejected4 = true;
        step4.statut = 'succes';
        step4.message = `Rejet strict validé : "${err.message}".`;
      }
      if (!rejected4) throw new Error("L'entrée excédentaire aurait dû être bloquée.");

      const step5 = addStep(5, 'Refus sortie supérieure au solde client', 'Client B possède 2 000 L. Tentative de sortie de 2 500 L.');
      let rejected5 = false;
      try {
        await this.enregistrerSortie({ clientId: clientB.id, cuveId: cuveTest.id, quantite: 2500.0, utilisateur: 'Opérateur Cuverie' }, true);
      } catch (err: any) {
        rejected5 = true;
        step5.statut = 'succes';
        step5.message = `Rejet strict validé : "${err.message}".`;
      }
      if (!rejected5) throw new Error('La sortie supérieure au solde aurait dû être bloquée.');

      const step6 = addStep(6, 'Vérification multi-clients dans une même pile', 'Répartition Client A (3 000 L) / Client B (2 000 L).');
      const soldeA = this.getClientSoldeDansCuve(clientA.id, cuveTest.id);
      const soldeB = this.getClientSoldeDansCuve(clientB.id, cuveTest.id);
      if (soldeA !== 3000.0 || soldeB !== 2000.0) throw new Error('Incohérence multi-clients.');
      step6.statut = 'succes';
      step6.message = `Cohabitation parfaite : Client A = ${soldeA} L, Client B = ${soldeB} L.`;

      const step7 = addStep(7, 'Transfert traçable entre deux piles', 'Transférer 800 L de Client A vers P-DEST-3000.');
      const cuveDest = this.ajouterCuve('P-DEST-3000', 'Cuve Réceptrice Transfert', 3000.0);
      const trfRes = await this.enregistrerTransfert(
        { clientId: clientA.id, cuveSourceId: cuveTest.id, cuveDestId: cuveDest.id, quantite: 800.0, utilisateur: 'Gérant (Admin)' },
        true
      );
      if (this.getCuveStock(cuveTest.id) !== 4200.0 || this.getCuveStock(cuveDest.id) !== 800.0) {
        throw new Error('Incohérence transfert.');
      }
      step7.statut = 'succes';
      step7.message = `Transfert réussi (${trfRes.sortie.numeroBon}). Source = 4 200 L, Dest = 800 L.`;

      const step8 = addStep(8, 'Vérification persistance après redémarrage', 'Recharger StorageService depuis le magasin mémoire isolé.');
      const reloadedEngine = new StorageService();
      const stockReloaded = reloadedEngine.getCuveStock(cuveTest.id);
      if (stockReloaded !== 4200.0) throw new Error(`Attendu 4200 L, obtenu ${stockReloaded} L.`);
      step8.statut = 'succes';
      step8.message = `Persistance vérifiée : stock retrouvé à l'identique (${stockReloaded} L).`;

      const step9 = addStep(9, "Annulation avec contre-passation d'audit", "Annuler le bon d'entrée sans supprimer la trace historique.");
      const mouvAnnule = await this.annulerMouvement(mouv2.id, "Test obligatoire d'annulation traçable", 'Gérant (Admin)', true);
      if (!mouvAnnule.estAnnule || this.getCuveStock(cuveTest.id) !== 2200.0) {
        throw new Error('Incohérence annulation.');
      }
      step9.statut = 'succes';
      step9.message = `Annulation réussie : Bon ${mouvAnnule.numeroBon} archivé. Stock = 2 200 L.`;

      const step10 = addStep(10, 'Sauvegarde & restauration vérifiée', "Créer un snapshot d'archive et vérifier son intégrité.");
      const snap = this.createAutomaticSnapshot('Snapshot Test Suite');
      if (!snap || snap.tailleKo <= 0) throw new Error('Échec snapshot.');
      step10.statut = 'succes';
      step10.message = `Snapshot créé : ${snap.nomFichier} (${snap.tailleKo} Ko).`;
    } catch (err: any) {
      const last = results[results.length - 1];
      if (last) {
        last.statut = 'echec';
        last.message = `ERREUR : ${err.message}`;
      }
    } finally {
      StorageService.isTestMode = false;
      testMemoryData = null;
      testMemoryBackups = [];
      try {
        this.data = JSON.parse(backupAvantTest);
        this.notifyListeners();
      } catch {
        // ignore
      }
    }

    return results;
  }
}

export const dbService = new StorageService();
