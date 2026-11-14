import React, { useState } from 'react';
import { X, Wallet, CheckCircle, AlertCircle, RefreshCw, Calendar, Lock } from 'lucide-react';
import { Employee, SalaryAdvance, SalaryPayment } from '../../types/production';

interface PayrollSettlementModalProps {
  employee: Employee;
  periodMonth: string;
  monthAdvances: SalaryAdvance[];
  previousSettlements: SalaryPayment[];
  onClose: () => void;
  onSubmit: (params: {
    employeeId: string;
    periodMonth: string;
    paymentDate: string;
    paymentMode: 'ESPECES' | 'CHEQUE' | 'VIREMENT';
    notes?: string;
  }) => Promise<void>;
}

export const PayrollSettlementModal: React.FC<PayrollSettlementModalProps> = ({
  employee,
  periodMonth,
  monthAdvances,
  previousSettlements,
  onClose,
  onSubmit,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [paymentMode, setPaymentMode] = useState<'ESPECES' | 'CHEQUE' | 'VIREMENT'>('ESPECES');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const baseSalary = Number(employee.base_salary_tnd || 0);
  const totalAdvances = monthAdvances.reduce((sum, a) => sum + Number(a.amount_tnd || 0), 0);
  const previousPaid = previousSettlements.reduce(
    (sum, p) => sum + Number(p.net_paid_tnd || 0),
    0
  );
  const netToPay = Math.max(
    0,
    Math.round((baseSalary - totalAdvances - previousPaid) * 1000) / 1000
  );

  const alreadySettled = previousSettlements.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (alreadySettled) {
      setErrorMsg(`Ce mois (${periodMonth}) est déjà soldé pour ${employee.full_name}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        employeeId: employee.id,
        periodMonth,
        paymentDate: paymentDate || todayStr,
        paymentMode,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la clôture du salaire.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-200">
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-extrabold text-sm">Règlement &amp; Clôture de Paie</h3>
              <span className="text-[11px] text-stone-400">
                {employee.full_name} ({employee.code}) · Mois {periodMonth}
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Live Pay Breakdown */}
          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2 font-mono">
            <div className="flex justify-between">
              <span className="font-sans text-stone-600">Salaire de Base Mensuel :</span>
              <span className="font-bold text-stone-900">{baseSalary.toFixed(3)} TND</span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans text-stone-600">
                Avances déduites ({monthAdvances.length} bon(s)) :
              </span>
              <span className="font-bold text-amber-800">-{totalAdvances.toFixed(3)} TND</span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans text-stone-600">Paiements précédents ({periodMonth}) :</span>
              <span className="font-bold text-stone-700">-{previousPaid.toFixed(3)} TND</span>
            </div>
            <div className="flex justify-between border-t border-stone-300 pt-2 text-sm">
              <span className="font-sans font-extrabold text-emerald-950">Net à Payer :</span>
              <span className="font-black text-emerald-800 text-lg">{netToPay.toFixed(3)} TND</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stone-500" />
                <span>Date de Règlement *</span>
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">Mode de Règlement</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as any)}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-semibold"
              >
                <option value="ESPECES">Espèces</option>
                <option value="CHEQUE">Chèque</option>
                <option value="VIREMENT">Virement</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={`Solde de paie ${periodMonth}`}
              className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
            />
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-[11px] text-emerald-900">
            <Lock className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <span>
              Règlement mensuel unique : cette opération génère un <strong>BON-PAY</strong> définitif, marque les avances du mois comme soldées et s&apos;impute automatiquement en sortie de caisse.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 border border-stone-300 rounded-xl font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || alreadySettled}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:bg-stone-400 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
              <span>Confirmer le Règlement ({netToPay.toFixed(3)} TND)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
