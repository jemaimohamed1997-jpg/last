import React, { useState } from 'react';
import { X, ShoppingCart, Check, AlertCircle, Calendar, RefreshCw } from 'lucide-react';
import { PurchaseBatch } from '../../types/production';
import { TankStockDetail } from '../../types/stock';
import { Language } from '../../lib/i18n';

export type PurchaseCreateInput = Omit<
  PurchaseBatch,
  'id' | 'doc_number' | 'created_at' | 'updated_at'
>;

interface PurchaseModalProps {
  tanks: TankStockDetail[];
  currentOperator: string;
  lang: Language;
  onClose: () => void;
  onSubmit: (purchase: PurchaseCreateInput) => Promise<void>;
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  tanks,
  currentOperator,
  lang,
  onClose,
  onSubmit,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [purchaseDate, setPurchaseDate] = useState<string>(todayStr);
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [itemType, setItemType] = useState<'OLIVES' | 'HUILE_VRAC'>('OLIVES');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState<'ESPECES' | 'CHEQUE' | 'VIREMENT' | 'A_TERME'>(
    'ESPECES'
  );
  const [paymentStatus, setPaymentStatus] = useState<'PAYE' | 'IMPAYE'>('PAYE');
  const [destinationTankId, setDestinationTankId] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const numQty = typeof quantity === 'number' ? quantity : 0;
  const numPrice = typeof unitPrice === 'number' ? unitPrice : 0;
  const totalPriceTnd = Math.round(numQty * numPrice * 1000) / 1000;

  const activeTanks = tanks.filter((t) => t.tank.is_active && !t.tank.is_deleted);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!supplierName.trim()) {
      setErrorMsg('Veuillez saisir le nom du fournisseur / agriculteur.');
      return;
    }
    if (numQty <= 0) {
      setErrorMsg('Veuillez saisir une quantité valide (> 0).');
      return;
    }
    if (numPrice <= 0) {
      setErrorMsg('Veuillez saisir un prix unitaire valide (> 0).');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        date: purchaseDate || todayStr,
        supplier_name: supplierName.trim(),
        supplier_phone: supplierPhone.trim() || null,
        item_type: itemType,
        quantity: numQty,
        unit_price_tnd: numPrice,
        total_price_tnd: totalPriceTnd,
        payment_mode: paymentMode,
        payment_status: paymentStatus,
        operator: currentOperator,
        destination_tank_id:
          itemType === 'HUILE_VRAC' && destinationTankId ? destinationTankId : undefined,
        notes: notes.trim() || null,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || "Erreur lors de l'enregistrement de l'achat.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-stone-200 overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">
                {lang === 'ar'
                  ? 'تسجيل شراء جديد (زيتون / زيت)'
                  : 'Nouvel Achat Huilerie (BON-ACH)'}
              </h3>
              <p className="text-xs text-amber-300 font-medium">
                {lang === 'ar'
                  ? 'شراء لحساب المعصرة من الفلاحة والمزودين'
                  : 'Achat direct pour compte propre de l’huilerie'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Date d'achat */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-stone-500" />
              <span>Date d&apos;Achat *</span>
            </label>
            <input
              type="date"
              required
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs font-mono font-bold"
            />
          </div>

          {/* Supplier Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                {lang === 'ar' ? 'اسم المزود / الفلاح *' : 'Fournisseur / Agriculteur *'}
              </label>
              <input
                type="text"
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Ex: Hedi Jemai"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                {lang === 'ar' ? 'الهاتف' : 'Téléphone'}
              </label>
              <input
                type="tel"
                value={supplierPhone}
                onChange={(e) => setSupplierPhone(e.target.value)}
                placeholder="+216 ..."
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Type of Item */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={itemType === 'OLIVES' ? 'sm:col-span-2' : ''}>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                {lang === 'ar' ? 'نوع المشتريات *' : 'Type de Produit Acheté *'}
              </label>
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value as 'OLIVES' | 'HUILE_VRAC')}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="OLIVES">Olives en Vrac (KG)</option>
                <option value="HUILE_VRAC">Huile d’Olive en Vrac (Litres)</option>
              </select>
            </div>

            {itemType === 'HUILE_VRAC' && (
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {lang === 'ar' ? 'حوض التخزين (اختياري)' : 'Cuve de dépôt (optionnel)'}
                </label>
                <select
                  value={destinationTankId}
                  onChange={(e) => setDestinationTankId(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Sélectionner une cuve disponible...</option>
                  {activeTanks.map((t) => (
                    <option key={t.tank.id} value={t.tank.id}>
                      {t.tank.name} ({t.tank.code}) - Libre: {t.remaining_capacity} L
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Quantity & Unit Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
            <div>
              <label className="block text-xs font-bold text-amber-950 mb-1">
                {lang === 'ar'
                  ? `الكمية (${itemType === 'OLIVES' ? 'كلغ' : 'لتر'}) *`
                  : `Quantité (${itemType === 'OLIVES' ? 'KG' : 'Litres'}) *`}
              </label>
              <input
                type="number"
                step="any"
                min="0.1"
                required
                value={quantity}
                onChange={(e) =>
                  setQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))
                }
                placeholder={itemType === 'OLIVES' ? 'Ex: 1500' : 'Ex: 300'}
                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-amber-950 mb-1">
                {lang === 'ar' ? 'سعر الوحدة (دينار) *' : 'Prix Unitaire (TND) *'}
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                required
                value={unitPrice}
                onChange={(e) =>
                  setUnitPrice(e.target.value === '' ? '' : parseFloat(e.target.value))
                }
                placeholder={itemType === 'OLIVES' ? 'Ex: 2.200' : 'Ex: 14.500'}
                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Total Display */}
            <div className="sm:col-span-2 pt-2 border-t border-amber-200/80 flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900">
                {lang === 'ar' ? 'المبلغ الإجمالي المستحق :' : 'Montant Total d’Achat :'}
              </span>
              <span className="text-base font-black text-amber-950 font-mono">
                {totalPriceTnd.toFixed(3)} TND
              </span>
            </div>
          </div>

          {/* Payment & Settlement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                {lang === 'ar' ? 'طريقة الدفع' : 'Mode de Paiement'}
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as any)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="ESPECES">Espèces (نقدا)</option>
                <option value="CHEQUE">Chèque (شيك)</option>
                <option value="VIREMENT">Virement bancaire</option>
                <option value="A_TERME">À terme / Crédit (مؤجل)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                {lang === 'ar' ? 'حالة الخلاص' : 'Statut du Règlement'}
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="PAYE">Payé immédiatement (خالص)</option>
                <option value="IMPAYE">Impayé / En attente (غير خالص)</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              {lang === 'ar' ? 'ملاحظات' : 'Observations & Références'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Achat récolte..."
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Operator Signature Tag */}
          <div className="text-[11px] text-stone-500 flex items-center justify-between pt-2 border-t border-stone-200">
            <span>
              Opérateur responsable : <strong className="text-stone-700">{currentOperator}</strong>
            </span>
            <span>Émission instantanée du bon officiel</span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 border border-stone-300 rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-100 transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-400 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Valider l&apos;Achat &amp; Émettre le Bon</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
