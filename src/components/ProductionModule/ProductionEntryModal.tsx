import React, { useState } from 'react';
import { X, CheckCircle, Cog, Lock, AlertCircle, Info, RefreshCw } from 'lucide-react';
import { OliveReception, ProductionBatch } from '../../types/production';
import { OIL_KG_TO_LITRES_FACTOR } from '../../lib/supabase';
import { translations, Language } from '../../lib/i18n';

export type ProductionBatchCreateInput = Omit<
  ProductionBatch,
  'id' | 'ticket_number' | 'created_at' | 'updated_at'
>;

interface ProductionEntryModalProps {
  reception: OliveReception;
  currentOperator: string;
  lang: Language;
  onClose: () => void;
  onSubmit: (batchInput: ProductionBatchCreateInput) => Promise<void>;
}

export const ProductionEntryModal: React.FC<ProductionEntryModalProps> = ({
  reception,
  currentOperator,
  lang,
  onClose,
  onSubmit,
}) => {
  const t = translations[lang];

  const [oilKgInput, setOilKgInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const olivesNetKg = Number(reception.net_weight_kg) || 0;
  const oilKg = Math.max(0, Number(oilKgInput) || 0);
  const oilLitres = Math.round(oilKg * OIL_KG_TO_LITRES_FACTOR * 100) / 100;

  const yieldPercent = olivesNetKg > 0 ? (oilKg / olivesNetKg) * 100 : 0;
  const yieldLPer100Kg = olivesNetKg > 0 ? (oilLitres / olivesNetKg) * 100 : 0;
  const estimatedGrignonsKg = Math.round(olivesNetKg * 0.45);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (oilKg <= 0) {
      setErrorMsg("Veuillez saisir une quantité d'huile extraite valide en kilogrammes (> 0 KG).");
      return;
    }

    if (olivesNetKg <= 0) {
      setErrorMsg("Le poids net d'olives de la réception est invalide.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: ProductionBatchCreateInput = {
        reception_id: reception.id,
        reception_ticket: reception.ticket_number,
        party_id: reception.party_id,
        party_name: reception.party_name,
        party_code: reception.party_code,
        olives_net_kg: olivesNetKg,
        press_line: '',
        oil_input_unit: 'KG',
        oil_quantity_entered: oilKg,
        oil_density: OIL_KG_TO_LITRES_FACTOR,
        oil_quantity_kg: Math.round(oilKg * 100) / 100,
        oil_quantity_litres: oilLitres,
        yield_percentage: Math.round(yieldPercent * 100) / 100,
        yield_litres_per_100kg: Math.round(yieldLPer100Kg * 100) / 100,
        grignons_estimated_kg: estimatedGrignonsKg,
        milling_fee_rate: Number(reception.milling_fee_per_kg || 0),
        milling_fee_mode: 'ESPECES',
        milling_fee_total_tnd: Number(reception.total_milling_fee_tnd || 0),
        milling_fee_paid: reception.payment_status === 'PAYE',
        operator: currentOperator,
        status: 'EN_ATTENTE',
        started_at: new Date().toISOString(),
        is_confirmed: false,
        oil_destination: 'NON_DEFINI',
        notes: notes.trim() || null,
      };
      await onSubmit(payload);
    } catch (err: any) {
      setErrorMsg(err?.message || "Erreur lors de l'enregistrement du lot de trituration.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh] border border-stone-200">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Cog className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base">
                Saisie Trituration &amp; Rendement d&apos;Huile
              </h2>
              <span className="text-[11px] text-stone-400">
                {reception.ticket_number} · {reception.party_name} ({olivesNetKg.toLocaleString()} KG d&apos;olives)
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Fixed Conversion Rule Banner */}
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 flex items-start gap-2.5 text-xs text-stone-700">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="text-stone-900 block">Règle de conversion fixe : 1 KG = 1,1 Litre</strong>
              <span>
                L&apos;opérateur saisit uniquement le poids net d&apos;huile obtenu en kilogrammes (KG).
                Le volume en litres est calculé automatiquement (KG × 1,1).
              </span>
            </div>
          </div>

          {/* Saisie Quantité en KG uniquement */}
          <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold uppercase tracking-wider text-amber-950">
                Poids d&apos;Huile Extraite (KG) *
              </label>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-200/70 text-amber-950">
                Facteur fixe : × {OIL_KG_TO_LITRES_FACTOR} L/kg
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  autoFocus
                  value={oilKgInput}
                  onChange={(e) => setOilKgInput(e.target.value)}
                  placeholder="Ex: 200"
                  className="w-full p-3 pr-12 bg-white border border-amber-300 rounded-xl text-lg font-mono font-black text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-amber-700">
                  KG
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs min-w-[180px] text-right font-mono">
                <span className="text-[10px] text-stone-500 block uppercase font-sans font-bold">
                  Équivalent Volume (1 KG = 1,1 L)
                </span>
                <strong className="text-lg text-amber-950 block font-black">
                  {oilLitres.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                </strong>
              </div>
            </div>

            {/* Real-time Yield Display */}
            <div className="grid grid-cols-3 gap-3 pt-1 text-center">
              <div className="p-2.5 bg-white rounded-xl border border-amber-200">
                <span className="text-[10px] text-stone-500 block font-semibold">Rendement (%)</span>
                <span className="font-mono text-base font-black text-emerald-700">
                  {yieldPercent.toFixed(2)} %
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-amber-200">
                <span className="text-[10px] text-stone-500 block font-semibold">Litres / 100 KG</span>
                <span className="font-mono text-base font-black text-amber-900">
                  {yieldLPer100Kg.toFixed(2)} L
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-amber-200">
                <span className="text-[10px] text-stone-500 block font-semibold">Grignons estimés</span>
                <span className="font-mono text-base font-bold text-stone-800">
                  {estimatedGrignonsKg.toLocaleString()} KG
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Observations de trituration (optionnel)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Température pâte normale, lot homogène..."
              className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium"
            />
          </div>

          {/* Pending Confirmation & Storage Rule Notice */}
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-950">
            <Lock className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="block font-bold">Enregistrement en attente de confirmation :</strong>
              <p className="text-[11px] text-blue-900">
                Ce bon est enregistré avec le statut <strong>EN ATTENTE</strong>. Après vérification, un responsable doit cliquer sur <strong>Confirmer</strong> pour verrouiller définitivement la fiche. Aucune huile n&apos;est ajoutée automatiquement dans les cuves (dépôt explicite depuis l&apos;Historique Clients si demandé).
              </p>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-xl text-xs font-semibold cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-400 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Enregistrer la Trituration (EN ATTENTE)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
