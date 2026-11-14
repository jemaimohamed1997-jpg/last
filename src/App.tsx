/**
 * Huilerie Jemai (معصرة جماعي) - ERP & Gestion de Stock
 * Complete Oléicole ERP Application backed exclusively by Supabase PostgreSQL + Auth + RBAC
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Menu,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import {
  supabase,
  isSupabaseConfigured,
  fetchCurrentUserAndProfile,
  signOutSession,
  fetchLiveTanks,
  fetchLiveParties,
  createPartyRecord,
  updatePartyRecord,
  togglePartyActiveRecord,
  fetchLiveOperations,
  fetchLiveTankMovements,
  fetchLiveAppSettings,
  saveLiveOperation,
  getNextBonNumber,
  fetchOliveReceptions,
  createOliveReceptionRecord,
  editOliveReceptionRpc,
  fetchReceptionPayments,
  recordReceptionPaymentRpc,
  fetchProductionBatches,
  createProductionBatchRecord,
  confirmProductionBatchRpc,
  depositProductionToTankRpc,
  fetchGrignonSales,
  createGrignonSaleRecord,
  updateGrignonSalePayment,
  fetchPurchases,
  createPurchaseRecord,
  updatePurchasePayment,
  fetchExpenses,
  createExpenseRecord,
  fetchEmployees,
  createEmployeeRecord,
  updateEmployeeRecord,
  fetchSalaryAdvances,
  recordSalaryAdvanceRpc,
  fetchSalaryPayments,
  recordSalaryPaymentRpc,
  fetchAuditLogs,
  appendAuditLog,
  DEFAULT_APP_SETTINGS,
} from './lib/supabase';
import { calculateTankStocks, calculateClientStocks } from './lib/stockCalculation';
import { canAccessModule, canPerformAction, ModuleKey } from './lib/permissions';
import {
  exportClientsToExcel,
  exportOliveReceptionsToExcel,
  exportProductionToExcel,
  exportGrignonsToExcel,
  exportPurchasesToExcel,
  exportPersonnelToExcel,
  exportFinancesToExcel,
} from './lib/export';
import {
  Tank,
  Party,
  Operation,
  TankMovement,
  UserProfile,
  AppSettings,
} from './types/stock';
import {
  OliveReception,
  ReceptionPayment,
  ProductionBatch,
  GrignonSale,
  PurchaseBatch,
  ExpenseItem,
  Employee,
  SalaryAdvance,
  SalaryPayment,
  AuditLog,
} from './types/production';
import { Language, translations } from './lib/i18n';

// Components
import { AppLoginScreen } from './components/Auth/AppLoginScreen';
import { Navbar } from './components/Navbar';
import { Sidebar, ActiveModule, getOrderedSidebarItems } from './components/Sidebar';
import { GestionDeStockOriginal } from './components/GestionDeStockModule/GestionDeStockOriginal';
import { OliveReceptionsList } from './components/OlivesModule/OliveReceptionsList';
import {
  OliveReceptionModal,
  OliveReceptionCreateInput,
} from './components/OlivesModule/OliveReceptionModal';
import { ReceptionPaymentSubmitPayload } from './components/OlivesModule/ReceptionPaymentModal';
import { ProductionQueue } from './components/ProductionModule/ProductionQueue';
import {
  ProductionEntryModal,
  ProductionBatchCreateInput,
} from './components/ProductionModule/ProductionEntryModal';
import { CustomerProductionLedger } from './components/CustomerHistoryModule/CustomerProductionLedger';
import { GrignonsSalesList } from './components/GrignonsModule/GrignonsSalesList';
import {
  GrignonSaleModal,
  GrignonSaleCreateInput,
} from './components/GrignonsModule/GrignonSaleModal';
import { PurchasesList } from './components/PurchasesModule/PurchasesList';
import {
  PurchaseModal,
  PurchaseCreateInput,
} from './components/PurchasesModule/PurchaseModal';
import { FinancesManager, ExpenseCreateInput } from './components/FinancesModule/FinancesManager';
import { ClientsList } from './components/ClientsModule/ClientsList';
import { PersonnelManager } from './components/PersonnelModule/PersonnelManager';
import { EmployeeFormPayload } from './components/PersonnelModule/EmployeeModal';
import { SettingsView } from './components/SettingsModule/SettingsView';
import {
  PrintDocument,
  PrintableDocType,
  PrintFormat,
} from './components/Documents/PrintDocument';

export default function App() {
  const [lang, setLang] = useState<Language>('fr');
  const [activeModule, setActiveModule] = useState<ActiveModule>('RECEPTIONS');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auth State
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(false);

  // Status Notification Banner (replaces window.alert)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showBanner = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setBanner({ type, message });
    setTimeout(() => {
      setBanner((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  }, []);

  // Core Data (Supabase Single Source of Truth)
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [movements, setMovements] = useState<TankMovement[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  const [receptions, setReceptions] = useState<OliveReception[]>([]);
  const [receptionPayments, setReceptionPayments] = useState<ReceptionPayment[]>([]);
  const [productionBatches, setProductionBatches] = useState<ProductionBatch[]>([]);
  const [grignonSales, setGrignonSales] = useState<GrignonSale[]>([]);
  const [purchases, setPurchases] = useState<PurchaseBatch[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryAdvances, setSalaryAdvances] = useState<SalaryAdvance[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Modal Controls
  const [activeModal, setActiveModal] = useState<
    | null
    | { type: 'OLIVE_RECEPTION' }
    | { type: 'PRODUCTION_ENTRY'; reception: OliveReception }
    | { type: 'GRIGNON_SALE' }
    | { type: 'PURCHASE' }
    | { type: 'PRINT'; docType: PrintableDocType; data: any; format?: PrintFormat }
  >(null);

  const clearBusinessState = useCallback(() => {
    setTanks([]);
    setParties([]);
    setOperations([]);
    setMovements([]);
    setReceptions([]);
    setReceptionPayments([]);
    setProductionBatches([]);
    setGrignonSales([]);
    setPurchases([]);
    setExpenses([]);
    setEmployees([]);
    setSalaryAdvances([]);
    setSalaryPayments([]);
    setAuditLogs([]);
    setActiveModal(null);
  }, []);

  const refreshAllData = useCallback(
    async (silent: boolean = false) => {
      if (!isSupabaseConfigured) return;
      if (!silent) setLoadingData(true);
      try {
        const results = await Promise.allSettled([
          fetchLiveTanks(),
          fetchLiveParties(),
          fetchLiveOperations(),
          fetchLiveTankMovements(),
          fetchLiveAppSettings(),
          fetchOliveReceptions(),
          fetchReceptionPayments(),
          fetchProductionBatches(),
          fetchGrignonSales(),
          fetchPurchases(),
          fetchExpenses(),
          fetchEmployees(),
          fetchSalaryAdvances(),
          fetchSalaryPayments(),
          fetchAuditLogs(),
        ]);

        let anySuccess = false;
        const val = <T,>(idx: number, setter: (v: T) => void) => {
          const r = results[idx];
          if (r.status === 'fulfilled') {
            setter(r.value as T);
            anySuccess = true;
          }
        };

        val<Tank[]>(0, setTanks);
        val<Party[]>(1, setParties);
        val<Operation[]>(2, setOperations);
        val<TankMovement[]>(3, setMovements);
        val<AppSettings>(4, setAppSettings);
        val<OliveReception[]>(5, setReceptions);
        val<ReceptionPayment[]>(6, setReceptionPayments);
        val<ProductionBatch[]>(7, setProductionBatches);
        val<GrignonSale[]>(8, setGrignonSales);
        val<PurchaseBatch[]>(9, setPurchases);
        val<ExpenseItem[]>(10, setExpenses);
        val<Employee[]>(11, setEmployees);
        val<SalaryAdvance[]>(12, setSalaryAdvances);
        val<SalaryPayment[]>(13, setSalaryPayments);
        val<AuditLog[]>(14, setAuditLogs);

        setIsOnline(anySuccess);
      } catch (err: any) {
        setIsOnline(false);
        if (!silent) {
          showBanner(err?.message || 'Erreur synchronisation Supabase.', 'error');
        }
      } finally {
        if (!silent) setLoadingData(false);
      }
    },
    [showBanner]
  );

  // Bootstrap Authentication
  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      if (!isSupabaseConfigured) {
        if (mounted) setAuthChecking(false);
        return;
      }
      try {
        // Attempt to load branding settings if publicly readable
        fetchLiveAppSettings()
          .then((s) => {
            if (mounted && s) setAppSettings(s);
          })
          .catch(() => {});

        const profile = await fetchCurrentUserAndProfile();
        if (mounted) {
          setCurrentProfile(profile);
        }
      } finally {
        if (mounted) setAuthChecking(false);
      }
    };

    initAuth();

    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        if (mounted) {
          setCurrentProfile(null);
          clearBusinessState();
        }
      } else if (mounted) {
        fetchCurrentUserAndProfile()
          .then((prof) => {
            if (mounted) setCurrentProfile(prof);
          })
          .catch(() => {});
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [clearBusinessState]);

  // Load ERP Data whenever authenticated profile changes
  useEffect(() => {
    if (!currentProfile) return;
    refreshAllData(false);

    // Ensure activeModule is accessible to this user
    if (!canAccessModule(currentProfile, activeModule)) {
      const orderedKeys: ModuleKey[] = [
        'RECEPTIONS',
        'PRODUCTION',
        'GRIGNONS',
        'PURCHASES',
        'CUVES',
        'FINANCES',
        'CUSTOMER_HISTORY',
        'CLIENTS',
        'PERSONNEL',
        'SETTINGS',
      ];
      const firstAllowed = orderedKeys.find((k) => canAccessModule(currentProfile, k));
      if (firstAllowed) setActiveModule(firstAllowed);
    }
  }, [currentProfile, refreshAllData]);

  // Update HTML document direction and lang attribute
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  // Logout
  const handleLogout = async () => {
    await signOutSession();
    setCurrentProfile(null);
    clearBusinessState();
  };

  // Stock Calculations
  const { tankDetails } = useMemo(
    () =>
      calculateTankStocks(
        tanks,
        parties,
        operations,
        movements,
        appSettings.threshold
      ),
    [tanks, parties, operations, movements, appSettings.threshold]
  );

  const clientStockSummaries = useMemo(
    () => calculateClientStocks(parties, tanks, operations, movements),
    [parties, tanks, operations, movements]
  );

  const queueCount = receptions.filter((r) => r.status === 'EN_FILE').length;
  const alertTanksCount = tankDetails.filter((t) => t.is_alert).length;

  // --------------------------------------------------------------------------
  // ERP HANDLERS (ALL BACKED BY SUPABASE)
  // --------------------------------------------------------------------------
  const handleSaveOliveReception = async (input: OliveReceptionCreateInput) => {
    if (!currentProfile) return;
    let resolvedParty: Party | undefined;

    if (input.party_id === 'NEW' && input.new_party) {
      resolvedParty = await createPartyRecord({
        name: input.new_party.name,
        phone: input.new_party.phone,
      });
    } else {
      resolvedParty = parties.find((p) => p.id === input.party_id);
    }

    if (!resolvedParty) {
      throw new Error('Client / Producteur introuvable.');
    }

    const created = await createOliveReceptionRecord({
      date: input.date,
      party_id: resolvedParty.id,
      party_name: resolvedParty.name,
      party_code: resolvedParty.code,
      phone: resolvedParty.phone || input.new_party?.phone || undefined,
      vehicle_plate: input.vehicle_plate,
      driver_name: input.driver_name,
      gross_weight_kg: input.gross_weight_kg,
      tare_weight_kg: input.tare_weight_kg,
      net_weight_kg: input.net_weight_kg,
      milling_fee_per_kg: input.milling_fee_per_kg,
      total_milling_fee_tnd: input.total_milling_fee_tnd,
      paid_amount_tnd: 0,
      remaining_amount_tnd: input.total_milling_fee_tnd,
      payment_status: input.total_milling_fee_tnd <= 0 ? 'PAYE' : 'IMPAYE',
      status: input.status,
      notes: input.notes || null,
      operator: currentProfile.display_name,
    });

    await appendAuditLog({
      action: 'RECEPTION_OLIVES',
      module: 'RECEPTIONS',
      record_id: created.id,
      details: `Ticket ${created.ticket_number}: ${created.net_weight_kg} KG (${created.total_milling_fee_tnd.toFixed(
        3
      )} TND) de ${created.party_name}`,
      userName: currentProfile.display_name,
    });

    await refreshAllData(true);
    setActiveModal({
      type: 'PRINT',
      docType: 'OLIVE_RECEPTION',
      format: 'A4',
      data: created,
    });
  };

  const handleEditOliveReception = async (params: {
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
  }) => {
    if (!currentProfile) return;
    await editOliveReceptionRpc(params);
    await appendAuditLog({
      action: 'MODIF_BON_OLV',
      module: 'RECEPTIONS',
      record_id: params.receptionId,
      details: `Modification BON-OLV (${params.grossWeightKg - params.tareWeightKg} KG). Motif: ${params.reason}`,
      userName: currentProfile.display_name,
    });
    await refreshAllData(true);
    showBanner('Bon de réception olives modifié avec succès (audit enregistré).', 'success');
  };

  const handleSendToQueue = async (receptionId: string) => {
    if (!currentProfile || !supabase) return;
    try {
      const { error } = await supabase
        .from('olive_receptions')
        .update({ status: 'EN_FILE', updated_at: new Date().toISOString() })
        .eq('id', receptionId);
      if (error) throw new Error(error.message);

      await appendAuditLog({
        action: 'ENVOI_FILE_TRITURATION',
        module: 'RECEPTIONS',
        record_id: receptionId,
        details: `Lot ${receptionId} placé en file d'attente de trituration`,
        userName: currentProfile.display_name,
      });
      await refreshAllData(true);
      showBanner('Lot envoyé en file d’attente de trituration.', 'success');
    } catch (err: any) {
      showBanner(err?.message || 'Erreur envoi en file.', 'error');
    }
  };

  const handleConfirmReceptionPayment = async (payload: ReceptionPaymentSubmitPayload) => {
    if (!currentProfile) return;
    await recordReceptionPaymentRpc(payload);
    await appendAuditLog({
      action: 'ENCAISSEMENT_RECEPTION',
      module: 'FINANCES',
      record_id: payload.receptionId,
      details: `Règlement ${payload.amountTnd.toFixed(3)} TND (${payload.paymentMode})`,
      userName: currentProfile.display_name,
    });
    await refreshAllData(true);
    showBanner(`Encaissement de ${payload.amountTnd.toFixed(3)} TND enregistré.`, 'success');
  };

  const handleSaveProductionBatch = async (batchInput: ProductionBatchCreateInput) => {
    if (!currentProfile) return;
    const created = await createProductionBatchRecord(batchInput);
    await appendAuditLog({
      action: 'SAISIE_TRITURATION_ATTENTE',
      module: 'PRODUCTION',
      record_id: created.id,
      details: `Lot ${created.ticket_number}: ${created.oil_quantity_kg} KG (${created.oil_quantity_litres} L) en attente de confirmation`,
      userName: currentProfile.display_name,
    });
    await refreshAllData(true);
    setActiveModal({
      type: 'PRINT',
      docType: 'PRODUCTION_TICKET',
      format: 'A4',
      data: created,
    });
  };

  const handleConfirmProductionBatch = async (batchId: string) => {
    if (!currentProfile) return;
    await confirmProductionBatchRpc(batchId);
    await appendAuditLog({
      action: 'CONFIRMATION_TRITURATION',
      module: 'PRODUCTION',
      record_id: batchId,
      details: `Lot ${batchId} confirmé et verrouillé définitivement`,
      userName: currentProfile.display_name,
    });
    await refreshAllData(true);
    showBanner('Lot de trituration confirmé et verrouillé.', 'success');
  };

  const handleDepositCustomerOilInTank = async (batch: ProductionBatch, targetTankId: string) => {
    if (!currentProfile) return;
    const res = await depositProductionToTankRpc({ batchId: batch.id, tankId: targetTankId });
    await appendAuditLog({
      action: 'MISE_EN_CUVE_CLIENT',
      module: 'CUSTOMER_HISTORY',
      record_id: res.operation_id || batch.id,
      details: `Huile lot ${batch.ticket_number} (${batch.oil_quantity_litres} L) mise en cuve sous bon ${res.doc_number}`,
      userName: currentProfile.display_name,
    });
    await refreshAllData(true);
    showBanner(
      `Succès : ${batch.oil_quantity_litres} L déposés en cuve sous le bon ${res.doc_number}.`,
      'success'
    );
  };

  const handleSaveGrignonSale = async (saleInput: GrignonSaleCreateInput) => {
    if (!currentProfile) return;
    const created = await createGrignonSaleRecord(saleInput);
    await appendAuditLog({
      action: 'VENTE_GRIGNONS',
      module: 'GRIGNONS',
      record_id: created.id,
      details: `Bon ${created.doc_number}: ${created.net_weight_tonnes} T vendues à ${created.buyer_name} (${created.total_price_tnd} TND)`,
      userName: currentProfile.display_name,
    });
    await refreshAllData(true);
    setActiveModal({
      type: 'PRINT',
      docType: 'GRIGNON_SALE',
      format: 'A4',
      data: created,
    });
  };

  const handleToggleGrignonPayment = async (saleId: string, nextStatus: 'PAYE' | 'IMPAYE') => {
    if (!currentProfile) return;
    try {
      await updateGrignonSalePayment(saleId, nextStatus);
      await appendAuditLog({
        action: 'STATUT_PAIEMENT_GRIGNONS',
        module: 'GRIGNONS',
        record_id: saleId,
        details: `Statut paiement vente ${saleId} passé à ${nextStatus}`,
        userName: currentProfile.display_name,
      });
      await refreshAllData(true);
    } catch (err: any) {
      showBanner(err?.message || 'Erreur mise à jour statut paiement.', 'error');
    }
  };

  const handleSavePurchase = async (purchaseInput: PurchaseCreateInput) => {
    if (!currentProfile) return;
    const created = await createPurchaseRecord(purchaseInput);
    await appendAuditLog({
      action: 'ACHAT_DIRECT',
      module: 'PURCHASES',
      record_id: created.id,
      details: `Bon ${created.doc_number}: ${created.quantity} ${
        created.item_type === 'OLIVES' ? 'KG' : 'L'
      } auprès de ${created.supplier_name} (${created.total_price_tnd} TND)`,
      userName: currentProfile.display_name,
    });

    if (created.item_type === 'HUILE_VRAC' && created.destination_tank_id && supabase) {
      // Ensure own-stock party exists before inserting tank_movement FK
      const ownPartyId = 'cli-huilerie-propre';
      if (!parties.some((p) => p.id === ownPartyId)) {
        await supabase.from('parties').upsert({
          id: ownPartyId,
          code: 'HUILERIE',
          name: `${appSettings.company_name} (Stock Propre)`,
          is_active: true,
          is_deleted: false,
        });
      }

      const bonRec = await getNextBonNumber('REC');
      const opId = `op-ach-${Date.now()}`;
      const stockOp: Operation = {
        id: opId,
        doc_number: bonRec,
        type: 'ENTREE',
        party_id: ownPartyId,
        operator: currentProfile.display_name,
        total_quantity: created.quantity,
        notes: `Achat huile compte propre (${created.doc_number} - ${created.supplier_name})`,
        status: 'VALIDE',
        operation_date: new Date().toISOString(),
        allocations: [{ tank_id: created.destination_tank_id, quantity: created.quantity }],
      };
      const stockMvt: TankMovement = {
        id: `tm-${opId}`,
        operation_id: opId,
        tank_id: created.destination_tank_id,
        party_id: ownPartyId,
        direction: 'IN',
        quantity: created.quantity,
        notes: `Stock propre issu de ${created.doc_number}`,
        created_at: new Date().toISOString(),
      };
      await saveLiveOperation(stockOp, [stockMvt]);
    }

    await refreshAllData(true);
    setActiveModal({
      type: 'PRINT',
      docType: 'PURCHASE_RECEIPT',
      format: 'A4',
      data: created,
    });
  };

  const handleTogglePurchasePayment = async (purchaseId: string, nextStatus: 'PAYE' | 'IMPAYE') => {
    if (!currentProfile) return;
    try {
      await updatePurchasePayment(purchaseId, nextStatus);
      await appendAuditLog({
        action: 'STATUT_PAIEMENT_ACHAT',
        module: 'PURCHASES',
        record_id: purchaseId,
        details: `Statut paiement achat ${purchaseId} passé à ${nextStatus}`,
        userName: currentProfile.display_name,
      });
      await refreshAllData(true);
    } catch (err: any) {
      showBanner(err?.message || 'Erreur mise à jour statut paiement achat.', 'error');
    }
  };

  const handleAddExpense = async (expenseInput: ExpenseCreateInput) => {
    if (!currentProfile) return;
    const created = await createExpenseRecord(expenseInput);
    await appendAuditLog({
      action: 'DEPENSE_EXPLOITATION',
      module: 'FINANCES',
      record_id: created.id,
      details: `Charge: ${created.label} (${created.amount_tnd.toFixed(3)} TND) [${created.category}]`,
      userName: currentProfile.display_name,
    });
    await refreshAllData(true);
    showBanner('Dépense enregistrée dans la caisse.', 'success');
  };

  const handleAddNewClient = async (client: { name: string; phone?: string; notes?: string }) => {
    if (!currentProfile) return;
    const created = await createPartyRecord(client);
    await appendAuditLog({
      action: 'CREATION_CLIENT',
      module: 'CLIENTS',
      record_id: created.id,
      details: `Nouveau producteur ${created.code} - ${created.name}`,
      userName: currentProfile.display_name,
    });
    await refreshAllData(true);
    showBanner(`Client ${created.code} (${created.name}) enregistré.`, 'success');
  };

  const handleUpdateClient = async (
    partyId: string,
    updates: { name: string; phone?: string; notes?: string }
  ) => {
    if (!currentProfile) return;
    await updatePartyRecord(partyId, updates);
    await appendAuditLog({
      action: 'MODIFICATION_CLIENT',
      module: 'CLIENTS',
      record_id: partyId,
      details: `Fiche client mise à jour : ${updates.name}`,
      userName: currentProfile.display_name,
    });
    await refreshAllData(true);
    showBanner('Fiche client mise à jour.', 'success');
  };

  const handleToggleClientActive = async (partyId: string, nextActive: boolean) => {
    if (!currentProfile) return;
    await togglePartyActiveRecord(partyId, nextActive);
    await appendAuditLog({
      action: nextActive ? 'REACTIVATION_CLIENT' : 'ARCHIVAGE_CLIENT',
      module: 'CLIENTS',
      record_id: partyId,
      details: `Statut client passé à ${nextActive ? 'ACTIF' : 'ARCHIVÉ'}`,
      userName: currentProfile.display_name,
    });
    await refreshAllData(true);
  };

  // Personnel & Payroll Handlers
  const handleCreateEmployee = async (payload: EmployeeFormPayload) => {
    if (!currentProfile) return;
    const created = await createEmployeeRecord(payload);
    await appendAuditLog({
      action: 'CREATION_EMPLOYE',
      module: 'PERSONNEL',
      record_id: created.id,
      details: `Employé ${created.code} - ${created.full_name} (${created.base_salary_tnd.toFixed(3)} TND/mois)`,
      userName: currentProfile.display_name,
    });
    await refreshAllData(true);
    showBanner(`Employé ${created.full_name} ajouté.`, 'success');
  };

  const handleUpdateEmployee = async (id: string, payload: EmployeeFormPayload) => {
    if (!currentProfile) return;
    await updateEmployeeRecord(id, payload);
    await appendAuditLog({
      action: 'MODIFICATION_EMPLOYE',
      module: 'PERSONNEL',
      record_id: id,
      details: `Mise à jour fiche employé ${payload.full_name}`,
      userName: currentProfile.display_name,
    });
    await refreshAllData(true);
    showBanner('Fiche employé mise à jour.', 'success');
  };

  const handleRecordAdvance = async (params: {
    employeeId: string;
    amountTnd: number;
    advanceDate: string;
    paymentMode: 'ESPECES' | 'CHEQUE' | 'VIREMENT';
    notes?: string;
  }) => {
    if (!currentProfile) throw new Error('Session requise.');
    const adv = await recordSalaryAdvanceRpc(params);
    await appendAuditLog({
      action: 'AVANCE_SALAIRE',
      module: 'PERSONNEL',
      record_id: adv.id,
      details: `Avance ${adv.doc_number} de ${params.amountTnd.toFixed(3)} TND (${params.paymentMode})`,
      userName: currentProfile.display_name,
    });
    await refreshAllData(true);
    showBanner(`Avance ${adv.doc_number} enregistrée.`, 'success');
    return adv;
  };

  const handleRecordSettlement = async (params: {
    employeeId: string;
    periodMonth: string;
    paymentDate: string;
    paymentMode: 'ESPECES' | 'CHEQUE' | 'VIREMENT';
    notes?: string;
  }) => {
    if (!currentProfile) throw new Error('Session requise.');
    const pay = await recordSalaryPaymentRpc(params);
    await appendAuditLog({
      action: 'REGLEMENT_SALAIRE',
      module: 'PERSONNEL',
      record_id: pay.id,
      details: `Règlement paie ${pay.doc_number} (${params.periodMonth}) : Net ${Number(
        pay.net_paid_tnd
      ).toFixed(3)} TND`,
      userName: currentProfile.display_name,
    });
    await refreshAllData(true);
    showBanner(`Salaire réglé (${pay.doc_number}).`, 'success');
    return pay;
  };

  // --------------------------------------------------------------------------
  // RENDER STATES: CONFIG CHECK / AUTH CHECK / LOGIN SCREEN
  // --------------------------------------------------------------------------
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-4 shadow-2xl">
          <div className="flex items-center gap-3 text-amber-400">
            <AlertTriangle className="w-7 h-7 shrink-0" />
            <h1 className="text-lg font-extrabold">Configuration Supabase Requise</h1>
          </div>
          <p className="text-xs text-stone-300 leading-relaxed">
            Les variables d&apos;environnement <code className="font-mono text-amber-300">VITE_SUPABASE_URL</code> et{' '}
            <code className="font-mono text-amber-300">VITE_SUPABASE_ANON_KEY</code> ne sont pas configurées.
            Aucune donnée fictive n&apos;est chargée en local.
          </p>
        </div>
      </div>
    );
  }

  if (authChecking) {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        <p className="text-xs font-semibold text-stone-300">Vérification de la session sécurisée...</p>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <AppLoginScreen
        companyName={appSettings.company_name}
        arabicSubtitle={appSettings.arabic_subtitle}
        logoUrl={appSettings.logo_url}
        onAuthenticated={(prof) => setCurrentProfile(prof)}
      />
    );
  }

  const mobileNavItems = getOrderedSidebarItems(lang, queueCount, alertTanksCount).filter((item) =>
    canAccessModule(currentProfile, item.id)
  );
  const currentModuleItem = mobileNavItems.find((i) => i.id === activeModule);

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col text-stone-900 font-sans selection:bg-amber-200">
      {/* Top Navbar */}
      <Navbar
        settings={appSettings}
        currentProfile={currentProfile}
        lang={lang}
        isOnline={isOnline}
        onToggleLanguage={() => setLang((l) => (l === 'fr' ? 'ar' : 'fr'))}
        onLogout={handleLogout}
      />

      {/* Mobile Menu Bar */}
      <div className="no-print md:hidden bg-stone-900 text-white px-4 py-2 flex items-center justify-between border-b border-stone-800">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="flex items-center gap-2 text-xs font-bold text-amber-400 py-1 cursor-pointer"
        >
          {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          <span>Menu ERP (10 Modules)</span>
        </button>
        <span className="text-[11px] text-stone-300 font-semibold truncate max-w-[180px]">
          {currentModuleItem ? `${currentModuleItem.num}. ${currentModuleItem.label}` : ''}
        </span>
      </div>

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-row relative">
        {/* Desktop Sidebar */}
        <Sidebar
          activeModule={activeModule}
          currentProfile={currentProfile}
          lang={lang}
          queueCount={queueCount}
          alertTanksCount={alertTanksCount}
          onSelectModule={(m) => {
            setActiveModule(m);
            setIsMobileMenuOpen(false);
          }}
        />

        {/* Mobile Slide-in Drawer (Exact 10 modules filtered by RBAC) */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-black/60 flex">
            <div className="w-72 bg-stone-900 h-full p-4 overflow-y-auto border-r border-stone-800 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-3">
                <span className="font-bold text-xs uppercase text-amber-400">Navigation ERP</span>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1">
                {mobileNavItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveModule(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer ${
                      activeModule === item.id
                        ? 'bg-amber-500 text-stone-950 font-bold'
                        : 'text-stone-300 hover:bg-stone-800'
                    }`}
                  >
                    <span>
                      {item.num}. {item.label}
                    </span>
                    {item.badge && (
                      <span className="text-[10px] bg-amber-400 text-stone-950 px-1.5 py-0.5 rounded-full font-bold">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
          </div>
        )}

        {/* Workspace View */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {/* Global inline notification banner */}
          {banner && (
            <div
              className={`mb-4 px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 shadow-2xs ${
                banner.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {banner.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{banner.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setBanner(null)}
                className="text-current opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Header Summary for Active Module (except CUVES which has its own Header) */}
          {activeModule !== 'CUVES' && (
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                  {activeModule === 'RECEPTIONS' && '1. ' + translations[lang].receptionTitle}
                  {activeModule === 'PRODUCTION' && '2. ' + translations[lang].productionTitle}
                  {activeModule === 'GRIGNONS' && '3. ' + translations[lang].grignonsTitle}
                  {activeModule === 'PURCHASES' &&
                    '4. ' +
                      (lang === 'ar'
                        ? 'سجل مشتريات المعصرة (زيتون وزيت)'
                        : 'Achats et Fournisseurs (BON-ACH)')}
                  {activeModule === 'FINANCES' &&
                    '6. ' +
                      (lang === 'ar'
                        ? 'الصندوق والمالية العامة للمعصرة'
                        : 'Caisse & Gestion Financière ERP')}
                  {activeModule === 'CUSTOMER_HISTORY' && '7. ' + translations[lang].customerHistoryTitle}
                  {activeModule === 'CLIENTS' && '8. Répertoires Clients & Soldes de Stock'}
                  {activeModule === 'PERSONNEL' &&
                    '9. ' +
                      (lang === 'ar'
                        ? 'إدارة الموظفين والتسبقات والأجور'
                        : 'Gestion du Personnel, Avances & Paie')}
                  {activeModule === 'SETTINGS' && '10. Paramètres, Utilisateurs & Banc d’Essai'}
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                  {activeModule === 'RECEPTIONS' &&
                    'Pesée brute/tare/net, modification auditée BON-OLV et règlements de caisse'}
                  {activeModule === 'PRODUCTION' && translations[lang].productionSubtitle}
                  {activeModule === 'GRIGNONS' && translations[lang].grignonsSubtitle}
                  {activeModule === 'PURCHASES' &&
                    'Achats directs d’olives et d’huile pour compte propre de l’huilerie'}
                  {activeModule === 'FINANCES' &&
                    'Rapprochement encaissements réels, achats, dépenses et paie du personnel'}
                  {activeModule === 'CUSTOMER_HISTORY' && translations[lang].customerHistorySubtitle}
                  {activeModule === 'CLIENTS' &&
                    'Fiches producteurs (noms similaires distingués par CLI-xxx) et soldes par cuve'}
                  {activeModule === 'PERSONNEL' &&
                    'Employés, avances sur salaires datées (BON-ADV), calcul du net et règlement mensuel (BON-PAY)'}
                  {activeModule === 'SETTINGS' &&
                    'Logo de l’entreprise, comptes RBAC, traçabilité PostgreSQL et banc d’essai (16 tests)'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => refreshAllData(false)}
                disabled={loadingData}
                className="no-print px-3 py-2 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin text-amber-600' : ''}`} />
                <span>Actualiser</span>
              </button>
            </div>
          )}

          {/* 1. RECEPTION OLIVES */}
          {activeModule === 'RECEPTIONS' && canAccessModule(currentProfile, 'RECEPTIONS') && (
            <OliveReceptionsList
              receptions={receptions}
              parties={parties}
              currentOperator={currentProfile.display_name}
              lang={lang}
              canCreate={canPerformAction(currentProfile, 'RECEPTIONS', 'create')}
              canEdit={canPerformAction(currentProfile, 'RECEPTIONS', 'edit')}
              canPay={canPerformAction(currentProfile, 'RECEPTIONS', 'pay')}
              canExport={canPerformAction(currentProfile, 'RECEPTIONS', 'export')}
              onNewReception={() => setActiveModal({ type: 'OLIVE_RECEPTION' })}
              onEditReception={handleEditOliveReception}
              onSendToQueue={handleSendToQueue}
              onPrintA4={(rec) =>
                setActiveModal({ type: 'PRINT', docType: 'OLIVE_RECEPTION', data: rec, format: 'A4' })
              }
              onPrintRP80={(rec) =>
                setActiveModal({ type: 'PRINT', docType: 'OLIVE_RECEPTION', data: rec, format: 'RP80' })
              }
              onConfirmPayment={handleConfirmReceptionPayment}
              onExportExcel={() => exportOliveReceptionsToExcel(receptions, appSettings.company_name)}
            />
          )}

          {/* 2. TRITURATION */}
          {activeModule === 'PRODUCTION' && canAccessModule(currentProfile, 'PRODUCTION') && (
            <ProductionQueue
              queueReceptions={receptions.filter((r) => r.status === 'EN_FILE')}
              productionBatches={productionBatches}
              canCreate={canPerformAction(currentProfile, 'PRODUCTION', 'create')}
              canConfirm={canPerformAction(currentProfile, 'PRODUCTION', 'confirm')}
              canExport={canPerformAction(currentProfile, 'PRODUCTION', 'export')}
              lang={lang}
              onStartMilling={(rec) => setActiveModal({ type: 'PRODUCTION_ENTRY', reception: rec })}
              onConfirmBatch={handleConfirmProductionBatch}
              onPrintBatch={(b) =>
                setActiveModal({ type: 'PRINT', docType: 'PRODUCTION_TICKET', data: b, format: 'A4' })
              }
              onExportExcel={() => exportProductionToExcel(productionBatches, appSettings.company_name)}
            />
          )}

          {/* 3. VENTE GRIGNONS */}
          {activeModule === 'GRIGNONS' && canAccessModule(currentProfile, 'GRIGNONS') && (
            <GrignonsSalesList
              sales={grignonSales}
              canCreate={canPerformAction(currentProfile, 'GRIGNONS', 'create')}
              canPay={canPerformAction(currentProfile, 'GRIGNONS', 'pay')}
              canExport={canPerformAction(currentProfile, 'GRIGNONS', 'export')}
              lang={lang}
              onNewSale={() => setActiveModal({ type: 'GRIGNON_SALE' })}
              onTogglePaymentStatus={handleToggleGrignonPayment}
              onPrintSale={(s) =>
                setActiveModal({ type: 'PRINT', docType: 'GRIGNON_SALE', data: s, format: 'A4' })
              }
              onExportExcel={() => exportGrignonsToExcel(grignonSales, appSettings.company_name)}
            />
          )}

          {/* 4. ACHATS ET FOURNISSEURS */}
          {activeModule === 'PURCHASES' && canAccessModule(currentProfile, 'PURCHASES') && (
            <PurchasesList
              purchases={purchases}
              canCreate={canPerformAction(currentProfile, 'PURCHASES', 'create')}
              canPay={canPerformAction(currentProfile, 'PURCHASES', 'pay')}
              canExport={canPerformAction(currentProfile, 'PURCHASES', 'export')}
              lang={lang}
              onNewPurchase={() => setActiveModal({ type: 'PURCHASE' })}
              onTogglePaymentStatus={handleTogglePurchasePayment}
              onPrintPurchase={(p) =>
                setActiveModal({ type: 'PRINT', docType: 'PURCHASE_RECEIPT', data: p, format: 'A4' })
              }
              onExportExcel={() => exportPurchasesToExcel(purchases, appSettings.company_name)}
            />
          )}

          {/* 5. GESTION DE STOCK */}
          {activeModule === 'CUVES' && canAccessModule(currentProfile, 'CUVES') && (
            <div className="w-full">
              <GestionDeStockOriginal
                currentProfile={currentProfile}
                appSettings={appSettings}
                onLogout={handleLogout}
                onDataMutated={() => refreshAllData(true)}
              />
            </div>
          )}

          {/* 6. CAISSE & FINANCE */}
          {activeModule === 'FINANCES' && canAccessModule(currentProfile, 'FINANCES') && (
            <FinancesManager
              receptions={receptions}
              receptionPayments={receptionPayments}
              productionBatches={productionBatches}
              grignonSales={grignonSales}
              purchases={purchases}
              expenses={expenses}
              salaryAdvances={salaryAdvances}
              salaryPayments={salaryPayments}
              canCreate={canPerformAction(currentProfile, 'FINANCES', 'create')}
              canExport={canPerformAction(currentProfile, 'FINANCES', 'export')}
              currentOperator={currentProfile.display_name}
              lang={lang}
              onAddExpense={handleAddExpense}
              onExportExcel={() => {
                const receptionsPaid =
                  receptionPayments.length > 0
                    ? receptionPayments.reduce((acc, p) => acc + Number(p.amount_tnd || 0), 0)
                    : receptions.reduce((acc, r) => acc + Number(r.paid_amount_tnd || 0), 0);
                const grignonsRev = grignonSales
                  .filter((s) => s.payment_status === 'PAYE')
                  .reduce((acc, s) => acc + Number(s.total_price_tnd || 0), 0);
                const purchasesTotal = purchases
                  .filter((p) => p.payment_status === 'PAYE')
                  .reduce((acc, p) => acc + Number(p.total_price_tnd || 0), 0);
                exportFinancesToExcel(
                  receptionsPaid,
                  grignonsRev,
                  purchasesTotal,
                  expenses,
                  appSettings.company_name,
                  salaryAdvances,
                  salaryPayments
                );
              }}
            />
          )}

          {/* 7. HISTORIQUE CLIENTS */}
          {activeModule === 'CUSTOMER_HISTORY' &&
            canAccessModule(currentProfile, 'CUSTOMER_HISTORY') && (
              <CustomerProductionLedger
                parties={parties}
                batches={productionBatches}
                tanks={tankDetails}
                canTransferToTank={canPerformAction(currentProfile, 'CUSTOMER_HISTORY', 'edit')}
                canExport={canPerformAction(currentProfile, 'CUSTOMER_HISTORY', 'export')}
                lang={lang}
                onPrintStatement={(summary) =>
                  setActiveModal({
                    type: 'PRINT',
                    docType: 'CLIENT_STATEMENT',
                    data: summary,
                    format: 'A4',
                  })
                }
                onDepositInTank={handleDepositCustomerOilInTank}
                onExportExcel={() => exportProductionToExcel(productionBatches, appSettings.company_name)}
              />
            )}

          {/* 8. REPERTOIRES CLIENTS */}
          {activeModule === 'CLIENTS' && canAccessModule(currentProfile, 'CLIENTS') && (
            <ClientsList
              clients={clientStockSummaries}
              canCreate={canPerformAction(currentProfile, 'CLIENTS', 'create')}
              canEdit={canPerformAction(currentProfile, 'CLIENTS', 'edit')}
              canExport={canPerformAction(currentProfile, 'CLIENTS', 'export')}
              lang={lang}
              onNewClient={handleAddNewClient}
              onUpdateClient={handleUpdateClient}
              onToggleActive={handleToggleClientActive}
              onPrintClientStatement={(clientSummary) => {
                setActiveModal({
                  type: 'PRINT',
                  docType: 'CLIENT_STATEMENT',
                  format: 'A4',
                  data: {
                    party_name: clientSummary.party.name,
                    party_code: clientSummary.party.code,
                    total_olives_kg: 0,
                    total_oil_litres: clientSummary.total_quantity,
                    average_yield_percent: 0,
                  },
                });
              }}
              onExportExcel={() => exportClientsToExcel(clientStockSummaries, appSettings.company_name)}
            />
          )}

          {/* 9. GESTION DU PERSONNEL */}
          {activeModule === 'PERSONNEL' && canAccessModule(currentProfile, 'PERSONNEL') && (
            <PersonnelManager
              employees={employees}
              salaryAdvances={salaryAdvances}
              salaryPayments={salaryPayments}
              canCreate={canPerformAction(currentProfile, 'PERSONNEL', 'create')}
              canEdit={canPerformAction(currentProfile, 'PERSONNEL', 'edit')}
              canPay={canPerformAction(currentProfile, 'PERSONNEL', 'pay')}
              canExport={canPerformAction(currentProfile, 'PERSONNEL', 'export')}
              lang={lang}
              onCreateEmployee={handleCreateEmployee}
              onUpdateEmployee={handleUpdateEmployee}
              onRecordAdvance={handleRecordAdvance}
              onRecordSettlement={handleRecordSettlement}
              onPrintAdvance={(adv) =>
                setActiveModal({ type: 'PRINT', docType: 'SALARY_ADVANCE', data: adv, format: 'A4' })
              }
              onPrintSettlement={(pay) =>
                setActiveModal({
                  type: 'PRINT',
                  docType: 'SALARY_SETTLEMENT',
                  data: pay,
                  format: 'A4',
                })
              }
              onExportExcel={() =>
                exportPersonnelToExcel(
                  employees,
                  salaryAdvances,
                  salaryPayments,
                  appSettings.company_name
                )
              }
            />
          )}

          {/* 10. PARAMETRES */}
          {activeModule === 'SETTINGS' && canAccessModule(currentProfile, 'SETTINGS') && (
            <SettingsView
              settings={appSettings}
              currentProfile={currentProfile}
              isOnline={isOnline}
              auditLogs={auditLogs}
              lang={lang}
              onSaveSettings={(updated) => {
                setAppSettings(updated);
                refreshAllData(true);
              }}
              onSyncSupabase={() => refreshAllData(false)}
            />
          )}
        </main>
      </div>

      {/* GLOBAL MODALS */}
      {activeModal?.type === 'OLIVE_RECEPTION' && (
        <OliveReceptionModal
          parties={parties}
          defaultMillingFeePerKg={appSettings.default_milling_fee_per_kg}
          lang={lang}
          onClose={() => setActiveModal(null)}
          onSubmit={handleSaveOliveReception}
        />
      )}

      {activeModal?.type === 'PRODUCTION_ENTRY' && (
        <ProductionEntryModal
          reception={activeModal.reception}
          currentOperator={currentProfile.display_name}
          lang={lang}
          onClose={() => setActiveModal(null)}
          onSubmit={handleSaveProductionBatch}
        />
      )}

      {activeModal?.type === 'GRIGNON_SALE' && (
        <GrignonSaleModal
          currentOperator={currentProfile.display_name}
          lang={lang}
          onClose={() => setActiveModal(null)}
          onSubmit={handleSaveGrignonSale}
        />
      )}

      {activeModal?.type === 'PURCHASE' && (
        <PurchaseModal
          tanks={tankDetails}
          currentOperator={currentProfile.display_name}
          lang={lang}
          onClose={() => setActiveModal(null)}
          onSubmit={handleSavePurchase}
        />
      )}

      {activeModal?.type === 'PRINT' && (
        <PrintDocument
          docType={activeModal.docType}
          settings={appSettings}
          data={activeModal.data}
          initialFormat={activeModal.format || 'A4'}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
