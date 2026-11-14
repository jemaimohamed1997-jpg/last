import React, { useEffect, useState } from 'react';
import {
  Printer,
  Database,
  AlertCircle,
  X,
  RefreshCw,
  Clock,
  FileSpreadsheet,
} from 'lucide-react';
import { Party, TankStockDetail } from '../../types/stock';
import { ProductionBatch } from '../../types/production';
import { Language } from '../../lib/i18n';

interface CustomerProductionLedgerProps {
  parties: Party[];
  batches: ProductionBatch[];
  tanks: TankStockDetail[];
  canTransferToTank?: boolean;
  canExport?: boolean;
  lang: Language;
  onPrintStatement: (clientSummary: any) => void;
  onDepositInTank: (batch: ProductionBatch, targetTankId: string) => Promise<void>;
  onExportExcel?: () => void;
}

function formatDateSafe(val?: string | null): string {
  if (!val) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-');
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(val);
  return Number.isNaN(dt.getTime()) ? val : dt.toLocaleDateString('fr-TN');
}

export const CustomerProductionLedger: React.FC<CustomerProductionLedgerProps> = ({
  parties,
  batches,
  tanks,
  canTransferToTank = false,
  canExport = false,
  lang,
  onPrintStatement,
  onDepositInTank,
  onExportExcel,
}) => {
  const [selectedPartyId, setSelectedPartyId] = useState<string>('ALL');
  const [depositModalBatch, setDepositModalBatch] = useState<ProductionBatch | null>(null);
  const [chosenTankId, setChosenTankId] = useState<string>('');
  const [isDepositing, setIsDepositing] = useState<boolean>(false);
  const [depositError, setDepositError] = useState<string | null>(null);

  const activeTanks = tanks.filter((item) => item.tank.is_active && !item.tank.is_deleted);

  // Sync chosenTankId whenever the deposit modal opens or available tanks change
  useEffect(() => {
    if (!depositModalBatch) {
      setDepositError(null);
      return;
    }
    const eligible = activeTanks.filter(
      (item) => item.remaining_capacity >= Number(depositModalBatch.oil_quantity_litres)
    );
    const preferred = eligible[0]?.tank.id || activeTanks[0]?.tank.id || '';
    setChosenTankId(preferred);
    setDepositError(null);
  }, [depositModalBatch, tanks]);

  // Filter batches by selected party
  const filteredBatches =
    selectedPartyId === 'ALL'
      ? batches
      : batches.filter((b) => b.party_id === selectedPartyId);

  // Group by client
  const clientsSummaries = parties
    .map((p) => {
      const clientBatches = batches.filter((b) => b.party_id === p.id);
      const totalOlives = clientBatches.reduce((sum, b) => sum + Number(b.olives_net_kg || 0), 0);
      const totalOilLitres = clientBatches.reduce((sum, b) => sum + Number(b.oil_quantity_litres || 0), 0);
      const totalOilKg = clientBatches.reduce((sum, b) => sum + Number(b.oil_quantity_kg || 0), 0);
      const avgYield = totalOlives > 0 ? (totalOilKg / totalOlives) * 100 : 0;

      return {
        party: p,
        batches: clientBatches,
        totalOlives,
        totalOilLitres,
        totalOilKg,
        avgYield,
      };
    })
    .filter((cs) => cs.batches.length > 0 || selectedPartyId === cs.party.id);

  // Overall totals for filtered view
  const overallOlives = filteredBatches.reduce((sum, b) => sum + Number(b.olives_net_kg || 0), 0);
  const overallOilLitres = filteredBatches.reduce((sum, b) => sum + Number(b.oil_quantity_litres || 0), 0);
  const overallOilKg = filteredBatches.reduce((sum, b) => sum + Number(b.oil_quantity_kg || 0), 0);
  const overallAvgYield = overallOlives > 0 ? (overallOilKg / overallOlives) * 100 : 0;
  const inTanksLitres = filteredBatches
    .filter((b) => b.oil_destination === 'STOCKAGE_CUVE')
    .reduce((sum, b) => sum + Number(b.oil_quantity_litres || 0), 0);

  const handleConfirmDeposit = async () => {
    if (!depositModalBatch) return;
    if (!chosenTankId) {
      setDepositError('Veuillez sélectionner une cuve cible.');
      return;
    }
    const targetTank = activeTanks.find((item) => item.tank.id === chosenTankId);
    if (!targetTank) {
      setDepositError('Cuve sélectionnée introuvable ou inactive.');
      return;
    }
    if (targetTank.remaining_capacity + 0.001 < Number(depositModalBatch.oil_quantity_litres)) {
      setDepositError(
        `Capacité insuffisante dans ${targetTank.tank.code} (${targetTank.remaining_capacity.toFixed(2)} L libres pour ${depositModalBatch.oil_quantity_litres} L requis).`
      );
      return;
    }

    setDepositError(null);
    setIsDepositing(true);
    try {
      await onDepositInTank(depositModalBatch, chosenTankId);
      setDepositModalBatch(null);
    } catch (err: any) {
      setDepositError(err?.message || 'Erreur lors du transfert en cuve.');
    } finally {
      setIsDepositing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Client Selector & Overview Filter */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-stone-900 text-sm">
              {lang === 'ar'
                ? 'سجل الحرفاء والإنتاج'
                : 'Sélectionner un Producteur pour voir son Relevé'}
            </h3>
            <p className="text-xs text-stone-500">
              Historique complet des récoltes triturées, rendements (1 KG = 1,1 L) et dépôts en cuves
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
              className="p-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold text-stone-900 min-w-[220px]"
            >
              <option value="ALL">Tous les Producteurs ({batches.length} lots)</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>

            {canExport && onExportExcel && (
              <button
                type="button"
                onClick={onExportExcel}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Excel</span>
              </button>
            )}

            {selectedPartyId !== 'ALL' && (
              <button
                type="button"
                onClick={() => {
                  const curr = clientsSummaries.find((cs) => cs.party.id === selectedPartyId);
                  if (curr) {
                    onPrintStatement({
                      party_name: curr.party.name,
                      party_code: curr.party.code,
                      total_olives_kg: curr.totalOlives,
                      total_oil_litres: curr.totalOilLitres,
                      average_yield_percent: curr.avgYield,
                    });
                  }
                }}
                className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer Relevé</span>
              </button>
            )}
          </div>
        </div>

        {/* Aggregate Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center pt-2">
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
            <span className="text-[11px] text-stone-500 block">Total Olives Triturées</span>
            <span className="font-mono text-base font-black text-stone-900">
              {overallOlives.toLocaleString()} KG
            </span>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <span className="text-[11px] text-amber-800 font-semibold block">
              Huile Totale Extraite
            </span>
            <span className="font-mono text-base font-black text-amber-950">
              {overallOilLitres.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} L
            </span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <span className="text-[11px] text-emerald-800 font-semibold block">Rendement Moyen</span>
            <span className="font-mono text-base font-black text-emerald-900">
              {overallAvgYield.toFixed(2)} %
            </span>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <span className="text-[11px] text-blue-800 font-semibold block">
              Volume Transféré en Cuve
            </span>
            <span className="font-mono text-base font-black text-blue-950">
              {inTanksLitres.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} L
            </span>
          </div>
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider">
            Détail des Lots de Trituration ({filteredBatches.length})
          </h4>
          <span className="text-xs text-stone-500">
            Seuls les lots confirmés peuvent être transférés explicitement en cuve de stockage
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">N° Bon &amp; Date</th>
                <th className="p-3.5">Producteur</th>
                <th className="p-3.5 text-right">Olives Net</th>
                <th className="p-3.5 text-right">Huile Obtenue</th>
                <th className="p-3.5 text-right">Rendement</th>
                <th className="p-3.5">Confirmation</th>
                <th className="p-3.5">Destination</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredBatches.length > 0 ? (
                filteredBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-stone-50 transition-colors">
                    <td className="p-3.5">
                      <span className="font-mono font-bold text-stone-900 block">
                        {b.ticket_number}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {formatDateSafe(b.started_at)}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <span className="font-bold text-stone-900 block">{b.party_name}</span>
                      <span className="text-[10px] text-stone-500">
                        Réf: {b.reception_ticket}
                      </span>
                    </td>

                    <td className="p-3.5 text-right font-mono font-bold text-stone-800">
                      {Number(b.olives_net_kg).toLocaleString()} KG
                    </td>

                    <td className="p-3.5 text-right">
                      <span className="font-mono font-black text-amber-950 text-sm block">
                        {Number(b.oil_quantity_litres).toLocaleString('fr-FR', {
                          maximumFractionDigits: 2,
                        })}{' '}
                        L
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        ({Number(b.oil_quantity_kg).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} KG)
                      </span>
                    </td>

                    <td className="p-3.5 text-right">
                      <span className="font-mono font-black text-emerald-700 text-sm block">
                        {Number(b.yield_percentage).toFixed(2)} %
                      </span>
                      <span className="text-[10px] text-stone-500 font-mono">
                        {Number(b.yield_litres_per_100kg).toFixed(2)} L/100kg
                      </span>
                    </td>

                    <td className="p-3.5">
                      {b.is_confirmed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Confirmé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                          <Clock className="w-3 h-3" />
                          En attente
                        </span>
                      )}
                    </td>

                    <td className="p-3.5">
                      {b.oil_destination === 'STOCKAGE_CUVE' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          <Database className="w-3 h-3 text-blue-600" />
                          En Cuve Stockage
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-700 bg-stone-100 px-2 py-0.5 rounded">
                          Historique Client
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-right">
                      {b.is_confirmed &&
                        b.oil_destination !== 'STOCKAGE_CUVE' &&
                        canTransferToTank && (
                          <button
                            type="button"
                            onClick={() => setDepositModalBatch(b)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded font-semibold text-[11px] inline-flex items-center gap-1 ml-auto cursor-pointer"
                            title="Transférer cette huile vers une cuve de stockage de la huilerie"
                          >
                            <Database className="w-3 h-3" />
                            <span>Mettre en Cuve</span>
                          </button>
                        )}
                      {!b.is_confirmed && (
                        <span className="text-[10px] text-stone-400 italic">
                          Confirmation requise
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-stone-400 italic">
                    Aucun historique de trituration pour ce producteur.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for transferring confirmed customer oil into storage tanks explicitly */}
      {depositModalBatch && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="font-bold text-stone-900 text-sm">
                Transférer l&apos;huile en Cuve de Stockage
              </h3>
              <button
                type="button"
                disabled={isDepositing}
                onClick={() => setDepositModalBatch(null)}
                className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {depositError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{depositError}</span>
              </div>
            )}

            <p className="text-xs text-stone-600">
              Le producteur <strong>{depositModalBatch.party_name}</strong> souhaite déposer{' '}
              <strong>{depositModalBatch.oil_quantity_litres} Litres</strong> ({depositModalBatch.oil_quantity_kg} KG)
              d&apos;huile extraite ({depositModalBatch.ticket_number}) dans les cuves de l&apos;huilerie.
            </p>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Choisir la Cuve de Stockage Réceptrice :
              </label>
              <select
                value={chosenTankId}
                onChange={(e) => setChosenTankId(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium"
              >
                {activeTanks.length === 0 ? (
                  <option value="">Aucune cuve active disponible</option>
                ) : (
                  activeTanks.map((item) => {
                    const hasCapacity =
                      item.remaining_capacity + 0.001 >= Number(depositModalBatch.oil_quantity_litres);
                    return (
                      <option
                        key={item.tank.id}
                        value={item.tank.id}
                        disabled={!hasCapacity}
                      >
                        {item.tank.code} - {item.tank.name} (Libre: {item.remaining_capacity.toFixed(1)} L
                        {!hasCapacity ? ' · Capacité insuffisante' : ''})
                      </option>
                    );
                  })
                )}
              </select>
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
              Cela exécutera la transaction sécurisée et générera officiellement un{' '}
              <strong>Bon de Réception Stock (BON-REC)</strong> pour ce client.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDepositing}
                onClick={() => setDepositModalBatch(null)}
                className="px-3 py-1.5 border border-stone-300 rounded text-xs font-semibold text-stone-700 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDepositing || !chosenTankId}
                onClick={handleConfirmDeposit}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-400 text-white rounded text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isDepositing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDepositing ? 'Transfert...' : "Confirmer l'Entrée en Cuve"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
