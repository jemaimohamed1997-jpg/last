import React, { useState } from 'react';
import { X, Banknote, CheckCircle, AlertCircle, RefreshCw, Calendar } from 'lucide-react';
import { Employee, SalaryAdvance, SalaryPayment } from '../../types/production';

interface AdvanceModalProps {
  employees: Employee[];
  preselectedEmployeeId?: string;
  salaryAdvances: SalaryAdvance[];
  salaryPayments: SalaryPayment[];
  onClose: () => void;
  onSubmit: (params: {
    employeeId: string;
    amountTnd: number;
    advanceDate: string;
    paymentMode: 'ESPECES' | 'CHEQUE' | 'VIREMENT';
    notes?: string;
  }) => Promise<void>;
}

export const AdvanceModal: React.FC<AdvanceModalProps> = ({
  employees,
  preselectedEmployeeId,
  salaryAdvances,
  salaryPayments,
  onClose,
  onSubmit,
}) => {
  const activeEmployees = employees.filter((e) => e.is_active);
  const todayStr = new Date().toISOString().slice(0, 10);

  const [employeeId, setEmployeeId] = useState<string>(
    preselectedEmployeeId || activeEmployees[0]?.id || ''
  );
  const [advanceDate, setAdvanceDate] = useState<string>(todayStr);
  const [amountStr, setAmountStr] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'ESPECES' | 'CHEQUE' | 'VIREMENT'>('ESPECES');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedEmployee = activeEmployees.find((e) => e.id === employeeId);
  const periodMonth = (advanceDate || todayStr).slice(0, 7);

  const monthSettlement = salaryPayments.find(
    (p) => p.employee_id === employeeId && p.period_month === periodMonth
  );
  const existingAdvances = salaryAdvances
    .filter((a) => a.employee_id === employeeId && a.period_month === periodMonth)
    .reduce((sum, a) => sum + Number(a.amount_tnd || 0), 0);

  const baseSalary = Number(selectedEmployee?.base_salary_tnd || 0);
  const maxRemaining = Math.max(0, Math.round((baseSalary - existingAdvances) * 1000) / 1000);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!employeeId) {
      setErrorMsg('Veuillez sélectionner un employé actif.');
      return;
    }
    if (monthSettlement) {
      setErrorMsg(
        `Le salaire du mois ${periodMonth} est déjà soldé (${monthSettlement.doc_number}).`
      );
      return;
    }

    const parsedAmount = Number(amountStr);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg("Le montant de l'avance doit être strictement positif.");
      return;
    }
    if (parsedAmount > maxRemaining + 0.001) {
      setErrorMsg(
        `Avance trop élevée : plafond disponible pour ${periodMonth} = ${maxRemaining.toFixed(3)} TND.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        employeeId,
        amountTnd: Math.round(parsedAmount * 1000) / 1000,
        advanceDate: advanceDate || todayStr,
        paymentMode,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Erreur lors de l'enregistrement de l'avance.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-200">
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Banknote className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-extrabold text-sm">Accorder une Avance sur Salaire</h3>
              <span className="text-[11px] text-stone-400">
                Génère un bon horodaté BON-ADV déductible du mois
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

          <div>
            <label className="block font-bold text-stone-700 mb-1">Employé Bénéficiaire *</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-semibold"
            >
              {activeEmployees.length === 0 ? (
                <option value="">Aucun employé actif</option>
              ) : (
                activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.code}) · Base: {emp.base_salary_tnd.toFixed(3)} TND
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stone-500" />
                <span>Date de l&apos;Avance *</span>
              </label>
              <input
                type="date"
                required
                value={advanceDate}
                onChange={(e) => setAdvanceDate(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">Mode de Paiement</label>
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

          {selectedEmployee && (
            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-stone-600 font-sans">Période d&apos;imputation :</span>
                <strong className="text-stone-900">{periodMonth}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600 font-sans">Salaire de base :</span>
                <span className="font-bold">{baseSalary.toFixed(3)} TND</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600 font-sans">Avances déjà prises :</span>
                <span className="font-bold text-amber-800">{existingAdvances.toFixed(3)} TND</span>
              </div>
              <div className="flex justify-between border-t border-amber-200 pt-1.5">
                <span className="text-amber-950 font-sans font-bold">Plafond disponible :</span>
                <strong className="text-emerald-800">{maxRemaining.toFixed(3)} TND</strong>
              </div>
              {monthSettlement && (
                <div className="text-rose-700 font-sans font-bold pt-1">
                  ⚠ Paie de {periodMonth} déjà clôturée ({monthSettlement.doc_number}).
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block font-bold text-stone-700 mb-1">
              Montant de l&apos;Avance (TND) *
            </label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              max={maxRemaining > 0 ? maxRemaining : undefined}
              required
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="Ex: 200.000"
              className="w-full p-2.5 bg-white border border-amber-300 rounded-xl font-mono font-black text-base text-amber-950"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Motif / Remarque</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Acompte quinzaine..."
              className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
            />
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
              disabled={isSubmitting || Boolean(monthSettlement) || activeEmployees.length === 0}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-400 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
              <span>Valider &amp; Émettre BON-ADV</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
