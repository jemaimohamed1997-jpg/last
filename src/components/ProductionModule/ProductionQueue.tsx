import React, { useState } from 'react';
import {
  Cog,
  Play,
  CheckCircle,
  Clock,
  Lock,
  Printer,
  FileSpreadsheet,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { OliveReception, ProductionBatch } from '../../types/production';
import { translations, Language } from '../../lib/i18n';

interface ProductionQueueProps {
  queueReceptions: OliveReception[];
  productionBatches: ProductionBatch[];
  canCreate: boolean;
  canConfirm: boolean;
  canExport: boolean;
  lang: Language;
  onStartMilling: (reception: OliveReception) => void;
  onConfirmBatch: (batchId: string) => Promise<void>;
  onPrintBatch: (batch: ProductionBatch) => void;
  onExportExcel: () => void;
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

export const ProductionQueue: React.FC<ProductionQueueProps> = ({
  queueReceptions,
  productionBatches,
  canCreate,
  canConfirm,
  canExport,
  lang,
  onStartMilling,
  onConfirmBatch,
  onPrintBatch,
  onExportExcel,
}) => {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<'QUEUE' | 'COMPLETED'>('QUEUE');
  const [confirmPromptBatchId, setConfirmPromptBatchId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const totalOlivesInQueue = queueReceptions.reduce((sum, r) => sum + Number(r.net_weight_kg || 0), 0);
  const pendingBatches = productionBatches.filter((b) => !b.is_confirmed);
  const confirmedBatches = productionBatches.filter((b) => b.is_confirmed);
  const totalConfirmedOil = confirmedBatches.reduce((sum, b) => sum + Number(b.oil_quantity_litres || 0), 0);

  const handleConfirmClick = async (batchId: string) => {
    setConfirmError(null);
    setConfirmingId(batchId);
    try {
      await onConfirmBatch(batchId);
      setConfirmPromptBatchId(null);
    } catch (err: any) {
      setConfirmError(err?.message || 'Erreur lors de la confirmation du lot.');
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 font-medium block">{t.queueWaiting}</span>
            <span className="font-mono text-2xl font-black text-amber-900">
              {queueReceptions.length} lots ({totalOlivesInQueue.toLocaleString()} KG)
            </span>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-700 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 font-medium block">Huile Extraite Confirmée</span>
            <span className="font-mono text-2xl font-black text-emerald-800">
              {totalConfirmedOil.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} L
            </span>
            <span className="text-[11px] text-stone-400 block">
              {pendingBatches.length} lot(s) en attente de confirmation
            </span>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg">
            <Cog className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 font-medium block">Lots Confirmés &amp; Verrouillés</span>
            <span className="font-mono text-2xl font-black text-stone-900">
              {confirmedBatches.length} fiches
            </span>
          </div>
          <div className="p-2.5 bg-stone-100 text-stone-700 rounded-lg">
            <Lock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs & Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('QUEUE')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'QUEUE'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>File d&apos;Attente ({queueReceptions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('COMPLETED')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'COMPLETED'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>
              Historique des Triturations ({productionBatches.length}
              {pendingBatches.length > 0 ? ` · ${pendingBatches.length} en attente` : ''})
            </span>
          </button>
        </div>

        {canExport && (
          <button
            type="button"
            onClick={onExportExcel}
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Exporter Production Excel</span>
          </button>
        )}
      </div>

      {confirmError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{confirmError}</span>
        </div>
      )}

      {/* Content for TAB 1: Queue awaiting milling */}
      {activeTab === 'QUEUE' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">
                Lots d&apos;olives pesés en attente de trituration
              </h3>
              <p className="text-xs text-stone-500">
                Saisissez le poids d&apos;huile extraite en KG (conversion automatique 1 KG = 1,1 L)
              </p>
            </div>
            <span className="font-mono text-xs font-bold px-2.5 py-1 bg-amber-100 text-amber-900 rounded">
              {queueReceptions.length} lot(s) prêt(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">N° Ticket Réception</th>
                  <th className="p-3.5">Producteur / Client</th>
                  <th className="p-3.5">Date Réception</th>
                  <th className="p-3.5 text-right">Poids Net d&apos;Olives</th>
                  <th className="p-3.5 text-right">Action Opérateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {queueReceptions.length > 0 ? (
                  queueReceptions.map((rec) => (
                    <tr key={rec.id} className="hover:bg-amber-50/50 transition-colors">
                      <td className="p-3.5">
                        <span className="font-mono font-bold text-stone-900 block">
                          {rec.ticket_number}
                        </span>
                        {rec.vehicle_plate && (
                          <span className="text-[10px] text-stone-400 font-mono">
                            {rec.vehicle_plate}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className="font-bold text-stone-900 block">
                          {rec.party_name}
                        </span>
                        <span className="text-[11px] text-stone-500 font-mono">
                          {rec.party_code || 'CLI'}
                        </span>
                      </td>

                      <td className="p-3.5 text-stone-600 font-mono text-[11px]">
                        {formatDateSafe(rec.date)}
                      </td>

                      <td className="p-3.5 text-right">
                        <span className="font-mono font-black text-amber-950 text-base">
                          {Number(rec.net_weight_kg).toLocaleString()} KG
                        </span>
                      </td>

                      <td className="p-3.5 text-right">
                        {canCreate ? (
                          <button
                            type="button"
                            onClick={() => onStartMilling(rec)}
                            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs inline-flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Saisir Huile (KG)</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-stone-400 italic">Lecture seule</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-stone-400 italic">
                      La file d&apos;attente de trituration est vide. Enregistrez de nouvelles réceptions d&apos;olives pour alimenter la presse.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Content for TAB 2: Production Batches (EN_ATTENTE + CONFIRME) */}
      {activeTab === 'COMPLETED' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">Bon Trituration</th>
                  <th className="p-3.5">Producteur</th>
                  <th className="p-3.5 text-right">Olives Net</th>
                  <th className="p-3.5 text-right">Huile (KG)</th>
                  <th className="p-3.5 text-right">Volume (1 KG = 1,1 L)</th>
                  <th className="p-3.5 text-right">Rendement (%)</th>
                  <th className="p-3.5 text-right">Rendement (L/100kg)</th>
                  <th className="p-3.5">Statut / Verrou</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {productionBatches.length > 0 ? (
                  productionBatches.map((b) => {
                    const isAwaitingPrompt = confirmPromptBatchId === b.id;
                    const isCurrentlyConfirming = confirmingId === b.id;

                    return (
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

                        <td className="p-3.5 text-right font-mono text-stone-800">
                          {Number(b.olives_net_kg).toLocaleString()} KG
                        </td>

                        <td className="p-3.5 text-right font-mono font-bold text-stone-900">
                          {Number(b.oil_quantity_kg).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} KG
                        </td>

                        <td className="p-3.5 text-right font-mono font-black text-amber-950 text-sm">
                          {Number(b.oil_quantity_litres).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} L
                        </td>

                        <td className="p-3.5 text-right font-mono font-black text-emerald-700 text-sm">
                          {Number(b.yield_percentage).toFixed(2)} %
                        </td>

                        <td className="p-3.5 text-right font-mono font-bold text-stone-800">
                          {Number(b.yield_litres_per_100kg).toFixed(2)} L
                        </td>

                        <td className="p-3.5">
                          {b.is_confirmed ? (
                            <div>
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <Lock className="w-3 h-3 text-emerald-700" />
                                Verrouillé
                              </span>
                              {b.confirmed_by && (
                                <span className="block text-[10px] text-stone-400 mt-0.5">
                                  Par {b.confirmed_by}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                              <Clock className="w-3 h-3" />
                              EN ATTENTE
                            </span>
                          )}
                        </td>

                        <td className="p-3.5 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {!b.is_confirmed && canConfirm && !isAwaitingPrompt && (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmError(null);
                                  setConfirmPromptBatchId(b.id);
                                }}
                                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                title="Confirmer et verrouiller définitivement ce lot"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Confirmer</span>
                              </button>
                            )}

                            {!b.is_confirmed && canConfirm && isAwaitingPrompt && (
                              <div className="inline-flex items-center gap-1 bg-amber-50 border border-amber-300 rounded px-2 py-1">
                                <button
                                  type="button"
                                  disabled={isCurrentlyConfirming}
                                  onClick={() => handleConfirmClick(b.id)}
                                  className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  {isCurrentlyConfirming ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-3 h-3" />
                                  )}
                                  <span>Valider</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isCurrentlyConfirming}
                                  onClick={() => setConfirmPromptBatchId(null)}
                                  className="px-1.5 py-0.5 text-stone-600 hover:text-stone-900 text-[10px] font-semibold cursor-pointer"
                                >
                                  Annuler
                                </button>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => onPrintBatch(b)}
                              className="p-1.5 hover:bg-stone-100 text-stone-600 hover:text-stone-900 border border-stone-200 rounded cursor-pointer"
                              title="Imprimer le bon de trituration"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-stone-400 italic">
                      Aucune trituration enregistrée pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
