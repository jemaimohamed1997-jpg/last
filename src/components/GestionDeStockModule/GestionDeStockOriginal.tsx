/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LayoutDashboard,
  Layers,
  Users,
  History,
  FileSpreadsheet,
  HardDrive,
  CheckCircle,
} from 'lucide-react';

import { dbService } from '../../services/db';
import {
  Cuve,
  Client,
  Movement,
  AuditLog,
  AppSettings,
  UserSession,
  CuveDetails,
  ClientBalance,
  BackupSnapshot,
} from '../../types';
import { UserProfile, AppSettings as StockAppSettings } from '../../types/stock';
import { canPerformAction } from '../../lib/permissions';

import { Header } from '../Header';
import { Dashboard } from '../Dashboard';
import { CuvesManager } from '../CuvesManager';
import { ClientsManager } from '../ClientsManager';
import { HistoryAudit, ModifyStockReceptionPayload } from '../HistoryAudit';
import { ReportsManager } from '../ReportsManager';
import { BackupManager } from '../BackupManager';
import { MovementEntryModal } from '../MovementEntryModal';
import { MovementExitModal } from '../MovementExitModal';
import { MovementTransferModal } from '../MovementTransferModal';
import { ReceiptModal } from '../ReceiptModal';
import { MobileNavigation } from '../MobileNavigation';

interface GestionDeStockOriginalProps {
  currentProfile: UserProfile;
  appSettings: StockAppSettings;
  onLogout: () => void;
  onDataMutated?: () => void;
}

