import React, { useState, useEffect } from 'react';
import { X, Edit3, History, AlertCircle, CheckCircle, RefreshCw, Scale } from 'lucide-react';
import { Party } from '../../types/stock';
import { OliveReception, ReceiptModificationHistory } from '../../types/production';
import { fetchModificationHistory } from '../../lib/supabase';

interface EditOliveReceptionModalProps {
  reception: OliveReception;
  parties: Party[];
  initialTab?: 'edit' | 'history';
  canEdit: boolean;
  onClose: () => void;
  onSaveEdit: (params: {
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
  }) => Promise<void>;
}

export const EditOliveReceptionModal: React.FC<EditOliveReceptionModalProps> = ({
  reception,
  parties,
  initialTab = 'edit',
  canEdit,
  onClose,
  onSaveEdit,
}) => {
  const activeParties = parties.filter((p) => (p.is_active !== false && !p.is_deleted) || p.id === reception.party_id);
  const [activeTab, setActiveTab] = useState<'edit' | 'history'>(canEdit ? initialTab : 'history');

  const [date, setDate] = useState<string>(String(reception.date || '').slice(0, 10));
  const [partyId, setPartyId] = useState<string>(reception.party_id);
  const [vehiclePlate, setVehiclePlate] = useState<string>(reception.vehicle_plate || '');
  const [driverName, setDriverName] = useState<string>(reception.driver_name || '');
  const [grossWeight, setGrossWeight] = useState<number>(reception.gross_weight_kg);
  const [tareWeight, setTareWeight] = useState<number>(reception.tare_weight_kg);
  const [millingFeePerKg, setMillingFeePerKg] = useState<number>(reception.milling_fee_per_kg);
  const [notes, setNotes] = useState<string>(reception.notes || '');
  const [reason, setReason] = useState<string>('');

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<ReceiptModificationHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  useEffect(() => {
    setLoadingHistory(true);
    fetchModificationHistory('BON-OLV', reception.id)
      .then((rows) => setHistory(rows))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [reception.id]);

  const netWeight = Math.max(0, Number(grossWeight) - Number(tareWeight));
  const totalFee = Math.round(netWeight * Number(millingFeePerKg) * 1000) / 1000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!canEdit) {
      setErrorMsg('Vous n’avez pas la permission de modifier ce bon.');
      return;
    }
    if (netWeight <= 0) {
      setErrorMsg('Le poids net doit être strictement supérieur à zéro.');
      return;
    }
    if (millingFeePerKg <= 0) {
      setErrorMsg('Le prix de trituration par kg doit être supérieur à zéro.');
      return;
    }
    if (totalFee < (reception.paid_amount_tnd || 0) - 0.001) {
      setErrorMsg(
        `Le nouveau total (${totalFee.toFixed(3)} TND) ne peut pas être inférieur au montant déjà encaissé (${(
          reception.paid_amount_tnd || 0
        ).toFixed(3)} TND).`
      );
      return;
    }
    if (reason.trim().length < 3) {
      setErrorMsg('Le motif de modification est obligatoire (minimum 3 caractères).');
      return;
    }

    const selectedParty = activeParties.find((p) => p.id === partyId);
    setIsSaving(true);
    try {
      await onSaveEdit({
        receptionId: reception.id,
        date,
        partyId,
        partyName: selectedParty?.name || reception.party_name,
        partyCode: selectedParty?.code || reception.party_code,
        phone: selectedParty?.phone || reception.phone,
        vehiclePlate: vehiclePlate.trim() || undefined,
        driverName: driverName.trim() || undefined,
        grossWeightKg: Number(grossWeight),
        tareWeightKg: Number(tareWeight),
        millingFeePerKg: Number(millingFeePerKg),
        notes: notes.trim() || undefined,
        reason: reason.trim(),
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la modification du bon.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] border border-stone-200">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base">
                Bon de Réception {reception.ticket_number}
              </h2>
              <span className="text-[11px] text-stone-400">
                Modification auditée &amp; historique permanent des révisions
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subtabs */}
        <div className="flex border-b border-stone-200 bg-stone-50 px-6 pt-3 gap-4">
          {canEdit && (
            <button
              type="button"
              onClick={() => setActiveTab('edit')}
              className={`pb-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 cursor-pointer ${
                activeTab === 'edit'
                  ? 'border-amber-600 text-amber-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Modifier le Bon</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 cursor-pointer ${
              activeTab === 'history'
                ? 'border-amber-600 text-amber-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historique des Modifications ({history.length})</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {activeTab === 'edit' && canEdit ? (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Date de Réception *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Producteur / Déposant *</label>
                  <select
                    value={partyId}
                    onChange={(e) => setPartyId(e.target.value)}
                    className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg font-semibold"
                  >
                    {activeParties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Matricule Véhicule</label>
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Chauffeur</label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-stone-800 uppercase text-[11px]">
                  <Scale className="w-4 h-4 text-emerald-600" />
                  <span>Pesée &amp; Tarification</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">Brut (KG)</label>
                    <input
                      type="number"
                      min="1"
                      step="0.5"
                      required
                      value={grossWeight}
                      onChange={(e) => setGrossWeight(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-stone-300 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">Tare (KG)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      required
                      value={tareWeight}
                      onChange={(e) => setTareWeight(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-stone-300 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">Net (KG)</label>
                    <div className="p-2 bg-amber-100 border border-amber-300 rounded-lg font-mono font-black text-amber-950 text-center">
                      {netWeight.toLocaleString()} KG
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">Tarif (TND/kg)</label>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      required
                      value={millingFeePerKg}
                      onChange={(e) => setMillingFeePerKg(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-emerald-300 rounded-lg font-mono font-bold"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-stone-200 text-xs">
                  <span className="text-stone-600">
                    Déjà encaissé : <strong className="font-mono">{(reception.paid_amount_tnd || 0).toFixed(3)} TND</strong>
                  </span>
                  <span className="font-bold text-emerald-800 font-mono">
                    Nouveau Total : {totalFee.toFixed(3)} TND
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Observations</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <label className="block font-bold text-amber-950 mb-1">
                  Motif de la modification (Obligatoire pour l&apos;audit) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Rectification tare camion suite deuxième pesée..."
                  className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={onClose}
                  className="px-4 py-2 border border-stone-300 rounded-xl font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-300 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span>Enregistrer la Modification</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3 text-xs">
              {loadingHistory ? (
                <div className="py-8 text-center text-stone-500">Chargement de l&apos;historique...</div>
              ) : history.length === 0 ? (
                <div className="py-8 text-center text-stone-400 italic">
                  Aucune modification enregistrée sur ce bon depuis sa création.
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-900">{item.modified_by_name}</span>
                      <span className="font-mono text-[11px] text-stone-500">
                        {new Date(item.created_at).toLocaleString('fr-TN')}
                      </span>
                    </div>
                    <div className="text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg">
                      <strong>Motif :</strong> {item.reason}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="p-2 bg-white border border-stone-200 rounded">
                        <span className="text-stone-400 font-sans font-bold uppercase block mb-1">Avant</span>
                        <div>Client: {item.before_data?.party_name}</div>
                        <div>Net: {item.before_data?.net_weight_kg} KG</div>
                        <div>Total: {Number(item.before_data?.total_milling_fee_tnd || 0).toFixed(3)} TND</div>
                      </div>
                      <div className="p-2 bg-white border border-emerald-200 rounded">
                        <span className="text-emerald-700 font-sans font-bold uppercase block mb-1">Après</span>
                        <div>Client: {item.after_data?.party_name}</div>
                        <div>Net: {item.after_data?.net_weight_kg} KG</div>
                        <div>Total: {Number(item.after_data?.total_milling_fee_tnd || 0).toFixed(3)} TND</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
