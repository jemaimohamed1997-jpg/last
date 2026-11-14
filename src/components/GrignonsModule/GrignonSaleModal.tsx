import React, { useState } from 'react';
import { X, CheckCircle, Truck, Calendar, AlertCircle, RefreshCw } from 'lucide-react';
import { GrignonSale, GrignonPaymentMode, GrignonPriceUnit } from '../../types/production';
import { translations, Language } from '../../lib/i18n';

export type GrignonSaleCreateInput = Omit<
  GrignonSale,
  'id' | 'doc_number' | 'created_at' | 'updated_at'
>;

interface GrignonSaleModalProps {
  currentOperator: string;
  lang: Language;
  onClose: () => void;
  onSubmit: (sale: GrignonSaleCreateInput) => Promise<void>;
}

export const GrignonSaleModal: React.FC<GrignonSaleModalProps> = ({
  currentOperator,
  lang,
  onClose,
  onSubmit,
}) => {
  const t = translations[lang];
  const todayStr = new Date().toISOString().slice(0, 10);

  const [saleDate, setSaleDate] = useState<string>(todayStr);
  const [buyerName, setBuyerName] = useState<string>('');
  const [truckPlate, setTruckPlate] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');

  const [grossWeight, setGrossWeight] = useState<number>(24500);
  const [tareWeight, setTareWeight] = useState<number>(9500);
  const [priceUnit, setPriceUnit] = useState<GrignonPriceUnit>('TONNE');
  const [unitPrice, setUnitPrice] = useState<number>(180);
  const [paymentMode, setPaymentMode] = useState<GrignonPaymentMode>('ESPECES');
  const [paymentStatus, setPaymentStatus] = useState<'PAYE' | 'IMPAYE'>('PAYE');
  const [notes, setNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Calculations
  const netWeightKg = Math.max(0, Number(grossWeight) - Number(tareWeight));
  const netWeightTonnes = Math.round((netWeightKg / 1000) * 1000) / 1000;

  const totalPriceTnd =
    priceUnit === 'KG'
      ? Math.round(netWeightKg * Number(unitPrice) * 1000) / 1000
      : Math.round(netWeightTonnes * Number(unitPrice) * 1000) / 1000;

  const normalizedPerTonne =
    priceUnit === 'KG'
      ? Math.round(Number(unitPrice) * 1000 * 1000) / 1000
      : Math.round(Number(unitPrice) * 1000) / 1000;

  const handlePriceUnitSwitch = (nextUnit: GrignonPriceUnit) => {
    if (nextUnit === priceUnit) return;
    if (nextUnit === 'KG') {
      setUnitPrice(Math.round((Number(unitPrice) / 1000) * 1000) / 1000);
    } else {
      setUnitPrice(Math.round(Number(unitPrice) * 1000 * 1000) / 1000);
    }
    setPriceUnit(nextUnit);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!buyerName.trim()) {
      setErrorMsg("Veuillez saisir le nom de l'acheteur ou de l'usine d'extraction.");
      return;
    }
    if (!truckPlate.trim()) {
      setErrorMsg('Veuillez saisir le matricule du camion.');
      return;
    }
    if (netWeightKg <= 0) {
      setErrorMsg('Le poids net de grignons doit être strictement supérieur à zéro.');
      return;
    }
    if (Number(unitPrice) <= 0) {
      setErrorMsg('Le prix unitaire doit être strictement supérieur à zéro.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        date: saleDate || todayStr,
        buyer_name: buyerName.trim(),
        truck_plate: truckPlate.trim().toUpperCase(),
        driver_name: driverName.trim() || null,
        gross_weight_kg: Number(grossWeight),
        tare_weight_kg: Number(tareWeight),
        net_weight_kg: Number(netWeightKg),
        net_weight_tonnes: Number(netWeightTonnes),
        price_unit: priceUnit,
        unit_price_per_tonne_tnd: normalizedPerTonne,
        unit_price_tnd: Number(unitPrice),
        total_price_tnd: Number(totalPriceTnd),
        payment_mode: paymentMode,
        payment_status: paymentStatus,
        operator: currentOperator,
        notes: notes.trim() || null,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la création de la vente de grignons.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh] border border-stone-200">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-bold text-base">
                Nouveau Bon de Vente des Grignons (فيتورة)
              </h2>
              <span className="text-[11px] text-stone-400">
                Vente directe par camion · Tarification par Tonne ou par Kilogramme
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white cursor-pointer"
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

          {/* Date de vente */}
          <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200">
            <label className="block text-xs font-bold text-amber-950 mb-1 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-700" />
              <span>Date de la Vente *</span>
            </label>
            <input
              type="date"
              required
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="w-full p-2.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Buyer & Truck */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Acheteur / Usine d&apos;extraction *
              </label>
              <input
                type="text"
                required
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Ex: Usine d'Huile & Grignons..."
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Matricule Camion *
              </label>
              <input
                type="text"
                required
                value={truckPlate}
                onChange={(e) => setTruckPlate(e.target.value)}
                placeholder="Ex: 145 TU 8900"
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-mono font-bold uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Nom du Chauffeur (optionnel)
            </label>
            <input
              type="text"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="Ex: Habib Mansour"
              className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg text-xs"
            />
          </div>

          {/* Weighing Section */}
          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800">
              Pesée du Camion (Bascule Pont)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  Poids Brut (KG) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={grossWeight}
                  onChange={(e) => setGrossWeight(Number(e.target.value))}
                  required
                  className="w-full p-2 bg-white border border-stone-300 rounded text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  Tare (KG) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={tareWeight}
                  onChange={(e) => setTareWeight(Number(e.target.value))}
                  required
                  className="w-full p-2 bg-white border border-stone-300 rounded text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-800 mb-1">
                  Poids Net de Grignons
                </label>
                <div className="p-2 bg-amber-50 border border-amber-300 rounded text-xs font-mono font-black text-amber-950 text-center">
                  {netWeightTonnes.toFixed(3)} T ({netWeightKg.toLocaleString()} KG)
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Unit Toggle & Payment */}
          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-stone-800">
                Tarification *
              </label>
              <div className="inline-flex bg-stone-200 p-0.5 rounded-lg border border-stone-300">
                <button
                  type="button"
                  onClick={() => handlePriceUnitSwitch('TONNE')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                    priceUnit === 'TONNE'
                      ? 'bg-stone-900 text-white shadow-2xs'
                      : 'text-stone-700 hover:text-stone-900'
                  }`}
                >
                  Prix par Tonne (TND/T)
                </button>
                <button
                  type="button"
                  onClick={() => handlePriceUnitSwitch('KG')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                    priceUnit === 'KG'
                      ? 'bg-stone-900 text-white shadow-2xs'
                      : 'text-stone-700 hover:text-stone-900'
                  }`}
                >
                  Prix par KG (TND/KG)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {priceUnit === 'KG' ? 'Prix unitaire (TND / KG)' : 'Prix unitaire (TND / Tonne)'}
                </label>
                <input
                  type="number"
                  min="0.001"
                  step={priceUnit === 'KG' ? '0.001' : '0.5'}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  required
                  className="w-full p-2 bg-white border border-stone-300 rounded text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Mode de Paiement
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as GrignonPaymentMode)}
                  className="w-full p-2 bg-white border border-stone-300 rounded text-xs font-medium"
                >
                  <option value="ESPECES">Espèces (نقدا)</option>
                  <option value="CHEQUE">Chèque (شيك)</option>
                  <option value="VIREMENT">Virement bancaire (تحويل)</option>
                  <option value="A_TERME">À terme / Crédit (مؤجل)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Statut Règlement
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as 'PAYE' | 'IMPAYE')}
                  className="w-full p-2 bg-white border border-stone-300 rounded text-xs font-medium"
                >
                  <option value="PAYE">Payé (خالص)</option>
                  <option value="IMPAYE">Non Payé / Crédit (غير خالص)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Total Banner */}
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-300 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-amber-950 uppercase tracking-wide block">
                Montant Total de la Vente :
              </span>
              <span className="text-[11px] font-mono text-amber-800">
                {priceUnit === 'KG'
                  ? `${netWeightKg.toLocaleString()} KG × ${Number(unitPrice).toFixed(3)} TND/kg`
                  : `${netWeightTonnes.toFixed(3)} T × ${Number(unitPrice).toFixed(3)} TND/T`}
              </span>
            </div>
            <span className="font-mono text-xl font-black text-amber-950">
              {totalPriceTnd.toFixed(3)} TND
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Remarques
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Chargement du matin..."
              className="w-full p-2 bg-stone-50 border border-stone-300 rounded text-xs"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-lg text-xs font-semibold cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-400 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-2xs cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Valider &amp; Émettre le Bon de Vente</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