export function GestionDeStockOriginal({
  currentProfile,
  appSettings,
  onLogout,
  onDataMutated,
}: GestionDeStockOriginalProps) {
  const canCreateStock = canPerformAction(currentProfile, 'CUVES', 'create');
  const canEditStock = canPerformAction(currentProfile, 'CUVES', 'edit');
  const canDeleteStock = canPerformAction(currentProfile, 'CUVES', 'cancel');

  const currentUser: UserSession = useMemo(
    () => ({
      username: currentProfile.username,
      role: currentProfile.role,
      nomAffiche: currentProfile.display_name,
      email: currentProfile.email || undefined,
      telephone: currentProfile.phone || undefined,
      dernierAcces: new Date().toISOString(),
      acces: {
        peutEntrerHuile: canCreateStock,
        peutSortirHuile: canCreateStock,
        peutTransferer: canCreateStock,
        peutAnnuler: canDeleteStock,
        peutGererCuves: canEditStock || canCreateStock,
        peutGererClients: canPerformAction(currentProfile, 'CLIENTS', 'edit'),
        peutVoirRapports: canPerformAction(currentProfile, 'CUVES', 'export'),
        peutGererParametres: canPerformAction(currentProfile, 'SETTINGS', 'edit'),
      },
    }),
    [currentProfile, canCreateStock, canEditStock, canDeleteStock]
  );

  const settings: AppSettings = useMemo(
    () => ({
      nomEntreprise: appSettings.company_name || 'HUILERIE JEMAI',
      sousTitreArabe: appSettings.arabic_subtitle || 'معصرة جماعي لإنتاج وتخزين زيت الزيتون',
      precisionDecimales: Number(appSettings.settings_json?.precisionDecimales ?? 1),
      unite: appSettings.unit || 'L',
      contactTelephone: appSettings.phone || '+216 98 000 000',
      adresse: appSettings.address || 'Route Principale des Oliviers - Tunisie',
      alertSeuilRemplissage: Number(appSettings.threshold || 85),
      logoUrl: appSettings.logo_url || undefined,
    }),
    [appSettings]
  );

  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const [cuves, setCuves] = useState<Cuve[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [mouvements, setMouvements] = useState<Movement[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);
  const [cuvesDetails, setCuvesDetails] = useState<CuveDetails[]>([]);
  const [clientBalances, setClientBalances] = useState<ClientBalance[]>([]);

  // États des Modales
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [receiptMovement, setReceiptMovement] = useState<Movement | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isDuplicateReceipt, setIsDuplicateReceipt] = useState(false);

  const [preSelectedCuveId, setPreSelectedCuveId] = useState<string | undefined>(undefined);
  const [preSelectedClientId, setPreSelectedClientId] = useState<string | undefined>(undefined);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshToast, setRefreshToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'info' = 'success') => {
    setRefreshToast({ message, type });
    setTimeout(() => {
      setRefreshToast(null);
    }, 4000);
  }, []);

  const refreshState = useCallback(() => {
    const rawCuves = dbService.getCuves();
    const rawClients = dbService.getClients();
    const rawMouvements = dbService.getMouvements();
    const rawAudit = dbService.getAuditLogs();
    const rawBackups = dbService.getBackups();

    setCuves(rawCuves);
    setClients(rawClients);
    setMouvements(rawMouvements);
    setAuditLogs(rawAudit);
    setBackups(rawBackups);

    const calculatedCuvesDetails: CuveDetails[] = rawCuves
      .map((c) => dbService.getCuveDetails(c.id))
      .filter((d): d is CuveDetails => d !== null);
    setCuvesDetails(calculatedCuvesDetails);

    const calculatedClientBalances: ClientBalance[] = rawClients
      .map((cl) => dbService.getClientBalance(cl.id))
      .filter((cb): cb is ClientBalance => cb !== null);
    setClientBalances(calculatedClientBalances);
  }, []);

  useEffect(() => {
    refreshState();
    const unsubscribe = dbService.subscribe(refreshState);
    dbService.pullFromSupabase().then(() => refreshState()).catch(() => {});
    return () => unsubscribe();
  }, [refreshState]);

  const openEntree = (cuveId?: string, clientId?: string) => {
    if (!canCreateStock) return;
    setPreSelectedCuveId(cuveId);
    setPreSelectedClientId(clientId);
    setIsEntryModalOpen(true);
  };

  const openSortie = (clientId?: string) => {
    if (!canCreateStock) return;
    setPreSelectedClientId(clientId);
    setIsExitModalOpen(true);
  };

  const openTransfert = (cuveId?: string) => {
    if (!canCreateStock) return;
    setPreSelectedCuveId(cuveId);
    setIsTransferModalOpen(true);
  };

  const openReceipt = (movement: Movement, duplicate: boolean = false) => {
    setReceiptMovement(movement);
    setIsDuplicateReceipt(duplicate);
    setIsReceiptOpen(true);
  };

  const handleSmartRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await dbService.smartRefresh();
      refreshState();
      onDataMutated?.();
      showToast(res.message, res.updated ? 'success' : 'info');
    } catch (err: any) {
      showToast(`Erreur d'actualisation : ${err.message || 'Serveur injoignable'}`, 'info');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleQuickBackup = () => {
    const snap = dbService.createAutomaticSnapshot('Snapshot mémoire manuel (Gestion de Stock)');
    refreshState();
    showToast(`Snapshot créé : ${snap.nomFichier} (${snap.tailleKo} Ko)`, 'success');
  };

  const handleAddCuve = (numero: string, nom: string, capaciteMax: number, notes?: string) => {
    if (!canCreateStock) return;
    dbService.ajouterCuve(numero, nom, capaciteMax, notes);
    refreshState();
    onDataMutated?.();
  };

  const handleEditCuve = (cuveId: string, nom: string, capaciteMax: number, notes?: string) => {
    if (!canEditStock) return;
    dbService.modifierCuve(cuveId, nom, capaciteMax, notes);
    refreshState();
    onDataMutated?.();
  };

  const handleToggleCuve = (cuveId: string) => {
    if (!canEditStock) return;
    dbService.basculerStatutCuve(cuveId);
    refreshState();
    onDataMutated?.();
  };

  const handleDeleteCuve = (cuveId: string) => {
    if (!canDeleteStock) return;
    dbService.supprimerCuve(cuveId);
    refreshState();
    onDataMutated?.();
  };

  const handleAddClient = async (nomComplet: string, telephone?: string, notes?: string): Promise<Client> => {
    const nouveauClient = await dbService.ajouterClient(nomComplet, telephone, notes);
    refreshState();
    onDataMutated?.();
    return nouveauClient;
  };

  const handleUpdateClient = async (
    clientId: string,
    nomComplet: string,
    telephone?: string,
    notes?: string
  ): Promise<Client> => {
    const updated = await dbService.modifierClient(clientId, nomComplet, telephone, notes);
    refreshState();
    onDataMutated?.();
    return updated;
  };

  const handleDeleteClient = async (clientId: string) => {
    await dbService.supprimerClient(clientId);
    refreshState();
    onDataMutated?.();
  };

  const handleToggleClientActive = async (clientId: string) => {
    await dbService.basculerStatutClient(clientId);
    refreshState();
    onDataMutated?.();
  };

  const handleAnnulerMouvement = async (mouvementId: string, motif: string, utilisateur: string) => {
    await dbService.annulerMouvement(mouvementId, motif, utilisateur);
    refreshState();
    onDataMutated?.();
  };

  const handleModifierEntree = async (payload: ModifyStockReceptionPayload) => {
    await dbService.modifierEntreeStock(payload);
    refreshState();
    onDataMutated?.();
    showToast('Bon BON-REC modifié avec succès (audit enregistré).', 'success');
  };

  const handleRestoreSnapshot = (snapshotId: string) => {
    dbService.restaurerDepuisSnapshot(snapshotId);
    refreshState();
  };

  const handleRestoreJSON = (jsonString: string) => {
    dbService.restaurerDepuisJSON(jsonString);
    refreshState();
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-100/90 text-stone-900 rounded-2xl overflow-hidden border border-stone-200">
      {/* Header Stock avec Logo Entreprise et Bouton Actualiser */}
      <Header
        currentUser={currentUser}
        onLogout={onLogout}
        onOpenEntree={() => openEntree()}
        onOpenSortie={() => openSortie()}
        onOpenTransfert={() => openTransfert()}
        onQuickBackup={handleQuickBackup}
        onRefresh={handleSmartRefresh}
        isRefreshing={isRefreshing}
        settings={settings}
        canCreateStock={canCreateStock}
      />

      {/* Barre de Navigation Secondaire Stock */}
      <nav className="no-print bg-white border-b border-stone-200 z-20 shadow-xs hidden md:block rounded-xl mb-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between overflow-x-auto py-1 scrollbar-none">
            <div className="flex items-center space-x-1 sm:space-x-2 py-1">
              {[
                { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
                { id: 'cuves', label: 'Piles & Cuves', icon: Layers, badge: cuves.length },
                { id: 'clients', label: 'Clients & Déposants', icon: Users, badge: clients.length },
                { id: 'historique', label: 'Historique & Audit', icon: History, badge: mouvements.length },
                { id: 'rapports', label: 'Rapports & Excel', icon: FileSpreadsheet },
                { id: 'sauvegardes', label: 'Sauvegardes', icon: HardDrive },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-emerald-800 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-stone-500'}`} />
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                          isActive ? 'bg-emerald-950 text-emerald-200' : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Contenu Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2 sm:px-4 pb-24 md:pb-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            cuvesDetails={cuvesDetails}
            mouvements={mouvements}
            clients={clients}
            clientBalances={clientBalances}
            onOpenEntreeForCuve={(cid) => openEntree(cid)}
            onOpenSortieForClient={(clid) => openSortie(clid)}
            onOpenEntree={() => openEntree()}
            onOpenSortie={() => openSortie()}
            onOpenTransfert={() => openTransfert()}
            onPrintBon={(m) => openReceipt(m, true)}
            onSelectTab={setActiveTab}
            settings={settings}
          />
        )}

        {activeTab === 'cuves' && (
          <CuvesManager
            cuvesDetails={cuvesDetails}
            mouvements={mouvements}
            clients={clients}
            onAddCuve={handleAddCuve}
            onEditCuve={handleEditCuve}
            onToggleActive={handleToggleCuve}
            onDeleteCuve={handleDeleteCuve}
            onOpenTransfertForCuve={(cid) => openTransfert(cid)}
            onOpenEntreeForCuve={(cid) => openEntree(cid)}
            settings={settings}
          />
        )}

        {activeTab === 'clients' && (
          <ClientsManager
            clients={clients}
            clientBalances={clientBalances}
            cuves={cuves}
            mouvements={mouvements}
            onAddClient={handleAddClient}
            onUpdateClient={handleUpdateClient}
            onDeleteClient={handleDeleteClient}
            onToggleClientActive={handleToggleClientActive}
            onOpenEntreeForClient={(clid) => openEntree(undefined, clid)}
            onOpenSortieForClient={(clid) => openSortie(clid)}
            onPrintBon={(m) => openReceipt(m, true)}
            settings={settings}
          />
        )}

        {activeTab === 'historique' && (
          <HistoryAudit
            mouvements={mouvements}
            clients={clients}
            cuves={cuves}
            auditLogs={auditLogs}
            currentUser={currentUser}
            canEditEntree={canEditStock}
            canDeleteMouvement={canDeleteStock}
            onAnnulerMouvement={handleAnnulerMouvement}
            onModifierEntree={handleModifierEntree}
            onPrintBon={(m) => openReceipt(m, true)}
            settings={settings}
          />
        )}

        {activeTab === 'rapports' && (
          <ReportsManager
            cuvesDetails={cuvesDetails}
            cuves={cuves}
            clients={clients}
            mouvements={mouvements}
            onPrintBon={(m) => openReceipt(m, true)}
            settings={settings}
          />
        )}

        {activeTab === 'sauvegardes' && (
          <BackupManager
            backups={backups}
            onCreateBackup={(desc) => {
              const b = dbService.createAutomaticSnapshot(desc);
              refreshState();
              return b;
            }}
            onRestoreSnapshot={handleRestoreSnapshot}
            onRestoreJSON={handleRestoreJSON}
            onExportSQLiteScript={() => dbService.genererExportSQLiteSQL()}
            onResetData={() => {
              refreshState();
            }}
            settings={settings}
          />
        )}
      </main>

      {/* Modales Opérations Cuves */}
      <MovementEntryModal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        cuvesDetails={cuvesDetails}
        clients={clients}
        initialCuveId={preSelectedCuveId}
        initialClientId={preSelectedClientId}
        currentUser={currentUser}
        onSubmit={async (params) => {
          const mouv = await dbService.enregistrerEntree(params);
          refreshState();
          onDataMutated?.();
          return mouv;
        }}
        onOpenReceipt={(m) => openReceipt(m, false)}
        settings={settings}
      />

      <MovementExitModal
        isOpen={isExitModalOpen}
        onClose={() => setIsExitModalOpen(false)}
        cuvesDetails={cuvesDetails}
        clients={clients}
        clientBalances={clientBalances}
        initialClientId={preSelectedClientId}
        currentUser={currentUser}
        onSubmit={async (params) => {
          const mouv = await dbService.enregistrerSortie(params);
          refreshState();
          onDataMutated?.();
          return mouv;
        }}
        onOpenReceipt={(m) => openReceipt(m, false)}
        settings={settings}
      />

      <MovementTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        cuvesDetails={cuvesDetails}
        clients={clients}
        clientBalances={clientBalances}
        initialCuveSourceId={preSelectedCuveId}
        currentUser={currentUser}
        onSubmit={async (params) => {
          const res = await dbService.enregistrerTransfert(params);
          refreshState();
          onDataMutated?.();
          return res;
        }}
        onOpenReceipt={(m) => openReceipt(m, false)}
        settings={settings}
      />

      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        movement={receiptMovement}
        clients={clients}
        cuves={cuves}
        settings={settings}
        isDuplicate={isDuplicateReceipt}
      />

      {/* Barre de Navigation Mobile Stock */}
      <MobileNavigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentUser={currentUser}
        onLogout={onLogout}
        onOpenEntree={() => openEntree()}
        onOpenSortie={() => openSortie()}
        onOpenTransfert={() => openTransfert()}
        onOpenSettings={() => setActiveTab('sauvegardes')}
        onQuickBackup={handleQuickBackup}
        settings={settings}
        cuvesCount={cuves.length}
        clientsCount={clients.length}
        mouvementsCount={mouvements.length}
      />

      {/* Toast Synchronisation */}
      {refreshToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl border text-xs font-bold flex items-center gap-2.5 transition-all duration-300 ${
            refreshToast.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-600/80'
              : 'bg-stone-900 text-stone-100 border-stone-700'
          }`}
        >
          <CheckCircle
            className={`w-4 h-4 shrink-0 ${
              refreshToast.type === 'success' ? 'text-emerald-400' : 'text-sky-400'
            }`}
          />
          <span>{refreshToast.message}</span>
        </div>
      )}
    </div>
  );
}
